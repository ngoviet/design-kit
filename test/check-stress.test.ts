// Ba phép đo về nội dung và bố cục (24/11/2026): nội dung kéo dài (stress), điểm gãy của trang, tương phản trên điểm ảnh
// (contrast-px). Gọi thẳng hàm qua Playwright, không qua lệnh check. Mỗi phép đo có trang sai và trang đúng trong test/fixtures/.
import { join } from "node:path";
import type { Server } from "node:http";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AROUND_CAP, probeBreakpoints, sweepAround } from "../src/breakpoints.js";
import { launchBrowser, startServer, urlFor } from "../src/browser.js";
import { measurePixelText, pixelContrastPass, PX_BLOCKS } from "../src/pixelcontrast.js";
import { settleAnimations } from "../src/probe.js";
import { type NetWatch, settlePage, watchNetwork } from "../src/settle.js";
import { bigger, FILLER, LONG_WORD, longer, LONGER_BY, pickText, stressPass } from "../src/stress.js";

const root = join(__dirname, "..");
let browser: Browser;
let server: Server;
let origin: string;
beforeAll(async () => {
  ({ browser } = await launchBrowser(process.env));
  ({ server, origin } = await startServer(root));
});
afterAll(async () => {
  await browser?.close();
  server?.close();
});

interface Opened {
  page: Page;
  net: NetWatch;
}
async function open(file: string, w = 1280, h = 800, scheme: "light" | "dark" = "light", query = ""): Promise<Opened> {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
  const page = await ctx.newPage();
  const net = watchNetwork(page);
  await page.goto(urlFor(origin, root, join(root, file)) + query, { waitUntil: "load" });
  await settlePage(page, net);
  await page.evaluate(settleAnimations, 1500);
  return { page, net };
}
/** Trang nhỏ viết ngay trong test. */
async function write(body: string, w = 1280, h = 800): Promise<Opened> {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const net = watchNetwork(page);
  await page.goto(urlFor(origin, root, join(root, "test/fixtures/tot.html")), { waitUntil: "load" });
  await page.setContent(`<!doctype html><html lang="vi"><head><title>Thử</title><style>*{box-sizing:border-box}body{margin:0;font:400 16px/1.6 system-ui,sans-serif;background:#fff;color:#1a1a1a}</style></head><body>${body}</body></html>`);
  await settlePage(page, net);
  return { page, net };
}
const close = async (o: Opened): Promise<void> => o.page.context().close();
/** Mọi thứ người dùng thấy: DOM, chữ trong bóng, chỗ cuộn, stylesheet gắn thêm, biến tạm. */
const snapshot = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const parts = [document.documentElement.outerHTML, `${scrollX},${scrollY}`, `${document.adoptedStyleSheets.length}`];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      if (el.shadowRoot) parts.push(el.shadowRoot.innerHTML, `${el.shadowRoot.adoptedStyleSheets.length}`);
      if (el.scrollTop || el.scrollLeft) parts.push(`${el.id} ${el.scrollLeft},${el.scrollTop}`);
    }
    parts.push(Object.keys(window).filter((k) => /^__dk(Stress|Px)/.test(k)).join());
    return parts.join("\n");
  });

