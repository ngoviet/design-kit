import type { Page } from "playwright-core";
import { installKeyLib, type KeyLib } from "./keyboard.js";
import { probeVisible, settleAnimations } from "./probe.js";
import { twoFrames } from "./settle.js";
import type { ActionWatch } from "./steps.js";

/**
 * Phép đo `contrast-more`, `forced-colors`, `offline`, `aria-state` (mềm, 24/11/2026): giả lập máy và cách dùng của người dùng
 * bằng API có sẵn của Playwright.
 *
 * - `contrast-more` (MDN prefers-contrast N63; WCAG 1.4.6 AAA N37): chỉ đo khi trang có khai `@media (prefers-contrast…)`, tức là
 *   có hứa. Khi đó chữ thân phải đạt 7:1 (axe color-contrast-enhanced). Không khai thì không báo: 7:1 không phải AA.
 * - `forced-colors` (MDN N64, c44): Windows High Contrast bỏ nền, bóng, dải màu. Nút, ô, thẻ chỉ nhận ra nhờ nền thì biến thành
 *   chữ trơn; mục đang chọn chỉ khác màu thì không còn khác anh em.
 * - `offline`: trang đăng ký service worker là hứa dùng được lúc mất mạng: mở lại không mạng phải còn nội dung hay lời báo.
 * - `aria-state` (WCAG 4.1.2 A): bấm vào thứ có aria-expanded/pressed/selected/checked mà trang đổi còn thuộc tính thì không.
 *
 * Miễn: `data-contrast-ok`, `data-forced-ok`, `data-aria-ok` trên phần tử hay tổ tiên, giá trị là lý do.
 */
export interface EmulateFinding {
  check: "contrast-more" | "forced-colors" | "offline" | "aria-state";
  where: string;
  detail: string;
}

/** Cho mọi chuyển tiếp (transition) đang chạy tới đích ngay. Hiệu ứng keyframes để yên. */
function finishTransitions(): void {
  const walk = (root: Document | ShadowRoot): void => {
    for (const a of root.getAnimations()) if (a instanceof CSSTransition) a.finish();
    for (const el of Array.from(root.querySelectorAll("*"))) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
}

/**
 * Yên sau khi đổi chế độ: hai khung hình cho kiểu mới, rồi cho chuyển tiếp màu tới đích ngay thay vì chờ (trang thật có chuyển tiếp
 * dài làm phép đo mất 0,7 s). Cha và con cùng chuyển màu kế thừa thì bắt đầu cùng lúc, nên một lượt là đủ (có test).
 */
async function settleMode(page: Page): Promise<void> {
  await twoFrames(page);
  await page.evaluate(finishTransitions);
}

/* --------------------------------------------------------------- contrast-more */

/** Mọi điều kiện media có nhắc prefers-contrast, có luật trúng phần tử của trang, và lúc này nó có khớp không. */
export function contrastMedia(): Array<[string, boolean]> {
  const out = new Map<string, boolean>();
  const note = (m: string): void => {
    if (/prefers-contrast/i.test(m)) out.set(m, matchMedia(m).matches);
  };
  // Khối @media chỉ là lời hứa khi có luật trúng một phần tử của trang. Tệp bộ màu dùng chung khai tương phản cao cho chín bộ;
  // trang đang dùng màu của hướng thì không luật nào trúng, đòi 7:1 ở đó là báo oan (khối chon-mau, 24/11/2026).
  // Luật cho phần tử giả mang chữ: trúng khi bỏ phần tử giả đi thì bộ chọn trúng một phần tử, và ::before, ::after có được vẽ.
  // ::backdrop, ::selection, thanh cuộn không phải nội dung đang đọc (25/11/2026).
  const pseudo = (sel: string, root: Document | ShadowRoot): boolean =>
    sel.split(/,(?![^(]*\))/).some((part) => {
      const m = /^(.*?)::?(before|after|first-line|first-letter|marker|placeholder)$/.exec(part.trim());
      if (!m) return false;
      const drawn = (el: Element): boolean => !/^(before|after)$/.test(m[2]!) || !/^(none|normal)$/.test(getComputedStyle(el, `::${m[2]}`).content);
      try {
        return Array.from(root.querySelectorAll(/(^|[\s>+~])$/.test(m[1]!) ? `${m[1]}*` : m[1]!)).some(drawn);
      } catch {
        return false;
      }
    });
  const used = (list: CSSRuleList, root: Document | ShadowRoot): boolean =>
    Array.from(list).some((r) => {
      if (r instanceof CSSStyleRule) {
        try {
          if (root.querySelector(r.selectorText) || (root instanceof ShadowRoot && /:host/.test(r.selectorText)) || pseudo(r.selectorText, root)) return true;
        } catch {
          return true; // bộ chọn lạ: coi như có dùng
        }
      }
      const inner = (r as CSSGroupingRule).cssRules as CSSRuleList | undefined;
      return !!inner?.length && used(inner, root);
    });
  const rules = (list: CSSRuleList, root: Document | ShadowRoot): void => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSMediaRule && used(r.cssRules, root)) note(r.conditionText);
      if (r instanceof CSSImportRule) sheet(r.styleSheet, root, r.media.mediaText);
      const inner = (r as CSSGroupingRule).cssRules as CSSRuleList | undefined;
      if (inner?.length) rules(inner, root);
    }
  };
  const sheet = (s: CSSStyleSheet | null, root: Document | ShadowRoot, media = ""): void => {
    if (!s) return;
    try {
      const any = used(s.cssRules, root);
      for (const m of [media, s.media.mediaText]) if (any) note(m);
      rules(s.cssRules, root);
    } catch {
      /* stylesheet khác nguồn: không đọc được luật */
    }
  };
  const walk = (root: Document | ShadowRoot): void => {
    for (const s of [...Array.from(root.styleSheets), ...root.adoptedStyleSheets]) sheet(s, root);
    for (const el of Array.from(root.querySelectorAll("*"))) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
  return [...out];
}

