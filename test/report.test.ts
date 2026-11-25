// Cách báo (K9, 24/11/2026): mã phát hiện, lưu và so lượt chạy, đo lại theo mã (hàm thuần); tìm phần tử theo nhãn, vẽ khung đánh
// số (chạy trong trang).
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser, startServer } from "../src/browser.js";
import { probeLangParts } from "../src/langparts.js";
import { probeFingerprint, probeFocus, probePage } from "../src/probe.js";
import { clearMarks, diffRuns, drawMarks, findingId, labelOf, loadRun, locateLabels, recheckPlan, type Run, type RunFinding, saveRun } from "../src/report.js";
import { probeTouch } from "../src/touch.js";

const root = join(__dirname, "..");

const F = (page: string, check: string, where: string, detail = "d", renders: string[] = ["light/390"], gate: "hard" | "soft" = "soft"): RunFinding => ({
  id: findingId({ page, check, where, detail }), gate, page, check, where, detail, renders,
});
const R = (pages: string[], findings: RunFinding[], more: Partial<Run> = {}): Run => ({
  v: 1, opts: "x", at: "2026-11-24T10:00:00.000Z", sizes: ["320x720", "390x844", "1280x800"], schemes: ["light", "dark"], pages, skipped: [], findings, ...more,
});

describe("findingId", () => {
  const base = { page: "a.html", check: "text-clip", where: 'p#x "Chữ"', detail: "text cut off 12px of 14.5px at 390px" };
  it("is six easy characters, the same every time", () => {
    expect(findingId(base)).toMatch(/^[0-9a-hjkmnp-tv-z]{6}$/);
    expect(findingId({ ...base })).toBe(findingId(base));
    // Ghim một giá trị: đổi cách băm là mọi mã đã ghi trong lượt trước hết khớp.
    expect(findingId({ page: "p", check: "c", where: "w", detail: "d" })).toBe("qgqqwm");
  });
  it("ignores numbers in the detail (units and decimals kept apart), spacing, NFC form, the count in +N more, and slashes", () => {
    expect(findingId({ ...base, detail: "text cut off 13px of 15,25px at 320px" })).toBe(findingId(base));
    expect(findingId({ ...base, detail: "text cut off  12px of 14.5px\n at 390px" })).toBe(findingId(base));
    expect(findingId({ ...base, detail: "chữ ấ".normalize("NFD") })).toBe(findingId({ ...base, detail: "chữ ấ" }));
    expect(findingId({ ...base, where: "+3 more" })).toBe(findingId({ ...base, where: "+11 more" }));
    expect(findingId({ ...base, page: "blocks\\a.html" })).toBe(findingId({ ...base, page: "blocks/a.html" }));
  });
  it("two axe violations on one page keep two ids: the selector is not normalized, the measured part is", () => {
    const ax = (detail: string, check = "axe"): string => findingId({ page: "a.html", check, where: "color-contrast", detail });
    expect(ax("#nut-1: contrast of 2.32")).not.toBe(ax("#nut-2: contrast of 2.32"));
    expect(ax("#nut-1: contrast of 2.32")).toBe(ax("#nut-1: contrast of 2.41"));
    expect(ax(".a > li:nth-child(3): x", "axe-bp")).not.toBe(ax(".a > li:nth-child(4): x", "axe-bp"));
    // axe không kèm lời báo (luật list: kiểm tra hỏng nằm ở "none"): cả detail là bộ chọn (25/11/2026).
    expect(ax("#ds-1")).not.toBe(ax("#ds-2"));
    expect(ax("#ds-1", "axe-bp")).not.toBe(ax("#ds-2", "axe-bp"));
    // Phép đo khác không có bộ chọn đứng trước dấu hai chấm: số vẫn được bỏ.
    expect(findingId({ ...base, detail: "cut 12px: text" })).toBe(findingId({ ...base, detail: "cut 13px: text" }));
  });
  it("changes with the page, the check, the place and the words", () => {
    const ids = [base, { ...base, page: "b.html" }, { ...base, check: "touch" }, { ...base, where: "p#y" }, { ...base, where: "390x844" }, { ...base, where: "1280x720" }, { ...base, detail: "text covered" }].map(findingId);
    expect(new Set(ids).size).toBe(ids.length);
    // 5.000 phát hiện khác nhau, không trùng mã nào.
    expect(new Set(Array.from({ length: 5000 }, (_, i) => findingId({ ...base, where: `p#x${i}` }))).size).toBe(5000);
  });
});

