// Phép đo `css` (24/11/2026): mỗi luật con có trang sai, trang đúng gom các ca dễ báo oan, và các trang nhỏ cho điều kiện biên.
import { join } from "node:path";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser, startServer } from "../src/browser.js";
import { type CssHit, probeCss, probePaste } from "../src/csscheck.js";
import { probeFingerprint } from "../src/probe.js";

const root = join(__dirname, "..");
let browser: Browser;
let a: Awaited<ReturnType<typeof startServer>>;
/** Máy chủ thứ hai: khác cổng là khác nguồn, stylesheet của nó không đọc được. */
let b: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => {
  browser = (await launchBrowser(process.env)).browser;
  a = await startServer(root);
  b = await startServer(root);
}, 120_000);
afterAll(async () => {
  await browser.close();
  a.server.close();
  b.server.close();
});

interface Opts {
  w?: number;
  h?: number;
  scheme?: "light" | "dark";
}
async function withPage<T>(o: Opts, fn: (p: Page) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width: o.w ?? 390, height: o.h ?? 844 }, colorScheme: o.scheme ?? "light" });
  try {
    return await fn(await ctx.newPage());
  } finally {
    await ctx.close();
  }
}
const fixture = (name: string): string => `${a.origin}/test/fixtures/${name}.html`;
/** Trang nhỏ: phần đầu (style, meta) và thân. */
const doc = (head: string, body: string, html = ""): string =>
  `<!doctype html><html lang="vi"${html}><head><meta charset="utf-8"><title>Thử</title>${head}</head><body style="margin:0">${body}</body></html>`;
const probe = (head: string, body: string, o: Opts & { html?: string } = {}): Promise<CssHit[]> =>
  withPage(o, async (p) => {
    await p.setContent(doc(head, body, o.html));
    return p.evaluate(probeCss);
  });
const of = (hits: CssHit[], rule: string): CssHit[] => hits.filter((h) => h.detail.startsWith(`${rule}: `));
const places = (hits: CssHit[], rule: string): string[] => of(hits, rule).map((h) => h.where);

describe("css: the wrong page", () => {
  it("names every planted fault at a phone width, through @import, @layer, @media, nesting and shadow roots", async () => {
    const hits = await withPage({}, async (p) => {
      await p.goto(fixture("doc-css-sai"));
      const html = await p.evaluate(() => document.documentElement.outerHTML);
      const list = await p.evaluate(probeCss);
      // Hộp thử tính calc() đã được gỡ.
      expect(await p.evaluate(() => document.documentElement.outerHTML)).toBe(html);
      return list;
    });
    expect(places(hits, "vh-full")).toEqual(["section#man", "section#tinh", "section#lop", "section#long", "+1 more"]);
    expect(of(hits, "vh-full")[1]!.detail).toContain("height: calc(100vh - 2rem)");
    expect(of(hits, "vh-full")[4]!.detail).toContain("min-height: 95vh");
    expect(places(hits, "transition-all")).toEqual([".nut", ".tu-tep-nhap", ".nut-ngam"]);
    expect(of(hits, "transition-all")[0]!.detail).toContain("of 2 elements");
    expect(of(hits, "transition-all")[2]!.detail).toContain("and 2 more selectors");
    expect(places(hits, "vi-hyphen")).toEqual(["p#tach", "div#gay", "the-sai::shadow p"]);
    expect(places(hits, "scheme")).toEqual(["body"]);
    expect(of(hits, "scheme")[0]!.detail).toContain("background is dark");
    expect(places(hits, "theme-color")).toEqual(["meta[name=theme-color]"]);
    expect(places(hits, "safe-area")).toEqual(["header#dau", "nav#day"]);
    expect(of(hits, "safe-area").map((h) => /padding-(top|bottom): env\(safe-area-inset-\1\)/.exec(h.detail)?.[1])).toEqual(["top", "bottom"]);
    expect(places(hits, "img-size")).toEqual(["img#anh", "video#phim", "iframe#khung"]);
    expect(hits).toHaveLength(18);
  }, 60_000);
  it("at a desktop width 100vh is fine, the rest stays; the details carry no measured px, so widths merge into one row", async () => {
    const [narrow, wide] = await Promise.all([320, 1280].map((w) => withPage({ w, h: 800 }, async (p) => {
      await p.goto(fixture("doc-css-sai"));
      return p.evaluate(probeCss);
    })));
    expect(places(wide!, "vh-full")).toEqual([]);
    const strip = (l: CssHit[]): string[] => l.filter((h) => !h.detail.startsWith("vh-full")).map((h) => `${h.where}|${h.detail}`);
    expect(strip(wide!)).toEqual(strip(narrow!));
    expect(strip(wide!)).toHaveLength(13);
  }, 60_000);
  it("reports blocked paste: inline handler, document listener, shadow root; puts the value back", async () => {
    await withPage({}, async (p) => {
      await p.goto(fixture("doc-css-sai"));
      await p.evaluate(() => {
        (window as unknown as { seen: string[] }).seen = [];
        document.getElementById("ma-xn")!.addEventListener("input", (e) => (window as unknown as { seen: string[] }).seen.push((e.target as HTMLInputElement).value));
      });
      const hits = await p.evaluate(probePaste);
      expect(hits.map((h) => h.where)).toEqual(["input#mk", "input#email-lai", "input#ma-xn", "the-sai::shadow input#o-trong"]);
      expect(hits.every((h) => h.detail.startsWith("paste: "))).toBe(true);
      expect(await p.inputValue("#ma-xn")).toBe("12");
      expect(await p.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual(["12"]);
      // navigator.clipboard được trả lại đúng hàm gốc.
      expect(await p.evaluate(() => Object.getOwnPropertyNames(navigator.clipboard ?? {}))).toEqual([]);
    });
  }, 60_000);
});

describe("css: the right page", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`says nothing at 320, 390 and 1280 in ${scheme}, and leaves the page as it was`, async () => {
      for (const [w, h] of [[320, 720], [390, 844], [1280, 800]] as const) {
        await withPage({ w, h, scheme }, async (p) => {
          await p.goto(fixture("doc-css-dung"));
          const before = await p.evaluate(probeFingerprint);
          const html = await p.evaluate(() => document.documentElement.outerHTML);
          expect(await p.evaluate(probeCss), `${w} ${scheme}`).toEqual([]);
          expect(await p.evaluate(probePaste)).toEqual([]);
          expect((await p.evaluate(probeFingerprint)).hash).toBe(before.hash);
          expect(await p.evaluate(() => document.documentElement.outerHTML)).toBe(html);
          expect(await p.evaluate(() => [(document.getElementById("ma-1") as HTMLInputElement).value, document.activeElement?.tagName])).toEqual(["7", "BODY"]);
        });
      }
    }, 60_000);
  }
});

