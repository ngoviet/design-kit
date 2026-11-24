import type { Page } from "playwright-core";
import { type ProbeHit, probeCovered, probePage, settleAnimations } from "./probe.js";
import { type NetWatch, settleAfterChange } from "./settle.js";

/**
 * Phép đo `text-zoom`, `text-spacing`, `font-unit` (mềm, 24/11/2026): người dùng tự phóng chữ và tự giãn chữ.
 *
 * - `text-zoom`: đặt cỡ chữ mặc định của trình duyệt gấp đôi bằng CDP `Page.setFontSizes` (16 → 32 px) như người dùng chọn cỡ chữ
 *   lớn trong cài đặt. Đúng hơn `html{font-size:200%}`: media query theo em cũng đổi, và trang đặt `html{font-size:16px}` lộ ra
 *   là không theo. Báo thân chữ không to lên, chữ mới bị cắt, mới bị che, trang tràn ngang. WCAG 1.4.4 (N01) cho đạt bằng phóng
 *   cả trang, nên chữ đặt px KHÔNG phải lỗi AA: phần "thân chữ không to lên" là quy ước (theo HIG N40), phần mất chữ là 1.4.4.
 * - `text-spacing` (WCAG 1.4.12, c47): giãn dòng 1,5, cách đoạn 2 em, giãn chữ 0,12 em, giãn từ 0,16 em; báo chữ mới bị cắt hay che.
 * - `font-unit` (WCAG F94, N38): cỡ chữ chỉ theo đơn vị khung nhìn, không có phần rem/em/%: phóng trang cũng không to lên.
 *
 * `data-zoom-ok="<lý do>"` trên phần tử hay tổ tiên: chữ cố ý không to theo (nhãn trong biểu đồ, huy hiệu).
 */
export interface ResizeFinding {
  check: "text-zoom" | "text-spacing" | "font-unit";
  where: string;
  detail: string;
}

/** Thân chữ to lên ít hơn mức này khi người dùng đặt cỡ 200% thì coi là không theo. Dưới 2 vì bố cục hẹp hay dùng cỡ chữ nhỏ hơn một nấc. */
const GROW_MIN = 1.5;

/** Ghi cỡ chữ của thân chữ vào trang (giữ chính phần tử để so lại sau khi phóng). */
function rememberText(): void {
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const list: Array<{ el: Element; size: number }> = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (!/^(P|LI|DD|DT|TD|TH|BLOCKQUOTE|LABEL|FIGCAPTION|SUMMARY|BUTTON|A)$/.test(el.tagName)) continue;
      let own = "";
      for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) own += n.textContent ?? "";
      if (own.trim().length < 2 || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      let ok = false;
      for (let a: Element | null = el; a && !ok; a = up(a)) ok = a.hasAttribute("data-zoom-ok");
      if (!ok) list.push({ el, size: parseFloat(getComputedStyle(el).fontSize) });
    }
  };
  walk(document);
  (window as unknown as { __dkText: typeof list }).__dkText = list;
}