interface AxeNode {
  where: string;
  ratio: number;
}

/**
 * Chữ thân dưới 7:1 theo axe. Chữ lớn (axe đòi 4,5:1), chữ trong điều khiển và trong nav không phải chữ thân. Phải chạy cả luật
 * thường: color-contrast-enhanced cho qua chữ dưới 4,5:1 vì coi đó là việc của color-contrast (đo trên axe 4.14, 24/11/2026).
 */
async function enhanced(page: Page, axeSource: string): Promise<AxeNode[]> {
  if (!(await page.evaluate(() => "axe" in window))) await page.evaluate(axeSource);
  return page.evaluate(async () => {
    interface Data {
      contrastRatio?: number;
      expectedContrastRatio?: string;
    }
    const w = window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; nodes: Array<{ element?: Element; target: unknown[]; any: Array<{ data?: Data }> }> }> }> } };
    const res = await w.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast-enhanced", "color-contrast"] }, resultTypes: ["violations"], elementRef: true, preload: false });
    const out: Array<{ where: string; ratio: number }> = [];
    for (const [rule, n] of res.violations.flatMap((v) => v.nodes.map((x) => [v.id, x] as const))) {
      const d = n.any[0]?.data;
      const el = n.element;
      if (!el || d?.expectedContrastRatio !== (rule === "color-contrast" ? "4.5:1" : "7:1") || d.contrastRatio === undefined) continue;
      let skip = false;
      for (let a: Element | null = el; a && !skip; a = a.assignedSlot ?? a.parentElement ?? ((a.getRootNode() as ShadowRoot).host || null)) {
        skip = a.matches("button, [role=button], [role=tab], [role=menuitem], [role=option], input, select, textarea, summary, nav, [role=navigation], [data-contrast-ok]");
      }
      if (skip) continue;
      const id = el.id ? `#${el.id}` : typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
      const txt = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28);
      out.push({ where: `${el.tagName.toLowerCase()}${id}${txt ? ` "${txt}"` : ""}`, ratio: d.contrastRatio });
    }
    return out;
  });
}

const CONTRAST_CAP = 4;

/** Trả trang về chế độ tương phản thường khi xong. Trạng thái đầu, khổ rộng nhất, mỗi chế độ màu một lần. */
export async function contrastMorePass(page: Page, axeSource: string): Promise<EmulateFinding[]> {
  const before = new Map(await page.evaluate(contrastMedia));
  if (!before.size) return [];
  try {
    await page.emulateMedia({ contrast: "more" });
    await settleMode(page);
    // `prefers-contrast: less` hay `no-preference` không phải lời hứa cho người cần thêm tương phản.
    const promised = (await page.evaluate(contrastMedia)).some(([m, on]) => on && before.get(m) === false);
    if (!promised) return [];
    const low = await enhanced(page, axeSource);
    const out: EmulateFinding[] = low.slice(0, CONTRAST_CAP).map((n) => ({
      check: "contrast-more",
      where: n.where,
      detail: `${n.ratio}:1 with prefers-contrast: more, which the page declares; body text there needs 7:1: give it a stronger color in that @media block`,
    }));
    if (low.length > CONTRAST_CAP) out.push({ check: "contrast-more", where: `+${low.length - CONTRAST_CAP} more`, detail: "more body text under 7:1 with prefers-contrast: more" });
    return out;
  } finally {
    await page.emulateMedia({ contrast: null });
    await settleMode(page).catch(() => undefined);
  }
}

/* --------------------------------------------------------------- forced-colors */

interface LookLib {
  forced(): boolean;
  stands(e: Element): boolean;
  edge(e: Element): boolean;
  sig(e: Element): string;
}

