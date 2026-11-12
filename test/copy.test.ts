import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { loadCopyRules, parseCopyRules } from "../src/copy.js";

const root = join(__dirname, "..");

async function run(argv: string[]): Promise<{ out: string; code: number | undefined }> {
  let out = "";
  const prev = process.exitCode;
  process.exitCode = undefined;
  await main({ argv, stdout: { write: (c: string) => (out += c) }, runtime: { env: process.env, home: "", cwd: root } });
  const code = process.exitCode as number | undefined;
  process.exitCode = prev;
  return { out, code };
}

const rule = (cats: unknown[]): string => JSON.stringify({ categories: cats });

describe("copy rules file", () => {
  it("the shipped data/copy-tells.json loads and compiles", () => {
    const r = loadCopyRules();
    expect(r.categories.map((c) => c.id)).toEqual(expect.arrayContaining(["stock-phrase", "stock-word", "opener", "chat", "placeholder", "markdown"]));
    expect(r.vagueLinks.names).toContain("xem thêm");
    // "Tiếp"/"Next" thuộc phép đo guide: không chấm hai lần
    expect(r.vagueLinks.names).not.toContain("tiếp");
    expect(r.vagueLinks.names).not.toContain("next");
  });

  it("matches a phrase as whole words, Vietnamese letters included", () => {
    const r = parseCopyRules(rule([{ id: "w", phrases: ["tối ưu"] }]), "t.json");
    const re = new RegExp(r.categories[0]!.res[0]!.src, r.categories[0]!.res[0]!.flags);
    expect(re.test("Giải pháp Tối ưu cho bạn")).toBe(true);
    expect(re.test("tối ưuđ")).toBe(false);
    expect(re.test("bất tối ưu")).toBe(true);
  });

  it("anchors at: start phrases to the start of the text block", () => {
    const r = parseCopyRules(rule([{ id: "o", at: "start", phrases: ["bạn có biết"], regex: ["hãy tưởng"] }]), "t.json");
    const [a, b] = r.categories[0]!.res.map((x) => new RegExp(x.src, x.flags));
    expect(a!.test("Bạn có biết điều này?")).toBe(true);
    expect(a!.test("Hỏi: bạn có biết?")).toBe(false);
    expect(b!.test("Hãy tưởng tượng")).toBe(true);
    expect(b!.test("Ồ, hãy tưởng tượng")).toBe(false);
  });

  it("rejects a broken file with the place to fix", () => {
    expect(() => parseCopyRules("{", "x.json")).toThrow(/x\.json: not valid JSON/);
    expect(() => parseCopyRules(JSON.stringify({ categories: [] }), "x.json")).toThrow(/non-empty list/);
    expect(() => parseCopyRules(rule([{ id: "a", phrases: ["x"] }, { id: "a", phrases: ["y"] }]), "x.json")).toThrow(/duplicate category id "a"/);
    expect(() => parseCopyRules(rule([{ id: "a", regex: ["(["] }]), "x.json")).toThrow(/a: regex .* does not compile/);
    expect(() => parseCopyRules(rule([{ id: "a" }]), "x.json")).toThrow(/a: no phrases or regex/);
    expect(() => parseCopyRules(rule([{ id: "a", min: 0, phrases: ["x"] }]), "x.json")).toThrow(/min must be/);
  });
});

// Trình duyệt thật, một khổ, một chế độ (như check.test.ts).
const FAST = ["--no-impeccable", "--no-shots", "--viewports", "390", "--schemes", "light", "--full"];

describe("copy check and data-assumed on a real page", () => {
  it("names each planted tell, generation 1 and 2, and none of the controls", async () => {
    const { out, code } = await run(["check", "test/fixtures/chu-ai.html", ...FAST, "--strict"]);
    const rows = out.split("\n").filter((l) => /^\s+soft,copy,/.test(l));
    const has = (re: RegExp) => expect(rows.some((l) => re.test(l)), String(re)).toBe(true);
    // Thế hệ 1
    has(/p#sao,"stock phrase: \\"Trong thế giới ngày nay\\"/);
    has(/p#mo-dau,"template opener: \\"Bạn có biết\\"/);
    has(/p#chat,"chatbot residue: \\"Chắc chắn rồi\\"/);
    has(/p#giu-cho,"placeholder left in: \\"\[Số điện thoại của tiệm\]\\"/);
    has(/p#lorem,"placeholder left in: \\"Lorem ipsum\\"/);
    has(/img#anh \(attribute\),"placeholder left in: \\"\[Ảnh cửa tiệm\]\\"/);
    has(/<title>,"placeholder left in: \\"\[Tên tiệm\]\\"/);
    has(/p#md,"markdown shown as text: \\"## Thực đơn/);
    has(/page,"4 stock words: hành trình, khám phá, tuyệt vời, hoàn hảo"/);
    // Thế hệ 2
    has(/h1#mau-cut,"heading in clipped fragments: \\"Bánh ngon\. Giá mềm\.\\"/);
    has(/div#dai-so,"row of short stats under the hero: \\"10K\+ khách · 99% hài lòng · 24\/7 giao hàng\\"/);
    has(/a#xem,"link says nothing about where it goes: \\"xem thêm\\"/);
    has(/button#hoc,"link says nothing about where it goes: \\"learn more\\"/);
    expect(rows).toHaveLength(13);
    // Không báo: tiêu đề một câu, chữ thường, code, data-copy-ok, chữ ẩn, liên kết có aria-label rõ đích
    expect(rows.filter((l) => /#(tieu-de-thuong|tho|ma|cho-phep|an-chu|ro-dich|nhan)\b/.test(l))).toEqual([]);
    // Mềm: không làm trang trượt
    expect(out).toContain("copy,soft,13 soft");
    expect(code).toBeUndefined();
  }, 120_000);

  it("lists data-assumed facts apart from the findings, hidden ones included", async () => {
    const { out } = await run(["check", "test/fixtures/chu-ai.html", ...FAST]);
    expect(out).toContain("assumed[3]{where,text,note}:");
    expect(out).toContain('span#gio,"7:00–21:00","giờ mở cửa mẫu, chưa hỏi chủ"');
    expect(out).toContain("span#gia,25.000 đ,(no reason given)");
    expect(out).toContain("span#an-gia,500 suất/ngày,số liệu ẩn");
    expect(out).toContain("3 fact(s) the agent filled in (data-assumed)");
    expect(out).not.toMatch(/,(assumed|data-assumed),/);
  }, 120_000);

  it("--no-copy skips both, and a clean page has neither", async () => {
    const off = await run(["check", "test/fixtures/chu-ai.html", ...FAST, "--no-copy"]);
    expect(off.out).toContain("copy,soft,skipped");
    expect(off.out).not.toContain("assumed[");
    const clean = await run(["check", "test/fixtures/tot.html", ...FAST]);
    expect(clean.out).toContain("copy,soft,ok");
    expect(clean.out).not.toContain("assumed[");
  }, 120_000);
});