function stuckText(min: number): Array<{ where: string; value: string }> {
  const list = (window as unknown as { __dkText?: Array<{ el: Element; size: number }> }).__dkText ?? [];
  const out: Array<{ where: string; value: string }> = [];
  for (const { el, size } of list) {
    if (!el.isConnected || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const now = parseFloat(getComputedStyle(el).fontSize);
    if (now >= size * min) continue;
    const id = el.id ? `#${el.id}` : typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    out.push({ where: `${el.tagName.toLowerCase()}${id}`, value: `${+size.toFixed(1)}px → ${+now.toFixed(1)}px` });
  }
  return out;
}

function pageOverflow(): { s: number; c: number } {
  return { s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth };
}

/** Stylesheet giãn chữ vào document và mọi open shadow root; trả về tắt khi `off`. Constructable stylesheet nên CSP không chặn. */
function toggleSpacing(on: boolean): void {
  const w = window as unknown as { __dkSpacing?: CSSStyleSheet };
  if (!w.__dkSpacing) {
    w.__dkSpacing = new CSSStyleSheet();
    w.__dkSpacing.replaceSync("*, *::before, *::after { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-block-end: 2em !important; }");
  }
  const sheet = w.__dkSpacing;
  const walk = (root: Document | ShadowRoot): void => {
    const rest = root.adoptedStyleSheets.filter((s) => s !== sheet);
    root.adoptedStyleSheets = on ? [...rest, sheet] : rest;
    for (const el of Array.from(root.querySelectorAll("*"))) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
}

/** Luật `font-size` chỉ theo khung nhìn, đang áp cho phần tử có chữ hiện ra. */
export function probeFontUnit(): ProbeHit[] {
  const VIEW = /\d(?:\.\d+)?(?:[sld]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max))\b/i;
  const REL = /\d(?:rem|em|%|ex|rlh|lh)(?![a-z])/i;
  const out: ProbeHit[] = [];
  const seen = new Set<string>();
  // Biến CSS: lấy giá trị đã khai báo trên phần tử, lần theo tối đa ba tầng.
  const resolve = (value: string, el: Element): string => {
    let v = value;
    for (let i = 0; i < 3 && v.includes("var("); i++) {
      v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_m, name: string, fb: string | undefined) => getComputedStyle(el).getPropertyValue(name).trim() || fb || "");
    }
    return v;
  };
  const shownText = (el: Element): boolean => !!(el.textContent ?? "").trim() && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  // Luật có thật sự thắng không: đặt một phần tử thử cạnh nó với đúng giá trị đó, cỡ tính ra phải bằng cỡ của phần tử. Luật bị
  // luật sau đè thì cỡ khác.
  const wins = (el: Element, v: string): boolean => {
    const host = el.parentNode;
    if (!host) return false;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute!important;visibility:hidden!important;transition:none!important";
    probe.style.fontSize = v;
    host.appendChild(probe);
    const same = Math.abs(parseFloat(getComputedStyle(probe).fontSize) - parseFloat(getComputedStyle(el).fontSize)) < 0.2;
    probe.remove();
    return same;
  };
  const rulesOf = (list: CSSRuleList, root: Document | ShadowRoot): void => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSMediaRule && !matchMedia(r.conditionText).matches) continue;
      if (r instanceof CSSImportRule) {
        try {
          if (r.styleSheet && (!r.media.mediaText || matchMedia(r.media.mediaText).matches)) rulesOf(r.styleSheet.cssRules, root);
        } catch {
          /* tệp nhập khác nguồn */
        }
        continue;
      }
      if (r instanceof CSSStyleRule && r.style.fontSize) {
        let els: Element[] = [];
        try {
          els = Array.from(root.querySelectorAll(r.selectorText.replace(/::?(before|after|marker|placeholder|first-line|first-letter)\b/g, "")));
        } catch {
          /* bộ chọn lạ */
        }
        for (const el of els.filter(shownText).slice(0, 5)) {
          const v = resolve(r.style.fontSize, el);
          const key = `${r.selectorText}|${v}`;
          if (!VIEW.test(v) || REL.test(v) || seen.has(key) || !wins(el, v)) continue;
          seen.add(key);
          out.push({ where: r.selectorText.slice(0, 60), value: v.slice(0, 60) });
        }
      }
      const inner = (r as CSSGroupingRule).cssRules as CSSRuleList | undefined;
      if (inner?.length && !(r instanceof CSSKeyframesRule)) rulesOf(inner, root);
    }
  };
  const walk = (root: Document | ShadowRoot): void => {
    for (const s of [...Array.from(root.styleSheets), ...root.adoptedStyleSheets]) {
      try {
        rulesOf(s.cssRules, root);
      } catch {
        /* stylesheet khác nguồn: không đọc được */
      }
    }
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      const v = (el as HTMLElement).style?.fontSize;
      if (v && VIEW.test(v) && !REL.test(v) && shownText(el)) out.push({ where: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}[style]`, value: v });
    }
  };
  walk(document);
  return out;
}

interface Lost {
  clip: Set<string>;
  covered: Set<string>;
}
const lostOf = async (page: Page): Promise<{ clip: ProbeHit[]; covered: ProbeHit[] }> => ({
  clip: (await page.evaluate(probePage)).textClip,
  covered: await page.evaluate(probeCovered),
});
const keys = (l: { clip: ProbeHit[]; covered: ProbeHit[] }): Lost => ({ clip: new Set(l.clip.map((h) => h.where)), covered: new Set(l.covered.map((h) => h.where)) });
const CAP = 4;

/**
 * Yên sau khi đổi cỡ hay giãn chữ. `transition: all` của nút shadcn chạy cả font-size, đo ngay thì nút 14px mới tới 16px và bị
 * báo nhầm là không theo người đọc (24/11/2026, 11 phát hiện giả trên khối React). Cho hiệu ứng có hồi kết chạy xong ngay thay vì
 * chờ: chuyển tiếp 4 giây thì chờ bao lâu cũng hụt.
 */
async function settleText(page: Page, net: NetWatch): Promise<void> {
  await settleAfterChange(page, net);
  await page.evaluate(finishAnimations);
  await page.evaluate(settleAnimations, 300);
}

function finishAnimations(): void {
  const walk = (root: Document | ShadowRoot): void => {
    for (const a of root.getAnimations()) {
      const t = a.effect?.getComputedTiming();
      try {
        if (t && Number.isFinite(Number(t.endTime))) a.finish();
      } catch {
        /* hiệu ứng không cho kết thúc sớm */
      }
    }
    for (const el of Array.from(root.querySelectorAll("*"))) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
}

/** Giữ các phát hiện mới (không có trước khi đổi). */
function fresh(check: "text-zoom" | "text-spacing", before: Lost, after: { clip: ProbeHit[]; covered: ProbeHit[] }, why: string): ResizeFinding[] {
  const list = [
    ...after.clip.filter((h) => !before.clip.has(h.where)).map((h) => ({ where: h.where, detail: `text cut off ${why}: ${h.value}` })),
    ...after.covered.filter((h) => !before.covered.has(h.where)).map((h) => ({ where: h.where, detail: `text ${why} is ${h.value}` })),
  ];
  const shown: ResizeFinding[] = list.slice(0, CAP).map((x) => ({ check, ...x }));
  if (list.length > CAP) shown.push({ check, where: `+${list.length - CAP} more`, detail: `more text lost ${why}` });
  return shown;
}

/**
 * Giãn chữ ở khổ hiện tại. Gọi trên trang đã đo xong mọi thứ khác: trả trang về như cũ khi xong, nhưng một trang nghe
 * ResizeObserver có thể đã phản ứng.
 */
export async function spacingPass(page: Page, net: NetWatch): Promise<ResizeFinding[]> {
  const before = keys(await lostOf(page));
  try {
    await page.evaluate(toggleSpacing, true);
    await settleText(page, net);
    return fresh("text-spacing", before, await lostOf(page), "when a reader spaces it out (WCAG 1.4.12)");
  } finally {
    await page.evaluate(toggleSpacing, false);
    await settleText(page, net);
  }
}

/** Cỡ chữ mặc định gấp đôi ở khổ hiện tại. */
export async function zoomPass(page: Page, net: NetWatch): Promise<ResizeFinding[]> {
  const cdp = await page.context().newCDPSession(page);
  const set = (standard: number, fixed: number): Promise<unknown> => cdp.send("Page.setFontSizes", { fontSizes: { standard, fixed } });
  const out: ResizeFinding[] = [];
  await page.evaluate(rememberText);
  const before = keys(await lostOf(page));
  const base = await page.evaluate(pageOverflow);
  try {
    await set(32, 26);
    await settleText(page, net);
    const stuck = await page.evaluate(stuckText, GROW_MIN);
    // Một dòng cho mỗi bộ chọn: cả trang đặt px thì không cần lặp lại từng đoạn.
    const by = new Map<string, { n: number; value: string }>();
    for (const s of stuck) by.set(s.where, { n: (by.get(s.where)?.n ?? 0) + 1, value: s.value });
    const rows = [...by].sort((a, b) => b[1].n - a[1].n);
    for (const [where, { n, value }] of rows.slice(0, 3)) {
      out.push({ check: "text-zoom", where, detail: `text does not follow the reader's font size (${value} at 200%${n > 1 ? `, ${n} elements` : ""}): use rem, not px or vw (data-zoom-ok when deliberate)` });
    }
    if (rows.length > 3) out.push({ check: "text-zoom", where: `+${rows.length - 3} more`, detail: "more text that does not follow the reader's font size" });
    const o = await page.evaluate(pageOverflow);
    if (o.s > o.c + 1 && base.s <= base.c + 1) out.push({ check: "text-zoom", where: "page", detail: `page is ${o.s}px wide in a ${o.c}px screen with the reader's font size at 200%` });
    out.push(...fresh("text-zoom", before, await lostOf(page), "with the reader's font size at 200%"));
  } finally {
    await set(16, 13).catch(() => undefined);
    await cdp.detach().catch(() => undefined);
    await settleText(page, net);
  }
  return out;
}
