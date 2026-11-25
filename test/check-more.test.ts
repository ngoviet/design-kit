// Các phép đo thêm đợt hai (24/11/2026) đã được nối vào lệnh `check`: mỗi mô-đun có test riêng cho luật của nó (check-stress,
// check-keyboard, check-css, report); tệp này chỉ kiểm đường dây: gọi đúng lúc, đúng mã, mềm, và không làm hỏng phép đo khác.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AROUND_CAP, probeBreakpoints, sweepAround } from "../src/breakpoints.js";
import { launchBrowser } from "../src/browser.js";
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
// Một trang: cột check đứng thứ hai; nhiều trang hay trạng thái: có thêm cột page ở giữa. Bảng checks không bắt đầu bằng hard/soft.
const rows = (out: string, id: string): string[] => out.split("\n").filter((l) => new RegExp(`^\\s+(hard|soft),(?:[^,]*\\.html[^,]*,)?${id},`).test(l));

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
    // Sổ shadow root đóng (installVitals) có tới được phép đo Tab.
    ["tab-trap", "ban-phim-bay-dong", ["--viewports", "1280"]],
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

  it("offline: a worker registered late is measured, one still installing is said to be not measured", async () => {
    const trang = (q: string): Promise<string> => check("may-nguoi-dung-ngoai-tuyen-muon", "--viewports", "390,1280", "--query", q);
    expect(rows(await trang("tre=700"), "offline").join("\n")).toMatch(/reloading with no network fails/);
    const cham = await trang("sw=may-nguoi-dung-sw-cham.js");
    expect(cham).toMatch(/offline: not measured \(its service worker is still installing after 3 s/);
    expect(rows(cham, "offline")).toEqual([]);
  }, 120_000);
});

