import type { Page } from "playwright-core";
import { settleAnimations } from "./probe.js";
import type { ActionWatch } from "./steps.js";

/**
 * Phép đo `keyboard`, `tab-trap`, `skip-link`, `dialog-focus` (mềm, 24/11/2026): làm được mọi việc chỉ bằng bàn phím.
 *
 * - `keyboard` (WCAG 2.1.1 A): thứ bấm được bằng chuột mà Tab không tới. Ba dấu hiệu "bấm được": `cursor: pointer` do chính nó
 *   đặt (thuộc tính này kế thừa, nên chỉ tính phần tử ngoài cùng), thuộc tính `onclick`, trình nghe click thật (CDP
 *   DOMDebugger.getEventListeners, thấy cả trình nghe gắn bằng script). Miễn khi nó chứa hoặc nằm trong một điều khiển Tab tới
 *   được, và các ca vô hại đã biết (nhãn của ô nhập, mục của menu/listbox đi bằng mũi tên, lớp phủ đóng hộp, vùng kéo thả…).
 * - `tab-trap` (WCAG 2.1.2 A): Tab quay vòng trong một cụm nhỏ không phải hộp thoại modal, trang còn điểm dừng khác.
 * - `skip-link` (WCAG 2.4.1 A): nav dài đứng trước main mà không có liên kết bỏ qua, hoặc có mà không hiện khi focus.
 * - `dialog-focus` (WCAG 2.4.3 A, mẫu hộp thoại của ARIA APG): focus vào hộp, ở lại trong hộp, Esc đóng, trả về chỗ mở.
 *
 * Ý học từ renderlint `docs/rules.md` (focus-obscured, dialog-focus) và testaro `tests/testaro.ts` (focAll, focAndOp), đều MIT:
 * chỉ lấy ý, mã viết riêng. Thuộc tính miễn: `data-keyboard-ok`, `data-tab-trap-ok`, `data-skip-ok`, `data-dialog-ok`, giá trị là lý do.
 */
export interface KeyboardFinding {
  check: "keyboard" | "tab-trap" | "skip-link" | "dialog-focus";
  where: string;
  detail: string;
}

/** Hàm dùng chung trong trang, đặt trên window để các hàm đo bên dưới khỏi chép lại. */
export interface KeyLib {
  up(e: Element): Element | null;
  inside(anc: Element, n: Element | null): boolean;
  all(): Element[];
  name(e: Element): string;
  label(e: Element): string;
  shown(e: Element): boolean;
  tabbable(e: Element, modals?: Element[]): boolean;
  active(): Element | null;
  modals(): Element[];
  isModal(e: Element): boolean;
}

