/**
 * Phép đo `touch` (mềm, 24/11/2026): đích chạm nhỏ hơn 44×44 px trên thiết bị chạm.
 *
 * Mức cứng 24×24 (WCAG 2.5.8 AA) do axe `target-size` đo; 44 là 2.5.5 AAA (N32) và cỡ mặc định của Apple (N40; tối thiểu của
 * họ là 28 pt), Android 48 dp (N51), NN/g 1 cm (N101). Vì không phải AA nên phép đo này mềm.
 *
 * Đo vùng bấm thật, không chỉ hộp: hộp nhỏ hơn mức thì thử bấm bốn điểm cách tâm gần nửa mức (elementFromPoint của chính cây
 * chứa nó), nên đệm bằng `::after{inset:-8px}` hay nhãn bao quanh ô tích được tính. Liên kết trong dòng văn được miễn, đúng
 * ngoại lệ "inline" của WCAG. Hàm tự chứa, chạy trong trang mở với `hasTouch`.
 */
export interface TouchHit {
  where: string;
  w: number;
  h: number;
}

export function probeTouch(min: number): { total: number; small: TouchHit[] } {
  const SEL =
    "a[href], button, summary, select, textarea, input:not([type=hidden]):not([type=range]), [role=button], [role=link], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=option], [onclick]";
  const all: Element[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (el.matches(SEL)) all.push(el);
    }
  };
  walk(document);
  const label = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const cls = !id && typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    const txt = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24);
    const host = (el.getRootNode() as ShadowRoot).host;
    return `${host ? `${host.tagName.toLowerCase()}::shadow ` : ""}${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ""}`;
  };
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const inside = (anc: Element, n: Element | null): boolean => {
    for (let a: Element | null = n; a; a = up(a)) if (a === anc) return true;
    return false;
  };
  // Liên kết (hay nút hiện như chữ) nằm trong dòng văn: khối chứa còn chữ khác ngoài nó.
  const inSentence = (el: Element): boolean => {
    if (!/^inline($|-)/.test(getComputedStyle(el).display) || getComputedStyle(el).display === "inline-flex") return false;
    let b: Element | null = up(el);
    while (b && /^inline/.test(getComputedStyle(b).display)) b = up(b);
    if (!b) return false;
    for (const n of Array.from(b.childNodes)) {
      if (n.nodeType === 3 && (n.textContent ?? "").replace(/[\s·|,;/–—-]+/g, "").length >= 3) return true;
    }
    return false;
  };
  const sx = scrollX;
  const sy = scrollY;
  const small: TouchHit[] = [];
  let total = 0;
  for (const el of all) {
    const inp = el as HTMLInputElement;
    if (inp.disabled || el.getAttribute("aria-disabled") === "true" || el.closest("[inert], [aria-hidden=true]")) continue;
    if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === "none") continue;
    // Nút tự làm (Radix: <button role="checkbox"> kèm <label for>) cũng có `labels`: bấm nhãn là bấm nó.
    const toggle = /^(checkbox|radio|file)$/.test(inp.type ?? "") || /^(checkbox|radio|switch)$/.test(el.getAttribute("role") ?? "");
    const labels = toggle ? Array.from(inp.labels ?? []) : [];
    const boxes = [el, ...labels].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 1 && r.height > 1);
    // Ô thật bị giấu (trong suốt, 1px) mà có nhãn: nhãn là vùng bấm. Không còn hộp nào thì người dùng không thấy nó.
    if (!boxes.length) continue;
    if (Number(cs.opacity) === 0 && !labels.length) continue;
    total++;
    const left = Math.min(...boxes.map((r) => r.left));
    const right = Math.max(...boxes.map((r) => r.right));
    const top = Math.min(...boxes.map((r) => r.top));
    const bottom = Math.max(...boxes.map((r) => r.bottom));
    const w = right - left;
    const h = bottom - top;
    if (w >= min - 0.5 && h >= min - 0.5) continue;
    if (inSentence(el)) continue;
    // Hộp nhỏ: thử vùng bấm thật. Nhãn của ô tích và phần tử giả mở rộng đều trả về chính đích này.
    const target = labels[0] && boxes.length > 1 ? labels[0] : el;
    target.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const r = target.getBoundingClientRect();
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    const d = min / 2 - 1;
    const root = el.getRootNode() as Document | ShadowRoot;
    const mine = (x: number, y: number): boolean => {
      const hit = root.elementFromPoint(x, y);
      if (!hit) return false;
      return inside(el, hit) || labels.some((l) => inside(l, hit));
    };
    const pts: Array<[number, number]> = [];
    if (w < min - 0.5) pts.push([cx - d, cy], [cx + d, cy]);
    if (h < min - 0.5) pts.push([cx, cy - d], [cx, cy + d]);
    if (pts.every(([x, y]) => mine(x, y))) continue;
    small.push({ where: label(el), w: Math.round(w), h: Math.round(h) });
  }
  window.scrollTo({ top: sy, left: sx, behavior: "instant" });
  return { total, small };
}

export const TOUCH_MIN = 44;
export const touchFinding = (t: TouchHit, min: number): string => `${t.w}×${t.h} px on a touch screen, want ${min}×${min}: pad it, or widen the hit area with ::after { inset }`;
