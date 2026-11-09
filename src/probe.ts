/**
 * Đo trong trang (chạy bằng page.evaluate ⇒ hàm phải tự chứa, không dùng biến ngoài).
 * Đi vào mọi shadow root đang mở: lỗi ở Web Component (card Lit) không lọt như khi chỉ quét light DOM.
 */
export interface ProbeHit {
  where: string;
  value: string;
}
export interface ProbeResult {
  scrollW: number;
  clientW: number;
  lang: string;
  vietnamese: boolean;
  shadowRoots: number;
  textMin: ProbeHit[];
  bodySmall: ProbeHit[];
  bodyTight: ProbeHit[];
  headingTight: ProbeHit[];
  measure: ProbeHit[];
  fontFallback: ProbeHit[];
}

export function probePage(): ProbeResult {
  const out: ProbeResult = {
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    lang: document.documentElement.lang || "",
    vietnamese: false,
    shadowRoots: 0,
    textMin: [],
    bodySmall: [],
    bodyTight: [],
    headingTight: [],
    measure: [],
    fontFallback: [],
  };
  const all: Element[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      all.push(el);
      if (el.shadowRoot) {
        out.shadowRoots++;
        walk(el.shadowRoot);
      }
    }
  };
  walk(document);

  const label = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const cls = !id && typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    const host = (el.getRootNode() as ShadowRoot).host;
    const prefix = host ? `${host.tagName.toLowerCase()}::shadow ` : "";
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${prefix}${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ""}`;
  };
  const ownText = (el: Element): string =>
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent || "")
      .join("")
      .trim();
  const visible = (el: Element, cs: CSSStyleDeclaration): boolean => {
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1; // bỏ chữ chỉ cho trình đọc màn hình (sr-only 1px)
  };
  const VI = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i;
  const GENERIC = /^(system-ui|sans-serif|serif|monospace|ui-monospace|ui-sans-serif|ui-serif|cursive|fantasy|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica|georgia|times new roman|consolas|courier new|tahoma|verdana)$/i;
  const canvas = document.createElement("canvas").getContext("2d");
  const seenFont = new Set<string>();
  const loaded = new Set(
    Array.from(document.fonts)
      .filter((f) => f.status === "loaded")
      .map((f) => f.family.replace(/["']/g, "").toLowerCase()),
  );
  let viChars = 0;

  for (const el of all) {
    const text = ownText(el);
    if (!text || el.closest("svg") || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    if (VI.test(text)) viChars++;
    const fs = parseFloat(cs.fontSize);
    const lhRaw = cs.lineHeight === "normal" ? fs * 1.2 : parseFloat(cs.lineHeight);
    const ratio = lhRaw / fs;
    const tag = el.tagName;
    if (fs < 12) out.textMin.push({ where: label(el), value: `${fs.toFixed(1)}px` });
    const isBody = tag === "P" || tag === "LI" || tag === "DD" || tag === "BLOCKQUOTE";
    const lines = Math.round(el.getBoundingClientRect().height / lhRaw);
    if (isBody && text.length > 40 && fs < 16) out.bodySmall.push({ where: label(el), value: `${fs.toFixed(1)}px` });
    if (isBody && lines >= 2 && ratio < 1.5) out.bodyTight.push({ where: label(el), value: ratio.toFixed(2) });
    if (/^H[1-4]$/.test(tag) && ratio < 1.2) out.headingTight.push({ where: label(el), value: ratio.toFixed(2) });
    if (isBody && lines >= 2 && canvas) {
      // Bề rộng ký tự trung bình đo trên chính chữ của đoạn (không dùng "0" như đơn vị ch:
      // chữ Việt trong Be Vietnam Pro hẹp hơn "0" ~37%, nên 68ch thành ~93 ký tự mỗi dòng).
      canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const sample = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400);
      const avg = sample ? canvas.measureText(sample).width / sample.length : 0;
      const width = el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (avg > 0 && width / avg > 80) out.measure.push({ where: label(el), value: `~${Math.round(width / avg)} chars/line` });
    }
    const first = (cs.fontFamily.split(",")[0] || "").replace(/["']/g, "").trim();
    const key = first.toLowerCase();
    if (first && !seenFont.has(key)) {
      seenFont.add(key);
      if (!GENERIC.test(first) && !loaded.has(key)) out.fontFallback.push({ where: label(el), value: first });
    }
  }
  // Chữ trong SVG co theo viewBox: 13px khai báo trong SVG rộng 900 hiện ở 390px chỉ còn ~5px.
  for (const el of all) {
    if (el.tagName.toLowerCase() !== "text" || !(el as SVGElement).ownerSVGElement) continue;
    const svg = (el as SVGElement).ownerSVGElement!;
    const vb = svg.viewBox?.baseVal;
    const cs = getComputedStyle(el);
    if (!vb || !vb.width || !visible(svg, getComputedStyle(svg)) || !(el.textContent || "").trim()) continue;
    const eff = parseFloat(cs.fontSize) * (svg.getBoundingClientRect().width / vb.width);
    if (eff < 12) out.textMin.push({ where: `svg ${label(el)}`, value: `${eff.toFixed(1)}px rendered` });
  }
  out.vietnamese = viChars >= 3;
  return out;
}

/** Phần tử đang focus (đi xuyên shadow root) và chỉ báo focus của nó. */
export function probeFocus(): { where: string; indicator: boolean; obscured: boolean } | null {
  let el: Element | null = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const cs = getComputedStyle(el);
  const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2;
  const ring = cs.boxShadow !== "none" && cs.boxShadow !== "";
  const id = el.id ? `#${el.id}` : "";
  const txt = (el.textContent || (el as HTMLInputElement).placeholder || el.getAttribute("aria-label") || "").trim().slice(0, 28);
  const where = `${el.tagName.toLowerCase()}${id}${txt ? ` "${txt}"` : ""}`;
  const r = el.getBoundingClientRect();
  let obscured = false;
  if (r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight) {
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    // Trúng chính nó, con của nó, hoặc host chứa nó ⇒ không bị che.
    obscured = !!hit && hit !== el && !el.contains(hit) && !hit.contains(el) && !(hit.shadowRoot && hit.shadowRoot.contains(el));
  }
  return { where, indicator: outline || ring, obscured };
}

/** Animation còn chạy (dùng sau khi giả lập prefers-reduced-motion: reduce). */
export function probeMotion(): { running: number; samples: string[] } {
  const anims = document.getAnimations().filter((a) => {
    if (a.playState !== "running") return false;
    const t = a.effect?.getComputedTiming();
    const dur = typeof t?.duration === "number" ? t.duration : 0;
    return dur > 50 || t?.iterations === Infinity;
  });
  const samples = anims.slice(0, 5).map((a) => {
    const target = (a.effect as KeyframeEffect | null)?.target;
    const name = (a as CSSAnimation).animationName || "animation";
    return `${target ? target.tagName.toLowerCase() + (target.id ? `#${target.id}` : "") : "?"} ${name}`;
  });
  return { running: anims.length, samples };
}

/** Ghi LCP và CLS ngay từ đầu (addInitScript). */
export function installVitals(): void {
  const w = window as unknown as { __dk: { lcp: number; cls: number } };
  w.__dk = { lcp: 0, cls: 0 };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__dk.lcp = Math.max(w.__dk.lcp, e.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput) w.__dk.cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    /* trình duyệt không hỗ trợ ⇒ để 0 */
  }
}