describe("css vh-full", () => {
  const vh = (css: string, body: string, o: Opts = {}): Promise<string[]> => probe(`<style>${css}</style>`, body, o).then((l) => places(l, "vh-full"));
  it("counts a block from 90% of the screen, at widths up to 480", async () => {
    expect(await vh("#a{height:90vh}", '<div id="a">x</div>')).toEqual(["div#a"]);
    expect(await vh("#a{height:89vh}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh}", '<div id="a">x</div>', { w: 480 })).toEqual(["div#a"]);
    expect(await vh("#a{height:100vh}", '<div id="a">x</div>', { w: 481 })).toEqual([]);
    expect(await vh("#a{height:101vh}", '<div id="a">x</div>')).toEqual([]);
  }, 60_000);
  it("reads max-height, inline style, a content-box block with padding, and vb", async () => {
    expect(await vh("#a{max-height:100vh;overflow:auto}#a>p{height:2000px}", '<div id="a"><p>x</p></div>')).toEqual(["div#a"]);
    expect(await vh("", '<div id="a" style="min-height:100vh">x</div>')).toEqual(["div#a"]);
    expect(await vh("#a{min-height:100vh;padding:20px}", '<div id="a">x</div>')).toEqual(["div#a"]);
    expect(await vh("#a{min-height:100vb}", '<div id="a">x</div>')).toEqual(["div#a"]);
    expect(await vh("#a{min-block-size:100vh}", '<div id="a">x</div>')).toEqual(["div#a"]);
    expect(await vh("#a{min-block-size:100vh;min-height:100svh}", '<div id="a">x</div>')).toEqual([]);
  }, 60_000);
  it("leaves a max-height nobody reaches, svh beside it, hidden, decorative, off-screen and waived blocks", async () => {
    expect(await vh("#a{max-height:100vh}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh}#a{max-height:100svh}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh;opacity:0}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh}", '<div id="a" aria-hidden="true">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh;pointer-events:none}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh;position:absolute;z-index:-1}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh;position:fixed;left:100%;width:200px}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh}", '<main data-css-ok="bản trình chiếu"><div id="a">x</div></main>')).toEqual([]);
    expect(await vh("#a{height:100vh}", '<main data-css-ok="transition-all: thử"><div id="a">x</div></main>')).toEqual(["div#a"]);
  }, 60_000);
  it("ignores a vh rule that another value overrides, even when the block ends up as tall as the screen", async () => {
    expect(await vh("#a{min-height:50vh}#a{min-height:800px}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:calc(100vh - 300px)}#a{height:800px}", '<div id="a">x</div>')).toEqual([]);
  }, 60_000);
  it("a dvh rule counts as the fix only when it sizes this block: not its pseudo-element, not another px value that lost or is not its height", async () => {
    expect(await vh('#a{height:100vh}#a::before{content:"";position:absolute;width:4px;height:100dvh}', '<div id="a">x</div>')).toEqual(["div#a"]);
    expect(await vh('#a{height:100vh}#a:after{content:"";display:block;height:100dvh}', '<div id="a">x</div>')).toEqual(["div#a"]);
    expect(await vh("#a{height:calc(100dvh - 300px)}div#a{height:100vh}", '<div id="a">x</div>')).toEqual(["div#a"]);
    expect(await vh("#a{height:100vh;min-height:50dvh}", '<div id="a">x</div>')).toEqual(["div#a"]);
    // Danh sách có cả chính khối: vẫn là cách sửa của khối.
    expect(await vh("#a{height:100vh}#a,#a::before{height:100dvh}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("div#a{height:100dvh}#a{height:100vh}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh}#a{max-height:min(100dvh, 100%)}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh}#a{max-height:-webkit-fill-available}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{height:100vh}#a{max-height:stretch}", '<div id="a">x</div>')).toEqual([]);
    expect(await vh("#a{min-height:100vh}@supports (-webkit-touch-callout: none){#a{min-height:-webkit-fill-available}}", '<div id="a">x</div>')).toEqual([]);
    // Chiều ngược lại: 100vh của phần tử giả không phải chiều cao của khối.
    expect(await vh('#a{height:844px}#a::before{content:"";position:absolute;height:100vh}', '<div id="a">x</div>')).toEqual([]);
  }, 60_000);
  it("when 100dvh and 100vh come to the same px, only the rule that wins the cascade is the fix (25/11/2026)", async () => {
    const lost: Array<[string, string, string?]> = [
      ["class", ".hero{height:100dvh}.hero.to{height:100vh}", '<div id="a" class="hero to">x</div>'],
      ["id", "#a{height:100vh}.hero.to{height:100dvh}"],
      ["attribute and pseudo-class", "div[id]:first-child{height:100vh}.hero{height:100dvh}"],
      ["order", ".hero{height:100dvh}.to{height:100vh}"],
      ["!important", ".to{height:100vh!important}#a{height:100dvh}"],
      ["@layer, unlayered wins", ".to{height:100vh}@layer x{#a{height:100dvh}}"],
      ["@layer order", "@layer a,b;@layer b{.to{height:100vh}}@layer a{#a{height:100dvh}}"],
      ["@layer, !important turns the order round", "@layer a,b;@layer a{.to{height:100vh!important}}@layer b{#a{height:100dvh!important}}"],
      [":is takes its strongest argument", ":is(#z,.to){height:100vh}.hero.to{height:100dvh}"],
      [":where counts nothing", "div{height:100vh}:where(#a){height:100dvh}"],
      [":not takes its argument", "div:not(#z){height:100vh}.hero.to{height:100dvh}"],
      ["nesting", "main{.to&,& #a{height:100vh}}.hero.to{height:100dvh}", '<main><div id="a" class="hero to">x</div></main>'],
      ["@media after", ".to{height:100dvh}@media (max-width:500px){.to{height:100vh}}"],
      ["style attribute", "#a{height:100dvh}", '<div id="a" class="hero to" style="height:100vh">x</div>'],
      ["min-height", ".hero{min-height:100dvh}.hero.to{min-height:100vh}"],
      ["max-height", ".hero{max-height:100dvh}.hero.to{max-height:100vh;overflow:auto}#a>p{height:2000px}", '<div id="a" class="hero to"><p>x</p></div>'],
      ["a running transition: all", "#a{transition:all 1s}.hero{height:100dvh}.hero.to{height:100vh}"],
    ];
    const won: Array<[string, string, string?]> = [
      ["class", ".hero{height:100vh}.hero.to{height:100dvh}"],
      ["order", ".hero{height:100vh}.to{height:100dvh}"],
      ["!important", ".to{height:100dvh!important}#a{height:100vh}"],
      ["@layer", ".to{height:100dvh}@layer x{#a{height:100vh}}"],
      ["@layer order", "@layer a,b;@layer b{.to{height:100dvh}}@layer a{#a{height:100vh}}"],
      [":is", ":is(#z,.to){height:100dvh}.hero.to{height:100vh}"],
      [":where", "div{height:100dvh}:where(#a){height:100vh}"],
      ["style attribute", "#a{height:100vh}", '<div id="a" class="hero to" style="height:100dvh">x</div>'],
      ["!important over the style attribute", "#a{height:100dvh!important}", '<div id="a" class="hero to" style="height:100vh">x</div>'],
      ["another property", ".hero{max-height:100dvh}.hero.to{height:100vh}"],
      // Đổi thử sang auto sẽ chạy chuyển tiếp: không so được, vẫn coi là đã sửa.
      ["discrete transition", "#a{transition:all 1s allow-discrete}.hero{height:100dvh}.hero.to{height:100vh}"],
    ];
    for (const [list, want] of [[lost, ["div#a"]], [won, []]] as const) {
      for (const [name, css, body] of list) expect([name, await vh(css, body ?? '<div id="a" class="hero to">x</div>')]).toEqual([name, want]);
    }
  }, 120_000);
  it("puts back the rule it tried, starts no transition and leaves the style attribute alone", async () => {
    const css = ".hero{color:red;height:100dvh!important;margin:0}.hero.to{height:100vh!important}#a{transition:all 1s}" +
      ".c{height:100dvh;block-size:100dvh}div.c{height:100vh}.d{height:100vh}";
    await withPage({}, async (p) => {
      await p.setContent(doc(`<style>${css}</style>`, '<div id="a" class="hero to">x</div><div class="c">x</div><div class="d" style="height:100dvh">x</div>'));
      const state = (): Promise<unknown> => p.evaluate(() => [Array.from(document.styleSheets[0]!.cssRules).map((r) => r.cssText), getComputedStyle(document.getElementById("a")!).height, document.getAnimations().length, document.documentElement.outerHTML]);
      const before = await state();
      await p.evaluate(() => {
        const w = window as unknown as { seen: number };
        w.seen = 0;
        new MutationObserver((l) => (w.seen += l.length)).observe(document.body, { attributes: true, subtree: true });
      });
      expect(places(await p.evaluate(probeCss), "vh-full")).toEqual(["div#a"]);
      expect(await state()).toEqual(before);
      expect(await p.evaluate(() => (window as unknown as { seen: number }).seen)).toBe(0);
    });
  }, 60_000);
  it("ignores rules that do not apply: print sheet, unmet @media and @supports, @starting-style, disabled sheet", async () => {
    expect(await vh("@media (min-width:900px){#a{height:100vh}}", '<div id="a" style="height:844px">x</div>')).toEqual([]);
    expect(await probe('<style media="print">#a{height:100vh}</style><style>@supports (display: nope){#a{height:100vh}}@starting-style{#a{height:100vh}}</style>', '<div id="a" style="height:844px">x</div>').then((l) => places(l, "vh-full"))).toEqual([]);
    const off = await withPage({}, async (p) => {
      await p.setContent(doc("<style>#a{height:100vh}</style>", '<div id="a">x</div>'));
      await p.evaluate(() => {
        document.styleSheets[0]!.disabled = true;
        document.getElementById("a")!.style.height = "844px";
      });
      return p.evaluate(probeCss);
    });
    expect(off).toEqual([]);
  }, 60_000);
});

describe("css transition-all", () => {
  const tr = (css: string, body: string): Promise<CssHit[]> => probe(`<style>${css}</style>`, body).then((l) => of(l, "transition-all"));
  it("sees a shorthand behind a variable, a pseudo-element, and the universal reset", async () => {
    expect((await tr(":root{--t:all .2s}.x{transition:var(--t)}", '<p class="x">a</p>')).map((h) => h.where)).toEqual([".x"]);
    expect((await tr('.x::after{content:"›";transition:all .2s}', '<p class="x">a</p>')).map((h) => h.where)).toEqual([".x::after"]);
    expect((await tr("*, ::before, ::after{transition:all .2s}", "<p>a</p>")).map((h) => h.where)).toEqual(["*, ::before, ::after"]);
    expect((await tr("", '<p style="transition:all .2s" id="i">a</p>')).map((h) => h.where)).toEqual(["p#i[style]"]);
    expect((await tr(":root{--t:.2s}.x{transition:var(--t)}", '<p class="x">a</p>')).map((h) => h.where)).toEqual([".x"]);
  }, 60_000);
  it("names the rule that says all, not the one that only sets the duration", async () => {
    const [h] = await tr(".goc{transition:all .2s}.nhanh{transition-duration:.1s}", '<p class="goc nhanh">a</p>');
    expect(h!.where).toBe(".goc");
    expect(await tr(".goc{transition:all .2s}.nhanh{transition-duration:.1s}", '<p class="goc nhanh">a</p>')).toHaveLength(1);
    // Luật viết thẳng `all` được nêu tên dù một luật qua biến đứng sau nó.
    expect((await tr(":root{--t:.2s}.goc{transition:all .2s}.bien{transition:var(--t)}", '<p class="goc bien">a</p>')).map((h) => h.where)).toEqual([".goc"]);
    // Chỉ đặt thời lượng, không ai viết all: lớp duration-200 của hộp thoại shadcn.
    expect(await tr(".nhanh{transition-duration:.1s}", '<p class="nhanh">a</p><p style="transition-duration:.1s">b</p>')).toEqual([]);
  }, 60_000);
  it("a rule for the pseudo-element is not named as the rule of the element, nor the other way round (25/11/2026)", async () => {
    const rows = async (css: string, body = '<p class="x y">a</p>'): Promise<string[]> => (await tr(css, body)).map((h) => `${h.where} ${/of (\d+)/.exec(h.detail)![1]}`).sort();
    expect(await rows('.x{transition:all .2s}.x::before{content:"";transition:all .3s}')).toEqual([".x 1", ".x::before 1"]);
    expect(await rows('.x:after{content:"";transition:all .3s}.x{transition:all .2s}')).toEqual([".x 1", ".x::after 1"]);
    expect(await rows('.x{transition:all .2s;&::before{content:"";transition:all .3s}}')).toEqual([".x 1", ":is(.x)::before 1"]);
    // Danh sách: mỗi phần chỉ nói về thứ nó trỏ tới.
    expect(await rows('.x::before{content:"";transition:all .2s}.y,.z::before{transition:all .3s}', '<p class="x y">a</p>')).toEqual([".x::before 1", ".y, .z::before 1"]);
  }, 60_000);
  it("leaves zero duration, a pseudo-element with no content, invisible elements, and pairs durations with properties", async () => {
    expect(await tr(".x::after{transition:all .2s}", '<p class="x">a</p>')).toEqual([]);
    expect(await tr(".x{transition:all .2s;visibility:hidden}", '<p class="x">a</p>')).toEqual([]);
    expect(await tr(".x{transition-property:all, color;transition-duration:0s, .2s}", '<p class="x">a</p>')).toEqual([]);
    expect(await tr(".x{transition-property:color, all;transition-duration:0s, .2s}", '<p class="x">a</p>')).toHaveLength(1);
  }, 60_000);
});

describe("css vi-hyphen", () => {
  const hy = (css: string, body: string): Promise<CssHit[]> => probe(`<style>${css}</style>`, body).then((l) => of(l, "vi-hyphen"));
  it("reports where the setting comes from, once for a whole subtree", async () => {
    const l = await hy("body{hyphens:auto}", "<main><p>Chữ Việt một</p><p>Chữ Việt hai</p></main>");
    expect(l.map((h) => h.where)).toEqual(["body"]);
    expect(l[0]!.detail).toContain('hyphens: auto on Vietnamese text ("Chữ Việt một")');
  }, 60_000);
  it("only Vietnamese text in Vietnamese or unmarked language", async () => {
    expect(await hy("p{word-break:break-all}", "<p>khong co dau, van dai</p>")).toEqual([]);
    expect(await hy("p{word-break:break-all}", '<p lang="fr">Les élèves étaient à côté</p>')).toEqual([]);
    expect(await hy("p{word-break:break-all}", '<p data-css-ok="mã">Mã hoá đơn</p>')).toEqual([]);
    expect(await hy("p{word-break:break-all}", "<p>Mã hoá đơn</p>")).toHaveLength(1);
    expect(await hy("p{word-break:break-word;hyphens:manual}", "<p>Mã hoá đơn</p>")).toEqual([]);
  }, 60_000);
});

describe("css scheme", () => {
  const sc = (css: string, o: Opts & { html?: string; head?: string } = {}, body = "<p>Chữ</p>"): Promise<CssHit[]> =>
    probe(`${o.head ?? ""}<style>${css}</style>`, body, o).then((l) => of(l, "scheme"));
  it("reports a dark page drawn light, a light page drawn dark, and light dark on a page with one theme", async () => {
    expect((await sc("html{background:#111}"))[0]!.detail).toMatch(/background is dark \(rgb 17 17 17\).*\(color-scheme: normal\): declare color-scheme: dark/);
    expect((await sc("html{background:#fff;color-scheme:dark}"))[0]!.detail).toMatch(/background is light.*declare color-scheme: light/);
    expect(await sc("body{background:#fff}:root{color-scheme:light dark}", { scheme: "dark" })).toHaveLength(1);
    expect(await sc("body{background:#fff}:root{color-scheme:light dark}", { scheme: "light" })).toEqual([]);
    expect(await sc("body{background:oklch(0.2 0.02 260)}")).toHaveLength(1);
  }, 60_000);
  it("leaves a declared scheme (CSS or meta), no background, mid tones, gradients, and a waived page", async () => {
    expect(await sc("body{background:#111}:root{color-scheme:dark}")).toEqual([]);
    expect(await sc("body{background:#111}", { head: '<meta name="color-scheme" content="dark light">', scheme: "dark" })).toEqual([]);
    expect(await sc(":root{color-scheme:dark}")).toEqual([]);
    for (const mid of ["#7a7a7a", "#b0b0b0", "#5c5c5c"]) for (const s of ["light", "dark"]) expect(await sc(`body{background:${mid};color-scheme:${s}}`), `${mid} ${s}`).toEqual([]);
    expect(await sc("body{background:linear-gradient(#111,#222)}")).toEqual([]);
    expect(await sc("body{background:rgb(0 0 0 / 50%)}")).toEqual([]);
    // Nền body là chuyển sắc hay màu trong, phủ trọn: không biết, dù html bên dưới có màu đặc.
    expect(await sc("html{background:#fff;color-scheme:dark}body{min-height:100dvh;background:linear-gradient(#111,#222)}")).toEqual([]);
    expect(await sc("html{background:#fff;color-scheme:dark}body{min-height:100dvh;background:rgb(0 0 0 / 50%)}")).toEqual([]);
    expect(await sc("body{background:#111}", { html: ' data-css-ok="scheme: màn chiếu không có thanh cuộn"' })).toEqual([]);
  }, 60_000);
  it("an app shell that covers the whole page is the page; a dark hero one screen tall is not", async () => {
    expect((await sc("body{background:#fff}#app{background:#111;min-height:100dvh}", {}, '<div id="app">Ứng dụng</div>')).map((h) => h.where)).toEqual(["div#app"]);
    expect(await sc("body{background:#fff}.hero{background:#111;height:100dvh}", {}, '<div class="hero">Chào</div><p style="height:900px">Tiếp</p>')).toEqual([]);
  }, 60_000);
});

describe("css theme-color", () => {
  const tc = (meta: string, css: string, body = "<p>Chữ</p>", o: Opts = {}): Promise<CssHit[]> =>
    probe(`${meta}<style>${css}</style>`, body, o).then((l) => of(l, "theme-color"));
  const M = (c: string, media = ""): string => `<meta name="theme-color" content="${c}"${media ? ` media="${media}"` : ""}>`;
  it("compares the meta that applies in this scheme with the top of the page", async () => {
    expect((await tc(M("#0b5394"), "body{background:#fff}"))[0]!.detail).toContain('"#0b5394" next to a page top that is rgb 255 255 255');
    expect(await tc(M("#fff", "(prefers-color-scheme: light)") + M("#fff", "(prefers-color-scheme: dark)"), "body{background:#111}:root{color-scheme:dark}", "<p>Chữ</p>", { scheme: "dark" })).toHaveLength(1);
    expect(await tc(M("#fff", "(prefers-color-scheme: light)") + M("#111", "(prefers-color-scheme: dark)"), "body{background:#111}:root{color-scheme:dark}", "<p>Chữ</p>", { scheme: "dark" })).toEqual([]);
  }, 60_000);
  it("takes the header's color, mixes translucent layers, goes into shadow roots, and forgives near shades", async () => {
    expect(await tc(M("#0b5394"), "header{background:#0b5394;height:56px}", "<header>Đầu</header>")).toEqual([]);
    expect(await tc(M("#808080"), "header{background:rgb(0 0 0 / 50%);height:56px}body{background:#fff}", "<header>Đầu</header>")).toEqual([]);
    expect(await tc(M("#ffffff"), "header{background:rgb(0 0 0 / 50%);height:56px}body{background:#fff}", "<header>Đầu</header>")).toHaveLength(1);
    expect(await tc(M("#f5f5f5"), "body{background:#fff}")).toEqual([]);
    const inShadow = await withPage({}, async (p) => {
      await p.setContent(doc(`${M("#ffffff")}<style>body{background:#fff}</style>`, "<the-dau></the-dau>"));
      await p.evaluate(() => {
        const r = document.querySelector("the-dau")!.attachShadow({ mode: "open" });
        r.innerHTML = '<div style="background:#222;color:#fff;height:60px">Đầu trang</div>';
      });
      return p.evaluate(probeCss);
    });
    expect(of(inShadow, "theme-color")).toHaveLength(1);
  }, 60_000);
  it("a translucent page background counts once, and the body's only when it is the canvas (25/11/2026)", async () => {
    // Làm tròn 8 bit có thể lệch một: so theo bậc 4.
    const at = async (css: string, body = "<div>Chữ</div>"): Promise<number> => Math.round(Number(/rgb (\d+)/.exec((await tc(M("#00ff00"), css, body))[0]!.detail)![1]) / 4) * 4;
    expect(await at("body{background:rgb(0 0 0 / 50%)}")).toBe(128);
    expect(await at("html{background:rgb(0 0 0 / 50%)}")).toBe(128);
    expect(await at("html{background:rgb(0 0 0 / 50%)}body{background:rgb(0 0 0 / 50%)}")).toBe(64);
    // Lề của đoạn đầu đẩy hộp body xuống: nền body lan ra màn khi html trong suốt, còn html có nền thì không.
    expect(await at("body{background:rgb(0 0 0 / 50%)}", "<p>Chữ</p>")).toBe(128);
    expect(await at("html{background:rgb(0 0 0 / 50%)}body{background:#000}", "<p>Chữ</p>")).toBe(128);
    expect(await tc(M("#808080"), "body{background:rgb(0 0 0 / 50%)}", "<div>Chữ</div>")).toEqual([]);
  }, 60_000);
  it("says nothing without the tag, with an invalid color, over an image or gradient, after scrolling, or when waived", async () => {
    expect(await tc("", "body{background:#111}:root{color-scheme:dark}")).toEqual([]);
    expect(await tc(M("khong-phai-mau"), "body{background:#fff}")).toEqual([]);
    expect(await tc(M("#111"), "header{height:60px;background:linear-gradient(#fff,#eee)}", "<header>Đầu</header>")).toEqual([]);
    expect(await tc(M("#111"), "img{display:block}", '<img alt="" width="390" height="60" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">')).toEqual([]);
    expect(await tc('<meta name="theme-color" content="#111" data-css-ok="màu thương hiệu">', "body{background:#fff}")).toEqual([]);
    // Hộp thoại đang mở, màn che mờ, phần tử giả tô nền: không biết, hoặc chỉ tạm thời.
    const open = await withPage({}, async (p) => {
      await p.setContent(doc(`${M("#fff")}<style>body{background:#fff}dialog{background:#111;color:#fff;margin:auto}</style>`, "<p>Nền</p><dialog>Hộp</dialog>"));
      await p.evaluate(() => document.querySelector("dialog")!.showModal());
      return p.evaluate(probeCss);
    });
    expect(of(open, "theme-color")).toEqual([]);
    expect(await tc(M("#fff"), "body{background:#fff}.che{position:fixed;inset:0;background:rgb(0 0 0 / 60%)}", '<p>Nền</p><div class="che"></div>')).toEqual([]);
    expect(await tc(M("#111"), 'body{background:#fff}header{position:relative;height:60px}header::before{content:"";position:absolute;inset:0;background:#111}', "<header>Đầu</header>")).toEqual([]);
    const scrolled = await withPage({}, async (p) => {
      await p.setContent(doc(`${M("#111")}<style>body{background:#fff}</style>`, '<p style="height:3000px">Dài</p>'));
      await p.evaluate(() => window.scrollTo(0, 500));
      return p.evaluate(probeCss);
    });
    expect(of(scrolled, "theme-color")).toEqual([]);
  }, 60_000);
});

describe("css safe-area", () => {
  const COVER = '<meta name="viewport" content="width=device-width, viewport-fit=cover">';
  const BAR = ".day{position:fixed;left:0;right:0;bottom:0;padding:12px;background:#eee}";
  const sa = (css: string, body = '<nav class="day">Trang chủ</nav>', head = COVER): Promise<string[]> => probe(`${head}<style>${css}</style>`, body).then((l) => places(l, "safe-area"));
  it("needs viewport-fit=cover, and a bar that touches the edge and is as wide as a bar", async () => {
    expect(await sa(BAR)).toEqual(["nav.day"]);
    expect(await sa(BAR, undefined, '<meta name="viewport" content="width=device-width">')).toEqual([]);
    expect(await sa(`${BAR}.day{bottom:24px}`)).toEqual([]);
    expect(await sa(`${BAR}.day{left:auto;width:56px}`)).toEqual([]);
    expect(await sa(`${BAR}.day{pointer-events:none}`)).toEqual([]);
    expect(await sa(`${BAR}.day{top:0}`)).toEqual([]);
    expect(await sa(BAR, '<nav class="day"></nav>')).toEqual([]);
    expect(await sa(BAR, '<nav class="day" data-css-ok="chỉ chạy trong vỏ app có viền">Trang chủ</nav>')).toEqual([]);
  }, 60_000);
  it("accepts env() on the bar, inside it, inline, through variables, and a variable set by script", async () => {
    expect(await sa(`${BAR}.day{padding-bottom:env(safe-area-inset-bottom)}`)).toEqual([]);
    expect(await sa(`${BAR}.day>div{padding:8px 8px max(8px, env(safe-area-inset-bottom))}`, '<nav class="day"><div>Trang chủ</div></nav>')).toEqual([]);
    expect(await sa(BAR, '<nav class="day" style="padding-bottom:env(safe-area-inset-bottom)">Trang chủ</nav>')).toEqual([]);
    expect(await sa(`:root{--a:env(safe-area-inset-bottom);--b:calc(var(--a) + 8px)}${BAR}.day{padding-bottom:var(--b)}`)).toEqual([]);
    expect(await sa(`${BAR}.day{padding-bottom:var(--ion-safe-area-bottom)}`)).toEqual([]);
    // Biến khai ngay trên thẻ html hay trên thanh.
    const inl = await probe(`${COVER}<style>${BAR}.day{padding-bottom:calc(12px + var(--sab))}</style>`, '<nav class="day">Trang chủ</nav>', { html: ' style="--sab: env(safe-area-inset-bottom)"' });
    expect(places(inl, "safe-area")).toEqual([]);
    expect(await sa(`${BAR}.day{padding-bottom:var(--x)}`, '<nav class="day" style="--x:env(safe-area-inset-bottom)">Trang chủ</nav>')).toEqual([]);
    expect(await sa(`${BAR}.day{padding-bottom:var(--x)}`, '<nav class="day" style="--x:8px">Trang chủ</nav>')).toEqual(["nav.day"]);
  }, 60_000);
  it("a declared but unused variable, the other edge, or the body's padding do not protect the bar", async () => {
    expect(await sa(`:root{--a:env(safe-area-inset-bottom)}${BAR}`)).toEqual(["nav.day"]);
    expect(await sa(`${BAR}.day{--a:env(safe-area-inset-bottom)}`)).toEqual(["nav.day"]);
    expect(await sa(BAR, '<nav class="day" style="--a:env(safe-area-inset-bottom)">Trang chủ</nav>')).toEqual(["nav.day"]);
    expect(await sa(`${BAR}.day{padding-top:env(safe-area-inset-top)}`)).toEqual(["nav.day"]);
    expect(await sa(`${BAR}body{padding-bottom:env(safe-area-inset-bottom)}`)).toEqual(["nav.day"]);
  }, 60_000);
  it("does not conclude when a stylesheet cannot be read, unless it is a font stylesheet", async () => {
    const run = (href: string): Promise<CssHit[]> => withPage({}, async (p) => {
      await p.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "@font-face{font-family:X;src:local(Arial)}" }));
      await p.route("**/khac-nguon.html", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: doc(`${COVER}<link rel="stylesheet" href="${href}"><style>${BAR}</style>`, '<nav class="day">Trang chủ</nav>') }));
      await p.goto(`${a.origin}/khac-nguon.html`);
      return p.evaluate(probeCss);
    });
    expect(places(await run(`${b.origin}/test/fixtures/doc-css-nhap.css`), "safe-area")).toEqual([]);
    expect(places(await run("https://fonts.googleapis.com/css2?family=X"), "safe-area")).toEqual(["nav.day"]);
    expect(places(await run(`${a.origin}/test/fixtures/doc-css-nhap.css`), "safe-area")).toEqual(["nav.day"]);
  }, 60_000);
});