describe("words for the stress pass", () => {
  it("adds about half the length in real Vietnamese words, at least one", () => {
    for (const t of ["Tìm", "Đơn hàng", "Thiết bị trực tuyến", "Không tải được danh sách thiết bị trong mạng nhà"]) {
      const add = longer(t, LONGER_BY, FILLER).length - t.length;
      expect(add).toBeGreaterThanOrEqual(Math.max(2, Math.floor(t.length * 0.4)));
      expect(add).toBeLessThanOrEqual(Math.ceil(t.length * 0.5) + 8);
    }
    expect(longer("Đơn hàng trong tuần ", 0.5, FILLER)).toBe("Đơn hàng trong tuần ở khu vực ");
    expect(longer("\n  Lưu\n", 0.5, FILLER)).toBe("\n  Lưu ở\n");
    expect(FILLER.join(" ")).toMatch(/[ạảấầẩẫậắằẳẵặẹẻẽềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵ]/);
  });
  it("the long word is 36 letters or more, with nowhere to break", () => {
    expect(LONG_WORD).toMatch(/^[a-z]{36,}$/);
  });
  it("numbers gain three digits and keep their format", () => {
    const vi: Record<string, string> = {
      "1.250.000 ₫": "1.250.000.000 ₫",
      "250.000đ": "250.000.000đ",
      "12,5%": "12.000,5%",
      "+12%": "+12.000%",
      "182": "182.000",
      "182,4": "182.000,4",
      "0,4": "1.000,4",
      "1.250": "1.250.000",
      "1.250,5": "1.250.000,5",
      "1.250,500": "1.250.000,500",
      "98 765": "98 765 000",
      "1250000": "1250000000",
      "/ 26": "/ 26.000",
      "21–40": "21.000–40.000",
      "1.250.000.000 ₫": "1.250.000.000.000 ₫",
      " 350 km ": " 350.000 km ",
    };
    for (const [a, b] of Object.entries(vi)) expect(bigger(a, true), a).toBe(b);
    const en: Record<string, string> = { "1,250,000.50": "1,250,000,000.50", "182": "182,000", "1.250": "1,000.250", "1,250": "1,250,000", "12.5%": "12,000.5%" };
    for (const [a, b] of Object.entries(en)) expect(bigger(a, false), a).toBe(b);
  });
  it("leaves dates, times, addresses, phones, versions, codes, years, ratios, ratings, degrees and sentences alone", () => {
    const keep = [
      "7", "08:12", "8h30", "24/11/2026", "2026-11-24", "24-11-2026", "192.0.2.31", "255.255.255.128", "0901 234 567", "(028) 3822 1234", "+84 901 234 567", "1900 1234", "19001234",
      "2026", "v1.2", "1.2.10", "10.0.19045", "A4", "DH-2024", "Q.12", "#10234", "001099012345", "007", "23/26", "4,8 ★", "28 °C", "4K", "24h", "7 ngày", "Tầng 12", "Tăng 12% so với hôm qua", "Mb/s", "",
    ];
    for (const t of keep) expect(bigger(t, true), t).toBeUndefined();
  });
});

describe("sweepAround", () => {
  it("takes both sides of every breakpoint, inside the range, without the widths already measured", () => {
    expect(sweepAround([768, 1024], 320, 1280, [320, 390, 1280])).toEqual([767, 768, 1023, 1024]);
    expect(sweepAround([768], 320, 1280, [768])).toEqual([767]);
    expect(sweepAround([320, 1281, 1280.4], 320, 1280, [])).toEqual([320, 1280]);
    expect(sweepAround([640.5, 641], 320, 1280, [])).toEqual([640, 641]);
    expect(sweepAround([NaN, Infinity, -5], 320, 1280, [])).toEqual([]);
    expect(sweepAround([], 320, 1280, [])).toEqual([]);
  });
  it("keeps at most 24, the breakpoints repeated most first, then in the order given", () => {
    const many = Array.from({ length: 30 }, (_, i) => 400 + i * 20);
    const got = sweepAround(many, 320, 1280, []);
    expect(got).toHaveLength(AROUND_CAP);
    expect(AROUND_CAP).toBe(24);
    expect(got).toEqual(many.slice(0, 12).flatMap((b) => [b - 1, b]));
    expect(sweepAround([...many, 980, 980], 320, 1280, [])).toContain(979);
    // Mốc đã đo hết thì không chiếm chỗ của mốc khác.
    expect(sweepAround(many, 320, 1280, [399, 400])).toContain(640);
  });
});

