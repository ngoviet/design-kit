// Các phép đo thêm đợt hai (24/11/2026) đã được nối vào lệnh `check`: mỗi mô-đun có test riêng cho luật của nó (check-stress,
// check-keyboard, check-css, report); tệp này chỉ kiểm đường dây: gọi đúng lúc, đúng mã, mềm, và không làm hỏng phép đo khác.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";

const root = join(__dirname, "..");
async function run(argv: string[], cwd = root): Promise<{ out: string; code: number | undefined }> {
  let out = "";
  const prev = process.exitCode;
  process.exitCode = undefined;
  await main({ argv, stdout: { write: (c: string) => (out += c) }, runtime: { env: process.env, home: "", cwd } });
  const code = process.exitCode as number | undefined;
  process.exitCode = prev;
  return { out, code };
}
const BASE = ["--no-impeccable", "--no-shots", "--no-standalone", "--no-copy", "--no-cache", "--schemes", "light", "--full"];
const check = async (page: string, ...extra: string[]): Promise<string> => (await run(["check", `test/fixtures/${page}.html`, ...BASE, ...extra])).out;
const rows = (out: string, id: string): string[] => out.split("\n").filter((l) => new RegExp(`^\\s+(hard|soft),${id},`).test(l));

describe("wired into check, always soft", () => {
  it.each([
    ["stress", "keo-dai-sai", ["--viewports", "390,1280"]],
    ["contrast-px", "tuong-phan-anh-sai", ["--viewports", "1280"]],
    ["keyboard", "ban-phim-sai", ["--viewports", "1280"]],
    ["tab-trap", "ban-phim-bay-sai", ["--viewports", "1280"]],
    ["skip-link", "ban-phim-bo-qua-sai", ["--viewports", "1280"]],
    ["css", "doc-css-sai", ["--viewports", "390,1280"]],
  ] as Array<[string, string, string[]]>)("%s reports %s.html", async (id, page, extra) => {
    const out = await check(page, ...extra);
    expect(rows(out, id).length).toBeGreaterThan(0);
    expect(rows(out, id).every((l) => /^\s+soft,/.test(l))).toBe(true);
  }, 120_000);

  it.each([
    ["stress", "keo-dai-dung", ["--viewports", "390,1280"]],
    ["contrast-px", "tuong-phan-anh-dung", ["--viewports", "1280"]],
    ["keyboard", "ban-phim-dung", ["--viewports", "1280"]],
    ["tab-trap", "ban-phim-bay-dung", ["--viewports", "1280"]],
    ["skip-link", "ban-phim-bo-qua-dung", ["--viewports", "1280"]],
    ["css", "doc-css-dung", ["--viewports", "390,1280"]],
  ] as Array<[string, string, string[]]>)("%s leaves %s.html", async (id, page, extra) => {
    expect(await check(page, ...extra)).toContain(`${id},soft,ok`);
  }, 120_000);

  it("--fresh runs the same checks at the end of the wide and narrow loads", async () => {
    expect(rows(await check("keo-dai-sai", "--viewports", "390,1280", "--fresh"), "stress").length).toBeGreaterThan(0);
    expect(rows(await check("ban-phim-bo-qua-sai", "--viewports", "1280", "--fresh"), "skip-link").length).toBeGreaterThan(0);
  }, 120_000);

  it("--sweep adds the two widths beside the page's own breakpoints, and finds what breaks only there", async () => {
    const out = await check("diem-gay-sai", "--viewports", "390,1280", "--sweep");
    expect(out).toMatch(/swept \d+ more widths beside the page's own breakpoints/);
    expect(rows(out, "overflow").join("\n")).toMatch(/hard,overflow,\d+px/);
    const ok = await check("diem-gay-dung", "--viewports", "390,1280", "--sweep");
    expect(ok).toContain("overflow,hard,ok");
  }, 120_000);
});

describe("focus: an indicator drawn with border or background counts (q5)", () => {
  const page = (css: string): string => {
    const d = join(root, ".design-kit", "test", "vong-2");
    mkdirSync(d, { recursive: true });
    const n = `${css.length}-${css.replace(/\W+/g, "").slice(0, 20)}`;
    writeFileSync(join(d, `${n}.html`), `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vòng</title><style>body{font:1rem/1.6 system-ui;background:#fff;color:#111}button{min-height:44px;font:inherit;border:2px solid #777;background:#fff;color:#111;border-radius:4px}button:focus{outline:none;${css}}</style></head><body><main><h1>Vòng focus</h1><button id="a">Nút một</button><button id="b">Nút hai</button></main></body></html>`);
    return `.design-kit/test/vong-2/${n}.html`;
  };
  it("a strong border or background change is seen, nothing at all is reported", async () => {
    for (const css of ["border-color:#000;", "background:#111;color:#fff;"]) expect((await run(["check", page(css), ...BASE, "--viewports", "390"])).out).toContain("focus,soft,ok");
    expect(rows((await run(["check", page(""), ...BASE, "--viewports", "390"])).out, "focus").join("\n")).toContain("nothing else about it changes");
  }, 120_000);
});

describe("ids, comparison with the last run, recheck, numbered screenshots (K9)", () => {
  const d = join(root, ".design-kit", "test", "k9");
  const page = (h: string): void => {
    writeFileSync(join(d, "a.html"), `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>K9</title><style>body{font:1rem/1.6 system-ui;background:#fff;color:#111}</style></head><body><main><h1>Trang thử</h1>${h}</main></body></html>`);
  };
  const SMALL = '<p id="nho" style="font-size:10px">Chữ nhỏ quá mức cho phép</p>';
  const GREY = '<p id="mo" style="color:#bbb">Chữ mờ khó đọc trên nền trắng</p>';
  const args = ["check", "a.html", "--no-impeccable", "--no-standalone", "--no-copy", "--no-cache", "--schemes", "light", "--viewports", "390", "--full"];
  const idOf = (out: string, check: string): string => /,([0-9a-hjkmnp-tv-z]{6}),light\/390/.exec(rows(out, check)[0] ?? "")?.[1] ?? "";

  it("says what was fixed and what is new, rechecks by id, refuses unknown ids, and numbers the findings on a screenshot", async () => {
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
    page(SMALL + GREY);
    const first = await run(args, d);
    expect(first.out).not.toContain("since_last");
    const small = idOf(first.out, "text-min");
    const grey = idOf(first.out, "axe");
    expect(small).toMatch(/^[0-9a-z]{6}$/);
    expect(grey).toMatch(/^[0-9a-z]{6}$/);
    expect(readdirSync(join(d, ".design-kit", "shots", "a"))).toContain("marked-light-390.png");
    expect(first.out).toMatch(/marked-light-390\.png: 1 [0-9a-z]{6}/);

    // Sửa chữ nhỏ, để nguyên chữ mờ: đo lại theo mã.
    page(GREY);
    const re = await run([...args, "--recheck", `${small},${grey}`], d);
    expect(re.out).toMatch(new RegExp(`${small},fixed,a\\.html,text-min`));
    expect(re.out).toMatch(new RegExp(`${grey},still there,a\\.html,axe`));
    // Lượt đo lại không ghi đè lượt trước: lượt đủ sau đó vẫn thấy phần đã sửa.
    const second = await run(args, d);
    expect(second.out).toMatch(/since_last: "?2 fixed, 0 new, \d+ same on 1 page\(s\)/); // text-min và text-zoom của cùng dòng chữ
    expect(second.out).toContain(small);
    // Thêm lỗi mới.
    page(GREY + SMALL);
    expect((await run(args, d)).out).toMatch(/since_last: "?0 fixed, 2 new/);
    // Đổi bộ khổ thì không so, và nói vì sao.
    const other = [...args];
    other[other.indexOf("390")] = "1280";
    expect((await run(other, d)).out).toMatch(/since_last: "?not compared: sizes differ/);

    const unknown = await run([...args, "--recheck", "zzzzzz"], d);
    expect(unknown.out).toContain("not in the last run: zzzzzz");
    expect(unknown.code).toBe(2);
    rmSync(join(d, ".design-kit", "runs"), { recursive: true, force: true });
    const none = await run([...args, "--recheck", small], d);
    expect(none.out).toContain("no earlier run");
    expect(none.code).toBe(2);
    expect(existsSync(join(d, ".design-kit", "runs"))).toBe(false);
  }, 180_000);
});