/** Hàm tự chứa, chạy trong trang. Gọi lại nhiều lần không sao. */
export function installKeyLib(): void {
  const w = window as unknown as { __dkKeys?: KeyLib };
  if (w.__dkKeys) return;
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const inside = (anc: Element, n: Element | null): boolean => {
    for (let a: Element | null = n; a; a = up(a)) if (a === anc) return true;
    return false;
  };
  const all = (): Element[] => {
    const out: Element[] = [];
    const walk = (root: Document | ShadowRoot): void => {
      for (const el of Array.from(root.querySelectorAll("*"))) {
        out.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return out;
  };
  const name = (e: Element): string => {
    const id = e.id ? `#${e.id}` : "";
    const cls = !id && typeof e.className === "string" && e.className.trim() ? `.${e.className.trim().split(/\s+/)[0]}` : "";
    const host = (e.getRootNode() as ShadowRoot).host;
    return `${host ? `${host.tagName.toLowerCase()}::shadow ` : ""}${e.tagName.toLowerCase()}${id}${cls}`;
  };
  const label = (e: Element): string => {
    const txt = (e.getAttribute("aria-label") || e.textContent || (e as HTMLInputElement).placeholder || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${name(e)}${txt ? ` "${txt}"` : ""}`;
  };
  const shown = (e: Element): boolean => {
    if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = e.getBoundingClientRect();
    if (!(r.width > 1 && r.height > 1)) return false;
    // Đẩy hẳn ra ngoài trang (ngăn kéo đóng bằng transform, chữ giấu bằng left: -9999px): người dùng không thấy.
    if (r.right + scrollX <= 0 || r.bottom + scrollY <= 0 || r.left >= Math.max(innerWidth, document.documentElement.scrollWidth)) return false;
    // Nằm trong hộp cắt đã thu về không (accordion đóng bằng height: 0): có rect mà không hiện.
    for (let a = up(e); a && a !== document.body; a = up(a)) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const ar = a.getBoundingClientRect();
      if (!(ar.width > 1 && ar.height > 1)) return false;
    }
    return true;
  };
  const isModal = (e: Element): boolean => {
    if (e.matches("dialog:modal")) return true;
    if (!e.matches("[role=dialog], [role=alertdialog], dialog[open]")) return false;
    if (e.getAttribute("aria-modal") === "true") return true;
    // Radix và họ hàng không đặt aria-modal mà đặt aria-hidden (hay inert) cho phần còn lại của trang.
    return Array.from(document.body?.children ?? []).some((c) => !inside(c, e) && (c.getAttribute("aria-hidden") === "true" || c.hasAttribute("inert")) && c.getBoundingClientRect().height > 1 && !!c.querySelector("a[href], button, input"));
  };
  const modals = (): Element[] => all().filter((e) => e.matches("dialog, [role=dialog], [role=alertdialog]") && isModal(e) && shown(e));
  const NATIVE = "a[href], area[href], button, input:not([type=hidden]), select, textarea, iframe, audio[controls], video[controls]";
  // Không dùng `el.tabIndex`: Chromium trả 0 cho cả <a> không có href, là thứ Tab bỏ qua (thử trên Edge 24/11/2026).
  const tabbable = (e: Element, open?: Element[]): boolean => {
    const ti = /^\s*-?\d+/.test(e.getAttribute("tabindex") ?? "") ? parseInt(e.getAttribute("tabindex")!, 10) : null;
    const editable = e.matches("[contenteditable]:not([contenteditable=false])");
    const summary = e.tagName === "SUMMARY" && e.parentElement?.tagName === "DETAILS" && e.parentElement.querySelector(":scope > summary") === e;
    if (ti === null ? !(e.matches(NATIVE) || editable || summary) : ti < 0) return false;
    if (e.matches(":disabled") || !e.checkVisibility({ checkVisibilityCSS: true })) return false;
    const list = open ?? [];
    const native = list.filter((d) => d.matches("dialog:modal"));
    if (native.length && !native.some((d) => inside(d, e))) return false;
    for (let a: Element | null = e; a; a = up(a)) {
      if (a.hasAttribute("inert")) return false;
      // Host có tabindex âm: cả cây bóng của nó bị bỏ khỏi thứ tự Tab.
      if (a !== e && a.shadowRoot && parseInt(a.getAttribute("tabindex") ?? "0", 10) < 0) return false;
    }
    return true;
  };
  const active = (): Element | null => {
    let el: Element | null = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el && el !== document.body && el !== document.documentElement ? el : null;
  };
  w.__dkKeys = { up, inside, all, name, label, shown, tabbable, active, modals, isModal };
}

/* ------------------------------------------------------------------ keyboard */

/** Số phần tử có trình nghe được xét: mỗi phần tử tốn hai lệnh CDP. */
const LISTENER_CAP = 300;
/** Phần tử nghe nhiều loại sự kiện hơn ngần này là khung phân phát của thư viện. */
const ROOT_TYPES = 20;

/**
 * Đánh dấu phần tử có trình nghe click (và thả) vào WeakMap trên window. Một lệnh lấy trình nghe của cả cây, xuyên open shadow
 * root. Trình nghe chỉ chặn lan (`e => e.stopPropagation()`) không phải hành động, nên bỏ. Hàm rỗng cũng bỏ: React gắn hàm rỗng
 * lên mọi phần tử có onClick (mẹo cho Safari), kể cả nơi onClick chẳng làm gì; chỗ bấm thật trong React còn lộ ra nhờ cursor.
 */
async function markListeners(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const group = "dk-keyboard";
  try {
    const { result } = await cdp.send("Runtime.evaluate", { expression: "document", objectGroup: group });
    if (!result.objectId) return;
    const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId, depth: -1, pierce: true });
    const by = new Map<number, { click: boolean; drop: boolean; types: Set<string> }>();
    const TRIVIAL = /^(?:(?:async\s*)?function\s*\w*\s*\(\s*\w*\s*\)|\(?\s*\w*\s*\)?\s*=>)\s*\{?\s*(?:return\s+)?(?:\w+\.(?:stopPropagation|stopImmediatePropagation|preventDefault)\(\)\s*;?\s*)+\}?\s*$/;
    const EMPTY = /^(?:function\s*[\w$]*\s*\([\w\s,]*\)|\(?[\w\s,]*\)?\s*=>)\s*\{\s*\}\s*$/;
    for (const l of listeners) {
      if (l.backendNodeId === undefined) continue;
      const rec = by.get(l.backendNodeId) ?? { click: false, drop: false, types: new Set() };
      rec.types.add(l.type);
      rec.drop ||= /^(drop|dragover|dragenter|dragstart)$/.test(l.type);
      rec.click ||= l.type === "click" && !TRIVIAL.test(l.handler?.description ?? "") && !EMPTY.test(l.handler?.description ?? "");
      by.set(l.backendNodeId, rec);
    }
    // Gốc của React nghe hơn trăm loại sự kiện để phân phát cho cây bên dưới: đó không phải một nút.
    const keep = [...by].filter(([, r]) => r.drop || (r.click && r.types.size <= ROOT_TYPES));
    // Quá trần: nút và liên kết Tab tới được xếp sau, để vài trăm nút thật không chiếm chỗ của thứ cần tìm (25/11/2026).
    if (keep.length > LISTENER_CAP) {
      // Cây quá sâu thì CDP từ chối: giữ thứ tự cũ.
      const doc = await cdp.send("DOM.getDocument", { depth: -1, pierce: true }).catch(() => undefined);
      const reach = new Set<number>();
      const nodes = doc ? [doc.root] : [];
      for (let n = nodes.pop(); n; n = nodes.pop()) {
        const at = new Map<string, string>();
        for (let i = 0; i < (n.attributes?.length ?? 0); i += 2) at.set(n.attributes![i]!, n.attributes![i + 1]!);
        const ti = parseInt(at.get("tabindex") ?? "", 10);
        if (!at.has("disabled") && (ti >= 0 || (Number.isNaN(ti) && (/^(BUTTON|SELECT|TEXTAREA|INPUT)$/.test(n.nodeName) || (n.nodeName === "A" && at.has("href")))))) reach.add(n.backendNodeId);
        nodes.push(...(n.children ?? []), ...(n.shadowRoots ?? []), ...(n.contentDocument ? [n.contentDocument] : []));
      }
      keep.sort(([a], [b]) => Number(reach.has(a)) - Number(reach.has(b)));
    }
    await Promise.all(
      keep.slice(0, LISTENER_CAP).map(async ([backendNodeId, rec]) => {
        try {
          const { object } = await cdp.send("DOM.resolveNode", { backendNodeId, objectGroup: group });
          if (!object.objectId) return;
          // Chạy trên chính nút đó, nên nút trong khung con ghi vào window của khung con, không lẫn.
          await cdp.send("Runtime.callFunctionOn", {
            objectId: object.objectId,
            functionDeclaration: "function(click, drop){ if (this.nodeType !== 1) return; const w = this.ownerDocument.defaultView; (w.__dkListen ||= new WeakMap()).set(this, { click, drop }); }",
            arguments: [{ value: rec.click }, { value: rec.drop }],
          });
        } catch {
          /* nút vừa bị gỡ: bỏ qua */
        }
      }),
    );
  } finally {
    await cdp.send("Runtime.releaseObjectGroup", { objectGroup: group }).catch(() => undefined);
    await cdp.detach().catch(() => undefined);
  }
}

interface ClickHit {
  key: string;
  where: string;
  reason: "onclick" | "listener" | "pointer" | "label";
}

/** Thứ bấm được mà Tab không tới. Cần `installKeyLib`; đọc dấu của `markListeners` nếu có. */
export function probeClickable(): ClickHit[] {
  const w = window as unknown as { __dkKeys: KeyLib; __dkListen?: WeakMap<Element, { click: boolean; drop: boolean }>; __dkClosed?: WeakSet<Element> };
  const K = w.__dkKeys;
  const all = K.all();
  const modals = K.modals();
  const tabs = new Set(all.filter((e) => K.tabbable(e, modals)));
  const holds = new Set<Element>();
  for (const t of tabs) for (let a = K.up(t); a && !holds.has(a); a = K.up(a)) holds.add(a);
  const active = K.active();
  const listen = (e: Element): { click: boolean; drop: boolean } | undefined => w.__dkListen?.get(e);
  const cursor = new Map<Element, string>();
  const cur = (e: Element): string => {
    let c = cursor.get(e);
    if (c === undefined) cursor.set(e, (c = getComputedStyle(e).cursor));
    return c;
  };

  const FRAME = /^(HTML|BODY|MAIN|UL|OL|DL|MENU|TABLE|TBODY|THEAD|TFOOT|FORM|NAV|HEADER|FOOTER|ASIDE|FIELDSET|DIALOG)$/;
  // Trình nghe ủy quyền nằm ở khung bao nhiều thứ; khung chiếm quá nửa màn mà có con cũng là khung ứng dụng (#root, #app).
  const isFrame = (e: Element): boolean => {
    if (FRAME.test(e.tagName) || /^(root|app|__next|__nuxt|svelte)$/i.test(e.id)) return true;
    const r = e.getBoundingClientRect();
    return e.children.length > 0 && r.width * r.height > innerWidth * innerHeight * 0.5;
  };
  const ok = (e: Element): boolean => {
    for (let a: Element | null = e; a; a = K.up(a)) {
      if (a.hasAttribute("data-keyboard-ok") || a.hasAttribute("inert") || a.getAttribute("aria-disabled") === "true" || a.matches(":disabled")) return true;
    }
    return false;
  };
  const inTab = (e: Element): boolean => {
    for (let a: Element | null = e; a; a = K.up(a)) if (tabs.has(a)) return true;
    return false;
  };
  // Nhãn của ô nhập: bấm nhãn là bấm ô. Ô bị khoá thì cả hai đều thôi. Ô radio không nhận Tab lúc chưa chọn nhưng mũi tên tới
  // được. Ô giấu bằng display: none thì bàn phím không tới, nhãn là đường duy nhất: không miễn.
  const labelState = (e: Element): "ok" | "lost" | undefined => {
    for (let a: Element | null = e; a; a = K.up(a)) {
      if (!(a instanceof HTMLLabelElement)) continue;
      const c = a.control;
      if (!c) return undefined;
      return (c as HTMLInputElement).disabled || K.tabbable(c, modals) ? "ok" : "lost";
    }
    return undefined;
  };
  const COMPOSITE = "[role=tablist], [role=menu], [role=menubar], [role=listbox], [role=radiogroup], [role=tree], [role=grid], [role=treegrid], [role=toolbar]";
  const ITEM = /^(tab|menuitem|menuitemcheckbox|menuitemradio|option|radio|treeitem|gridcell)$/;
  // Mục của một bộ đi bằng mũi tên: cả bộ chỉ có một điểm dừng Tab, hoặc focus đang ở trong bộ, hoặc một ô nhập điều khiển nó.
  const managed = (e: Element): boolean => {
    let item = false;
    for (let a: Element | null = e; a; a = K.up(a)) {
      if (!a.matches(COMPOSITE)) {
        item ||= a.getAttribute("tabindex") === "-1" || ITEM.test(a.getAttribute("role") ?? "");
        continue;
      }
      if (!item) return false;
      if (tabs.has(a) || holds.has(a) || (active && K.inside(a, active))) return true;
      return !!a.id && [...tabs].some((t) => ["aria-controls", "aria-owns"].some((at) => (t.getAttribute(at) ?? "").split(/\s+/).includes(a.id)));
    }
    return false;
  };
  // tabindex="-1" có lý do (của chính nó hay của khung nhỏ chứa nó): anh em cùng thẻ giữ tabindex="0" (roving không ghi role), nút
  // phụ của ô số hay ô chọn (mũi tên làm việc đó), thẻ đã chọn trong ô chọn nhiều, liên kết lặp lại một liên kết Tab tới được.
  const aside = (hit: Element): boolean => {
    let e: Element | null = hit;
    for (let i = 0; i < 2 && e && e.getAttribute("tabindex") !== "-1"; i++) e = K.up(e);
    if (!e || e.getAttribute("tabindex") !== "-1") return false;
    const href = e instanceof HTMLAnchorElement ? e.href : "";
    if (href && [...tabs].some((t) => t instanceof HTMLAnchorElement && t.href === href)) return true;
    const p = K.up(e);
    for (const box of [p, p && K.up(p)]) {
      // Khung trang chứa đủ thứ: một ô số ở nơi khác không giải thích được nút này.
      if (!box || /^(HTML|BODY|MAIN|FORM|SECTION|ARTICLE|HEADER|FOOTER|ASIDE)$/.test(box.tagName)) break;
      // Bộ roving: cả nhóm cùng thẻ chỉ có đúng một điểm dừng Tab, và nó ghi tabindex="0".
      const stops = Array.from(box.querySelectorAll(e.tagName.toLowerCase())).filter((s) => tabs.has(s));
      if (stops.length === 1 && stops[0]!.getAttribute("tabindex") === "0") return true;
      const fields = Array.from(box.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, [role=spinbutton], [role=combobox]")).filter((s) => tabs.has(s));
      if (fields.length === 1 && fields[0]!.matches("input[type=number], input[list], [role=spinbutton], [role=combobox]")) return true;
    }
    return false;
  };
  // Chỉ chứa điều khiển đang khoá: cả cụm đang khoá. Khung có con trỏ chữ, hay khung cạnh ô gõ, chỉ nghe click mà không có bàn tay:
  // bấm là đưa con trỏ vào ô, việc Tab làm được. Có bàn tay (kính lúp, nút xoá chữ) thì là nút.
  const idle = (e: Element, why: string): boolean => {
    if (e.querySelector(":disabled, [aria-disabled=true]")) return true;
    if (why !== "listener" || cur(e) === "pointer" || e.matches("button, a, summary, [role=button], [role=link], [role=checkbox], [role=switch], [role=tab], [role=menuitem], [role=option]")) return false;
    const p = K.up(e);
    const tight = (t: Element): boolean => p!.getBoundingClientRect().height <= t.getBoundingClientRect().height * 2 + 16;
    return cur(e) === "text" || (!!p && Array.from(p.querySelectorAll("input, textarea")).some((t) => tabs.has(t) && !t.matches("[type=checkbox], [type=radio], [type=button], [type=submit]") && tight(t)));
  };
  const CLOSE = /(^|[\s"“(])(đóng|huỷ|hủy|thoát|bỏ qua|để sau|xong|thu gọn|close|cancel|dismiss|done|hide)([\s"”).,!]|$)|^[×✕✖⨯]$/i;
  const closer = (t: Element): boolean =>
    CLOSE.test((t.getAttribute("aria-label") || t.getAttribute("title") || (t as HTMLInputElement).value || t.textContent || "").normalize("NFC").trim()) ||
    t.matches("[data-dismiss], [data-close], [popovertargetaction=hide], [command^=close], form[method=dialog] button, [aria-expanded=true]");
  let hasCloser: boolean | undefined;
  const backdrop = (e: Element): boolean => {
    const cs = getComputedStyle(e);
    if (!/^(fixed|absolute)$/.test(cs.position) || (e.textContent ?? "").trim()) return false;
    const r = e.getBoundingClientRect();
    if (!(r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9)) return false;
    hasCloser ??= [...tabs].some((t) => K.shown(t) && closer(t));
    return hasCloser;
  };
  const drag = (e: Element): boolean => {
    if (/^(grab|grabbing|move)$/.test(cur(e))) return true;
    for (const a of [e, K.up(e)]) {
      if (a && (a.getAttribute("draggable") === "true" || a.hasAttribute("ondrop") || listen(a)?.drop)) return true;
    }
    return false;
  };

  const out: ClickHit[] = [];
  const taken: Element[] = [];
  for (const e of all) {
    if (/^(HTML|BODY|MAIN|SCRIPT|STYLE|OPTION|IFRAME|OBJECT|EMBED)$/.test(e.tagName) || tabs.has(e) || holds.has(e)) continue;
    let reason: ClickHit["reason"] | undefined;
    const attr = e.getAttribute("onclick");
    if (attr !== null && !/^\s*((event\.(stopPropagation|stopImmediatePropagation|preventDefault)\(\)|return false)\s*;?\s*)*$/.test(attr) && !isFrame(e)) reason = "onclick";
    // Biểu đồ vẽ trên canvas và trình phát luôn gắn click cho mẹo nổi: một mình trình nghe chưa đủ nói là nút.
    else if (listen(e)?.click && attr === null && !isFrame(e) && !/^(CANVAS|VIDEO|AUDIO)$/.test(e.tagName)) reason = "listener";
    else if (cur(e) === "pointer") {
      const p = K.up(e);
      if (!p || cur(p) !== "pointer") reason = "pointer";
    }
    if (!reason || !K.shown(e) || getComputedStyle(e).pointerEvents === "none") continue;
    if (inTab(e) || ok(e) || taken.some((t) => K.inside(t, e))) continue;
    if (modals.length && !modals.some((m) => K.inside(m, e))) continue;
    // Cây bóng đóng: không nhìn vào được, có thể đã có nút thật bên trong.
    if (e.tagName.includes("-") && !e.shadowRoot && w.__dkClosed?.has(e)) continue;
    const l = labelState(e);
    if (l === "ok" || idle(e, reason) || managed(e) || aside(e) || backdrop(e) || drag(e)) continue;
    taken.push(e);
    out.push({ key: `${K.name(e)}|${reason}`, where: K.label(e), reason: l === "lost" ? "label" : reason });
  }
  return out;
}

const USE = "but Tab never reaches it: use <button> or <a href> (data-keyboard-ok when another control does the same)";
const WHY: Record<ClickHit["reason"], (n: string) => string> = {
  onclick: (n) => `has onclick${n} ${USE}`,
  listener: (n) => `has a click listener${n} ${USE}`,
  pointer: (n) => `shows a hand cursor (cursor: pointer)${n} ${USE}`,
  label: (n) => `is the label of a control${n} that Tab cannot reach (display: none or tabindex="-1"): hide the control with opacity or clip instead, so it keeps its place in the Tab order`,
};
const KEY_CAP = 5;

/** `keyboard`: không đổi trang (chỉ đặt rồi gỡ biến trên window). Chạy ở trạng thái đầu và sau thao tác, một khổ là đủ. */
export async function keyboardPass(page: Page, cap = KEY_CAP): Promise<KeyboardFinding[]> {
  await page.evaluate(installKeyLib);
  // CDP hỏng (trình duyệt lạ, trang tự điều hướng) thì vẫn còn cursor và onclick.
  await markListeners(page).catch(() => undefined);
  const hits = await page.evaluate(probeClickable);
  await page.evaluate(() => delete (window as unknown as { __dkListen?: unknown }).__dkListen);
  const by = new Map<string, { hit: ClickHit; n: number }>();
  for (const h of hits) by.set(h.key, { hit: by.get(h.key)?.hit ?? h, n: (by.get(h.key)?.n ?? 0) + 1 });
  const rows = [...by.values()];
  const out: KeyboardFinding[] = rows.slice(0, cap).map(({ hit, n }) => ({ check: "keyboard", where: hit.where, detail: WHY[hit.reason](n > 1 ? ` (${n} like this)` : "") }));
  if (rows.length > cap) out.push({ check: "keyboard", where: `+${rows.length - cap} more`, detail: "more things to click that Tab never reaches" });
  return out;
}

/* --------------------------------------------------------- tab-trap, skip-link */

/** Số lần bấm Tab tối đa. */
export const TAB_MAX = 60;
/** Vòng lặp dài hơn ngần này điểm dừng không còn là "cụm nhỏ". */
const TRAP_MAX = 12;
/** Một phần tử giữ focus: ô ngày có ba bốn phần bên trong, trình phát có nhiều nút, nên đợi lâu hơn hẳn. */
const STUCK_MIN = 14;
/** Nav từ ngần này liên kết trở lên thì cần đường bỏ qua. */
const NAV_LINKS = 5;
/** Liên kết bỏ qua được đứng sau logo, nút menu. */
const SKIP_WITHIN = 3;

/** Nav đứng trước main có bao nhiêu liên kết Tab tới được. */
function navBeforeMain(): number {
  const K = (window as unknown as { __dkKeys: KeyLib }).__dkKeys;
  const all = K.all();
  const modals = K.modals();
  const main = all.findIndex((e) => e.matches("main, [role=main]") && e.checkVisibility());
  if (main < 0) return 0;
  const okd = (e: Element): boolean => {
    for (let a: Element | null = e; a; a = K.up(a)) if (a.hasAttribute("data-skip-ok")) return true;
    return false;
  };
  const links = new Set<Element>();
  all.slice(0, main).forEach((e) => {
    if (!e.matches("a[href], [role=link]") || !K.shown(e) || !K.tabbable(e, modals) || okd(e)) return;
    for (let a = K.up(e); a; a = K.up(a)) if (a.matches("nav, [role=navigation]")) links.add(e);
  });
  return links.size;
}

/** Tab bắt đầu lại từ đầu trang: Chromium đi tiếp từ phần tử focus gần nhất, kể cả sau blur(). */
function resetTabStart(): void {
  const b = document.body;
  const had = b.hasAttribute("tabindex");
  if (!had) b.tabIndex = -1;
  b.focus({ preventScroll: true });
  b.blur();
  if (!had) b.removeAttribute("tabindex");
}

interface TabStop {
  /** 0: focus không ở phần tử nào (Tab vừa đi hết trang). */
  id: number;
  label: string;
  /** Focus có thể đang đi bên trong mà ngoài này không thấy: iframe, host của shadow root đóng (25/11/2026). */
  frame: boolean;
  editable: boolean;
}

function tabStop(): TabStop {
  const w = window as unknown as { __dkKeys: KeyLib; __dkStops?: Element[]; __dkClosed?: WeakSet<Element> };
  const stops = (w.__dkStops ??= []);
  const el = w.__dkKeys.active();
  if (!el) return { id: 0, label: "", frame: false, editable: false };
  if (!stops.includes(el)) stops.push(el);
  return { id: stops.indexOf(el) + 1, label: w.__dkKeys.label(el), frame: el.tagName === "IFRAME" || !!w.__dkClosed?.has(el), editable: el.matches("textarea, input, [contenteditable]:not([contenteditable=false]), [role=textbox]") };
}

/** Phần tử đang focus có phải liên kết tới nội dung không. `missing`: trỏ tới chỗ không có. */
function skipOf(): { label: string; href: string; missing: boolean } | null {
  const K = (window as unknown as { __dkKeys: KeyLib }).__dkKeys;
  const el = K.active();
  if (!el) return null;
  const text = (el.getAttribute("aria-label") || el.textContent || "").normalize("NFC").trim();
  const worded = /bỏ qua|(tới|đến|sang|vào) (phần )?nội dung|nội dung chính|\bskip\b|jump to (the )?(main )?content/i.test(text);
  if (!(el instanceof HTMLAnchorElement) || !el.hash || el.href.split("#")[0] !== location.href.split("#")[0]) return worded ? { label: K.label(el), href: "", missing: false } : null;
  let id = el.hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    /* "%" viết sai trong neo: dùng nguyên văn */
  }
  const t = document.getElementById(id) ?? (el.getRootNode() as Document | ShadowRoot).getElementById?.(id) ?? document.getElementsByName(id)[0];
  if (!t) return worded ? { label: K.label(el), href: el.hash, missing: true } : null;
  const all = K.all();
  const main = all.find((e) => e.matches("main, [role=main]") && e.checkVisibility());
  if (main && (K.inside(main, t) || K.inside(t, main))) return { label: K.label(el), href: el.hash, missing: false };
  // Đích nằm sau nav, trước main (một thẻ neo, tiêu đề trang): vẫn bỏ qua được nav. Khi đó nav sau main (chân trang) không tính:
  // không ai phải đi qua nó để tới nội dung (25/11/2026).
  const end = main && all.indexOf(t) < all.indexOf(main) ? all.indexOf(main) : all.length;
  const navs = all.slice(0, end).filter((e) => e.matches("nav, [role=navigation]"));
  const after = navs.length > 0 && navs.every((n) => !K.inside(n, t) && all.indexOf(t) > all.indexOf(n));
  return after || worded ? { label: K.label(el), href: el.hash, missing: false } : null;
}

/** Phần tử đang focus có hiện ra trong màn không. */
function focusShows(): boolean {
  const K = (window as unknown as { __dkKeys: KeyLib }).__dkKeys;
  const el = K.active();
  if (!el || !K.shown(el)) return false;
  const r = el.getBoundingClientRect();
  if (!(r.width > 4 && r.height > 4 && r.right > 4 && r.left < innerWidth - 4 && r.bottom > 4 && r.top < innerHeight - 4)) return false;
  const root = el.getRootNode() as Document | ShadowRoot;
  const y = Math.min(Math.max((r.top + r.bottom) / 2, 1), innerHeight - 1);
  // Cắt bằng clip hay clip-path thì rect vẫn đủ lớn nhưng điểm bấm không trúng nó.
  return [0.5, 0.15, 0.85].some((f) => {
    const x = Math.min(Math.max(r.left + r.width * f, 1), innerWidth - 1);
    const hit = root.elementFromPoint(x, y);
    return !!hit && (K.inside(el, hit) || K.inside(hit, el));
  });
}

/** Điểm dừng khác ngoài cụm đang quay vòng; `modal`: cụm nằm trong một hộp thoại modal. */
function trapFacts(ids: number[]): { others: string[]; modal: boolean; ok: boolean; where: string } {
  const w = window as unknown as { __dkKeys: KeyLib; __dkStops?: Element[] };
  const K = w.__dkKeys;
  const set = ids.map((i) => w.__dkStops?.[i - 1]).filter((e): e is Element => !!e);
  const modals = K.modals();
  const chain = (e: Element, f: (a: Element) => boolean): boolean => {
    for (let a: Element | null = e; a; a = K.up(a)) if (f(a)) return true;
    return false;
  };
  const group = (e: Element): string => (e instanceof HTMLInputElement && e.type === "radio" && e.name ? e.name : "");
  const groups = new Set(set.map(group).filter(Boolean));
  const others = K.all().filter((e) => K.tabbable(e, modals) && !set.includes(e) && K.shown(e) && !groups.has(group(e)) && !chain(e, (a) => a.getAttribute("aria-hidden") === "true") && !set.some((s) => K.inside(s, e) || K.inside(e, s)));
  return {
    others: others.slice(0, 3).map((e) => K.label(e)),
    modal: set.some((e) => chain(e, (a) => modals.includes(a) || a.getAttribute("aria-modal") === "true")),
    ok: set.some((e) => chain(e, (a) => a.hasAttribute("data-tab-trap-ok"))),
    where: set[0] ? K.label(set[0]) : "",
  };
}

/** Chu kỳ ở đuôi dãy điểm dừng: độ dài, hoặc 0 khi chưa quay vòng. Đi qua thân trang (0) là hết một vòng tự nhiên, không phải bẫy. */
export function cycleOf(ids: number[]): number {
  for (let p = 1; p <= TRAP_MAX; p++) {
    const need = p === 1 ? STUCK_MIN : Math.max(p * 3, 6);
    if (ids.length < need) continue;
    const tail = ids.slice(-need);
    // Một phần tử đứng yên cũng "lặp" với mọi chu kỳ: chỉ chu kỳ 1 (đòi dài hơn) được nhận nó.
    if (tail.includes(0) || (p > 1 && new Set(tail).size === 1)) continue;
    if (tail.every((x, i) => i < p || x === tail[i - p])) return p;
  }
  return 0;
}

/**
 * `tab-trap` và `skip-link`: bấm Tab từ đầu trang. Ở trạng thái đầu, khổ rộng nhất (nav điện thoại thường đã thu vào menu), sau
 * phép đo focus: Tab làm đổi focus, có thể mở mẹo nổi hay gõ dấu tab vào ô soạn thảo. Trả chỗ cuộn và bỏ focus khi xong.
 */
export async function tabPass(page: Page): Promise<KeyboardFinding[]> {
  await page.evaluate(installKeyLib);
  const out: KeyboardFinding[] = [];
  const links = await page.evaluate(navBeforeMain);
  const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  await page.evaluate(resetTabStart);
  await page.evaluate(() => delete (window as unknown as { __dkStops?: unknown }).__dkStops);
  const ids: number[] = [];
  const labels: string[] = [];
  let skip: { label: string; href: string; missing: boolean; shows: boolean } | undefined;
  try {
    for (let i = 0; i < TAB_MAX; i++) {
      await page.keyboard.press("Tab");
      const s = await page.evaluate(tabStop);
      // Hết trang rồi quay về điểm dừng đầu: một vòng tự nhiên, không cần đi tiếp.
      if (ids.length > 1 && ids[ids.length - 1] === 0 && s.id === ids[0]) break;
      ids.push(s.id);
      labels.push(s.label);
      if (i < SKIP_WITHIN && links >= NAV_LINKS && !skip) {
        const k = await page.evaluate(skipOf);
        if (k) {
          // Liên kết bỏ qua hay trượt từ ngoài màn vào: chờ chuyển động xong rồi mới đọc.
          await page.evaluate(settleAnimations, 400);
          skip = { ...k, shows: await page.evaluate(focusShows) };
        }
      }
      const p = cycleOf(ids);
      if (!p) continue;
      const cycle = [...new Set(ids.slice(-p))];
      // Khung con hay cây bóng đóng: focus đi qua nhiều điều khiển bên trong mà ngoài này chỉ thấy một phần tử.
      if (p === 1 && s.frame) continue;
      const f = await page.evaluate(trapFacts, cycle);
      if (f.modal || f.ok || !f.others.length) break;
      // Ô soạn mã giữ phím Tab nhưng Esc rồi Tab thì ra được: WCAG 2.1.2 chấp nhận.
      if (s.editable) {
        await page.keyboard.press("Escape");
        await page.keyboard.press("Tab");
        if (!cycle.includes((await page.evaluate(tabStop)).id)) break;
      }
      out.push({
        check: "tab-trap",
        where: f.where,
        detail: `Tab ${p === 1 ? "never leaves this element" : `goes round ${cycle.length} stops only`}, it cannot reach ${f.others.map((o) => o.slice(0, 40)).join(", ")}: let Tab move on (only a modal dialog keeps focus; data-tab-trap-ok when deliberate)`,
      });
      break;
    }
  } finally {
    await page.evaluate((at) => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      window.scrollTo({ left: at.x, top: at.y, behavior: "instant" });
      delete (window as unknown as { __dkStops?: unknown }).__dkStops;
    }, scroll).catch(() => undefined);
  }
  if (links >= NAV_LINKS) {
    if (!skip) out.push({ check: "skip-link", where: labels[0] || "page", detail: `${links} navigation links come before <main> and none of the first ${SKIP_WITHIN} Tab stops skips them: add <a href="#content">Bỏ qua tới nội dung</a> first, shown on focus` });
    else if (skip.missing) out.push({ check: "skip-link", where: skip.label, detail: `skip link points to ${skip.href}, which is not on the page: give <main> that id` });
    else if (!skip.shows) out.push({ check: "skip-link", where: skip.label, detail: "skip link stays hidden when it has focus: bring it into view with :focus" });
  }
  return out;
}

/* ---------------------------------------------------------------- dialog-focus */

/**
 * Sổ các phần tử vừa nhận focus, cũ trước mới sau; null: focus rời phần tử mà không sang đâu (bấm vào chỗ không nhận focus).
 * Nhờ nó biết phần tử nào giữ focus ngay trước khi hộp thoại mở. Gắn trước thao tác đầu tiên của một trạng thái.
 */
export function installFocusLog(): void {
  const w = window as unknown as { __dkFocusLog?: Array<Element | null> };
  if (w.__dkFocusLog) return;
  const log: Array<Element | null> = [];
  w.__dkFocusLog = log;
  const push = (e: Element | null): void => {
    if (log[log.length - 1] === e) return;
    log.push(e);
    if (log.length > 20) log.shift();
  };
  let el: Element | null = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  if (el && el !== document.body && el !== document.documentElement) push(el);
  addEventListener("focusin", (e) => {
    const t = e.composedPath()[0];
    if (t instanceof Element) push(t);
  }, true);
  addEventListener("focusout", (e) => {
    if (!e.relatedTarget) push(null);
  }, true);
}

/** Móc cho `runActions`: ghi sổ focus suốt các thao tác, để `dialogFocusPass` biết nút nào đã mở hộp. */
export const focusLogWatch: ActionWatch = {
  start: async (page) => {
    await page.evaluate(installFocusLog);
  },
};

interface DialogState {
  where: string;
  alert: boolean;
  ok: boolean;
  inside: boolean;
  active: string;
  opener: string | null;
  stops: number;
}

/** Hộp thoại modal đang hiện (chọn hộp đang giữ focus, không thì hộp cuối). Ghi hộp và nút mở vào window cho các bước sau. */
function dialogState(): DialogState | null {
  const w = window as unknown as { __dkKeys: KeyLib; __dkFocusLog?: Array<Element | null>; __dkDialog?: Element | null; __dkOpener?: Element | null };
  const K = w.__dkKeys;
  const modals = K.modals();
  const active = K.active();
  // Hộp lồng nhau: hộp trong cùng đang giữ focus.
  const holding = modals.filter((m) => active && K.inside(m, active));
  const d = holding.find((m) => !holding.some((x) => x !== m && K.inside(m, x))) ?? modals[modals.length - 1];
  if (!d) return null;
  w.__dkDialog = d;
  let opener: Element | null = null;
  for (const e of [...(w.__dkFocusLog ?? [])].reverse()) {
    if (e && K.inside(d, e)) continue;
    opener = e;
    break;
  }
  w.__dkOpener = opener;
  const by = (d.getAttribute("aria-labelledby") ?? "").split(/\s+/)[0];
  // Đi bằng up(), không closest(): lời miễn đặt trên host phải tới được hộp trong shadow root (25/11/2026).
  let exempt = false;
  for (let a: Element | null = d; a && !exempt; a = K.up(a)) exempt = a.hasAttribute("data-dialog-ok");
  const title = d.getAttribute("aria-label") || (by && (d.getRootNode() as Document | ShadowRoot).getElementById(by)?.textContent) || d.querySelector("h1, h2, h3")?.textContent || "";
  const t = title.trim().replace(/\s+/g, " ").slice(0, 28);
  return {
    where: `${K.name(d)}${t ? ` "${t}"` : ""}`,
    alert: d.getAttribute("role") === "alertdialog",
    ok: exempt,
    inside: !!active && K.inside(d, active),
    active: active ? K.label(active) : "the page body",
    opener: opener ? K.label(opener) : null,
    stops: K.all().filter((e) => K.inside(d, e) && K.tabbable(e, modals)).length,
  };
}

/** Focus đang ở đâu so với hộp: "in" (trong hộp), "none" (không ở phần tử nào), "guard" (chốt canh của bẫy focus), hoặc tên phần tử. */
function dialogStep(): string {
  const w = window as unknown as { __dkKeys: KeyLib; __dkDialog?: Element | null };
  const K = w.__dkKeys;
  const el = K.active();
  const d = w.__dkDialog;
  if (!el || !d) return "none";
  if (K.inside(d, el)) return "in";
  const r = el.getBoundingClientRect();
  // Chốt canh của thư viện (Radix, focus-trap): phần tử rỗng không thấy được, nhận focus rồi đẩy về hộp.
  if (!(r.width > 1 && r.height > 1) && !(el.textContent ?? "").trim()) return "guard";
  return K.label(el);
}

function focusIntoDialog(): void {
  const w = window as unknown as { __dkKeys: KeyLib; __dkDialog?: Element | null };
  const K = w.__dkKeys;
  const d = w.__dkDialog;
  const a = K.active();
  if (!d || (a && K.inside(d, a))) return;
  const modals = K.modals();
  (K.all().find((e) => K.inside(d, e) && K.tabbable(e, modals)) as HTMLElement | undefined)?.focus();
}

function dialogGone(): boolean {
  const w = window as unknown as { __dkKeys: KeyLib; __dkDialog?: Element | null };
  const d = w.__dkDialog;
  return !d || !d.isConnected || !w.__dkKeys.shown(d) || (d.tagName === "DIALOG" && !(d as HTMLDialogElement).open);
}

/** Bấm nút an toàn (Huỷ, Đóng, Giữ lại…) để đóng hộp không đóng bằng Esc. Không có nút nào rõ là an toàn thì thôi. */
function pressCancel(): boolean {
  const w = window as unknown as { __dkKeys: KeyLib; __dkDialog?: Element | null };
  const K = w.__dkKeys;
  const d = w.__dkDialog;
  if (!d) return false;
  const SAFE = /^(đóng|huỷ|hủy|thôi|để sau|không|quay lại|giữ lại|bỏ qua|close|cancel|dismiss|not now|no|back|keep)([\s.,!]|$)|^[×✕✖⨯x]$/i;
  const modals = K.modals();
  const b = K.all().find((e) => K.inside(d, e) && e.matches("button, [role=button], input[type=button], input[type=reset]") && K.tabbable(e, modals) && SAFE.test((e.getAttribute("aria-label") || (e as HTMLInputElement).value || e.textContent || "").normalize("NFC").trim()));
  if (!(b instanceof HTMLElement)) return false;
  b.focus();
  b.click();
  return true;
}

/** Sau khi đóng: focus về đúng chỗ mở chưa. `gone`: nút mở không còn hiện (mục của menu đã đóng), không đòi. */
function afterClose(): { back: boolean; gone: boolean; active: string | null } {
  const w = window as unknown as { __dkKeys: KeyLib; __dkOpener?: Element | null };
  const K = w.__dkKeys;
  const o = w.__dkOpener;
  const a = K.active();
  const gone = !o || !o.isConnected || !K.shown(o) || o.matches(":disabled");
  return { back: !!o && !!a && (K.inside(o, a) || K.inside(a, o)), gone, active: a ? K.label(a) : null };
}

/**
 * `dialog-focus`: PHẢI CHẠY CUỐI CÙNG, sau khi thao tác của một trạng thái đã mở hộp thoại modal; nó bấm Tab, Esc và đóng hộp.
 * Không có hộp modal nào thì trả mảng rỗng. Muốn kiểm trả focus thì `runActions(…, focusLogWatch)` trước đó.
 */
export async function dialogFocusPass(page: Page): Promise<KeyboardFinding[]> {
  await page.evaluate(installKeyLib);
  let s = await page.evaluate(dialogState);
  if (!s || s.ok) return [];
  const opener = s.opener;
  const until = async (fn: () => Promise<boolean>, ms: number): Promise<boolean> => {
    const end = Date.now() + ms;
    for (;;) {
      if (await fn()) return true;
      if (Date.now() >= end) return false;
      await page.waitForTimeout(40);
    }
  };
  const out: KeyboardFinding[] = [];
  const add = (detail: string): void => {
    out.push({ check: "dialog-focus", where: s!.where, detail });
  };
  // Thư viện hay chuyển focus sau hiệu ứng mở: cho thêm một lúc trước khi kết luận.
  if (!s.inside) {
    await until(async () => !!(s = (await page.evaluate(dialogState)) ?? s)?.inside, 400);
    if (!s.inside) add(`focus stays on ${s.active} behind the open dialog: focus its first field or its close button when it opens (<dialog> with showModal() does)`);
  }
  const left: string[] = [];
  for (const key of ["Tab", "Shift+Tab"]) {
    await page.evaluate(focusIntoDialog);
    for (let i = 0; i < Math.min(s.stops, 18) + 2; i++) {
      await page.keyboard.press(key);
      let at = await page.evaluate(dialogStep);
      // Chốt canh đẩy focus về hộp ngay hoặc sau một nhịp; bấm tiếp trước đó là đi vượt qua nó.
      if (at === "guard") await until(async () => (at = await page.evaluate(dialogStep)) !== "guard", 200);
      if (/^(in|none|guard)$/.test(at)) continue;
      left.push(`${key} → ${at}`);
      break;
    }
  }
  if (left.length) add(`focus leaves the modal dialog (${left.join("; ")}): keep Tab inside it and make the rest of the page inert (<dialog> with showModal() does both)`);
  await page.evaluate(focusIntoDialog);
  const gone = (): Promise<boolean> => page.evaluate(dialogGone);
  let closed = false;
  if (!s.alert) {
    // Lần bấm đầu có thể đóng một thứ nhỏ hơn đang mở trong hộp (mẹo nổi, danh sách chọn): cho bấm lần hai.
    for (const ms of [600, 400]) {
      await page.keyboard.press("Escape");
      if ((closed = await until(gone, ms))) break;
    }
    if (!closed) add('Escape does not close the dialog: close it on Escape (a question that must be answered is role="alertdialog"; data-dialog-ok when deliberate)');
  }
  if (!closed) closed = (await page.evaluate(pressCancel)) && (await until(gone, 600));
  if (closed && opener) {
    const r = (): Promise<{ back: boolean; gone: boolean; active: string | null }> => page.evaluate(afterClose);
    await until(async () => (await r()).back, 300);
    const a = await r();
    if (!a.back && !a.gone) add(`closing the dialog ${a.active ? `moves focus to ${a.active}` : "drops focus to the top of the page"}, not back to ${opener}: call .focus() on the control that opened it`);
  }
  return out;
}