describe("probeBreakpoints", () => {
  it("reads every way to write a width condition, the one with most rules first", async () => {
    const o = await open("test/fixtures/diem-gay-dung.html");
    expect(await o.page.evaluate(probeBreakpoints)).toEqual([768, 900, 1100, 481, 500, 560, 640, 641, 810, 820, 830, 840, 850, 860, 1000, 1301]);
    await close(o);
  });
  it("finds the narrow range where the layout breaks and the preset widths do not", async () => {
    const o = await open("test/fixtures/diem-gay-sai.html");
    const over = async (w: number): Promise<number> => {
      await o.page.setViewportSize({ width: w, height: 800 });
      return o.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    };
    for (const w of [390, 640, 820, 1280]) expect(await over(w), String(w)).toBe(0);
    const widths = sweepAround(await o.page.evaluate(probeBreakpoints), 320, 1280, [320, 390, 1280]);
    expect(widths).toEqual([480, 481, 699, 700]);
    expect(await over(699)).toBe(0);
    expect(await over(700)).toBeGreaterThan(50);
    await close(o);
  });
  it("skips a stylesheet it may not read", async () => {
    const o = await write("<p>Chữ</p>");
    await o.page.route("https://khac.example/x.css", (r) => r.fulfill({ contentType: "text/css", body: "@media (min-width: 777px) { p { color: red } }" }));
    await o.page.addStyleTag({ url: "https://khac.example/x.css" });
    await o.page.addStyleTag({ content: "@media (min-width: 612px) { p { color: blue } }" });
    expect(await o.page.evaluate(probeBreakpoints)).toEqual([612]);
    await close(o);
  });
});