describe("saveRun and loadRun", () => {
  const dir = join(root, ".design-kit", "test", "luot");
  const file = join(dir, "sau", "last.json");
  it("round-trips, makes the folder, leaves no temporary file", () => {
    rmSync(dir, { recursive: true, force: true });
    const run = R(["a.html"], [F("a.html", "touch", "button#x")]);
    saveRun(file, run);
    saveRun(file, run);
    expect(loadRun(file)).toEqual(run);
    expect(readdirSync(join(dir, "sau"))).toEqual(["last.json"]);
  });
  it("a missing, broken, foreign or half-written file is no run, not an error", () => {
    expect(loadRun(join(dir, "khong-co.json"))).toBeUndefined();
    mkdirSync(dir, { recursive: true });
    const bad = join(dir, "bad.json");
    const ok = R(["a.html"], [F("a.html", "touch", "x")]);
    for (const text of ["{", "null", "[]", JSON.stringify({ ...ok, v: 2 }), JSON.stringify({ ...ok, opts: undefined }), JSON.stringify({ ...ok, opts: 3 }), JSON.stringify({ ...ok, pages: "a" }), JSON.stringify({ ...ok, sizes: [1] }), JSON.stringify({ ...ok, findings: [{ id: "x" }] }), JSON.stringify({ ...ok, findings: [null] }), JSON.stringify({ ...ok, skipped: undefined })]) {
      writeFileSync(bad, text);
      expect(loadRun(bad), text.slice(0, 40)).toBeUndefined();
    }
    writeFileSync(bad, JSON.stringify(ok));
    expect(loadRun(bad)).toEqual(ok);
  });
});

