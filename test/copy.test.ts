import { join } from "node:path";
import type { Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser, startServer } from "../src/browser.js";
import { main } from "../src/cli.js";
import { type CopyResult, loadCopyRules, parseCopyRules, probeCopy } from "../src/copy.js";

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
    expect(r.categories.map((c) => c.id)).toEqual(expect.arrayContaining(["stock-phrase", "stock-word", "opener", "chat", "placeholder", "markdown", "raw-value", "raw-word", "error-code", "fake-proof", "fake-rating"]));
    // Khung hai thế hệ: giá trị lộ ra là dấu vết chưa ai đọc lại, bằng chứng tự bịa là dấu ở ý.
    expect(r.categories.filter((c) => c.gen === 2).map((c) => c.id)).toEqual(["fake-proof", "fake-rating"]);
    expect(r.categories.filter((c) => c.skipAssumed).map((c) => c.id)).toEqual(["fake-proof", "fake-rating"]);
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
    expect(() => parseCopyRules(rule([{ id: "a", min: 3, max: 2, phrases: ["x"] }]), "x.json")).toThrow(/max must be/);
    expect(() => parseCopyRules(rule([{ id: "a", max: -1, phrases: ["x"] }]), "x.json")).toThrow(/max must be/);
    expect(() => parseCopyRules(rule([{ id: "a", assumed: "yes", phrases: ["x"] }]), "x.json")).toThrow(/assumed must be "skip"/);
    expect(() => parseCopyRules(rule([{ id: "a", bare: "true", phrases: ["x"] }]), "x.json")).toThrow(/bare must be true or false/);
    expect(() => parseCopyRules(rule([{ id: "a", unlessLink: 1, phrases: ["x"] }]), "x.json")).toThrow(/unlessLink must be true or false/);
    expect(() => parseCopyRules(rule([{ id: "a", unless: ["("], phrases: ["x"] }]), "x.json")).toThrow(/a: unless .* does not compile/);
    expect(() => parseCopyRules(rule([{ id: "a", unless: [3], phrases: ["x"] }]), "x.json")).toThrow(/every unless must be/);
    expect(() => parseCopyRules(rule([{ id: "a", unless: "x", phrases: ["x"] }]), "x.json")).toThrow(/must be lists/);
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