describe("stress", () => {
  it("reports only what breaks with longer text, a long word and bigger numbers, and puts the page back", async () => {
    for (const w of [1280, 390]) {
      const o = await open("test/fixtures/keo-dai-sai.html", w);
      const before = await snapshot(o.page);
      const inner = await o.page.evaluate(() => document.body.innerText);
      const f = await stressPass(o.page, o.net);
      expect(await snapshot(o.page)).toBe(before);
      expect(await o.page.evaluate(() => document.body.innerText)).toBe(inner);
      const of = (when: string): string[] => f.filter((x) => x.detail.startsWith(when)).map((x) => x.where.split(' "')[0]!);
      expect(of("with text 50% longer")).toEqual(["h3#tieu-de-the", "p#cham", "the-don::shadow h3.ten-don", "span#nhan"]);
      expect(of("with a 37-letter word")).toEqual([...(w === 390 ? ["td#o-ten"] : []), "strong#ten-nguoi", "the-don::shadow h3.ten-don"]);
      expect(of("with three more digits")).toEqual(["div#tien", "div#phan-tram", "div#dem"]);
      // Nhãn mang chữ gốc, không mang chữ đã kéo dài; chữ đã bị cắt từ trước không bị báo lại.
      expect(f.find((x) => x.where.startsWith("div#tien"))!.where).toBe('div#tien "1.250.000 ₫"');
      expect(JSON.stringify(f)).not.toContain("mat-san");
      expect(f.every((x) => x.check === "stress")).toBe(true);
      await close(o);
    }
  });
  it("names the cell that pushes, and the box that cuts it", async () => {
    const o = await open("test/fixtures/keo-dai-sai.html", 390, 844);
    const cell = (await stressPass(o.page, o.net)).find((x) => x.where.startsWith("td#o-ten"))!;
    expect(cell.detail).toMatch(/text cut off at 390px by overflow hidden on section\.bang; add overflow-wrap: anywhere/);
    await close(o);
  });
  it("leaves code, time, logos, pills, units, scroll areas, deliberate ellipsis, data-stress-ok and a page that changes itself", async () => {
    for (const [w, h] of [[1280, 800], [390, 844]] as const) {
      const o = await open("test/fixtures/keo-dai-dung.html", w, h);
      expect(await stressPass(o.page, o.net)).toEqual([]);
      expect(await o.page.evaluate(() => document.getElementById("dem")!.textContent)).toMatch(/^nhịp thứ \d+$/);
      expect(await o.page.evaluate(() => document.body.innerText)).not.toMatch(/ở khu|baocaotonghop/);
      await close(o);
    }
  });
  it("picks interface text, data names and nothing else", async () => {
    const o = await open("test/fixtures/keo-dai-dung.html", 390, 844);
    const texts = async (k: "longer" | "word" | "number"): Promise<string[]> => (await o.page.evaluate(pickText, k)).map((t) => t.trim());
    const long = await texts("longer");
    for (const t of ["Trạng thái", "Báo cáo tuần", "Lưu thay đổi", "Xem thêm", "Đơn mới"]) expect(long).toContain(t);
    for (const t of ["npm test", "Ctrl K", "Ghi chú ngắn", "Kho phía Nam", "Đang giao hàng", "Sửa tại chỗ", "Bản quyền số", "LA", "A", "thứ Ba, 24 tháng 11", "Hình minh hoạ", "Cổng chính", "Trục hoành", "Phần này đang ẩn", "Nội dung đóng", "Chỉ cho trình đọc màn hình", "Mb/s", "km", "Vườn Nhà Xanh", "7"]) {
      expect(long, t).not.toContain(t);
    }
    expect(await texts("word")).toEqual(["Báo cáo tuần", "Danh sách khách", "Đơn mới", "Đang giao", "Đã xong"]);
    expect(await texts("number")).not.toContain("7");
    await close(o);
  });
  it("groups after four findings in one pass", async () => {
    const li = ["Kho phía Nam", "Kho phía Bắc", "Kho miền Tây", "Kho ven biển", "Kho trên núi", "Kho trung tâm"].map((t) => `<li style="width:104px;height:24px;line-height:24px;overflow:hidden;white-space:nowrap">${t}</li>`).join("");
    const o = await write(`<main><h1>Kho</h1><ul>${li}</ul></main>`);
    const f = await stressPass(o.page, o.net);
    expect(f.map((x) => x.where)).toEqual(['li "Kho phía Nam"', 'li "Kho phía Bắc"', 'li "Kho miền Tây"', 'li "Kho ven biển"', "+2 more"]);
    await close(o);
  });
  it("reports a page, or an app shell, that becomes wider, and the text that pushes it", async () => {
    const bar = '<main><h1>Đơn</h1><div style="display:flex"><button style="white-space:nowrap;font:inherit;padding:0 20px">Xác nhận và gửi đơn hàng</button></div><p>Chữ thường.</p></main>';
    const a = await write(bar, 300);
    expect((await stressPass(a.page, a.net)).map((x) => `${x.where} | ${x.detail}`)).toEqual([expect.stringMatching(/^button "Xác nhận và gửi đơn hàng" \| with text 50% longer: the page is \d+px wide in 300px/)]);
    await close(a);
    // Trang không cuộn: vỏ app tự cuộn, tràn ngang nằm ở main.
    const shell = '<style>html,body{height:100%;overflow:hidden}main{height:100%;overflow-y:auto;padding:16px}</style><main><h1>Tệp</h1><p class="file-name">Báo cáo tuần</p></main>';
    const b = await write(shell, 300);
    expect((await stressPass(b.page, b.net)).map((x) => `${x.where} | ${x.detail}`)).toEqual([expect.stringMatching(/^p\.file-name "Báo cáo tuần" \| with a 37-letter word: the page is \d+px wide in \d+px/)]);
    await close(b);
    // Trang tràn sẵn: phép đo overflow đã báo.
    const c = await write(`<div style="width:500px">Rộng sẵn</div>${bar}`, 300);
    expect(await stressPass(c.page, c.net)).toEqual([]);
    await close(c);
  });
  it("an ellipsis with the full text elsewhere is left alone, unless it also widens the page", async () => {
    const line = (attr: string): string => `<p style="width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" ${attr}>Giao trong ngày</p>`;
    for (const [attr, n] of [['title="Giao trong ngày"', 0], ['aria-label="Giao trong ngày ở nội thành"', 0], ['title="Giao"', 1], ["", 1]] as const) {
      const o = await write(`<main><h1>Đơn</h1>${line(attr)}</main>`);
      expect((await stressPass(o.page, o.net)).length, attr).toBe(n);
      await close(o);
    }
    // Cắt thẳng (không có dấu ba chấm) thì title không cứu được.
    const cut = await write('<main><h1>Đơn</h1><p style="width:130px;overflow:hidden;white-space:nowrap" title="Giao trong ngày">Giao trong ngày</p></main>');
    expect((await stressPass(cut.page, cut.net)).length).toBe(1);
    await close(cut);
    const wide = await write('<main><h1>Đơn</h1><div style="width:max-content;max-width:none"><p class="file-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Báo cáo">Báo cáo</p></div></main>', 300);
    expect((await stressPass(wide.page, wide.net)).map((x) => x.detail)).toEqual([expect.stringMatching(/with a 37-letter word: the page is/)]);
    await close(wide);
  });
  it("gives the long word to an email in plain text, and blames the text that pushes rather than the text it pushes", async () => {
    const o = await write('<main style="padding:16px"><h1>Liên hệ</h1><p>Gửi thư cho chúng tôi bất cứ lúc nào, chúng tôi trả lời trong ngày.</p><p>lan@vuon.vn</p><h2>Địa chỉ của vườn rau nằm ở cuối con đường nhỏ ven sông</h2></main>', 300);
    expect((await stressPass(o.page, o.net)).map((x) => x.where)).toEqual(['p "lan@vuon.vn"']);
    await close(o);
    // Nút không ngắt dòng còn nằm trong màn nhưng kéo cả khung; tiêu đề xuống dòng được mới là thứ thò ra.
    const g = await write('<main style="padding:16px"><div style="display:grid;border:1px solid #bbb;padding:16px"><h2>Địa chỉ của vườn rau nằm ở cuối con đường nhỏ ven sông</h2><button style="white-space:nowrap;font:inherit;justify-self:start;padding:0 8px">Xem đường đi tới vườn</button></div></main>', 300);
    expect((await stressPass(g.page, g.net)).map((x) => x.where)).toEqual(['button "Xem đường đi tới vườn"']);
    await close(g);
  });
  it("text that only gets covered because another text grew is not reported twice", async () => {
    // Tên dài kéo rộng cả thẻ, câu bên dưới tràn theo sang thẻ kế: chỉ báo cái tên.
    const o = await write(`<main><h1>Nhóm</h1><div style="display:grid;grid-template-columns:150px 150px"><div style="background:#eee;display:grid"><strong class="user-name" id="a">Lan</strong><p style="margin:0">Tốt nghiệp lớp trồng rau sạch của huyện năm ngoái.</p></div><div style="background:#ddd"></div></div></main>`);
    expect((await stressPass(o.page, o.net)).map((x) => x.where)).toEqual(['strong#a "Lan"']);
    await close(o);
  });
  it("throws when the page keeps the stressed text, instead of measuring a page it has changed", async () => {
    const o = await write("<main><h1>Đơn hàng</h1><div class='file-name' id='a'>Báo cáo</div><p id='b'></p></main>");
    await o.page.evaluate(() => {
      const a = document.getElementById("a")!;
      new MutationObserver(() => {
        document.getElementById("b")!.textContent += ` ${a.textContent}`;
      }).observe(a, { characterData: true, subtree: true });
    });
    await expect(stressPass(o.page, o.net)).rejects.toThrow(/kept the stressed text \(longer\)/);
    expect(await o.page.evaluate(() => document.getElementById("a")!.textContent)).toBe("Báo cáo");
    await close(o);
  });
  it("keeps the text the page itself wrote while it was being measured", async () => {
    const o = await write("<main><h1>Đơn hàng</h1><p id='a'>Đang tải</p></main>");
    await o.page.evaluate(() => {
      const t = document.getElementById("a")!.firstChild as Text;
      const mo = new MutationObserver(() => {
        mo.disconnect();
        t.data = "Đã tải xong";
      });
      mo.observe(t, { characterData: true });
    });
    await stressPass(o.page, o.net);
    expect(await o.page.evaluate(() => document.getElementById("a")!.textContent)).toBe("Đã tải xong");
    await close(o);
  });
  it("finds nothing on the kit's blocks at 1280", async () => {
    for (const b of ["chi-so", "dau-trang", "bo-loc", "hero", "bang-du-lieu"]) {
      const o = await open(`blocks/html/${b}.html`);
      expect(await stressPass(o.page, o.net), b).toEqual([]);
      await close(o);
    }
  });
});