describe("diffRuns", () => {
  const x = F("a.html", "touch", "button#x");
  const y = F("a.html", "copy", "p#y");
  const z = F("b.html", "touch", "button#z");
  const w = F("a.html", "cls", "page");
  it("counts fixed, added and same on the pages both runs measured", () => {
    const d = diffRuns(R(["a.html", "b.html"], [x, y, z]), R(["a.html", "b.html"], [y, w, z]));
    expect(d).toEqual({ fixed: [x], added: [w], same: 2, pages: 2 });
  });
  it("a page that did not run this time is not fixed, a new page is not added", () => {
    expect(diffRuns(R(["a.html", "b.html"], [x, z]), R(["a.html"], [x]))).toEqual({ fixed: [], added: [], same: 1, pages: 1 });
    expect(diffRuns(R(["a.html"], [x]), R(["a.html", "b.html"], [x, z]))).toEqual({ fixed: [], added: [], same: 1, pages: 1 });
    expect(diffRuns(R(["a.html"], [x]), R(["b.html"], [z]))).toMatchObject({ fixed: [], added: [], same: 0, pages: 0, why: "no page in common" });
  });
  it("different sizes or schemes are not compared; another order is", () => {
    expect(diffRuns(R(["a.html"], [x]), R(["a.html"], [], { sizes: ["390x844"] }))).toMatchObject({ fixed: [], pages: 0, why: expect.stringContaining("sizes differ (320x720, 390x844, 1280x800 then, 390x844 now)") });
    expect(diffRuns(R(["a.html"], [x]), R(["a.html"], [], { sizes: ["320x720", "390x700", "1280x800"] })).pages).toBe(0);
    expect(diffRuns(R(["a.html"], [x]), R(["a.html"], [], { schemes: ["light"] })).why).toContain("color schemes differ");
    // Lượt này đo thêm khổ hay chế độ màu cũng là bộ khác.
    expect(diffRuns(R(["a.html"], [x], { schemes: ["light"] }), R(["a.html"], [])).why).toContain("color schemes differ");
    expect(diffRuns(R(["a.html"], [x], { sizes: ["390x844"] }), R(["a.html"], [])).why).toContain("sizes differ");
    expect(diffRuns(R(["a.html"], [x]), R(["a.html"], [], { schemes: ["dark", "light"], sizes: ["1280x800", "320x720", "390x844"] })).fixed).toEqual([x]);
  });
  it("other options are not compared: the sweep, focus stops, the touch size, the engine", () => {
    const d = diffRuns(R(["a.html"], [x], { opts: "sweep on" }), R(["a.html"], [], { opts: "sweep off" }));
    expect(d).toEqual({ fixed: [], added: [], same: 0, pages: 0, why: "options differ (sweep on then, sweep off now)" });
  });
  it("a check switched off in either run says nothing", () => {
    expect(diffRuns(R(["a.html"], [x, y]), R(["a.html"], [x], { skipped: ["copy"] }))).toMatchObject({ fixed: [], added: [], same: 1 });
    expect(diffRuns(R(["a.html"], [x], { skipped: ["copy"] }), R(["a.html"], [x, y]))).toMatchObject({ fixed: [], added: [], same: 1 });
  });
  it("a blank page or a state that cannot be reached hides findings, it does not fix them", () => {
    const blank = F("a.html", "render", "page", "nothing visible", ["light/390"], "hard");
    const stuck = F("a.html", "steps", "mo", "selector not found", ["light/390"], "hard");
    for (const lost of [blank, stuck]) {
      expect(diffRuns(R(["a.html", "b.html"], [x, y, z]), R(["a.html", "b.html"], [lost]))).toEqual({ fixed: [z], added: [lost], same: 0, pages: 2 });
      expect(diffRuns(R(["a.html"], [lost]), R(["a.html"], [x, y]))).toEqual({ fixed: [lost], added: [], same: 0, pages: 1 });
    }
    // `render` mềm (thẻ tự làm chưa định nghĩa) không phải trang trắng.
    expect(diffRuns(R(["a.html"], [x]), R(["a.html"], [{ ...blank, gate: "soft" }])).fixed).toEqual([x]);
  });
});

describe("recheckPlan", () => {
  const a = F("a.html", "touch", "button#x", "d", ["touch/390"]);
  const b = F("a.html", "axe", "color-contrast", "d", ["dark/1280", "dark/390"], "hard");
  const c = F("a.html?dk=dem #loi", "focus", "input#m", "d", ["light/390"]);
  const d = F("http://localhost:5173/#/trang", "overflow", "320px", "d", ["mobile/320"], "hard");
  const e = F("a.html", "render", "page", "page did not load", ["load"], "hard");
  const s = F("b.html", "sticky", "844x390", "d", ["light/844"]);
  const run = R(["a.html"], [a, b, c, d, e, s]);
  it("merges the widths and schemes of one page, keeps states and queries apart", () => {
    expect(recheckPlan(run, [a.id, b.id])).toEqual({ items: [{ page: "a.html", widths: [390, 1280], schemes: ["light", "dark"] }], unknown: [] });
    expect(recheckPlan(run, [c.id, d.id]).items).toEqual([
      { page: "a.html?dk=dem", state: "loi", widths: [390], schemes: ["light"] },
      { page: "http://localhost:5173/#/trang", widths: [320], schemes: ["light"] },
    ]);
    expect(recheckPlan(run, [b.id]).items[0]!.schemes).toEqual(["dark"]);
  });
  it("a finding with no size means every size; a swept size means the sweep", () => {
    expect(recheckPlan(run, [e.id]).items).toEqual([{ page: "a.html", widths: [320, 390, 1280], schemes: ["light", "dark"] }]);
    expect(recheckPlan(run, [s.id]).items).toEqual([{ page: "b.html", widths: [1280], schemes: ["light"], sweep: true }]);
  });
  it("a file name with ' #' is not a state: only a name steps files allow is cut off (25/11/2026)", () => {
    const f = F("bao cao #2.html", "touch", "button#x");
    const g = F("bao cao #2.html?dk=dem #mo-ra", "touch", "button#x");
    expect(recheckPlan(R(["bao cao #2.html"], [f, g]), [f.id, g.id]).items).toEqual([
      { page: "bao cao #2.html", widths: [390], schemes: ["light"] },
      { page: "bao cao #2.html?dk=dem", state: "mo-ra", widths: [390], schemes: ["light"] },
    ]);
  });
  it("takes ids as people type them and lists the unknown ones once", () => {
    expect(recheckPlan(run, [` #${a.id.toUpperCase()} `, "zzzzzz", "zzzzzz", ""])).toMatchObject({ items: [{ widths: [390] }], unknown: ["zzzzzz"] });
    expect(recheckPlan(run, [])).toEqual({ items: [], unknown: [] });
  });
});