// Giá trị kỹ thuật lộ ra và bằng chứng xã hội tự bịa (K5, 24/11/2026): đo thẳng trong trang để thấy mọi dòng (cổng cắt ở 20).
describe("raw values and invented proof", () => {
  let browser: Browser;
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    browser = (await launchBrowser(process.env)).browser;
    server = await startServer(root);
  }, 120_000);
  afterAll(async () => {
    await browser.close();
    server.server.close();
  });
  const measure = async (body: string | { file: string }, rules = loadCopyRules()): Promise<CopyResult> => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      if (typeof body === "string") await page.setContent(`<!doctype html><html lang="vi"><head><title>Thử</title></head><body><main>${body}</main></body></html>`);
      else await page.goto(`${server.origin}/test/fixtures/${body.file}.html`);
      return await page.evaluate(probeCopy, rules);
    } finally {
      await page.close();
    }
  };
  const rowsOf = (r: CopyResult): string[] => r.copy.map((h) => `${h.where} ${h.value}`);

  it("names each planted value and claim once, with the words it saw", async () => {
    expect(rowsOf(await measure({ file: "chu-ky-thuat-sai" })).sort()).toEqual([
      'p#mau-kep placeholder left in: "{{ten}}"',
      'p#ten-mau placeholder left in: "Nguyễn Văn A"',
      'td#rong raw value shown to the reader: "null"',
      'td#rong-gia raw value shown to the reader: "null đ"',
      'p#chao-null raw value shown to the reader: "Chào null"',
      'p#doi-tuong raw value shown to the reader: "[object Object]"',
      'p#ngay raw value shown to the reader: "Invalid Date"',
      'p#mau-cau raw value shown to the reader: "%d"',
      'p#chao raw value shown to the reader: "undefined"',
      'p#gia raw value shown to the reader: "NaN"',
      'p#gia-dinh raw value shown to the reader: "NaN"',
      'p#loi-js raw value shown to the reader: "TypeError"',
      'img#anh (attribute) raw value shown to the reader: "undefined"',
      '<title> raw value shown to the reader: "undefined"',
      'p#ma-trang-thai bare error code, say what happened and what to do: "Request failed with status code 500"',
      'p#ma-mang bare error code, say what happened and what to do: "net::ERR_CONNECTION_REFUSED"',
      'p#ma-tran bare error code, say what happened and what to do: "Lỗi 503"',
      'p#tin-dung invented social proof, use real numbers or cut it: "Hơn 10.000 khách hàng tin dùng"',
      'p#hang-nghin invented social proof, use real numbers or cut it: "Được tin dùng bởi hàng nghìn"',
      'p#trieu invented social proof, use real numbers or cut it: "Hàng triệu người dùng đã tin tưởng"',
      'p#phan-tram invented social proof, use real numbers or cut it: "98% khách hàng hài lòng"',
      'p#cong invented social proof, use real numbers or cut it: "500+ doanh nghiệp"',
      'p#tieng-anh invented social proof, use real numbers or cut it: "10,000+ teams"',
      'p#join invented social proof, use real numbers or cut it: "Join 5,000 creators"',
      'p#happy invented social proof, use real numbers or cut it: "25k+ happy customers"',
      'p#sao-so rating with no source, link the reviews or cut it: "4.9/5"',
    ].sort());
  }, 60_000);
  it("leaves technical sentences, code, explained errors, real counts, sourced ratings and assumed facts", async () => {
    const r = await measure({ file: "chu-ky-thuat-dung" });
    expect(rowsOf(r)).toEqual([]);
    expect(r.assumed.map((a) => a.text)).toEqual(["10.000 khách hàng", "Đánh giá 4.9/5 từ khách hàng"]);
  }, 60_000);
  it("raw values: other shapes, and near misses", async () => {
    for (const bad of ["null / null", "NULL", "Hello null!", "Ngày Invalid DateTime", "[object Promise]", "Còn %1$d chỗ", "%@ đã gửi", "Uncaught (in promise)", "Unhandled Promise Rejection", "Traceback (most recent call last)", "Cannot read properties of null", "undefined/undefined", "#undefined", "NaN:NaN", "Uncaught ReferenceError: x"]) {
      expect(rowsOf(await measure(`<p>${bad}</p>`)), bad).toHaveLength(1);
    }
    for (const fine of ["nullable", "Không null", "NaNa", "undefinedX", "x.undefined", "100%s", "50%d", "%sau", "SomeTypeErrors", "invalid date", "Chào nulla"]) {
      expect(rowsOf(await measure(`<p>${fine}</p>`)), fine).toEqual([]);
    }
  }, 60_000);
  it("the technical guard does not swallow everyday words (phổ biến, hàm lượng, biến thể)", async () => {
    for (const bad of ["Cách chế biến: undefined", "Các biến thể: NaN món", "Trong hàm lượng: NaN mg", "Giá trị đơn: NaN đ", "Kiểu giao hàng: undefined"]) {
      expect(rowsOf(await measure(`<p>${bad}</p>`)), bad).toHaveLength(1);
    }
    for (const fine of ["Khi gọi hàm thiếu tên thì nhận undefined.", "Biến này là undefined.", "Một exception kiểu TypeError."]) {
      expect(rowsOf(await measure(`<p>${fine}</p>`)), fine).toEqual([]);
    }
  }, 60_000);
  it("a bare code needs three words of explanation in the line or right next to it; a hidden neighbour does not count", async () => {
    const code = (b: string): Promise<number> => measure(b).then((r) => r.copy.length);
    expect(await code("<div><p>ECONNREFUSED</p></div>")).toBe(1);
    expect(await code("<div><p>Đã lỗi ECONNREFUSED</p></div>")).toBe(1);
    expect(await code("<div><p>Máy chủ đang bận ECONNREFUSED</p></div>")).toBe(0);
    expect(await code("<div><h2>Máy chủ đang bận</h2><p>ECONNREFUSED</p></div>")).toBe(0);
    expect(await code("<div><p>ECONNREFUSED</p><p>Thử lại sau vài phút.</p></div>")).toBe(0);
    expect(await code('<div><p>ECONNREFUSED</p><p style="display:none">Thử lại sau vài phút.</p></div>')).toBe(1);
    for (const bad of ["500 Internal Server Error", "Failed to fetch", "Network Error", "HTTP 502", "Error code: 0x80070005", "Mã lỗi: 503", "status 404"]) expect(await code(`<div><p>${bad}</p></div>`), bad).toBe(1);
    for (const fine of ["Phòng 404", "HTTP 200", "Lỗi 4500", "404", "Mã đơn 502"]) expect(await code(`<div><p>${fine}</p></div>`), fine).toBe(0);
  }, 60_000);
  it("invented proof: the number has to be marketing sized, and assumed facts are skipped only when they carry it", async () => {
    const n = (t: string): Promise<number> => measure(t).then((r) => r.copy.length);
    for (const bad of ["Gần 5 nghìn khách hàng tin tưởng", "50K+ người dùng", "Được yêu thích bởi 2.000 gia đình", "Hơn 300 khách hàng Việt Nam luôn đồng hành", "95% học viên giới thiệu", "Loved by 12k developers", "Trusted by thousands", "Join thousands of happy customers"]) expect(await n(`<p>${bad}</p>`), bad).toBe(1);
    for (const fine of ["99 khách hàng hài lòng", "Có 1.240 khách hàng", "95% học viên đi học", "Trusted by 2 teams", "Join 3 people", "Đơn 10.000 đồng hành trình"]) expect(await n(`<p>${fine}</p>`), fine).toBe(0);
    expect(await n('<p>Hơn 10.000 khách hàng tin dùng, mở cửa <span data-assumed="giờ mẫu">7:00</span></p>')).toBe(1);
    expect(await n('<p>Hơn <b data-assumed="số mẫu">10.000</b> khách hàng tin dùng</p>')).toBe(0);
    expect(await n('<p><b data-assumed="số mẫu">Hàng nghìn khách hàng tin dùng</b> mỗi ngày</p>')).toBe(0);
    // Dữ kiện tự điền khác trong cùng câu, dù chữ số trùng một phần, không che lời khoe.
    expect(await n('<p>Hơn 10.000 khách hàng tin dùng, mở cửa <b data-assumed="ngày mẫu">1</b> tuần</p>')).toBe(1);
    expect(await n('<p>Hàng nghìn khách hàng tin dùng, mở cửa <b data-assumed="ngày mẫu">hàng</b> ngày</p>')).toBe(1);
    expect(await n('<p data-copy-ok="số thật, có sổ">Hơn 10.000 khách hàng tin dùng</p>')).toBe(0);
  }, 60_000);
  it("a rating is fine with a source or a review count; more than two different ones are data", async () => {
    const n = (t: string): Promise<number> => measure(t).then((r) => r.copy.length);
    expect(await n("<p>4,9 sao</p>")).toBe(1);
    expect(await n("<p>4.8 out of 5 từ 2.000+ đánh giá</p>")).toBe(1);
    expect(await n("<p>4.8/5 (128 reviews)</p>")).toBe(0);
    expect(await n('<a href="https://example.com/x"><p>4,9/5</p></a>')).toBe(0);
    expect(await n("<p>4,9/5</p><p>4,8/5</p>")).toBe(2);
    expect(await n("<p>4,9/5</p><p>4,8/5</p><p>4,7/5</p>")).toBe(0);
    expect(await n("<p>3,5/5</p><p>4,5/50</p><p>14,9/5</p>")).toBe(0);
  }, 60_000);
  it("the gate prints them as soft copy findings", async () => {
    const { out, code } = await run(["check", "test/fixtures/chu-ky-thuat-dung.html", ...FAST, "--no-standalone", "--no-cache", "--strict"]);
    expect(out).toContain("copy,soft,ok");
    expect(code).toBeUndefined();
  }, 120_000);
});