/** Hàm đọc vẻ ngoài, dùng ở cả chế độ thường lẫn màu ép buộc. Cần `installKeyLib`. */
export function installLook(): void {
  const w = window as unknown as { __dkKeys: KeyLib; __dkLook?: LookLib };
  if (w.__dkLook) return;
  const K = w.__dkKeys;
  const forced = (): boolean => matchMedia("(forced-colors: active)").matches;
  type Rgba = [number, number, number, number];
  const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  const cache = new Map<string, Rgba>();
  // Qua canvas thì đọc được mọi cách viết màu (oklch, color()), không phải tự phân tích chuỗi.
  const px = (c: string): Rgba => {
    let v = cache.get(c);
    if (v) return v;
    if (!ctx) return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    v = [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    cache.set(c, v);
    return v;
  };
  const over = (c: Rgba, b: Rgba): Rgba => [0, 1, 2].map((i) => c[i]! * c[3] + b[i]! * (1 - c[3])).concat(1) as Rgba;
  const lab = (c: Rgba): [number, number, number] => {
    const [r, g, b] = [0, 1, 2].map((i) => {
      const x = c[i]! / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const far = (a: Rgba, b: Rgba, min: number): boolean => {
    const [x, y] = [lab(a), lab(b)];
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) >= min;
  };
  /** Màu nền phía sau; null: có ảnh nền, không biết. */
  const behind = (e: Element): Rgba | null => {
    const stack: Rgba[] = [];
    for (let a = K.up(e); a; a = K.up(a)) {
      const cs = getComputedStyle(a);
      if (cs.backgroundImage !== "none") return null;
      const c = px(cs.backgroundColor);
      if (c[3] > 0) stack.push(c);
      if (c[3] >= 0.99) break;
    }
    return stack.reverse().reduce((b, c) => over(c, b), [255, 255, 255, 1] as Rgba);
  };
  const shadowed = (v: string): boolean =>
    v !== "none" &&
    v.split(/,(?![^(]*\))/).some((layer) => {
      const color = /^\s*([a-z-]+\([^)]*\)|#\w+)/i.exec(layer)?.[1];
      return (!color || px(color)[3] > 0.04) && (layer.replace(color ?? "", "").match(/-?[\d.]+px/g) ?? []).some((n) => Math.abs(parseFloat(n)) >= 1);
    });
  const painted = (cs: CSSStyleDeclaration, back: Rgba | null): boolean => {
    if (/gradient\(/.test(cs.backgroundImage)) return true;
    const c = px(cs.backgroundColor);
    return c[3] > 0.04 && (!back || far(over(c, back), back, 0.02));
  };
  const pseudos = (e: Element): CSSStyleDeclaration[] => ["::before", "::after"].map((p) => getComputedStyle(e, p)).filter((cs) => cs.content !== "none" && cs.content !== "normal" && cs.display !== "none");
  /** Chế độ thường: nổi lên khỏi nền nhờ nền, bóng hay dải màu (những thứ màu ép buộc bỏ đi). */
  const stands = (e: Element): boolean => {
    const back = behind(e);
    const r = e.getBoundingClientRect();
    // Phần tử giả phải phủ quá nửa mới là thân của nút: vạch 1px cạnh mục điều hướng không phải.
    const cover = (p: CSSStyleDeclaration): boolean => p.position === "absolute" && parseFloat(p.width) * parseFloat(p.height) >= r.width * r.height * 0.5;
    const filled = (x: Element): boolean => {
      const cs = getComputedStyle(x);
      return shadowed(cs.boxShadow) || painted(cs, back) || pseudos(x).some((p) => cover(p) && (painted(p, back) || shadowed(p.boxShadow)));
    };
    // Liên kết bọc cả thẻ: nền và bóng nằm ở con chiếm gần hết nó.
    return filled(e) || Array.from(e.children).slice(0, 4).some((c) => {
      const q = c.getBoundingClientRect();
      return c instanceof HTMLElement && q.width * q.height >= r.width * r.height * 0.8 && filled(c);
    });
  };
  // Nền hệ thống của chế độ ép buộc. Canvas, Field và ButtonFace trùng nhau trong mọi bộ màu tương phản của Windows, nên nền
  // bằng một trong ba không làm nút nổi lên; nền khác (Highlight, hay forced-color-adjust: none) thì có.
  let system: Rgba[] | undefined;
  const systemBg = (): Rgba[] => {
    if (system) return system;
    const t = document.createElement("div");
    t.style.cssText = "position:absolute;forced-color-adjust:none";
    document.documentElement.appendChild(t);
    system = ["Canvas", "Field", "ButtonFace"].map((c) => {
      t.style.backgroundColor = c;
      return px(getComputedStyle(t).backgroundColor);
    });
    t.remove();
    return system;
  };
  const ownBg = (cs: CSSStyleDeclaration): string => {
    const c = px(cs.backgroundColor);
    if (!(c[3] > 0.04)) return "";
    return forced() && systemBg().some((s) => !far(s, c, 0.02)) ? "" : cs.backgroundColor;
  };
  const image = (cs: CSSStyleDeclaration): string => (forced() ? (cs.backgroundImage.match(/url\([^)]*\)/g) ?? []).join() : cs.backgroundImage === "none" ? "" : cs.backgroundImage);
  const SIDES = ["Top", "Right", "Bottom", "Left"] as const;
  const borders = (cs: CSSStyleDeclaration): string =>
    SIDES.map((s) => {
      const width = parseFloat(cs[`border${s}Width`]);
      const color = cs[`border${s}Color`];
      return width >= 1 && !/none|hidden/.test(cs[`border${s}Style`]) && px(color)[3] > 0.04 ? `${width}${cs[`border${s}Style`]}${color}` : "";
    }).join("/");
  const outline = (cs: CSSStyleDeclaration): string => (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1 && px(cs.outlineColor)[3] > 0.04 ? `${cs.outlineWidth}${cs.outlineStyle}${cs.outlineColor}` : "");
  const lined = (cs: CSSStyleDeclaration): boolean => borders(cs) !== "///" || outline(cs) !== "";
  const tree = (e: Element, max: number): Element[] => {
    const out: Element[] = [];
    const walk = (n: Element): void => {
      for (const c of [...Array.from(n.shadowRoot?.children ?? []), ...Array.from(n.children)]) {
        if (out.length >= max) return;
        out.push(c);
        if (!(c instanceof SVGElement)) walk(c);
      }
    };
    walk(e);
    return out;
  };
  const hasText = (e: Element): boolean => Array.from(e.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
  /** Màu ép buộc: còn viền, outline, gạch chân, nền hệ thống khác hay ảnh để nhận ra nó. */
  const edge = (e: Element): boolean => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const area = r.width * r.height;
    if (lined(cs) || ownBg(cs) || /url\(/.test(cs.backgroundImage) || cs.textDecorationLine.includes("underline")) return true;
    if (pseudos(e).some((p) => lined(p) || ownBg(p) || /url\(/.test(p.backgroundImage))) return true;
    for (const c of tree(e, 40)) {
      if (!K.shown(c)) continue;
      const ccs = getComputedStyle(c);
      if (hasText(c) && ccs.textDecorationLine.includes("underline")) return true;
      const cr = c.getBoundingClientRect();
      const big = cr.width * cr.height;
      if (big >= area * 0.5 && (lined(ccs) || ownBg(ccs))) return true;
      if (big >= area * 0.6 && /^(IMG|VIDEO|CANVAS|PICTURE|SVG)$/i.test(c.tagName)) return true;
    }
    // Khung bao sát (ô nhập kèm biểu tượng, hàng có đường kẻ): viền của khung chính là viền của nó.
    let p = K.up(e);
    for (let i = 0; i < 2 && p && p !== document.body; i++, p = K.up(p)) {
      const pr = p.getBoundingClientRect();
      if (Math.abs(pr.top - r.top) <= 16 && Math.abs(pr.bottom - r.bottom) <= 16 && lined(getComputedStyle(p))) return true;
    }
    return false;
  };
  /** Những gì phân biệt được bằng mắt, không gồm chữ. Chế độ ép buộc thì nền trùng nền hệ thống và dải màu không tính; bóng đã về none. */
  const feat = (e: Element, cs: CSSStyleDeclaration, text: boolean): string =>
    [borders(cs), outline(cs), ownBg(cs), image(cs), shadowed(cs.boxShadow) ? cs.boxShadow : "", cs.opacity, ...(text ? [cs.color, cs.fontWeight, cs.fontStyle, cs.fontSize, cs.textDecorationLine] : [])].join("|") +
    (e instanceof SVGElement ? ["", e.firstElementChild].map((x) => (x === "" ? `${cs.fill}${cs.stroke}` : x ? `${getComputedStyle(x as Element).fill}${getComputedStyle(x as Element).stroke}` : "")).join("~") : "");
  const sig = (e: Element): string => {
    const parts = [feat(e, getComputedStyle(e), true)];
    for (const p of pseudos(e)) {
      const content = p.content.replace(/^"|"$/g, "").trim();
      if (content || lined(p) || ownBg(p) || image(p) || shadowed(p.boxShadow)) parts.push(`p:${content}${borders(p)}${outline(p)}${ownBg(p)}${image(p)}${p.opacity}${p.transform}${p.width}`);
    }
    for (const c of tree(e, 25)) {
      if (!K.shown(c)) continue;
      const cs = getComputedStyle(c);
      const pic = /^(IMG|VIDEO|CANVAS|SVG)$/i.test(c.tagName);
      if (pic || hasText(c) || lined(cs) || ownBg(cs)) parts.push(`${pic ? c.tagName.toLowerCase() : ""}${feat(c, cs, hasText(c))}`);
    }
    return parts.join("\n");
  };
  w.__dkLook = { forced, stands, edge, sig };
}

interface Chosen {
  e: Element;
  attr: string;
  peers: Element[];
}

/** Chế độ thường: điều khiển chỉ nổi nhờ nền hay bóng, và mục đang chọn khác anh em chưa chọn. */
export function rememberLook(): void {
  const w = window as unknown as { __dkKeys: KeyLib; __dkLook: LookLib; __dkBefore?: { filled: Element[]; chosen: Chosen[] } };
  const K = w.__dkKeys;
  const L = w.__dkLook;
  const all = K.all();
  const okd = (e: Element): boolean => {
    for (let a: Element | null = e; a; a = K.up(a)) if (a.hasAttribute("data-forced-ok") || a.hasAttribute("inert")) return true;
    return false;
  };
  const off = (e: Element): boolean => e.matches(":disabled, [aria-disabled=true]");
  const STATES = ["aria-pressed", "aria-selected", "aria-checked", "aria-current"];
  const on = (e: Element, a: string): boolean => {
    const v = e.getAttribute(a);
    return a === "aria-current" ? v !== null && v !== "" && v !== "false" : v === "true";
  };
  // Cờ `i` của bộ chọn thuộc tính chỉ bỏ qua hoa thường của chữ ASCII ("Đ" khác "đ"), nên so bằng script.
  const crumb = (e: Element): boolean => {
    for (let x: Element | null = e; x; x = K.up(x)) if (/breadcrumb|đường dẫn/i.test(`${x.getAttribute("aria-label") ?? ""} ${x.getAttribute("class") ?? ""}`.normalize("NFC"))) return true;
    return false;
  };
  const filled: Element[] = [];
  const chosen: Chosen[] = [];
  const FILL = "button, [role=button], select, textarea, a[href], [role=link], input:not([type=hidden]):not([type=range]):not([type=color]):not([type=file]):not([type=image])";
  // Mục trong một bộ (tab, lựa chọn) nhận ra nhờ cả bộ; mục đang chọn do phần `chosen` lo.
  const ITEM = /^(tab|option|menuitem|menuitemradio|menuitemcheckbox|treeitem|radio|switch)$/;
  for (const e of all) {
    if (filled.length >= 300) break;
    if (!e.matches(FILL) || off(e) || ITEM.test(e.getAttribute("role") ?? "") || STATES.some((a) => on(e, a)) || !K.shown(e) || okd(e)) continue;
    const cs = getComputedStyle(e);
    // Ô tích, ô chọn gốc: trình duyệt tự vẽ bằng màu hệ thống. Liên kết trong dòng văn không phải hộp.
    if (e.matches("input[type=checkbox], input[type=radio]") && cs.appearance !== "none") continue;
    if (e.matches("a[href], [role=link]") && cs.display === "inline") continue;
    if (L.stands(e)) filled.push(e);
  }
  for (const a of STATES) {
    for (const e of all) {
      if (!e.hasAttribute(a) || !on(e, a) || e.getAttribute("role") === "switch" || e instanceof HTMLInputElement || !K.shown(e) || okd(e)) continue;
      const widget = e.matches("a[href], button, [role=link], [role=button], [tabindex]");
      // Mẩu bánh mì: mục cuối là trang hiện tại theo quy ước vị trí.
      if (a === "aria-current" && crumb(e)) continue;
      let peers: Element[] = [];
      let box = K.up(e);
      for (let i = 0; i < (a === "aria-current" && !widget ? 1 : 4) && box && !peers.length; i++, box = K.up(box)) {
        const pool = Array.from(box.querySelectorAll(a === "aria-current" ? e.tagName.toLowerCase() : `[${a}="false"]`));
        peers = pool.filter((p) => p !== e && !on(p, a) && !p.contains(e) && !e.contains(p) && (p.getAttribute("role") ?? "") === (e.getAttribute("role") ?? "") && (p.textContent ?? "").trim() !== "" && !off(p) && K.shown(p));
        if (a === "aria-current") peers = peers.filter((p) => !widget || p.matches("a[href], button, [role=link], [role=button], [tabindex]"));
        if (box.matches("nav, [role=navigation], main, body, [role=tablist], [role=listbox], [role=radiogroup], [role=group], [role=toolbar]")) break;
      }
      const mine = L.sig(e);
      // Chỉ xét anh em nhìn ra khác ở chế độ thường: chế độ thường đã giống thì không phải lỗi của màu ép buộc.
      const diff = peers.filter((p) => L.sig(p) !== mine);
      if (diff.length) chosen.push({ e, attr: a, peers: diff });
    }
  }
  w.__dkBefore = { filled, chosen };
}

interface ForcedHit {
  kind: "edge" | "chosen";
  key: string;
  where: string;
  peer: string;
}

/** Chế độ màu ép buộc: những gì đã nhớ ở `rememberLook` còn nhận ra không. */
export function probeForced(): ForcedHit[] {
  const w = window as unknown as { __dkKeys: KeyLib; __dkLook: LookLib; __dkBefore?: { filled: Element[]; chosen: Chosen[] } };
  const K = w.__dkKeys;
  const L = w.__dkLook;
  const b = w.__dkBefore;
  if (!b || !L.forced()) return [];
  const out: ForcedHit[] = [];
  for (const e of b.filled) {
    if (e.isConnected && K.shown(e) && !L.edge(e)) out.push({ kind: "edge", key: K.name(e), where: K.label(e), peer: "" });
  }
  const MARK = /[✓✔☑●◉◆•▸►★✅]|đang (chọn|xem|bật|ở)|hiện tại|đã chọn|\b(selected|current|active)\b/i;
  const seen = (e: Element): string => (e instanceof HTMLElement ? e.innerText : (e.textContent ?? "")).normalize("NFC");
  for (const { e, attr, peers } of b.chosen) {
    if (!e.isConnected || !K.shown(e)) continue;
    const mine = L.sig(e);
    const same = peers.find((p) => p.isConnected && K.shown(p) && L.sig(p) === mine && !(MARK.test(seen(e)) && !MARK.test(seen(p))));
    if (!same) continue;
    // Vệt chỉ báo là một phần tử riêng trượt theo mục đang chọn: có viền thì vẫn thấy.
    const r = e.getBoundingClientRect();
    const box = K.up(e);
    const scope = box && box.contains(same) ? box : box ? K.up(box) : null;
    const pill = Array.from(scope?.querySelectorAll("*") ?? []).some((x) => {
      if (x === e || x.contains(e) || K.inside(e, x) || getComputedStyle(x).position !== "absolute" || !K.shown(x) || (x.textContent ?? "").trim()) return false;
      const q = x.getBoundingClientRect();
      return Math.min(q.right, r.right) - Math.max(q.left, r.left) >= r.width * 0.5 && Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top) > -8 && L.edge(x);
    });
    if (!pill) out.push({ kind: "chosen", key: `${K.name(e)}|${attr}`, where: `${K.label(e)} [${attr}]`, peer: K.label(same) });
  }
  return out;
}

const FORCED_CAP = 4;

/** Trả trang về màu thường khi xong. Trạng thái đầu và sau thao tác, khổ rộng nhất, một chế độ màu. */
export async function forcedColorsPass(page: Page, cap = FORCED_CAP): Promise<EmulateFinding[]> {
  await page.evaluate(installKeyLib);
  await page.evaluate(installLook);
  await page.evaluate(rememberLook);
  let hits: ForcedHit[];
  try {
    await page.emulateMedia({ forcedColors: "active" });
    await settleMode(page);
    hits = await page.evaluate(probeForced);
  } finally {
    await page.emulateMedia({ forcedColors: null });
    await settleMode(page).catch(() => undefined);
    await page.evaluate(() => {
      const w = window as unknown as { __dkBefore?: unknown; __dkLook?: unknown };
      delete w.__dkBefore;
      delete w.__dkLook;
    }).catch(() => undefined);
  }
  const out: EmulateFinding[] = [];
  for (const kind of ["chosen", "edge"] as const) {
    const by = new Map<string, { hit: ForcedHit; n: number }>();
    for (const h of hits.filter((x) => x.kind === kind)) by.set(h.key, { hit: by.get(h.key)?.hit ?? h, n: (by.get(h.key)?.n ?? 0) + 1 });
    const rows = [...by.values()];
    for (const { hit, n } of rows.slice(0, cap)) {
      out.push({
        check: "forced-colors",
        where: hit.where,
        detail:
          kind === "edge"
            ? `with Windows contrast themes (forced-colors) its background and shadow are removed and nothing marks its edge${n > 1 ? ` (${n} like this)` : ""}: add border: 1px solid transparent, the theme paints it`
            : `with Windows contrast themes (forced-colors) the chosen item looks the same as ${hit.peer}: add an underline, weight or icon to it, or a border that only it has`,
      });
    }
    if (rows.length > cap) out.push({ check: "forced-colors", where: `+${rows.length - cap} more`, detail: kind === "edge" ? "more controls without an edge in forced-colors mode" : "more chosen items that look like the others in forced-colors mode" });
  }
  return out;
}

/* --------------------------------------------------------------------- offline */

const ACTIVE_MS = 3_000;
const RELOAD_MS = 8_000;

/**
 * Service worker của chính trang này: chưa có, đang cài, hay đã chạy. Hỏi theo địa chỉ trang, không hỏi mọi đăng ký của gốc: một
 * ứng dụng khác cùng gốc có service worker không phải lời hứa của trang này. `ms` là 0 thì trả lời ngay; lớn hơn thì chờ tới ngần
 * ấy cho nó chạy, kể cả khi trang đăng ký muộn (sau load, lúc rảnh): `ready` đợi cả lượt đăng ký chưa có (25/11/2026).
 */
async function workerReady(ms: number): Promise<"none" | "installing" | "active"> {
  try {
    const sw = navigator.serviceWorker as ServiceWorkerContainer | undefined;
    if (!sw) return "none";
    if (ms) await Promise.race([sw.ready, new Promise<void>((ok) => setTimeout(ok, ms))]);
    const reg = await sw.getRegistration();
    if (!reg) return "none";
    return reg.active ? "active" : "installing";
  } catch {
    /* khung cách ly, địa chỉ data: không được dùng service worker */
    return "none";
  }
}

/** Trang có đăng ký service worker không; không đổi gì, không chờ. Dùng để quyết định có mở trang riêng cho `offlinePass` hay không. */
export const registersWorker = async (page: Page): Promise<boolean> => (await page.evaluate(workerReady, 0)) !== "none";

/**
 * `offline`: nạp lại trang hai lần, nên CHẠY TRÊN MỘT TRANG RIÊNG (hoặc cuối cùng): các yêu cầu hỏng lúc mất mạng sẽ lẫn vào sổ lỗi
 * và sổ tệp phụ thuộc của trang đang đo. Luôn bật mạng lại rồi nạp lại. Chỉ gọi khi `registersWorker` đã nói có: nó chờ
 * worker tới 3 giây. Hết giờ mà trang vẫn không có worker thì trả mảng rỗng, không nạp lại; còn đang cài thì ném lỗi, vì worker chưa
 * nắm trang, ngắt mạng lúc đó không nói gì về trang ngoại tuyến của nó.
 */
export async function offlinePass(page: Page): Promise<EmulateFinding[]> {
  const state = await page.evaluate(workerReady, ACTIVE_MS);
  if (state === "none") return [];
  if (state === "installing") throw new Error(`its service worker is still installing after ${ACTIVE_MS / 1000} s`);
  const ctx = page.context();
  let where = new URL(page.url()).pathname.split("/").pop() || "page";
  try {
    where = decodeURIComponent(where);
  } catch {
    /* "%" viết sai trong địa chỉ: dùng nguyên văn */
  }
  const bad = (detail: string): EmulateFinding[] => [{ check: "offline", where, detail }];
  try {
    await ctx.setOffline(true);
    try {
      await page.reload({ waitUntil: "load", timeout: RELOAD_MS });
    } catch (e) {
      const why = /net::\w+/.exec((e as Error).message)?.[0] ?? "no answer";
      return bad(`registers a service worker, yet reloading with no network fails (${why}): cache the page shell in install, or answer navigations with an offline page`);
    }
    await twoFrames(page);
    let v = await page.evaluate(probeVisible);
    // Vỏ ứng dụng dựng bằng script sau load: cho thêm một lúc.
    for (let i = 0; i < 10 && !(v.text > 0 || v.media > 0); i++) {
      await page.waitForTimeout(100);
      v = await page.evaluate(probeVisible);
    }
    if (!(v.text > 0 || v.media > 0)) return bad("registers a service worker, yet the page is blank when reloaded with no network: show the cached content, or a line that says it is offline");
    return [];
  } finally {
    await ctx.setOffline(false);
    await page.reload({ waitUntil: "load", timeout: RELOAD_MS }).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ aria-state */

interface AriaShot {
  attrs: Record<string, string | null>;
  regions: Element[];
  regionShown: boolean;
  texts: string[];
  own: { text: string; icons: string; tokens: string; look: string };
}
interface AriaLib {
  target(e: Element): Element | null;
  shot(t: Element): AriaShot;
}

/** Cần `installKeyLib`. */
export function installAria(): void {
  const w = window as unknown as { __dkKeys: KeyLib; __dkAriaLib?: AriaLib };
  if (w.__dkAriaLib) return;
  const K = w.__dkKeys;
  const ATTRS = ["aria-expanded", "aria-pressed", "aria-selected", "aria-checked"];
  const target = (e: Element): Element | null => {
    let t: Element | null = e;
    for (let i = 0; t && i < 4; i++, t = K.up(t)) {
      if (ATTRS.some((a) => t!.hasAttribute(a))) {
        // Đi bằng up(), không closest(): lời miễn đặt trên host phải tới được nút trong shadow root (25/11/2026).
        for (let a: Element | null = t; a; a = K.up(a)) if (a.hasAttribute("data-aria-ok")) return null;
        return t;
      }
      // Nút đóng nằm trong một tab: bấm nó không phải bấm tab.
      if (t.matches("a[href], button, input, select, textarea, [role=button], [role=link]")) return null;
    }
    return null;
  };
  const LIVE = "[aria-live]:not([aria-live=off]), [role=status], [role=alert], [role=log], [role=timer], [role=tooltip]";
  // Chữ và hình đang hiện trong một vùng. Số đổi (đồng hồ, bộ đếm) không phải nội dung hiện thêm, vùng đọc tự báo cũng vậy.
  const visible = (roots: Element[], skip: Element): string[] => {
    const out: string[] = [];
    let n = 0;
    const walk = (e: Element): void => {
      if (e === skip || n++ > 1500 || /^(SCRIPT|STYLE|TEMPLATE|OPTION)$/.test(e.tagName) || e.matches(LIVE)) return;
      const own = Array.from(e.childNodes).filter((c) => c.nodeType === 3).map((c) => (c.textContent ?? "").trim()).join(" ").trim();
      const pic = /^(IMG|VIDEO|CANVAS|INPUT|SELECT|TEXTAREA)$/.test(e.tagName);
      if ((own || pic) && K.shown(e)) out.push(`${e.tagName}:${own.replace(/\d+/g, "#")}`);
      for (const c of [...Array.from(e.shadowRoot?.children ?? []), ...Array.from(e.children)]) walk(c);
    };
    roots.forEach(walk);
    return out.sort();
  };
  // Vùng không có kích thước (height: 0, display: contents) mà nội dung định vị tuyệt đối vẫn hiện. Bản thân nút không tính (25/11/2026).
  const regionOn = (r: Element, t: Element): boolean => {
    const on = (e: Element): boolean => e !== t && ((!K.inside(e, t) && K.shown(e)) || [...Array.from(e.shadowRoot?.children ?? []), ...Array.from(e.children)].some(on));
    return K.shown(r) || on(r);
  };
  const shot = (t: Element): AriaShot => {
    const root = t.getRootNode() as Document | ShadowRoot;
    const regions = (t.getAttribute("aria-controls") ?? "").split(/\s+/).filter(Boolean).map((id) => root.getElementById(id)).filter((e): e is HTMLElement => !!e);
    // Không có aria-controls: vùng quanh nút (hai tầng cha), dừng trước khung trang để việc khác của trang không lẫn vào.
    let scope: Element[] = [];
    if (!regions.length) {
      let p: Element = t;
      for (let i = 0; i < 2; i++) {
        const q = K.up(p);
        if (!q || /^(BODY|MAIN|HTML)$/.test(q.tagName)) {
          if (p.nextElementSibling) scope.push(p.nextElementSibling);
          break;
        }
        scope = [q];
        p = q;
      }
      // Menu, hộp nổi gắn ở chỗ khác trong trang.
      scope.push(...K.all().filter((e) => e.matches("[role=menu], [role=listbox], [role=dialog], [popover]") && !scope.some((s) => K.inside(s, e))));
    }
    const cs = getComputedStyle(t);
    const NOISE = /focus|hover|ripple|touch|waves/i;
    const tokens = [
      ...Array.from(t.classList),
      ...Array.from(t.attributes).filter((a) => /^data-|^style$/.test(a.name)).map((a) => `${a.name}=${a.value}`),
    ].filter((x) => !NOISE.test(x));
    return {
      attrs: Object.fromEntries(ATTRS.filter((a) => t.hasAttribute(a)).map((a) => [a, t.getAttribute(a)])),
      regions,
      regionShown: regions.some((e) => regionOn(e, t)),
      texts: visible(regions.length ? [] : scope, t),
      own: {
        text: (t instanceof HTMLElement ? t.innerText : (t.textContent ?? "")).replace(/\d+/g, "#").trim(),
        icons: Array.from(t.querySelectorAll("svg, img")).map((s) => s.innerHTML + (s.getAttribute("src") ?? "")).join("|"),
        tokens: tokens.join(" "),
        look: [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.fontWeight, cs.textDecorationLine, cs.boxShadow].join("|"),
      },
    };
  };
  w.__dkAriaLib = { target, shot };
}

/** Ngay trước khi bấm `clicked`. false: phần tử không mang trạng thái ARIA. */
function ariaBefore(clicked: Element): boolean {
  const w = window as unknown as { __dkAriaLib: AriaLib; __dkAria?: { el: Element; shot: AriaShot } };
  delete w.__dkAria;
  const t = w.__dkAriaLib.target(clicked);
  if (!t) return false;
  w.__dkAria = { el: t, shot: w.__dkAriaLib.shot(t) };
  return true;
}

/** Sau khi bấm và trang đã yên. */
function ariaAfter(): Array<{ where: string; detail: string }> {
  const w = window as unknown as { __dkKeys: KeyLib; __dkAriaLib: AriaLib; __dkAria?: { el: Element; shot: AriaShot } };
  const K = w.__dkKeys;
  const rec = w.__dkAria;
  // Phần tử đã biến mất (menu đóng lại, hàng bị gỡ) thì không còn gì để người dùng hay trình đọc gặp.
  if (!rec || !rec.el.isConnected || !K.shown(rec.el)) return [];
  const { el, shot: a } = rec;
  const b = w.__dkAriaLib.shot(el);
  const where = K.label(el);
  const out: Array<{ where: string; detail: string }> = [];
  const own = a.own.text !== b.own.text || a.own.icons !== b.own.icons || (a.own.tokens !== b.own.tokens && a.own.look !== b.own.look);
  const around = a.regions.length ? a.regionShown !== b.regionShown : a.texts.join("\n") !== b.texts.join("\n");
  for (const [attr, was] of Object.entries(a.attrs)) {
    const now = el.getAttribute(attr);
    const ids = b.regions.map((e) => `#${e.id}`).join(" ");
    if (attr === "aria-expanded" && now === "true" && b.regions.length && !b.regionShown) {
      out.push({ where, detail: `aria-expanded is "true" while the region it controls (${ids}) is hidden: set both in the same handler` });
      continue;
    }
    if (attr === "aria-expanded" && now === "false" && was === "true" && b.regionShown && !a.regionShown) {
      out.push({ where, detail: `aria-expanded is "false" after the click showed the region it controls (${ids}): it is the wrong way round` });
      continue;
    }
    if (now !== was) continue;
    // Bấm lại tab hay ô radio đang chọn: giữ nguyên là đúng.
    if (was === "true" && (attr === "aria-selected" || (attr === "aria-checked" && /^(radio|menuitemradio|option)$/.test(el.getAttribute("role") ?? "")))) continue;
    if (own || around) out.push({ where, detail: `the click changes what is shown but ${attr} stays "${was ?? ""}": update it in the same handler, a screen reader still announces the old state` });
  }
  return out;
}

/**
 * Móc cho `runActions`: `const aria = ariaStateWatch(); await runActions(page, actions, net, [aria.watch]); aria.findings`.
 * Chỉ chờ thêm (tối đa khoảng 0,4 s) sau lần bấm vào phần tử có trạng thái ARIA, và thêm 0,25 s khi thấy lệch, để thuộc tính
 * cập nhật sau một lượt vẽ khỏi bị báo oan.
 */
export function ariaStateWatch(): { watch: ActionWatch; findings: EmulateFinding[] } {
  const findings: EmulateFinding[] = [];
  let armed = false;
  return {
    findings,
    watch: {
      async before(page, action) {
        armed = false;
        if (action.click === undefined) return;
        const h = await page.waitForSelector(action.click, { state: "visible", timeout: 1500 });
        await page.evaluate(installKeyLib);
        await page.evaluate(installAria);
        armed = await h.evaluate(ariaBefore);
        await h.dispose();
      },
      async after(page) {
        if (!armed) return;
        armed = false;
        await twoFrames(page);
        await page.evaluate(settleAnimations, 350);
        let list = await page.evaluate(ariaAfter);
        if (list.length) {
          await page.waitForTimeout(250);
          list = await page.evaluate(ariaAfter);
        }
        for (const p of list) {
          if (!findings.some((f) => f.where === p.where && f.detail === p.detail)) findings.push({ check: "aria-state", ...p });
        }
      },
    },
  };
}