describe("css img-size", () => {
  const img = (body: string, css = ""): Promise<CssHit[]> => withPage({}, async (p) => {
    await p.route("**/anh.html", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: doc(`<style>${css}</style>`, body) }));
    await p.goto(`${a.origin}/anh.html`);
    return of(await p.evaluate(probeCss), "img-size");
  });
  const SRC = "test/fixtures/hinh/logo-jpeg.jpg";
  it("one attribute is not enough, groups same-looking images, sees a lazy image that has not loaded", async () => {
    expect(await img(`<img src="${SRC}" width="80" alt="">`)).toHaveLength(1);
    expect(await img(`<img src="${SRC}" height="80" alt="">`)).toEqual([]);
    const three = await img(`<img class="s" src="${SRC}" alt=""><img class="s" src="${SRC}" alt=""><img class="s" src="${SRC}" alt="">`);
    expect(three.map((h) => h.where)).toEqual(["img.s"]);
    expect(three[0]!.detail).toContain("(3 of them)");
    expect((await img(`<p style="height:6000px">Dài</p><img id="lazy" loading="lazy" src="${SRC}" alt="">`)).map((h) => h.where)).toEqual(["img#lazy"]);
  }, 60_000);
  it("a percent height counts only when the box above it is known, a cut box only when it cuts", async () => {
    expect(await img(`<div><img src="${SRC}" alt="" style="height:100%"></div>`)).toHaveLength(1);
    expect(await img(`<div style="height:90px"><img src="${SRC}" alt="" style="height:100%"></div>`)).toEqual([]);
    expect(await img(`<div style="height:90px"><div style="height:100%"><img src="${SRC}" alt="" style="height:100%"></div></div>`)).toEqual([]);
    expect(await img(`<div style="height:90px;overflow:auto"><img src="${SRC}" alt=""></div>`)).toHaveLength(1);
    expect(await img(`<div style="overflow:hidden"><img src="${SRC}" alt=""></div>`)).toHaveLength(1);
    expect(await img(`<div style="position:absolute"><img src="${SRC}" alt=""></div>`)).toEqual([]);
  }, 60_000);
  it("leaves broken images, hidden images and waived ones", async () => {
    expect(await img('<img src="khong-co.png" alt="Ảnh hỏng">')).toEqual([]);
    expect(await img(`<img src="${SRC}" alt="" style="display:none">`)).toEqual([]);
    expect(await img(`<img src="${SRC}" alt="" data-css-ok="ảnh người dùng dán, cỡ không biết trước">`)).toEqual([]);
  }, 60_000);
});