describe("contrast-px", () => {
  it("measures text over gradients, images, canvases, sibling layers and pseudo-elements, down to the worst part", async () => {
    const o = await open("test/fixtures/tuong-phan-anh-sai.html");
    const before = await snapshot(o.page);
    const f = await pixelContrastPass(o.page);
    expect(await snapshot(o.page)).toBe(before);
    const got = new Map(f.map((x) => [x.where.split('"')[1]!, Number(/is ([\d.]+):1/.exec(x.detail)![1])]));
    const want: Array<[string, number, number]> = [
      ["Vườn rau sạch mỗi sáng", 1, 1.1],
      ["Chữ trắng trên ảnh sáng", 1.2, 1.4],
      ["Nền là lớp anh em", 1.9, 2.2],
      ["Nền là phần tử giả", 2.2, 2.5],
      ["Nền là canvas", 1.8, 2],
      ["Dòng 1 của đoạn văn dài nằm ", 1.3, 1.5],
      ["Màu chữ nửa trong", 3.2, 3.5],
      ["Cả khối nửa trong", 2.7, 3],
      ["Đăng ký nhận tin", 1.5, 2.2],
      ["Chữ trong bóng", 1.8, 2.1],
    ];
    for (const [t, lo, hi] of want) {
      expect(got.get(t), t).toBeGreaterThanOrEqual(lo);
      expect(got.get(t), t).toBeLessThanOrEqual(hi);
    }
    expect(f).toHaveLength(want.length);
    expect(f.find((x) => x.where.startsWith("h2"))!.detail).toMatch(/text #ffffff over #ffffff is 1\.00:1 at its worst part, want 3:1/);
    expect(f.find((x) => x.where.startsWith("the-mau"))!.where).toBe('the-mau::shadow p "Chữ trong bóng"');
    await close(o);
  });
  it("on a phone the line that runs off the screen is still measured where it shows", async () => {
    const o = await open("test/fixtures/tuong-phan-anh-sai.html", 390, 844);
    expect((await pixelContrastPass(o.page)).map((x) => x.where)).toContain('h2 "Vườn rau sạch mỗi sáng"');
    await close(o);
  });
  it("passes faint patterns, scrims, shadows, own panels, large text and moving dark backgrounds; leaves the page as it was", async () => {
    for (const [w, h] of [[1280, 800], [390, 844]] as const) {
      const o = await open("test/fixtures/tuong-phan-anh-dung.html", w, h);
      const before = await snapshot(o.page);
      expect(await pixelContrastPass(o.page)).toEqual([]);
      expect(await snapshot(o.page)).toBe(before);
      // `transition: all 3s`: màu chữ không được chạy lại từ trong suốt sau khi trả trang.
      const left = await o.page.evaluate(() => {
        const p = document.querySelector(".cham p")!;
        const cs = getComputedStyle(p);
        return { same: cs.webkitTextFillColor === cs.color, running: p.getAnimations().length };
      });
      expect(left).toEqual({ same: true, running: 0 });
      await close(o);
    }
  });
  it("really measures the good page: known ratios, and the skipped text is absent", async () => {
    const o = await open("test/fixtures/tuong-phan-anh-dung.html");
    const all = new Map((await measurePixelText(o.page, 60, 12)).map((x) => [x.where.split('"')[1]!, x]));
    const near = (t: string, ratio: number, need: number): void => {
      expect(all.get(t)?.ratio, t).toBeGreaterThan(ratio * 0.94);
      expect(all.get(t)?.ratio, t).toBeLessThan(ratio * 1.06);
      expect(all.get(t)?.need, t).toBe(need);
    };
    near("Chữ phụ trên hoạ tiết nhạt, ", 5.6, 4.5);
    near("Chữ lớn chỉ cần ba trên một", 3.43, 3);
    near("Ảnh có lớp tối phủ lên", 9.3, 4.5);
    // Chữ rơi lệch ô kẻ khác nhau theo font (4,62 với Arial, 4,93 với Segoe UI): chỉ chặn hai phía, trên mức cần và dưới nền trơn (5,33).
    const ke = all.get("Giấy kẻ ô với chữ phụ ghi ch")!;
    expect(ke.need).toBe(4.5);
    expect(ke.ratio).toBeGreaterThan(4.5);
    expect(ke.ratio).toBeLessThan(5.2);
    near("gạch chân dày gợi ý gì", 7.4, 4.5);
    near("Nền trôi chậm phía sau", 12.3, 4.5);
    for (const t of ["Nút gradient đậm", "Chọn kho", "Mục hai", "Mục ba", "Chữ ở cuối trang dài.", "Canvas tối đang chạy phía sa"]) expect(all.has(t), t).toBe(true);
    for (const t of ["Chữ có bóng tối", "Chữ có nền riêng", "Thẻ đặc đặt trên ảnh", "Vườn Nhà Xanh", "01", "Chữ tô bằng gradient", "Khối có bộ lọc", "Khối trộn màu", "Nút đang tắt", "Ảnh nằm cạnh, không nằm sau "]) {
      expect(all.has(t), t).toBe(false);
    }
    await close(o);
  });
  it("ignores a flaw under 5% of the text and reports one over it, whatever the font", async () => {
    // Sáu mươi chữ n trên một dải màu rộng theo phần trăm: tỉ lệ chữ nằm trên dải không phụ thuộc font. Nền trơn 5,33; trên dải 3,53.
    for (const font of ["system-ui", "Georgia, serif", "monospace"]) {
      for (const [pct, lo, hi] of [[3, 5.2, 5.4], [10, 3.4, 3.8]] as const) {
        const o = await write(`<main><p style="display:inline-block;margin:20px;white-space:nowrap;font-family:${font};color:#6b6b6b;background:linear-gradient(90deg,#fff 40%,#d2d2d2 40% ${40 + pct}%,#fff ${40 + pct}%)">${"n".repeat(60)}</p></main>`);
        const m = (await measurePixelText(o.page))[0]!;
        expect(m.ratio, `${font} ${pct}%`).toBeGreaterThan(lo);
        expect(m.ratio, `${font} ${pct}%`).toBeLessThan(hi);
        await close(o);
      }
    }
  });
  it("puts text over images before text over gradients when there is too much to measure", async () => {
    const grad = Array.from({ length: PX_BLOCKS + 6 }, (_, i) => `<p style="margin:0;color:rgb(${60 + i},60,60)">Dòng gradient ${i}</p>`).join("");
    const img = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23e8e2d0'/%3E%3C/svg%3E";
    const o = await write(`<main style="background:linear-gradient(#fff,#f4f4f4)"><h1>Nhiều chữ</h1>${grad}<div style="position:relative;height:60px"><img alt="" src="${img}" style="position:absolute;inset:0;width:100%;height:100%"><p style="position:relative;margin:0;color:#fff">Chữ trên ảnh</p></div></main>`);
    const all = await measurePixelText(o.page);
    expect(all).toHaveLength(PX_BLOCKS);
    expect(all.map((x) => x.where)).toContain('p "Chữ trên ảnh"');
    await close(o);
  });
  it("does not report the kit's patterned themes, light and dark", async () => {
    for (const theme of ["gomlam", "sonmai", "sanchoi", "kanagawa"]) {
      for (const scheme of ["light", "dark"] as const) {
        const o = await open("blocks/html/chon-mau.html", 1280, 800, scheme, `?chu-de=${theme}`);
        const all = await measurePixelText(o.page);
        expect(all.length, `${theme} ${scheme}`).toBeGreaterThanOrEqual(3);
        expect(all.filter((x) => !(x.ratio >= x.need + 0.5)), `${theme} ${scheme}`).toEqual([]);
        await close(o);
      }
    }
  });
});