describe("labelOf", () => {
  it("gives the element a finding points at: axe keeps it in the detail, whole-page findings have none", () => {
    expect(labelOf({ check: "touch", where: 'button#x "Lưu"', detail: "30×30 px" })).toBe('button#x "Lưu"');
    expect(labelOf({ check: "axe", where: "label", detail: "#o: Form element has no label" })).toBe("#o: Form element has no label");
    expect(labelOf({ check: "axe-bp", where: "region", detail: "main > p" })).toBe("main > p");
    for (const f of [{ check: "cls", where: "page" }, { check: "impeccable", where: "label" }, { check: "touch", where: "+3 more" }, { check: "copy", where: "<title>" }, { check: "sticky", where: "390x844" }, { check: "lang-part", where: "page" }]) {
      expect(labelOf({ ...f, detail: "d" }), f.check).toBeUndefined();
    }
  });
});

describe("in the page", () => {
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
  async function withPage<T>(w: number, fn: (p: Page) => Promise<T>): Promise<T> {
    const ctx = await browser.newContext({ viewport: { width: w, height: 700 } });
    try {
      return await fn(await ctx.newPage());
    } finally {
      await ctx.close();
    }
  }
  const fixture = (f: string): string => `${server.origin}/test/fixtures/${f}.html`;
  /** Ô của phần tử theo id, toạ độ tài liệu. */
  const boxOf = (p: Page, sel: string): Promise<{ x: number; y: number; w: number; h: number }> =>
    p.locator(sel).first().evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    });

  it("finds every label the real probes print, at the element they mean", async () => {
    await withPage(390, async (p) => {
      for (const [file, labels] of [
        ["cham-sai", () => p.evaluate(probeTouch, 44).then((t) => t.small.map((x) => x.where))],
        ["ngon-ngu-sai", () => p.evaluate(probeLangParts).then((l) => [...l.nfc, ...l.han, ...l.english].map((x) => x.where))],
        ["loi", () => p.evaluate(probePage).then((r) => [...r.textMin, ...r.bodySmall, ...r.bodyTight, ...r.headingTight, ...r.innerScroll].map((x) => x.where))],
        ["cat-chu", () => p.evaluate(probePage).then((r) => r.textClip.map((x) => x.where))],
      ] as const) {
        await p.goto(fixture(file));
        const list = [...new Set(await labels())];
        expect(list.length, file).toBeGreaterThan(1);
        const got = await p.evaluate(locateLabels, list);
        expect(list.filter((l) => !got.some((g) => g.label === l)), file).toEqual([]);
        for (const g of got) {
          const id = /^[\w-]+#([\w-]+)/.exec(g.label)?.[1];
          if (id) expect({ x: g.x, y: g.y, w: g.w, h: g.h }, g.label).toEqual(await boxOf(p, `#${id}`));
        }
      }
    });
  }, 60_000);
  it("finds the focused element by the label probeFocus prints", async () => {
    await withPage(390, async (p) => {
      await p.goto(fixture("cham-dung"));
      await p.keyboard.press("Tab");
      const f = (await p.evaluate(probeFocus))!;
      const [g] = await p.evaluate(locateLabels, [f.where]);
      expect(g).toMatchObject(await boxOf(p, "button"));
    });
  }, 60_000);

  const PAGE = `<!doctype html><html lang="vi"><head><title>Thử</title><style>body{margin:0;font:16px/1.5 sans-serif}*{box-sizing:border-box}.md\\:x{color:#333}</style></head><body>
    <div style="height:900px">Đầu</div>
    <the-c></the-c><p>Trùng chữ</p>
    <div class="y" style="visibility:hidden">Giấu</div>
    <button id="dong" aria-label="Đóng hộp">×</button>
    <span class="x">Chữ rất dài bị cắt ở giữa chừng vì hộp hẹp</span>
    <p class="x">Hai</p>
    <p class="md:x">Lớp có hai chấm</p>
    <div>Ba</div>
    <div style="padding:4px"><div style="padding:4px"><div id="">Lồng</div></div></div>
    <div class="y" style="display:none">Ẩn</div><div class="y">Hiện</div>
    <input name="q" value="1"><input placeholder="Tìm món">
    <svg width="60" height="20"><text x="0" y="15">12</text></svg>
    <img id="anh" alt="a" width="30" height="30" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
    <p>Ở ngoài</p>
    <the-a></the-a>
    <script>document.querySelector("the-c").attachShadow({mode:"open"}).innerHTML = '<p>Trùng chữ</p><button class="z">Xem</button>';
    document.querySelector("the-a").attachShadow({mode:"open"}).innerHTML = '<button class="z">Lưu</button><p>Trong</p><em>Chỉ có trong này</em>';</script>
  </body></html>`;
  it("reads each form of label, and drops what it cannot find", async () => {
    await withPage(390, async (p) => {
      await p.setContent(PAGE);
      const at = async (label: string): Promise<unknown> => {
        const [g] = await p.evaluate(locateLabels, [label]);
        return g && { x: g.x, y: g.y, w: g.w, h: g.h };
      };
      const same = async (label: string, sel: string): Promise<void> => expect(await at(label), label).toEqual(await boxOf(p, sel));
      await same('button#dong "Đóng hộp"', "#dong");
      await same('button#dong "×"', "#dong");
      await same('span.x "Chữ rất dài bị cắt ở giữa c"', "span.x");
      await same('span.x "Chữ rất dài…"', "span.x");
      await same("p.x", "p.x");
      await same('p.md:x "Lớp có hai chấm"', "p:nth-of-type(3)");
      await same('div "Ba"', "div:nth-of-type(3)");
      // Trùng nhãn ở trong và ngoài shadow root, trong hai thẻ khác nhau.
      await same('p "Trùng chữ"', "body > p:nth-of-type(1)");
      await same('the-c::shadow p "Trùng chữ"', "the-c p");
      await same('the-c::shadow button.z "Xem"', "the-c .z");
      await same('div "Lồng"', "div > div > div");
      await same("div.y", "div.y:nth-of-type(6)");
      await same('input "Tìm món"', "[placeholder]");
      await same('svg text "12"', "svg text");
      await same("img#anh[alt]", "#anh");
      await same("img#anh (attribute)", "#anh");
      await same('the-a::shadow button.z "Lưu"', "the-a button.z");
      await same('p "Ở ngoài"', "p:nth-of-type(4)");
      await same('em "Chỉ có trong này"', "em");
      // Bộ chọn của axe: kèm lời báo, dấu nháy đã mất, xuyên shadow root.
      await same("#dong: Element has insufficient color contrast of 2.1 (foreground color: #999)", "#dong");
      await same("input[name=\\q\\]: Form element has no label", "[name=q]");
      await same("[the-a,.z]: Element has insufficient contrast", "the-a button.z");
      await same("[the-c,.z]: Element has insufficient contrast", "the-c button.z");
      await same("span.x::before", "span.x");
      for (const none of ["page", "390px", "+3 more", "data: URL", "manifest", "body", "html", "p#khong-co", 'button#dong "Khác"', 'span.x "Chữ"', "[the-a,.khong]", "]]", "", 'section "Ba"', 'the-b::shadow button.z "Lưu"']) {
        expect(await at(none), none).toBeUndefined();
      }
      // Trang đã cuộn: vẫn là toạ độ tài liệu.
      await p.evaluate(() => window.scrollTo(0, 400));
      await same("#dong", "#dong");
      expect((await p.evaluate(locateLabels, ["p.x", "khong", "p.x"])).map((g) => g.label)).toEqual(["p.x", "p.x"]);
    });
  }, 60_000);
  it("reads labels from a real axe run", async () => {
    await withPage(390, async (p) => {
      await p.setContent('<!doctype html><html lang="vi"><head><title>Thử</title></head><body><main><h1>Thử</h1><p id="nhat" style="color:#bbb">Chữ nhạt quá</p><input type="text" name="o" value=""><the-b></the-b><script>document.querySelector("the-b").attachShadow({mode:"open"}).innerHTML = \'<p class="mo" style="color:#ccc">Chữ nhạt trong thẻ</p>\';</script></main></body></html>');
      await p.evaluate(readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8"));
      const details = await p.evaluate(async () => {
        const w = window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ nodes: Array<{ target: unknown[]; any: Array<{ message: string }> }> }> }> } };
        const r = await w.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
        return r.violations.flatMap((v) => v.nodes.map((n) => `${JSON.stringify(n.target).slice(1, -1).replace(/"/g, "")}${n.any[0] ? `: ${n.any[0].message}` : ""}`));
      });
      expect(details.length).toBeGreaterThanOrEqual(3);
      const got = await p.evaluate(locateLabels, details);
      expect(got.map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h }))).toEqual(expect.arrayContaining([await boxOf(p, "#nhat"), await boxOf(p, "input"), await boxOf(p, ".mo")]));
      expect(got).toHaveLength(details.length);
    });
  }, 60_000);

  /** Màu của một điểm ảnh trong ảnh chụp cả trang. */
  const pixel = async (p: Page, x: number, y: number): Promise<number[]> => {
    const png = (await p.screenshot({ fullPage: true, caret: "initial" })).toString("base64");
    return withPage(390, (q) =>
      q.evaluate(async ({ src, px, py }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height }).getContext("2d")!;
        c.drawImage(img, 0, 0);
        return Array.from(c.getImageData(px, py, 1, 1).data).slice(0, 3);
      }, { src: png, px: x, py: y }));
  };
  const HARD = [176, 0, 32];
  const SOFT = [138, 26, 155];

  it("draws boxes and numbers below the fold, changes no layout, catches no clicks, and clears without a trace", async () => {
    await withPage(390, async (p) => {
      await p.setContent(PAGE);
      const before = await p.evaluate(probeFingerprint);
      const html = await p.evaluate(() => document.documentElement.outerHTML);
      const size = (): Promise<number[]> => p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
      const s0 = await size();
      const [a, b] = await p.evaluate(locateLabels, ["#dong", "span.x"]);
      // Khung sát và quá mép không được làm trang cuộn ngang.
      const n = await p.evaluate(drawMarks, [{ n: 1, ...a!, hard: true }, { n: 2, ...b! }, { n: 3, x: 380, y: 10, w: 40, h: 4000 }, { n: 4, x: 0, y: 9000, w: 900, h: 20 }]);
      expect(n).toBe(4);
      expect(await size()).toEqual(s0);
      const during = (await p.evaluate(probeFingerprint)).lines;
      for (const l of before.lines) expect(during).toContain(l);
      expect(await pixel(p, a!.x - 2 < 0 ? 0 : a!.x - 2, a!.y + 10)).toEqual(HARD);
      expect(await pixel(p, b!.x + 60, b!.y + b!.h + 2)).toEqual(SOFT);
      // Khung vượt mép phải được kẹp vào trang, nên vẫn thấy đủ bốn cạnh.
      expect(await pixel(p, 389, 300)).toEqual(SOFT);
      expect(await p.evaluate(({ x, y }) => {
        window.scrollTo(0, y - 100);
        const hit = document.elementFromPoint(x + 5, y + 5 - scrollY);
        window.scrollTo(0, 0);
        return hit?.id;
      }, a!)).toBe("dong");
      // Vẽ lại thì thay, không chồng.
      await p.evaluate(drawMarks, [{ n: 1, ...a! }]);
      expect(await p.evaluate(() => document.querySelectorAll("[popover]").length)).toBe(1);
      await p.evaluate(clearMarks);
      expect((await p.evaluate(probeFingerprint)).hash).toBe(before.hash);
      expect(await p.evaluate(() => document.documentElement.outerHTML)).toBe(html);
      expect(await p.evaluate(() => "__dkMarks" in window)).toBe(false);
      expect(await size()).toEqual(s0);
      await p.evaluate(clearMarks);
    });
  }, 60_000);
  it("is drawn over an open modal dialog, on a page that styles every div, and under a CSP with no inline styles", async () => {
    await withPage(390, async (p) => {
      await p.setContent('<!doctype html><html lang="vi"><head><title>Thử</title><style>body{margin:0}div{display:none!important;position:static;transform:scale(2);border:9px solid red}dialog{margin:100px auto;width:300px;height:200px;background:#fff;border:0;padding:0}</style></head><body><p>Nền</p><dialog><button id="b" style="width:100px;height:44px">Lưu</button></dialog><script>document.querySelector("dialog").showModal()</script></body></html>');
      const focus = await p.evaluate(() => document.activeElement?.id);
      const [b] = await p.evaluate(locateLabels, ["#b"]);
      await p.evaluate(drawMarks, [{ n: 12, ...b!, hard: true }]);
      expect(await pixel(p, b!.x + 50, b!.y + b!.h + 2)).toEqual(HARD);
      expect(await p.evaluate(() => document.activeElement?.id)).toBe(focus);
      await p.evaluate(clearMarks);
      expect(await p.evaluate(() => document.querySelector("dialog")!.open)).toBe(true);
    });
    await withPage(390, async (p) => {
      await p.route("**/csp-chat.html", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", headers: { "content-security-policy": "default-src 'none'" }, body: '<!doctype html><html lang="vi"><head><title>Thử</title></head><body><p id="a">Trang có CSP chặt</p></body></html>' }));
      await p.goto(`${server.origin}/csp-chat.html`);
      const [a] = await p.evaluate(locateLabels, ["#a"]);
      await p.evaluate(drawMarks, [{ n: 1, ...a!, hard: true }]);
      expect(await pixel(p, a!.x + 100, a!.y + a!.h + 2)).toEqual(HARD);
    });
  }, 60_000);
  it("numbers on the same spot stay apart, a mark at the top keeps its number on the page", async () => {
    await withPage(390, async (p) => {
      await p.setContent("<!doctype html><html lang=vi><title>Thử</title><body style='margin:0;height:500px'>a");
      await p.evaluate(drawMarks, [{ n: 1, x: 40, y: 100, w: 50, h: 20 }, { n: 2, x: 40, y: 100, w: 50, h: 20 }, { n: 10, x: 40, y: 104, w: 50, h: 20 }, { n: 4, x: 0, y: 0, w: 20, h: 20 }, { n: 5, x: 385, y: 200, w: 5, h: 5 }]);
      const boxes = await p.evaluate(() => {
        const r = (window as unknown as { __dkMarks: HTMLElement }).__dkMarks.shadowRoot!;
        return Array.from(r.children).filter((e) => e.textContent).map((e) => {
          const q = e.getBoundingClientRect();
          return { t: e.textContent!, l: q.left, r: q.right, top: q.top, b: q.bottom };
        });
      });
      expect(boxes.map((x) => x.t)).toEqual(["1", "2", "10", "4", "5"]);
      for (const q of boxes) expect(q.l >= 0 && q.top >= 0 && q.r <= 390, q.t).toBe(true);
      for (const a of boxes) for (const c of boxes) if (a !== c) expect(a.r <= c.l || c.r <= a.l || a.b <= c.top || c.b <= a.top, `${a.t} over ${c.t}`).toBe(true);
    });
  }, 60_000);
});