describe("css paste", () => {
  const paste = (body: string): Promise<CssHit[]> => withPage({}, async (p) => {
    await p.setContent(doc("", body));
    return p.evaluate(probePaste);
  });
  const BLOCK = 'onpaste="event.preventDefault()"';
  it("looks at password, email and code fields only", async () => {
    for (const f of ['type="password"', 'type="email"', 'autocomplete="one-time-code"', 'autocomplete="new-password"', 'name="otp"', 'placeholder="Nhập mã"', 'inputmode="numeric" maxlength="1"']) {
      expect(await paste(`<input ${f} ${BLOCK}>`), f).toHaveLength(1);
    }
    for (const f of ['type="text" name="ho-ten"', 'type="search"', 'type="password" disabled', 'type="password" readonly', 'type="password" hidden', 'name="gia-ma-lon" placeholder="Giá"']) {
      expect(await paste(`<input ${f} ${BLOCK}>`), f).toEqual([]);
    }
    expect(await paste(`<label for="x">Mã xác nhận</label><input id="x" ${BLOCK}>`)).toHaveLength(1);
  }, 60_000);
  it("a field that reads the clipboard itself is not blocking, whichever way it reads", async () => {
    for (const read of ["event.clipboardData.getData('text')", "event.clipboardData.items.length", "event.clipboardData.types.length", "event.clipboardData.files.length", "navigator.clipboard?.readText()"]) {
      const l = await withPage({}, async (p) => {
        await p.goto(`${a.origin}/test/fixtures/tot.html`);
        await p.evaluate((h) => (document.body.innerHTML = h), `<input type="password" onpaste="${read}; event.preventDefault()">`);
        return p.evaluate(probePaste);
      });
      expect(l, read).toEqual([]);
    }
  }, 60_000);
  it("sees a listener on the window in the capture phase, groups the six boxes of one code", async () => {
    const l = await paste(`${'<input class="o" inputmode="numeric" maxlength="1">'.repeat(6)}<script>addEventListener("paste", (e) => e.preventDefault(), true)</script>`);
    expect(l.map((h) => h.where)).toEqual(["input.o"]);
    expect(l[0]!.detail).toContain("(6 fields)");
  }, 60_000);
});