describe("sweep: breakpoints", () => {
  it("never measures only one side of a breakpoint because the cap ran out", () => {
    // 1280 đã đo một bên, nên còn một chỗ lẻ ở cuối.
    const bps = [1280, ...Array.from({ length: 13 }, (_, i) => 400 + i * 50)];
    const got = sweepAround(bps, 320, 2560, [320, 390, 1280]);
    for (const b of bps.slice(1)) expect(got.includes(b - 1), String(b)).toBe(got.includes(b));
    expect(got).toEqual([...Array.from({ length: 11 }, (_, i) => 400 + i * 50).flatMap((b) => [b - 1, b]), 1279]);
    // Chỗ lẻ còn lại dành cho mốc chỉ cần một bề rộng.
    const le = sweepAround([...bps, 2561], 320, 2560, [320, 390, 1280]);
    expect(le).toHaveLength(AROUND_CAP);
    expect(le).toContain(2560);
  });
  it("an exact width in @media is a breakpoint on both its sides", async () => {
    const { browser } = await launchBrowser(process.env);
    try {
      const p = await browser.newPage();
      await p.setContent("<style>@media (width: 700px){p{color:#222}}@media (device-width: 333px){p{color:#222}}@media (min-device-width: 334px){p{color:#222}}</style><p>Chữ</p>");
      const got = await p.evaluate(probeBreakpoints);
      expect(got).toEqual([700, 701]);
      expect(sweepAround(got, 320, 1280, [])).toEqual([699, 700, 701]);
    } finally {
      await browser.close();
    }
  });
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

describe("wired into check: states, modes, service worker", () => {
  const S = (o: unknown): string => JSON.stringify(o);
  it("dialog-focus and aria-state run in states after steps, also with --fresh", async () => {
    const steps = S([{ name: "hop", do: [{ click: "#mo-ngoai" }] }, { name: "kin", do: [{ click: "#mo-kin" }] }]);
    for (const extra of [[], ["--fresh"]]) {
      const out = await check("ban-phim-hop-sai", "--viewports", "1280", "--steps", steps, ...extra);
      expect(rows(out, "dialog-focus").join("\n")).toMatch(/#hop,dialog-focus,/);
      expect(rows(out, "dialog-focus").join("\n")).toMatch(/#kin,dialog-focus,.*Esc/);
      expect(rows(out, "dialog-focus").length).toBeGreaterThan(1);
    }
    const ok = await check("ban-phim-hop-dung", "--viewports", "1280");
    expect(ok).toContain('dialog-focus,soft,"none: no steps file"');
    const aria = await check("may-nguoi-dung-aria-sai", "--viewports", "1280", "--steps", S([{ name: "quen", do: [{ click: "#quen" }] }]));
    expect(rows(aria, "aria-state").join("\n")).toMatch(/aria-expanded/);
  }, 180_000);
  it("forced-colors, contrast-more and offline run on the initial state", async () => {
    expect(rows(await check("may-nguoi-dung-ep-mau-sai", "--viewports", "1280"), "forced-colors").length).toBeGreaterThan(0);
    expect(rows(await check("may-nguoi-dung-tuong-phan-sai", "--viewports", "1280"), "contrast-more").length).toBeGreaterThan(0);
    expect(rows(await check("may-nguoi-dung-ngoai-tuyen-sai", "--viewports", "1280"), "offline").length).toBeGreaterThan(0);
    for (const [id, p] of [["forced-colors", "ep-mau"], ["contrast-more", "tuong-phan"], ["offline", "ngoai-tuyen"]] as const) expect(await check(`may-nguoi-dung-${p}-dung`, "--viewports", "1280")).toContain(`${id},soft,ok`);
  }, 180_000);
  it("stress runs at the narrow width too", async () => {
    expect(rows(await check("keo-dai-sai", "--viewports", "390,1280"), "stress").some((l) => /light\/390/.test(l))).toBe(true);
  }, 120_000);
  it("a page with a service worker is never cached: fixing the worker is seen on the next run", async () => {
    const d = join(root, ".design-kit", "test", "sw");
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "package.json"), "{}");
    writeFileSync(join(d, "a.html"), '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SW</title><style>body{font:1rem/1.6 system-ui;background:#fff;color:#111}</style></head><body><main><h1>Trang có worker</h1><p>Nội dung của trang.</p></main><script>navigator.serviceWorker.register("sw.js")</script></body></html>');
    writeFileSync(join(d, "sw.js"), "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));");
    const a = ["check", "a.html", "--no-impeccable", "--no-shots", "--no-standalone", "--no-copy", "--schemes", "light", "--viewports", "1280", "--full"];
    expect(rows((await run(a, d)).out, "offline").length).toBeGreaterThan(0);
    const again = await run(a, d);
    expect(again.out).not.toContain("unchanged since their last check");
  }, 120_000);
});

describe("ids, comparison and recheck: never say fixed without measuring again", () => {
  const d = join(root, ".design-kit", "test", "k9b");
  const html = (head: string, body: string): string => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>K9</title><style>body{font:1rem/1.6 system-ui;background:#fff;color:#111;margin:0}${head}</style></head><body><main><h1>Trang thử</h1>${body}</main></body></html>`;
  const put = (name: string, head: string, body: string): void => writeFileSync(join(d, name), html(head, body));
  const fresh = (): void => {
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "package.json"), "{}");
  };
  const A = (pages: string[], ...extra: string[]): string[] => ["check", ...pages, "--no-impeccable", "--no-standalone", "--no-shots", "--no-cache", "--full", ...extra];
  const ids = (out: string, check: string): string[] => rows(out, check).map((l) => /,([0-9a-hjkmnp-tv-z]{6}),(?:light|dark|mobile|touch)\/\d+/.exec(l)?.[1] ?? "");

  it("two axe findings on different elements get different ids", async () => {
    fresh();
    put("a.html", ".mo{color:#bbb}", '<p id="doan-1" class="mo">Đoạn một mờ khó đọc</p><p id="doan-2" class="mo">Đoạn hai mờ khó đọc</p>');
    const out = (await run(A(["a.html"], "--no-copy", "--viewports", "390", "--schemes", "light"), d)).out;
    expect(new Set(ids(out, "axe")).size).toBe(2);
  }, 60_000);

  it("recheck measures only the page and sizes of the finding, and falls back to the schemes of the last run", async () => {
    fresh();
    put("a.html", "@media(max-width:600px){#nho{font-size:10px}} #mo{color:#bbb} @media(prefers-color-scheme:dark){#mo{color:#111}}", '<p id="nho">Chữ nhỏ ở khổ hẹp</p><p id="mo">Chữ mờ ở bản sáng</p>');
    put("b.html", "", "<p>Trang thứ hai không có lỗi.</p>");
    const args = A(["a.html", "b.html"], "--no-copy", "--viewports", "390,1280");
    const first = (await run(args, d)).out;
    const small = ids(first, "text-min")[0]!;
    expect(small).toMatch(/^[0-9a-z]{6}$/);
    const re = (await run([...args, "--recheck", small], d)).out;
    expect(re).toMatch(new RegExp(`${small},still there,a\\.html`));
    expect(re).toMatch(/renders: "?light\+dark × 390 px/);
    expect(re).toMatch(/pages\[1\]/);
    const grey = ids(first, "axe")[0]!;
    expect(rows(first, "axe").join("\n")).not.toContain("dark/");
    expect((await run([...args, "--schemes", "dark", "--recheck", grey], d)).out).toMatch(new RegExp(`${grey},still there`));
    // Cờ khác lượt trước (ít điểm dừng Tab hơn, ngưỡng chạm khác) thì từ chối, không nói "fixed".
    for (const other of [["--focus", "3"], ["--touch", "24"], ["--fresh"]]) {
      const no = await run([...args, ...other, "--recheck", small], d);
      expect(no.code, other.join(" ")).toBe(2);
      expect(no.out).toMatch(/last run used other flags/);
    }
  }, 180_000);

  it("recheck of a swept size sweeps again; a run without --sweep is not compared with one that had it", async () => {
    fresh();
    put("a.html", "@media(min-width:700px) and (max-width:800px){#rong{width:900px}} @media(min-width:905px) and (max-width:906px){#rong{width:1100px}}", '<div id="rong">Khối rộng ở khổ giữa</div>');
    const args = A(["a.html"], "--no-copy", "--viewports", "390,1280", "--schemes", "light");
    const first = (await run([...args, "--sweep"], d)).out;
    const wide = ids(first, "overflow");
    expect(wide.length).toBeGreaterThan(0);
    const re = (await run([...args, "--recheck", wide[0]!], d)).out;
    expect(re).toMatch(new RegExp(`${wide[0]},still there`));
    // Dải 905–906: không khổ định sẵn nào trúng, chỉ khổ sát điểm gãy của trang; đo lại ở khổ rộng nhất vẫn phải quét từ khổ hẹp nhất.
    const band = rows(first, "overflow").filter((l) => /overflow,90[56]px/.test(l)).map((l) => /,([0-9a-z]{6}),light/.exec(l)?.[1])[0]!;
    expect(band).toMatch(/^[0-9a-z]{6}$/);
    expect((await run([...args, "--recheck", band], d)).out).toMatch(new RegExp(`${band},still there`));
    expect((await run(args, d)).out).toMatch(/since_last: "?not compared: options differ/);
    expect((await run([...args, "--focus", "0"], d)).out).toMatch(/not compared: options differ/);
  }, 180_000);

  it("a check switched off, or a state that can no longer be reached, is not a fix", async () => {
    fresh();
    put("a.html", "", "<p>Chắc chắn rồi! Dưới đây là nội dung của trang.</p><button id=\"mo\" style=\"min-height:44px\" onclick=\"document.getElementById('x').hidden=false\">Mở</button><p id=\"x\" hidden style=\"font-size:9px\">Chữ nhỏ sau khi bấm</p>");
    const steps = JSON.stringify([{ name: "mo", do: [{ click: "#mo" }] }]);
    const args = A(["a.html"], "--viewports", "390", "--schemes", "light", "--steps", steps);
    const first = (await run(args, d)).out;
    const tiny = ids(first, "text-min")[0]!;
    expect(tiny).toBeTruthy();
    const words = ids(first, "copy")[0]!;
    expect(words).toBeTruthy();
    const off = await run([...args, "--no-copy", "--recheck", `${words},${tiny}`], d);
    expect(off.out).toMatch(new RegExp(`${words},not measured`));
    expect(off.out).toMatch(new RegExp(`${tiny},still there`));
    const noState = await run([...args.slice(0, args.indexOf("--steps")), "--recheck", `${words},${tiny}`], d);
    expect(noState.out).toMatch(new RegExp(`${words},still there`));
    expect(noState.out).toMatch(new RegExp(`${tiny},not measured`));
    expect((await run([...args, "--no-copy"], d)).out).toMatch(/since_last: "?0 fixed, 0 new/);
    await run(args, d);
    put("a.html", "", "<p>Trang đã đổi.</p><button id=\"khac\" style=\"min-height:44px\">Mở</button>");
    expect((await run([...args, "--recheck", tiny], d)).out).toMatch(new RegExp(`${tiny},not measured`));
  }, 180_000);

  it("numbered screenshots of fixed pages do not linger, and --sweep --fresh fails before a browser opens", async () => {
    fresh();
    put("a.html", "", '<p style="font-size:10px">Chữ nhỏ</p>');
    const args = ["check", "a.html", "--no-impeccable", "--no-standalone", "--no-copy", "--no-cache", "--schemes", "light", "--viewports", "390"];
    await run([...args, "--steps", JSON.stringify([{ name: "cham", do: [{ click: "p" }] }])], d);
    const shots = join(d, ".design-kit", "shots", "a");
    const marked = (): string[] => readdirSync(join(d, ".design-kit", "shots")).filter((s) => readdirSync(join(d, ".design-kit", "shots", s)).some((f) => f.startsWith("marked-")));
    // Trạng thái sau thao tác cũng có ảnh đánh số của nó.
    expect(marked().length).toBe(2);
    await run(args, d);
    expect(readdirSync(shots).some((f) => f.startsWith("marked-"))).toBe(true);
    put("a.html", "", "<p>Chữ thường</p>");
    await run(args, d);
    expect(readdirSync(shots).some((f) => f.startsWith("marked-"))).toBe(false);
    const bad = await run([...args, "--sweep", "--fresh"], d);
    expect(bad.code).toBe(2);
  }, 120_000);
});