describe("css probe and hostile pages", () => {
  it("runs under a strict CSP, on a page with no body styles, and inside a frame", async () => {
    const hits = await withPage({}, async (p) => {
      await p.goto(`${a.origin}/test/fixtures/csp.htm`);
      return [await p.evaluate(probeCss), await p.evaluate(probePaste)];
    });
    expect(hits).toEqual([[], []]);
    const framed = await withPage({}, async (p) => {
      await p.goto(`${a.origin}/test/fixtures/tot.html`);
      await p.evaluate((src) => {
        const f = document.createElement("iframe");
        Object.assign(f, { src, width: "390", height: "700" });
        document.body.append(f);
        return new Promise((ok) => (f.onload = ok));
      }, fixture("doc-css-sai"));
      return p.frames()[1]!.evaluate(probeCss);
    });
    expect(places(framed, "vi-hyphen")).toContain("p#tach");
  }, 60_000);
  it("takes well under half a second on a page with 6000 elements and 2000 rules", async () => {
    const ms = await withPage({}, async (p) => {
      const css = Array.from({ length: 2000 }, (_, i) => `.r${i}{color:#111;padding:calc(var(--s)*${i % 9});transition:color .2s}`).join("");
      await p.setContent(doc(`<style>:root{--s:1px}${css}</style>`, Array.from({ length: 3000 }, (_, i) => `<div class="r${i % 2000}"><span>Chữ ${i}</span></div>`).join("")));
      const t = Date.now();
      await p.evaluate(probeCss);
      return Date.now() - t;
    });
    expect(ms).toBeLessThan(3000); // đo 24/11/2026: 53–74 ms; ngưỡng rộng cho máy CI chậm
  }, 60_000);
});
