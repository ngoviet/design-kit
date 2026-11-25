/**
 * Đo trong trang (chạy bằng page.evaluate ⇒ hàm phải tự chứa, không dùng biến ngoài).
 * Đi vào mọi shadow root đang mở: lỗi ở Web Component (card Lit) không lọt như khi chỉ quét light DOM.
 */
export interface ProbeHit {
  where: string;
  value: string;
}
/** Một ô gõ chữ: input chữ, textarea, select (trên iOS select cũng mở bảng chọn và cũng phóng to). */
export interface TypingField {
  where: string;
  /** Cỡ chữ đã hiển thị, px (đã nhân hệ số co của transform, scale, zoom). */
  size: number;
  /** "textarea", "select", hoặc type của input ("text", "email", "search"…). */
  type: string;
  /** readonly: vẫn nhận focus khi chạm. */
  readonly: boolean;
  /** disabled: không nhận focus. */
  disabled: boolean;
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
  innerScroll: ProbeHit[];
  /** Chữ bị cắt mất nội dung: ellipsis hay line-clamp đang giấu chữ, overflow hidden/clip cắt ngang chữ hoặc cắt mất dấu. */
  textClip: ProbeHit[];
  /** Số ô nhập đang hiện cùng lúc (form dài một màn ⇒ nên chia bước). */
  visibleFields: number;
  /** Ô gõ chữ đang hiện (mở bàn phím khi chạm) và cỡ chữ đã hiển thị: iOS phóng to trang khi chạm vào ô chữ nhỏ. */
  typingFields: TypingField[];
  /** Nút đi tiếp chỉ ghi "Tiếp"/"Next": không nói bước sau là gì. */
  vagueNext: ProbeHit[];
  /** Trạng thái rỗng cụt: báo "không có dữ liệu" mà không chỉ việc làm tiếp. */
  emptyDeadEnd: ProbeHit[];
  /** Tour mở đầu (intro.js, Shepherd, driver.js…) hoặc hộp "Chào mừng" chặn trang ngay khi mở. */
  tour: ProbeHit[];
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
    innerScroll: [],
    textClip: [],
    visibleFields: 0,
    typingFields: [],
    vagueNext: [],
    emptyDeadEnd: [],
    tour: [],
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
  const bodyColor = getComputedStyle(document.body).color;

  // Hệ số co của chữ do CSS: font-size tính toán giữ nguyên 12px dưới `transform: scale(.55)`, `scale: .55`
  // hay `zoom: .55`, nhưng chữ hiện ra chỉ 6,6px (sơ đồ lan-topo-card co theo bề rộng thẻ).
  // Nhân dồn phần tuyến tính [a b c d] của chính phần tử và mọi tổ tiên theo cây phẳng
  // (slot được gán, rồi cha, rồi shadow host). Không đo hình học (rect / offsetHeight):
  // offsetHeight làm tròn số nguyên và phép xoay làm phình hộp bao, đều báo nhầm.
  type Lin = [number, number, number, number];
  const linOf = new Map<Element, Lin>();
  const lin = (el: Element): Lin => {
    const cached = linOf.get(el);
    if (cached) return cached;
    const up = el.assignedSlot ?? el.parentElement ?? ((el.getRootNode() as ShadowRoot).host || null);
    const [pa, pb, pc, pd] = up ? lin(up) : [1, 0, 0, 1];
    const cs = getComputedStyle(el);
    let m: Lin = [1, 0, 0, 1];
    // Hộp inline thường và display: contents không biến đổi được (computed style vẫn trả matrix(...)).
    if (cs.display !== "inline" && cs.display !== "contents") {
      if (cs.transform && cs.transform !== "none") {
        const d = new DOMMatrix(cs.transform);
        m = [d.a, d.b, d.c, d.d];
      }
      // Thuộc tính riêng `scale` áp trước `transform`: S·M.
      if (cs.scale && cs.scale !== "none") {
        const [sx = 1, sy = sx] = cs.scale.split(/\s+/).map(Number);
        m = [sx * m[0], sy * m[1], sx * m[2], sy * m[3]];
      }
    }
    // zoom co đều mọi thứ bên trong, kể cả hộp inline.
    const z = parseFloat(cs.zoom);
    if (Number.isFinite(z) && z > 0 && z !== 1) m = [z * m[0], z * m[1], z * m[2], z * m[3]];
    const r: Lin = [pa * m[0] + pc * m[1], pb * m[0] + pd * m[1], pa * m[2] + pc * m[3], pb * m[2] + pd * m[3]];
    linOf.set(el, r);
    return r;
  };
  // Cỡ chữ hiện ra theo chiều cao nét chữ: độ dài trục dọc sau biến đổi. Xoay hay lật không đổi cỡ.
  // Sai số dưới 0,5% coi như không co, để 12px không thành "11.99px".
  const shrink = (el: Element): number => {
    const [, , c, d] = lin(el);
    const k = Math.hypot(c, d);
    return Math.abs(k - 1) < 0.005 ? 1 : k;
  };
  const px = (fs: number, k: number): string =>
    k === 1 ? `${fs.toFixed(1)}px` : `${(fs * k).toFixed(1)}px rendered (${+fs.toFixed(1)}px × ${k.toFixed(2)})`;

  for (const el of all) {
    const text = ownText(el);
    if (!text || el.closest("svg") || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    if (VI.test(text)) viChars++;
    const fs = parseFloat(cs.fontSize);
    const k = shrink(el);
    const lhRaw = cs.lineHeight === "normal" ? fs * 1.2 : parseFloat(cs.lineHeight);
    // Làm tròn 2 chữ số như khi in: line-height 1.2 tính ra px rồi chia lại thành 1,19999… và bị báo trượt đúng ở ngưỡng
    // (h2 1.4142rem, cỡ chữ clamp() co giãn; 19/11/2026).
    const ratio = Math.round((lhRaw / fs) * 100) / 100;
    const tag = el.tagName;
    if (fs * k < 12) out.textMin.push({ where: label(el), value: px(fs, k) });
    const isBody = tag === "P" || tag === "LI" || tag === "DD" || tag === "BLOCKQUOTE";
    // Hộp bao đã co theo k, dòng chữ khai báo thì chưa: quy về cùng một hệ. Trừ đệm và viền: `li` một dòng có padding 14px
    // từng thành "hai dòng" và bị báo body-lh, measure (25/11/2026).
    const edges = [cs.paddingTop, cs.paddingBottom, cs.borderTopWidth, cs.borderBottomWidth].reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const tall = Math.round((el.getBoundingClientRect().height / k - edges) / lhRaw);
    // Hàng một dòng cao nhờ min-height, nút hay hình: hỏi lại chính các dòng chữ, chỉ khi sắp báo. Dòng mới là khi đáy hộp chữ xuống quá
    // nửa giãn dòng (chữ to cùng dòng lệch ít hơn; chỉ số trên, dưới thì bỏ qua). Chữ đi vào qua slot, nằm trong cây bóng, bị xoay hay viết dọc thì giữ
    // cách đếm theo chiều cao (25/11/2026).
    const manyLines = (): boolean => {
      if (tall < 2) return false;
      const [, b, c] = lin(el);
      if (b || c || cs.writingMode !== "horizontal-tb" || Array.from(el.querySelectorAll("*")).some((x) => x.tagName === "SLOT" || x.shadowRoot)) return true;
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let min = Infinity;
      let max = -Infinity;
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!(t.textContent || "").trim() || t.parentElement?.closest("sub, sup")) continue;
        range.selectNodeContents(t);
        for (const q of Array.from(range.getClientRects())) {
          if (q.width <= 0) continue;
          min = Math.min(min, q.bottom);
          max = Math.max(max, q.bottom);
          if (max - min > (lhRaw * k) / 2) return true;
        }
      }
      return false;
    };
    // Chữ phụ (gợi ý dưới ô, chú thích) có màu khác chữ thân: 14px là đúng thang, không tính là thân chữ nhỏ.
    const secondary = cs.color !== bodyColor;
    if (isBody && !secondary && text.length > 40 && fs * k < 16) out.bodySmall.push({ where: label(el), value: px(fs, k) });
    if (isBody && ratio < 1.5 && manyLines()) out.bodyTight.push({ where: label(el), value: ratio.toFixed(2) });
    if (/^H[1-4]$/.test(tag) && ratio < 1.2) out.headingTight.push({ where: label(el), value: ratio.toFixed(2) });
    if (isBody && tall >= 2 && canvas) {
      // Bề rộng ký tự trung bình đo trên chính chữ của đoạn (không dùng "0" như đơn vị ch:
      // chữ Việt trong Be Vietnam Pro hẹp hơn "0" ~37%, nên 68ch thành ~93 ký tự mỗi dòng).
      canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const sample = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400);
      const avg = sample ? canvas.measureText(sample).width / sample.length : 0;
      const [a, b] = lin(el);
      const width = el.getBoundingClientRect().width / (Math.hypot(a, b) || 1) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (avg > 0 && width / avg > 80 && manyLines()) out.measure.push({ where: label(el), value: `~${Math.round(width / avg)} chars/line` });
    }
    const first = (cs.fontFamily.split(",")[0] || "").replace(/["']/g, "").trim();
    const key = first.toLowerCase();
    if (first && !seenFont.has(key)) {
      seenFont.add(key);
      if (!GENERIC.test(first) && !loaded.has(key)) out.fontFallback.push({ where: label(el), value: first });
    }
  }
  // Ô nhập đang hiện (bỏ hidden, nút, ô chọn trong nhóm radio tính một lần theo name).
  // Ô tích và ô chọn tuỳ biến thường trong suốt hoặc bị cắt còn 1px (vệt bên cạnh vẽ thay) nên không xét hộp của
  // chính nó; nhưng phải còn được dựng: ô nằm trong <details> đang đóng, trong khối hidden hay display:none
  // (bước chưa tới) thì người dùng chưa thấy, tính vào là báo nhầm "cất bớt đi" cho thứ đã cất (gặp 15/11/2026).
  const rendered = (el: Element): boolean => el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
  const radioNames = new Set<string>();
  for (const el of all) {
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) continue;
    const inp = el as HTMLInputElement;
    if (["hidden", "submit", "button", "reset", "image"].includes(inp.type)) continue;
    const proxied = inp.type === "radio" || inp.type === "checkbox";
    if (proxied ? !rendered(el) : !visible(el, getComputedStyle(el))) continue;
    if (inp.type === "radio") { if (radioNames.has(inp.name)) continue; radioNames.add(inp.name); }
    // Ô mở bàn phím hay bảng chọn khi chạm: bỏ ô tích, ô chọn, thanh trượt, ô màu, ô tệp.
    if (!proxied && !["range", "color", "file"].includes(inp.type)) {
      const tag = el.tagName === "INPUT" ? inp.type : el.tagName.toLowerCase();
      out.typingFields.push({
        where: label(el),
        size: +(parseFloat(getComputedStyle(el).fontSize) * shrink(el)).toFixed(2),
        type: tag,
        readonly: inp.readOnly === true,
        disabled: inp.disabled === true,
      });
    }
    out.visibleFields++;
  }
  // Vùng cuộn ngang đang giấu nội dung (bảng bị cắt cột): không tràn trang nhưng người dùng phải cuộn trong khung.
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowX) || !visible(el, cs)) continue;
    const hidden = el.scrollWidth - el.clientWidth;
    if (hidden > 8) out.innerScroll.push({ where: label(el), value: `${hidden}px hidden of ${el.scrollWidth}px` });
  }
  // Chữ trong SVG co theo viewBox: 13px khai báo trong SVG rộng 900 hiện ở 390px chỉ còn ~5px.
  for (const el of all) {
    if (el.tagName.toLowerCase() !== "text" || !(el as SVGElement).ownerSVGElement) continue;
    const svg = (el as SVGElement).ownerSVGElement!;
    const vb = svg.viewBox?.baseVal;
    const cs = getComputedStyle(el);
    if (!vb || !vb.width || !visible(svg, getComputedStyle(svg)) || !(el.textContent || "").trim()) continue;
    // Chiều cao chữ trên màn là bề dày dòng chữ của chính nó: hệ số bề ngang của hình sai khi viewBox khác tỉ lệ
    // khung, có preserveAspectRatio, hay chữ nằm trong nhóm co giãn, svg lồng (25/11/2026). Chữ không được vẽ (ẩn, trong defs,
    // scale(0)) hay đang co giãn vô hạn thì ma trận không nói cỡ người đọc thấy: giữ hệ số bề ngang.
    let k = svg.getBoundingClientRect().width / vb.width;
    const r = el.getBoundingClientRect();
    const m = r.width > 1 && r.height > 1 && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ? (el as SVGTextElement).getScreenCTM() : null;
    let pulsing = false;
    for (let a: Element | null = el; a && a !== svg && !pulsing; a = a.parentElement) {
      pulsing = a.getAnimations().some((x) => x.playState === "running" && x.effect instanceof KeyframeEffect && x.effect.getTiming().iterations === Infinity &&
        x.effect.getKeyframes().some((f) => "transform" in f || "scale" in f));
    }
    if (m && !pulsing) {
      // Vuông góc với dòng chữ: chữ nghiêng (skewX) không cao hơn vì nét chéo dài hơn.
      k = Math.abs(m.a * m.d - m.b * m.c) / (Math.hypot(m.a, m.b) || 1);
      if (Math.abs(k - 1) < 0.005) k = 1;
    }
    const eff = Math.round(parseFloat(cs.fontSize) * k * 100) / 100;
    if (eff < 12) out.textMin.push({ where: `svg ${label(el)}`, value: `${eff.toFixed(1)}px rendered` });
  }

  // ---- Chữ bị cắt mất nội dung ----
  // Đủ cỡ, đủ tương phản, không tràn trang mà vẫn mất chữ: dòng phụ "6/10 cổng có link · 5 phía s…" của
  // lan-topo-card ở khổ 1280 chỉ lộ ra trên ảnh chụp (10/11/2026). Đi từ từng nút chữ lên tổ tiên theo cây phẳng
  // (slot, rồi cha, rồi shadow host) tìm hộp cắt: overflow hidden/clip theo từng trục. Hộp cuộn (auto/scroll) là việc
  // của inner-scroll, html/body là việc của overflow.
  interface Clip {
    x: boolean; y: boolean; left: number; top: number; right: number; bottom: number;
    /** Mép phải trừ chỗ cho dấu "…" (ellipsis chỉ hiện khi dòng tràn ngang). */
    limit: number; ellipsis: boolean; clamp: boolean; ox: string; oy: string;
  }
  interface Up { faded: boolean; hider: boolean; fixedCB: boolean; position: string; topLayer: boolean; clip: Clip | null; scrollX: boolean; scrollY: boolean }
  const upOf = new Map<Element, Up>();
  const parentOf = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const fontOf = (cs: CSSStyleDeclaration): string => `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const info = (a: Element): Up => {
    const cached = upOf.get(a);
    if (cached) return cached;
    const cs = getComputedStyle(a);
    const boxed = cs.display !== "inline" && cs.display !== "contents"; // overflow không áp cho hộp inline
    const r = a.getBoundingClientRect();
    const x = boxed && /^(hidden|clip)$/.test(cs.overflowX);
    const y = boxed && /^(hidden|clip)$/.test(cs.overflowY);
    let clip: Clip | null = null;
    if ((x || y) && a !== document.documentElement && a !== document.body) {
      // Hộp đệm (padding box) trên màn: clientWidth chưa co theo transform nên nhân hệ số co của chính hộp.
      const h = a as HTMLElement;
      const sx = h.offsetWidth ? r.width / h.offsetWidth : 1;
      const sy = h.offsetHeight ? r.height / h.offsetHeight : 1;
      const left = r.left + a.clientLeft * sx;
      const top = r.top + a.clientTop * sy;
      const right = left + a.clientWidth * sx;
      const clamp = cs.getPropertyValue("-webkit-line-clamp");
      const ellipsis = x && cs.textOverflow === "ellipsis";
      // Dấu "…" chiếm chỗ cuối dòng: chữ nào không lọt trước nó cũng bị giấu.
      let ell = 0;
      if (ellipsis && canvas) {
        canvas.font = fontOf(cs);
        ell = canvas.measureText("…").width * sx;
      }
      clip = {
        x, y, left, top, right, bottom: top + a.clientHeight * sy, limit: right - ell,
        ellipsis, clamp: !!clamp && clamp !== "none", ox: cs.overflowX, oy: cs.overflowY,
      };
    }
    let topLayer = false;
    try {
      topLayer = a.matches(":popover-open, dialog:modal");
    } catch {
      /* trình duyệt chưa có :popover-open */
    }
    const contain = /paint|layout|strict|content/.test(cs.contain);
    const res: Up = {
      faded: Number(cs.opacity) === 0,
      // Giấu có chủ ý: sr-only (hộp ≤ 1px hoặc clip: rect), clip-path, hộp gập về 0 (accordion đóng).
      hider: cs.clipPath !== "none" || (cs.clip !== "auto" && cs.clip !== "") || (!!clip && (r.width <= 1 || r.height <= 1)),
      // Khối chứa của phần tử fixed (và của absolute, cộng thêm position khác static).
      fixedCB: cs.transform !== "none" || cs.filter !== "none" || cs.perspective !== "none" || contain || /transform|filter|perspective/.test(cs.willChange),
      position: cs.position,
      topLayer,
      clip,
      scrollX: boxed && /^(auto|scroll)$/.test(cs.overflowX),
      scrollY: boxed && /^(auto|scroll)$/.test(cs.overflowY),
    };
    upOf.set(a, res);
    return res;
  };
  // Mực chữ đo bằng canvas (actualBoundingBox) so với hộp font (fontBoundingBox): dấu chồng của "Ổ" và dấu nặng của
  // "ị" vượt hộp dòng khi line-height chặt, overflow hidden cắt mất dấu mà không mất ký tự nào ("Ổn định" → "Ön đinh").
  const inkOf = (t: Text, cs: CSSStyleDeclaration): { up: number; down: number; fa: number; fd: number } | null => {
    if (!canvas) return null;
    canvas.font = fontOf(cs);
    const m = canvas.measureText(t.data.replace(/\s+/g, " ").trim());
    return m.fontBoundingBoxAscent + m.fontBoundingBoxDescent > 0
      ? { up: m.actualBoundingBoxAscent, down: m.actualBoundingBoxDescent, fa: m.fontBoundingBoxAscent, fd: m.fontBoundingBoxDescent }
      : null;
  };
  const rng = document.createRange();
  const rectsOf = (t: Text): DOMRect[] => {
    rng.selectNodeContents(t);
    return Array.from(rng.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  };
  const cutBy = new Map<Element, { c: Clip; nodes: Text[]; x: boolean }>();
  for (const el of all) {
    if (el.closest("svg") || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "OPTION"].includes(el.tagName)) continue;
    const nodes = Array.from(el.childNodes).filter((n): n is Text => n.nodeType === 3 && !!(n.textContent || "").trim());
    if (!nodes.length) continue;
    const elCs = getComputedStyle(el);
    const elShown = visible(el, elCs);
    for (const t of nodes) {
      const slot = t.assignedSlot;
      const cs = slot ? getComputedStyle(slot) : elCs;
      if (slot ? cs.visibility === "hidden" || Number(cs.opacity) === 0 : !elShown) continue;
      const rects = rectsOf(t);
      if (!rects.length) continue;
      const u = rng.getBoundingClientRect();
      // absolute/fixed thoát các hộp cắt nằm giữa nó và khối chứa của nó (tooltip, menu thả xuống).
      let escaping: "abs" | "fixed" | null = null;
      // Đã qua một hộp cuộn ở trục nào thì chữ ở trục đó tới được bằng cách cuộn: hộp cắt bên ngoài cùng cỡ (gốc của
      // ScrollArea kiểu Radix) không làm mất chữ. Khung cuộn giấu nội dung là việc của inner-scroll.
      let scrolledX = false;
      let scrolledY = false;
      for (let a: Element | null = slot ?? el; a; a = parentOf(a)) {
        const up = info(a);
        if (up.faded || up.hider) break;
        if (escaping) {
          if (!(up.fixedCB || (escaping === "abs" && up.position !== "static"))) continue;
          escaping = null;
        }
        const ex = !!up.clip?.x && !scrolledX;
        const ey = !!up.clip?.y && !scrolledY;
        const c = up.clip && (ex || ey) ? { ...up.clip, x: ex, y: ey } : null;
        if (c) {
          // Nằm hẳn ngoài khung: giấu có chủ ý (ngăn kéo đang đóng, text-indent âm, slide khác), không phải bị cắt.
          if ((c.x && (u.right <= c.left || u.left >= c.right)) || (c.y && (u.bottom <= c.top || u.top >= c.bottom))) break;
          const cutX = c.x && rects.some((r) => r.right > c.right + 1 || r.left < c.left - 1);
          let cut = cutX;
          if (!cut && c.y) {
            const ink = inkOf(t, cs);
            cut = rects.some((r) => {
              if (!ink) return r.bottom > c.bottom + 1 || r.top < c.top - 1;
              const s = r.height / (ink.fa + ink.fd);
              const base = r.top + ink.fa * s;
              return base + ink.down * s > c.bottom + 1 || base - ink.up * s < c.top - 1;
            });
          }
          if (cut) {
            const seen = cutBy.get(a) ?? { c, nodes: [], x: false };
            seen.nodes.push(t);
            seen.x ||= cutX;
            cutBy.set(a, seen);
            break;
          }
        }
        if (up.topLayer) break;
        scrolledX ||= up.scrollX;
        scrolledY ||= up.scrollY;
        if (scrolledX && scrolledY) break;
        if (up.position === "fixed") escaping = "fixed";
        else if (up.position === "absolute") escaping = "abs";
      }
    }
  }
  // Báo theo hộp cắt: chữ đang hiện (ký tự có tâm nằm trong hộp; với ellipsis, ký tự lọt trước dấu "…").
  for (const [a, { c, nodes, x }] of cutBy) {
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (p && visible(p, getComputedStyle(p)) && (n.textContent || "").trim()) texts.push(n as Text);
    }
    // Chữ đến từ slot không nằm dưới hộp cắt trong cây DOM: dùng chính các nút bị cắt.
    if (!nodes.some((n) => texts.includes(n))) texts.splice(0, texts.length, ...nodes);
    let shown = "";
    let hidden = 0;
    let budget = 400;
    for (const t of texts) {
      let prev = true;
      let i = 0;
      for (const ch of t.data) {
        if (budget-- <= 0) break;
        rng.setStart(t, i);
        rng.setEnd(t, i + ch.length);
        i += ch.length;
        const r = rng.getBoundingClientRect();
        // Dấu kết hợp (chữ Việt dạng NFD) và khoảng trắng gộp không có hộp riêng: theo ký tự trước.
        let inside: boolean = prev;
        if (r.width > 0 || r.height > 0) {
          const cx = (r.left + r.right) / 2;
          const cy = (r.top + r.bottom) / 2;
          // Trục ngang chỉ xét khi dòng thật sự tràn ngang: dấu "…" chỉ hiện lúc đó.
          inside = (!x || (c.ellipsis ? r.right <= c.limit + 0.5 && r.left >= c.left - 0.5 : cx >= c.left && cx <= c.right)) &&
            (!c.y || (cy >= c.top && cy <= c.bottom));
        }
        prev = inside;
        if (inside) shown += ch;
        else if (/\S/.test(ch)) {
          if (!shown.endsWith("…")) shown += "…";
          hidden++;
        }
      }
    }
    shown = shown.replace(/\s+/g, " ").replace(/\s*…\s*/g, "…").trim();
    // Tên cách cắt theo trục đã cắt: ngang thì ellipsis hay overflow-x, dọc thì line-clamp hay overflow-y.
    const how = x ? (c.ellipsis ? "ellipsis" : `overflow ${c.ox}`) : c.clamp ? "line-clamp" : `overflow ${c.oy}`;
    const at = `at ${innerWidth}px by ${how}`;
    if (hidden || x) {
      // Cắt ngang ký tự cuối mà tâm còn trong hộp: không ký tự nào mất hẳn, nhưng nét cuối đã mất.
      const tail = shown.length > 56 ? `…${shown.slice(-48)}` : shown;
      out.textClip.push({ where: label(a), value: `${at}: shows "${tail.replace(/…+/g, "…")}"${hidden ? "" : " with the last letter cut at the edge"}` });
    } else {
      // Dấu chồng của Be Vietnam Pro cao hơn ascent của font 0,25em: line-height 1,5 vẫn gọt móc dấu hỏi của "Ổ".
      const whole = shown.length > 40 ? `${shown.slice(0, 40)}…` : shown;
      out.textClip.push({ where: label(a), value: `${at}: tops or bottoms of letters cut in "${whole}" (stacked accents, dots below, descenders): add padding-block or clip only overflow-x` });
    }
  }
  // ---- Dẫn đường (skill mục 2b) ----
  const shown = (el: Element): boolean => visible(el, getComputedStyle(el));
  const accName = (el: Element): string =>
    (el.getAttribute("aria-label") || (el.tagName === "INPUT" ? (el as HTMLInputElement).value : el.textContent) || "").replace(/\s+/g, " ").trim();
  // Nút đi tiếp mà không nói đi đâu. Phân trang (trong <nav>) và carousel được phép ghi "Sau"/"Tiếp".
  const NEXT = /^(tiếp|tiếp tục|tiếp theo|next|continue|›|»|→)$/i;
  for (const el of all) {
    const isBtn = el.tagName === "BUTTON" || el.getAttribute("role") === "button" || el.tagName === "A" ||
      (el.tagName === "INPUT" && ["submit", "button"].includes((el as HTMLInputElement).type));
    if (!isBtn || el.closest("nav, [aria-roledescription='carousel'], .carousel, .swiper") || !shown(el)) continue;
    const name = accName(el);
    if (NEXT.test(name)) out.vagueNext.push({ where: label(el), value: `"${name}"` });
  }
  // Trạng thái rỗng cụt: câu báo rỗng mà quanh nó (tối đa 3 tầng, vùng còn nhỏ) không có nút hay liên kết nào.
  const EMPTY = /^((không|chưa) có (dữ liệu|kết quả|bản ghi)|(không|chưa) có [^.]{1,30} nào|không (tìm )?thấy|danh sách trống|no (data|results?|items?|records?)\b|nothing (here|found|yet))/i;
  const ACTION = "a[href], button, input:not([type=hidden]), select, textarea, [role=button]";
  for (const el of all) {
    const text = ownText(el);
    if (!text || text.length > 80 || !EMPTY.test(text) || !shown(el)) continue;
    let a: Element | null = el;
    let found = !!el.querySelector(ACTION);
    for (let i = 0; i < 3 && !found && a.parentElement && a.parentElement !== document.body; i++) {
      a = a.parentElement;
      if ((a.textContent || "").length > 400) break;
      found = !!a.querySelector(ACTION);
    }
    // Câu nằm ngay dưới body hay gốc cây bóng: không có tầng nào để đi lên, nên xét thứ đứng ngay sau nó (qua các dòng giải thích).
    // Nút ở chỗ khác của trang không phải việc làm tiếp của câu này (25/11/2026).
    if (el.parentNode === document.body || el.parentNode instanceof ShadowRoot) {
      let chars = text.length;
      for (let s = el.nextElementSibling; s && !found; s = s.nextElementSibling) {
        if (!shown(s)) continue;
        chars += (s.textContent || "").length;
        if (chars > 400 || s.matches("header, nav, main, footer, aside, [role=banner], [role=navigation], [role=main], [role=contentinfo]")) break;
        found = s.matches(ACTION) || !!s.querySelector(ACTION);
        if (!/^(P|SPAN|SMALL|BR)$/.test(s.tagName)) break;
      }
    }
    if (!found) out.emptyDeadEnd.push({ where: label(el), value: `"${text.slice(0, 40)}"` });
  }
  // Tour mở đầu: thư viện tour phổ biến, hoặc hộp thoại modal "Chào mừng / Bước 1" đang mở ngay lần render đầu.
  const TOUR = ".introjs-overlay, .introjs-tooltip, .shepherd-element, .driver-popover, .react-joyride__tooltip, .reactour__mask, .hopscotch-bubble";
  const tourEl = all.find((el) => el.matches(TOUR) && shown(el));
  if (tourEl) out.tour.push({ where: label(tourEl), value: "tour library overlay" });
  const WELCOME = /chào mừng|welcome|hướng dẫn nhanh|take a tour|tham quan|bước 1\s*(\/|trên)|step 1 of/i;
  for (const el of all) {
    const modal = (el.tagName === "DIALOG" && (el as HTMLDialogElement).open && el.matches(":modal")) ||
      (el.getAttribute("role") === "dialog" && el.getAttribute("aria-modal") === "true");
    if (modal && shown(el) && WELCOME.test(el.textContent || "")) {
      out.tour.push({ where: label(el), value: "welcome modal" });
      break;
    }
  }
  out.vietnamese = viChars >= 3;
  return out;
}

/**
 * Chữ bị phần tử khác vẽ đè: chữ tràn khỏi hộp của nó và hộp bên cạnh (có nền) nằm trên. Mọi phép đo khác đều đạt
 * vì chữ đủ cỡ, đủ tương phản, không tràn trang và không bị hộp cắt: khối hero của kit hiện "Camer" và "23/2" ở 320px
 * suốt từ 09/11 tới 15/11/2026 mà cổng không báo.
 *
 * Mỗi dòng chữ thử 9 điểm bằng `elementFromPoint` của chính cây chứa nó (document hoặc shadow root). Bỏ qua: lớp phủ
 * có chủ ý (chữ hay vật che nằm trong phần tử fixed/sticky/absolute, dialog, popover), vật che không vẽ gì (liên kết phủ
 * trong suốt), điểm nằm ngoài hộp cắt của tổ tiên (đó là việc của text-clip), chữ có `pointer-events: none` (không
 * hit-test được). Trang được cuộn từng nửa màn rồi trả về chỗ cũ.
 */
export function probeCovered(): ProbeHit[] {
  const de = document.documentElement;
  const all: Element[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      all.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
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
  // Cha theo cây phẳng: slot được gán, rồi cha, rồi shadow host.
  const up = (el: Element): Element | null => el.assignedSlot ?? el.parentElement ?? ((el.getRootNode() as ShadowRoot).host || null);
  const inside = (anc: Element, n: Element): boolean => {
    for (let a: Element | null = n; a; a = up(a)) if (a === anc) return true;
    return false;
  };
  const overlay = (el: Element): boolean => {
    for (let a: Element | null = el; a && a !== de; a = up(a)) {
      const p = getComputedStyle(a).position;
      if (p === "fixed" || p === "sticky" || p === "absolute" || a.tagName === "DIALOG" || a.hasAttribute("popover")) return true;
    }
    return false;
  };
  const alpha = (c: string): number => {
    // Hàm màu kiểu mới (oklch, lab, color(...)) ghi độ đục sau dấu "/".
    const slash = /\/\s*([\d.]+%?|none)\s*\)/.exec(c)?.[1];
    if (slash) return slash === "none" ? 0 : parseFloat(slash) / (slash.endsWith("%") ? 100 : 1);
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return c && c !== "transparent" ? 1 : 0;
    const parts = m[1]!.split(/[,/\s]+/).filter(Boolean);
    return parts.length >= 4 ? parseFloat(parts[3]!) : 1;
  };
  const paints = (el: Element): boolean => {
    if (/^(IMG|VIDEO|CANVAS|SVG|IFRAME|INPUT|SELECT|TEXTAREA|BUTTON)$/i.test(el.tagName)) return true;
    for (const pseudo of [null, "::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && (cs.content === "none" || cs.content === "normal")) continue;
      if (alpha(cs.backgroundColor) >= 0.5 || cs.backgroundImage !== "none") return true;
    }
    return false;
  };
  const clippedAt = (el: Element, x: number, y: number): boolean => {
    for (let a = up(el); a && a !== de; a = up(a)) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const r = a.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return true;
    }
    return false;
  };
  const shown = (el: Element): boolean => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });

  // 1. Mọi dòng chữ, toạ độ tài liệu (trước khi cuộn).
  const lines: Array<{ el: Element; top: number; left: number; width: number; height: number }> = [];
  const range = document.createRange();
  for (const el of all) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "OPTION"].includes(el.tagName) || el.closest("svg")) continue;
    const nodes = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && (n.textContent || "").trim());
    if (!nodes.length || !shown(el) || overlay(el) || getComputedStyle(el).pointerEvents === "none") continue;
    for (const n of nodes) {
      range.selectNodeContents(n);
      for (const q of Array.from(range.getClientRects())) {
        if (q.width >= 6 && q.height >= 6) lines.push({ el, top: q.top + scrollY, left: q.left + scrollX, width: q.width, height: q.height });
      }
    }
  }
  // 2. Cuộn từng nửa màn; mỗi dòng thử một lần, lúc nó nằm trọn trong màn.
  const hits = new Map<Element, string>();
  const tried = new Set<number>();
  const sx = scrollX;
  const sy = scrollY;
  const docH = Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const step = Math.max(120, Math.floor(innerHeight / 2));
  for (let y0 = 0, guard = 0; guard < 400; y0 += step, guard++) {
    window.scrollTo({ top: y0, left: 0, behavior: "instant" });
    lines.forEach((ln, i) => {
      if (tried.has(i)) return;
      const top = ln.top - scrollY;
      if (top < 0 || top + ln.height > innerHeight) return;
      tried.add(i);
      if (hits.has(ln.el)) return;
      const y = top + ln.height / 2;
      const x0 = ln.left - scrollX;
      const pts: Array<[string, number]> = [["start", x0 + 2], ["end", x0 + ln.width - 2]];
      for (let k = 1; k <= 7; k++) pts.push(["middle", x0 + (ln.width * k) / 8]);
      const root = ln.el.getRootNode() as Document | ShadowRoot;
      for (const [where, x] of pts) {
        if (x < 0 || x > innerWidth) continue;
        const hit = root.elementFromPoint(x, y);
        if (!hit || hit === ln.el || inside(ln.el, hit) || inside(hit, ln.el)) continue;
        if (overlay(hit) || !paints(hit) || clippedAt(ln.el, x, y)) continue;
        hits.set(ln.el, `covered by ${label(hit)} at its ${where}: the text spills out of its box under the next one`);
        break;
      }
    });
    if (scrollY + innerHeight >= docH - 1 || tried.size === lines.length) break;
  }
  window.scrollTo({ top: sy, left: sx, behavior: "instant" });
  return Array.from(hits, ([el, value]) => ({ where: label(el), value }));
}

/**
 * Ghi kiểu CHƯA focus của mọi phần tử nhận focus vào một WeakMap (`window.__dkFocusBase`), để `probeFocus` biết kiểu có đổi khi
 * focus không. Chỉ đọc outline và box-shadow thì báo oan trang đánh dấu focus bằng viền, nền hay gạch chân. Gọi sau khi trang yên
 * và TRƯỚC lần Tab đầu. Ghi: outline, viền, nền, màu chữ, bóng, gạch chân của chính nó, của ::before/::after, của con (thẻ bấm
 * được đổi tiêu đề bên trong), của phần tử thay thế ô tích (phần tử kế, nhãn), và của khung bao chỉ chứa mình nó (`:focus-within`
 * trên khung của ô nhập; khung chứa nhiều điều khiển đổi màu thì không nói được cái nào đang focus, nên không tính).
 *
 * "Khác đủ thấy": kích thước khác từ 1px, màu cách nhau từ 0,06 trong OKLab sau khi pha trên nền thật. Bỏ phần đang chạy hiệu ứng
 * lặp vô hạn (nó khác vì hiệu ứng). Đổi khổ, chế độ màu hay bật màu ép buộc sau khi ghi thì không so nữa (trả false). Trả về số
 * phần tử đã ghi.
 */
export function rememberUnfocused(): number {
  const SEL = "a[href], area[href], button, input:not([type=hidden]), select, textarea, summary, iframe, audio[controls], video[controls], [tabindex], [contenteditable]:not([contenteditable=false])";
  const TYPING = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=hidden]):not([type=range]):not([type=file]):not([type=image]):not([type=color]), textarea, select";
  type Rgba = [number, number, number, number];
  interface Snap {
    outline: number;
    outlineColor: string;
    border: number[];
    borderColor: string[];
    bg: string;
    image: string;
    color: string;
    shadow: string;
    line: string;
    lineColor: string;
    lineWidth: number;
    /** Chỉ phần tử giả: chữ của nó, độ mờ và biến hình, cỡ (gạch chân vẽ bằng ::after rộng dần). */
    content: string;
    box: string;
    shown: boolean;
    size: number[];
  }
  interface Spot {
    e: Element;
    pseudo: "" | "::before" | "::after";
    kind: "own" | "proxy" | "wrap";
    /** null: phần tử giả lúc đó không có. */
    snap: Snap | null;
  }
  const env = (): string => `${matchMedia("(forced-colors: active)").matches}|${matchMedia("(prefers-color-scheme: dark)").matches}|${innerWidth}`;
  const at = env();
  const base = new WeakMap<Element, Spot[]>();
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const read = (e: Element, pseudo: Spot["pseudo"]): Snap | null => {
    const cs = getComputedStyle(e, pseudo || null);
    if (pseudo && (cs.content === "none" || cs.content === "normal")) return null;
    const w = (style: string, width: string): number => (/none|hidden/.test(style) ? 0 : parseFloat(width) || 0);
    return {
      outline: w(cs.outlineStyle, cs.outlineWidth),
      outlineColor: cs.outlineColor,
      border: [w(cs.borderTopStyle, cs.borderTopWidth), w(cs.borderRightStyle, cs.borderRightWidth), w(cs.borderBottomStyle, cs.borderBottomWidth), w(cs.borderLeftStyle, cs.borderLeftWidth)],
      borderColor: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor],
      bg: cs.backgroundColor,
      image: cs.backgroundImage === "none" ? "" : `${cs.backgroundImage} ${cs.backgroundSize} ${cs.backgroundPosition}`,
      color: cs.color,
      shadow: cs.boxShadow,
      line: cs.textDecorationLine,
      lineColor: cs.textDecorationColor,
      lineWidth: parseFloat(cs.textDecorationThickness) || 1,
      content: pseudo ? cs.content.replace(/^"(.*)"$/s, "$1").trim() : "",
      box: pseudo ? `${cs.opacity}|${cs.transform}` : "",
      shown: !pseudo || (Number(cs.opacity) > 0.05 && cs.visibility === "visible" && cs.display !== "none"),
      size: pseudo ? [parseFloat(cs.width) || 0, parseFloat(cs.height) || 0] : [],
    };
  };
  const spots = (e: Element): Spot[] => {
    const out: Spot[] = [];
    const take = (x: Element, kind: Spot["kind"]): void => {
      for (const pseudo of ["", "::before", "::after"] as const) out.push({ e: x, pseudo, kind, snap: read(x, pseudo) });
    };
    take(e, "own");
    Array.from(e.querySelectorAll("*")).slice(0, 12).forEach((c) => take(c, "own"));
    if (e.matches("input[type=checkbox], input[type=radio]")) {
      for (const c of [e.nextElementSibling, ...Array.from((e as HTMLInputElement).labels ?? [])]) if (c) take(c, "proxy");
    }
    const inner = (p: Element, sel: string): number => [...Array.from(p.querySelectorAll(sel)), ...Array.from(p.shadowRoot?.querySelectorAll(sel) ?? [])].filter((x) => x !== e && x.getAttribute("tabindex") !== "-1" && !e.contains(x)).length;
    let p = up(e);
    for (let i = 0; i < 2 && p && !/^(BODY|MAIN|HTML)$/.test(p.tagName); i++, p = up(p)) {
      if (inner(p, SEL) === 0 || (e.matches(TYPING) && inner(p, TYPING) === 0)) take(p, "wrap");
    }
    return out;
  };
  const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  // Qua canvas thì đọc được mọi cách viết màu (oklch, color()).
  const px = (c: string): Rgba => {
    if (!ctx) return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
  };
  const over = (c: Rgba, b: Rgba): Rgba => [c[0] * c[3] + b[0] * (1 - c[3]), c[1] * c[3] + b[1] * (1 - c[3]), c[2] * c[3] + b[2] * (1 - c[3]), 1];
  const lab = (c: Rgba): [number, number, number] => {
    const f = (v: number): number => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = [f(c[0]), f(c[1]), f(c[2])];
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const dist = (a: Rgba, b: Rgba): number => {
    const [x, y] = [lab(a), lab(b)];
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };
  const behind = (e: Element): Rgba => {
    const stack: Rgba[] = [];
    for (let a = up(e); a; a = up(a)) {
      const c = px(getComputedStyle(a).backgroundColor);
      if (c[3] > 0) stack.push(c);
      if (c[3] >= 0.99) break;
    }
    return stack.reverse().reduce((b, c) => over(c, b), [255, 255, 255, 1] as Rgba);
  };
  const apart = (a: string, b: string, back: Rgba): boolean => a !== b && dist(over(px(a), back), over(px(b), back)) >= 0.06;
  // Các lớp bóng thấy được. Tailwind ghi sẵn những lớp trong suốt 0px làm chỗ trống.
  const layers = (v: string): Array<{ color: string; n: number[]; inset: boolean }> =>
    (v === "none" ? [] : v.split(/,(?![^(]*\))/))
      .map((s) => {
        const color = /([a-z-]+\([^)]*\)|#\w+)/i.exec(s)?.[1] ?? "rgb(0, 0, 0)";
        return { color, n: (s.replace(color, "").match(/-?[\d.]+px/g) ?? []).map((x) => parseFloat(x)), inset: /\binset\b/.test(s) };
      })
      .filter((l) => px(l.color)[3] > 0.05 && l.n.some((x) => Math.abs(x) >= 1));
  // Phần tử giả có vẽ gì thấy được không: chữ, hay một hộp có nền, viền, bóng.
  const draws = (x: Snap | null): boolean =>
    !!x && x.shown && (x.content !== "" || ((x.size.every((v) => v >= 1) || x.border.some((v) => v >= 1)) && (px(x.bg)[3] > 0.05 || x.image !== "" || x.border.some((v) => v >= 1) || x.outline >= 1 || layers(x.shadow).length > 0)));
  const differs = (a: Snap | null, b: Snap | null, s: Spot): boolean => {
    if (s.pseudo) {
      if (draws(a) !== draws(b)) return true;
      if (!draws(a)) return false;
    }
    if (!a || !b) return false;
    const back = behind(s.e);
    const far = (x: number, y: number): boolean => Math.abs(x - y) >= 1;
    // Viền trùng màu nền phía sau thì không ai thấy: coi như rộng 0.
    const worth = (w: number, c: string): number => (w > 0 && dist(over(px(c), back), back) >= 0.03 ? w : 0);
    const [oa, ob] = [worth(a.outline, a.outlineColor), worth(b.outline, b.outlineColor)];
    if (far(oa, ob) || (oa >= 1 && ob >= 1 && apart(a.outlineColor, b.outlineColor, back))) return true;
    for (let i = 0; i < 4; i++) {
      const [x, y] = [worth(a.border[i]!, a.borderColor[i]!), worth(b.border[i]!, b.borderColor[i]!)];
      if (far(x, y) || (x >= 1 && y >= 1 && apart(a.borderColor[i]!, b.borderColor[i]!, back))) return true;
    }
    if (apart(a.bg, b.bg, back) || a.image !== b.image) return true;
    const [la, lb] = [layers(a.shadow), layers(b.shadow)];
    if (la.length !== lb.length || la.some((l, i) => l.inset !== lb[i]!.inset || l.n.some((x, k) => far(x, lb[i]!.n[k] ?? 0)) || apart(l.color, lb[i]!.color, back))) return true;
    const inked = s.pseudo ? b.content !== "" : !!(s.e.textContent ?? "").trim() || s.e instanceof SVGElement || !!s.e.querySelector("svg") || s.e.matches(TYPING);
    if (inked) {
      const on = over(px(b.bg), back);
      if (apart(a.color, b.color, on) || a.line !== b.line) return true;
      if (b.line !== "none" && (far(a.lineWidth, b.lineWidth) || apart(a.lineColor, b.lineColor, on))) return true;
    }
    return s.pseudo !== "" && (a.content !== b.content || a.box !== b.box || a.size.some((x, i) => far(x, b.size[i]!)));
  };
  const looping = (s: Spot): boolean =>
    s.e.getAnimations({ subtree: true }).some((a) => {
      const f = a.effect as KeyframeEffect | null;
      return f?.target === s.e && (f.pseudoElement ?? "") === s.pseudo && a.playState === "running" && !Number.isFinite(Number(f.getComputedTiming().endTime));
    });
  const seen = (e: Element): boolean => {
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && Number(getComputedStyle(e).opacity) > 0;
  };
  let active: Element | null = document.activeElement;
  while (active && active.shadowRoot && active.shadowRoot.activeElement) active = active.shadowRoot.activeElement;
  let n = 0;
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      // Đang focus sẵn (autofocus): kiểu lúc này không phải kiểu chưa focus, nên không có mốc để so.
      if (!el.matches(SEL) || el === active) continue;
      base.set(el, spots(el));
      n++;
    }
  };
  walk(document);
  (window as unknown as { __dkFocusBase: unknown }).__dkFocusBase = {
    changed(e: Element, seesOwn: boolean): boolean {
      if (env() !== at) return false;
      return (base.get(e) ?? []).some((s) => {
        // Ô thật trong suốt: kiểu của chính nó không ai thấy, chỉ hình thay thế và khung bao mới tính.
        if (s.kind === "own" && !seesOwn) return false;
        return s.e.isConnected && seen(s.e) && !looping(s) && differs(s.snap, read(s.e, s.pseudo), s);
      });
    },
  };
  return n;
}

/**
 * Phần tử đang focus (đi xuyên shadow root) và chỉ báo focus của nó. `shadowOnly`: vòng focus chỉ vẽ bằng box-shadow,
 * không có outline nào (kể cả trong suốt). Chế độ màu ép buộc (Windows High Contrast) đặt box-shadow về none, nên vòng
 * biến mất; outline thì được tô lại bằng màu hệ thống (thử trên Edge 15/11/2026: outline trong suốt thành rgb(55, 0, 110)).
 * `changed`: kiểu lúc focus khác kiểu chưa focus đủ thấy (viền, nền, gạch chân… chứ không chỉ outline và bóng); chỉ có nghĩa khi
 * `rememberUnfocused` đã chạy trước lần Tab đầu, không thì luôn false.
 */
export function probeFocus(): { where: string; indicator: boolean; thin: boolean; shadowOnly: boolean; obscured: boolean; hidden: boolean; changed: boolean } | null {
  let el: Element | null = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const cs = getComputedStyle(el);
  const hasRing = (s: CSSStyleDeclaration): boolean =>
    (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2) || (s.boxShadow !== "none" && s.boxShadow !== "");
  const id = el.id ? `#${el.id}` : "";
  const txt = (el.textContent || (el as HTMLInputElement).placeholder || el.getAttribute("aria-label") || "").trim().slice(0, 28);
  const where = `${el.tagName.toLowerCase()}${id}${txt ? ` "${txt}"` : ""}`;
  const r = el.getBoundingClientRect();
  // Vô hình: tự nó hoặc một tổ tiên bị thu về ≤ 1px (kiểu sr-only), mờ hẳn, hoặc nằm ngoài khổ ngang.
  let hidden = r.width <= 1 || r.height <= 1 || r.right <= 0 || r.left >= innerWidth || Number(cs.opacity) === 0;
  for (let a = el.parentElement; a && !hidden && a !== document.body; a = a.parentElement) {
    const ar = a.getBoundingClientRect();
    const acs = getComputedStyle(a);
    if (Number(acs.opacity) === 0 || ((ar.width <= 1 || ar.height <= 1) && (acs.overflow !== "visible" || acs.clip !== "auto"))) hidden = true;
  }
  // Ô tuỳ biến: checkbox/radio trong suốt hoặc thu nhỏ, hình vẽ nằm ở phần tử ngay sau hoặc ở nhãn.
  // Thấy được hình thay thế ⇒ không phải focus lạc (vòng focus do CSS `input:focus-visible + span` vẽ).
  let proxies: Element[] = [];
  if (hidden && el.matches("input[type=checkbox], input[type=radio]")) {
    const cands = [el.nextElementSibling, ...Array.from((el as HTMLInputElement).labels ?? [])];
    proxies = cands.filter((c): c is Element => !!c && c.getBoundingClientRect().width > 1 && c.getBoundingClientRect().height > 1 && Number(getComputedStyle(c).opacity) > 0);
    if (proxies.length) hidden = false;
  }
  const proxy = proxies[0];
  const target = proxy ?? el;
  const tr = target.getBoundingClientRect();
  let obscured = hidden;
  if (!hidden && tr.top >= 0 && tr.bottom <= innerHeight) {
    const hit = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
    // Trúng chính nó, con của nó, hoặc host chứa nó ⇒ không bị che.
    const mine = (n: Element): boolean => n === el || el.contains(n) || n.contains(el) || n === target || target.contains(n) || n.contains(target);
    // document.elementFromPoint chỉ trả host ngoài cùng: đi ngược qua mọi tầng shadow (thẻ Lit, HA lồng nhau).
    let host: Element | null = el;
    while (host && host !== hit) host = (host.getRootNode() as ShadowRoot).host ?? null;
    obscured = !!hit && !mine(hit) && host !== hit;
  }
  // Hình người dùng thấy: hình thay thế nếu ô thật trong suốt (viền mặc định của ô thật cũng vô hình), không thì chính nó.
  const seen = proxies.length ? proxies.map((p) => getComputedStyle(p)) : [cs];
  const anyOutline = seen.some((s) => s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0);
  const anyShadow = seen.some((s) => s.boxShadow !== "none" && s.boxShadow !== "");
  // `auto` là vòng mặc định của trình duyệt: computed width ghi 1px nhưng Chromium vẽ vòng hai tông dày hơn, WCAG 2.4.7 chấp
  // nhận nó. Chỉ tính khi chính phần tử là thứ người dùng thấy: ô tích trong suốt có hình vẽ thay thì vòng ấy vô hình.
  const ownRing = !proxies.length && cs.outlineStyle === "auto" && parseFloat(cs.outlineWidth) > 0;
  const base = (window as unknown as { __dkFocusBase?: { changed(e: Element, seesOwn: boolean): boolean } }).__dkFocusBase;
  const changed = base ? base.changed(el, !hidden && !proxies.length) : false;
  return { where, indicator: hasRing(cs) || ownRing || proxies.some((p) => hasRing(getComputedStyle(p))), thin: anyOutline, shadowOnly: anyShadow && !anyOutline, obscured, hidden, changed };
}

/**
 * Chờ các hiệu ứng có hồi kết (mở mẹo, chuyển màu focus) chạy xong, tối đa `maxMs` (mặc định 600ms); bỏ qua hiệu ứng
 * lặp vô hạn. Đo giữa chừng một hiệu ứng mở (opacity 0 → 1) sẽ tưởng phần tử vô hình (gặp ở mẹo của khối bat-dau).
 */
export function settleAnimations(maxMs = 600): Promise<void> {
  // document.getAnimations() của Chromium không trả hoạt ảnh trong shadow root: gom thêm từ từng open shadow root
  // (thẻ Lit, card HA). Thiếu bước này thì chữ trong card bị đo giữa hiệu ứng mở.
  const all: Animation[] = [...document.getAnimations()];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) {
        all.push(...el.shadowRoot.getAnimations());
        walk(el.shadowRoot);
      }
    }
  };
  walk(document);
  const finite = [...new Set(all)].filter((a) => {
    const t = a.effect?.getComputedTiming();
    return a.playState === "running" && t !== undefined && Number.isFinite(Number(t.endTime));
  });
  return Promise.race([
    Promise.all(finite.map((a) => a.finished.catch(() => undefined))).then(() => undefined),
    new Promise<void>((done) => setTimeout(done, maxMs)),
  ]);
}

/**
 * Trang có hiện gì không: số ký tự chữ nhìn thấy và số ảnh/đồ hoạ nhìn thấy (đi xuyên shadow root), cùng các
 * custom element chưa bao giờ được định nghĩa: rỗng (script hỏng hoặc chưa tải) và có con trong light DOM (gốc app
 * kiểu `app-root`, thẻ chỉ để gắn style, hoặc phần của app chủ mà trang chứa không cấp). Trang trắng thì mọi phép đo khác
 * đều "đạt" vì không có gì để trượt: gặp khi kiểm lan-topo-card (10/11/2026), cổng báo pass trên một màn tối.
 */
export function probeVisible(): { text: number; media: number; undefinedTags: string[]; unregisteredTags: string[] } {
  const MEDIA = new Set(["IMG", "SVG", "CANVAS", "VIDEO", "PICTURE", "IFRAME", "OBJECT", "EMBED"]);
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "META", "LINK"]);
  let text = 0;
  let media = 0;
  const undef = new Set<string>();
  const unreg = new Set<string>();
  const closed = (window as unknown as { __dkClosed?: WeakSet<Element> }).__dkClosed;
  const empty = (el: Element): boolean => !el.children.length && !(el.textContent || "").trim();
  // opacity không kế thừa qua computed style: khung cha opacity 0 thì con vẫn báo 1, nên phải đi ngược lên
  // (xuyên qua shadow host). Nhớ kết quả từng phần tử để khỏi đi lại.
  const seen = new Map<Element, boolean>();
  const transparent = (el: Element | null): boolean => {
    if (!el) return false;
    const known = seen.get(el);
    if (known !== undefined) return known;
    const parent = el.parentElement ?? (el.parentNode instanceof ShadowRoot ? el.parentNode.host : null);
    const res = Number(getComputedStyle(el).opacity) === 0 || transparent(parent);
    seen.set(el, res);
    return res;
  };
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.matches(":not(:defined)")) (empty(el) ? undef : unreg).add(el.tagName.toLowerCase());
      if (el.shadowRoot) walk(el.shadowRoot);
      const tag = el.tagName.toUpperCase();
      if (SKIP.has(tag)) continue;
      // Host của shadow root đóng (ghi lại lúc attachShadow) vẽ ở chỗ probe không vào được: tính như một khối đồ hoạ.
      // Vỏ light DOM chưa vẽ gì chỉ là hộp CSS, không tính.
      const isMedia = MEDIA.has(tag) || closed?.has(el) === true;
      let own = 0;
      if (!isMedia) for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) own += (n.textContent || "").trim().length;
      if (!own && !isMedia) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || transparent(el)) continue;
      const r = el.getBoundingClientRect();
      if (isMedia ? r.width < 8 || r.height < 8 : r.width <= 1 || r.height <= 1) continue;
      if (isMedia) media++;
      else text += own;
    }
  };
  walk(document);
  return { text, media, undefinedTags: [...undef].slice(0, 5), unregisteredTags: [...unreg].slice(0, 5) };
}

/** Token của design-kit mà trang thiếu CSS sẽ mất: đọc trên body (biến CSS kế thừa từ html và [data-dk]). */
export const STANDALONE_TOKENS = ["--accent", "--bg", "--text", "--font-body", "--fs-body", "--sp-4"];

export interface StandaloneProbe {
  /** Giá trị các token trong STANDALONE_TOKENS, rỗng nếu không có. */
  tokens: Record<string, string>;
  /** Mỗi `<link rel=stylesheet>` có href và mỗi @import tương đối của `<style>` (đúng chuỗi trong trang): đã nạp chưa, có phải chỉ khai báo font. */
  sheets: Array<{ href: string; loaded: boolean; fonts: boolean }>;
  /** `<script src>` theo đường dẫn (tương đối hoặc từ gốc "/"): mở dạng data: URL thì không chạy. */
  scripts: string[];
}

/**
 * Trang dựa vào những tệp nào (chạy cả ở bản mở qua http lẫn bản mở dạng data: URL, rồi so).
 * Trình duyệt trong app Claude mở `file:///…/trang.html` thành `data:text/html,…` (đã thử 10/11/2026):
 * mọi href tương đối không phân giải được, thẻ link không có sheet.
 */
export function probeStandalone(tokenNames: string[]): StandaloneProbe {
  const cs = getComputedStyle(document.body ?? document.documentElement);
  const tokens: Record<string, string> = {};
  for (const t of tokenNames) tokens[t] = cs.getPropertyValue(t).trim();
  const fontUrl = /font/i;
  const read = (href: string, sheet: CSSStyleSheet | null): StandaloneProbe["sheets"][number] => {
    let fonts = false;
    if (sheet) {
      try {
        const rules = Array.from(sheet.cssRules);
        fonts = rules.length > 0 && rules.every((r) => r instanceof CSSFontFaceRule || (r instanceof CSSImportRule && fontUrl.test(r.href)));
      } catch {
        // Stylesheet khác nguồn (Google Fonts…) không đọc được luật: đoán theo URL.
        fonts = fontUrl.test(href);
      }
    }
    return { href, loaded: sheet !== null, fonts };
  };
  const sheets = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~=stylesheet][href]")).map((l) => read(l.getAttribute("href") ?? "", l.sheet));
  // <style>@import "site.css"</style> mất y như <link>. Mở dạng data: thì styleSheet là null; tệp thiếu (404) qua http thì là
  // tờ rỗng, vốn không có gì để mất (đo trên Edge 25/11/2026).
  for (const st of Array.from(document.querySelectorAll("style"))) {
    for (const r of Array.from(st.sheet?.cssRules ?? [])) {
      if (!(r instanceof CSSImportRule) || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(r.href)) continue;
      const s = read(r.href, r.styleSheet);
      if (s.loaded && r.styleSheet) {
        try {
          s.loaded = r.styleSheet.cssRules.length > 0;
        } catch {
          /* khác nguồn (chuyển hướng): không đọc được luật nhưng đã nạp */
        }
      }
      sheets.push(s);
    }
  }
  const scripts = Array.from(document.querySelectorAll("script[src]"))
    .map((s) => s.getAttribute("src") ?? "")
    .filter((s) => s && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(s));
  return { tokens, sheets, scripts };
}

/**
 * Chuẩn bị hỏi CDP font nào đã vẽ chữ Việt (`CSS.getPlatformFontsForNode`, tính cả chữ của thẻ con nên phải tách).
 * Lấy tối đa `max` nút chữ có chữ dựng sẵn dấu (U+1EA0–U+1EF9: ắ, ế, ữ…), tách mỗi nút thành các thẻ `dk-vi` (thẻ lạ nên không dính CSS của trang, như span):
 * `data-dk-vi="i:vi"` bọc chữ có dấu đó, `data-dk-vi="i:base"` bọc phần còn lại có chữ cái. Font của hai nhóm khác
 * nhau là font dự phòng thiếu chữ Việt. Chỉ dùng trên bản trang bỏ đi (đổi DOM). Trả về nhãn của nút thứ i.
 */
export function markVietnameseText(max: number): string[] {
  const VI = /[Ạ-ỹ]/;
  const RUN = /[Ạ-ỹ]+|[^Ạ-ỹ]+/g;
  const out: string[] = [];
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n && nodes.length < max; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA)$/.test(parent.tagName) || !VI.test(n.textContent ?? "")) continue;
    const r = parent.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || getComputedStyle(parent).visibility === "hidden") continue;
    nodes.push(n as Text);
  }
  nodes.forEach((t, i) => {
    const parent = t.parentElement!;
    const id = parent.id ? `#${parent.id}` : "";
    out.push(`${parent.tagName.toLowerCase()}${id} "${(t.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28)}"`);
    const frag = document.createDocumentFragment();
    for (const run of (t.textContent ?? "").match(RUN) ?? []) {
      const kind = VI.test(run) ? "vi" : /[A-Za-z]/.test(run) ? "base" : "";
      if (!kind) {
        frag.append(run);
        continue;
      }
      const s = document.createElement("dk-vi");
      s.setAttribute("data-dk-vi", `${i}:${kind}`);
      s.textContent = run;
      frag.append(s);
    }
    t.replaceWith(frag);
  });
  // Ép dàn trang ngay: CDP hỏi font của các nút dk-vi vừa chèn; chưa dàn trang thì nút chưa có bố cục và câu trả lời
  // rỗng (test font dự phòng chập chờn khi máy tải nặng, 15/11/2026).
  void (document.body ?? document.documentElement).getBoundingClientRect();
  return out;
}

/**
 * Animation còn chạy và làm vật dịch, phóng, xoay hay đổi kích thước (dùng sau khi giả lập prefers-reduced-motion: reduce).
 * Mờ dần và đổi màu không tính: WCAG 2.3.3 (mức AAA) nói về chuyển động, và người nhạy cảm tiền đình không bị chúng làm chóng
 * mặt. Trước 24/11/2026 mọi hiệu ứng còn chạy đều là lỗi cứng, chặt hơn chuẩn.
 */
export function probeMotion(): { running: number; samples: string[] } {
  // Gom cả hoạt ảnh trong open shadow root (document.getAnimations() bỏ sót, xem settleAnimations): thẻ web component
  // bỏ qua prefers-reduced-motion từng qua được phép đo cứng này (19/11/2026).
  const all: Animation[] = [...document.getAnimations()];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) {
        all.push(...el.shadowRoot.getAnimations());
        walk(el.shadowRoot);
      }
    }
  };
  walk(document);
  // Chỉ cho qua thứ chắc chắn không phải chuyển động. Danh sách cấm (bản đầu, 24/11/2026) sót background-size và
  // stroke-dashoffset, làm hai trang có chuyển động thật từ trượt thành đạt.
  const STILL = /^(opacity|visibility|[a-z]*color|fill|stroke|[a-z]*opacity)$/i;
  const anims = [...new Set(all)].filter((a) => {
    if (a.playState !== "running") return false;
    const t = a.effect?.getComputedTiming();
    const dur = typeof t?.duration === "number" ? t.duration : 0;
    if (!(dur > 50 || t?.iterations === Infinity)) return false;
    const eff = a.effect as KeyframeEffect | null;
    // Không đọc được khung hình chính (hiệu ứng lạ) thì coi là có chuyển động.
    const frames = typeof eff?.getKeyframes === "function" ? (eff.getKeyframes() as Array<Record<string, unknown>>) : [];
    const props = frames.flatMap((k) => Object.keys(k)).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p));
    const tp = (a as CSSTransition).transitionProperty;
    const named = [...props, ...(tp ? [tp] : [])];
    return !named.length || named.some((p) => p.startsWith("--") || !STILL.test(p.replace(/-/g, "")));
  });
  const samples = anims.slice(0, 5).map((a) => {
    const target = (a.effect as KeyframeEffect | null)?.target;
    const name = (a as CSSAnimation).animationName || "animation";
    return `${target ? target.tagName.toLowerCase() + (target.id ? `#${target.id}` : "") : "?"} ${name}`;
  });
  return { running: anims.length, samples };
}

/** Ghi LCP và CLS ngay từ đầu (addInitScript), cùng các host của shadow root đóng (probe không vào được). */
export function installVitals(): void {
  const w = window as unknown as { __dk: { lcp: number; cls: number }; __dkClosed: WeakSet<Element> };
  w.__dk = { lcp: 0, cls: 0 };
  w.__dkClosed = new WeakSet();
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit): ShadowRoot {
    const root = attach.call(this, init);
    if (init.mode === "closed") w.__dkClosed.add(this);
    return root;
  };
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

/**
 * Ghi lại script đọc chế độ màu bằng `matchMedia("(prefers-color-scheme…)")` (addInitScript). Trang đọc một lần lúc
 * nạp mà không nghe sự kiện `change` sẽ không đổi màu khi cổng đổi chế độ tại chỗ (`emulateMedia`), nên lượt tối đo
 * nhầm màu sáng. Cổng hỏi `schemeReadOnce` sau lần nạp đầu: có thì mỗi chế độ màu nạp riêng một lần.
 */
export function installSchemeWatch(): void {
  const w = window as unknown as { __dkScheme: Array<{ read: boolean; listening: boolean }> };
  w.__dkScheme = [];
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (q: string): MediaQueryList => {
    const mql = orig(q);
    if (!/prefers-color-scheme/i.test(q)) return mql;
    const rec = { read: false, listening: false };
    w.__dkScheme.push(rec);
    const add = mql.addEventListener.bind(mql);
    mql.addEventListener = ((type: string, ...rest: [EventListenerOrEventListenerObject, (boolean | AddEventListenerOptions)?]) => {
      if (type === "change") rec.listening = true;
      add(type, ...rest);
    }) as typeof mql.addEventListener;
    const addL = mql.addListener.bind(mql);
    mql.addListener = (cb) => {
      rec.listening = true;
      addL(cb);
    };
    const desc = Object.getOwnPropertyDescriptor(MediaQueryList.prototype, "matches");
    Object.defineProperty(mql, "matches", {
      get() {
        rec.read = true;
        return desc?.get?.call(mql) as boolean;
      },
    });
    const onchange = Object.getOwnPropertyDescriptor(MediaQueryList.prototype, "onchange");
    Object.defineProperty(mql, "onchange", {
      set(v: unknown) {
        rec.listening = true;
        onchange?.set?.call(mql, v);
      },
      get: () => onchange?.get?.call(mql) as unknown,
    });
    return mql;
  };
}

/** Có script đọc chế độ màu (`.matches`) mà không nghe `change` không (xem installSchemeWatch). */
export function schemeReadOnce(): boolean {
  const list = (window as unknown as { __dkScheme?: Array<{ read: boolean; listening: boolean }> }).__dkScheme ?? [];
  return list.some((m) => m.read && !m.listening);
}

/**
 * Dấu vân bố cục và màu của trang ở khổ và chế độ hiện tại: vị trí, cỡ (làm tròn 1px), màu chữ, màu nền, cỡ chữ của
 * mọi phần tử hiện ra (đi xuyên open shadow root), băm thành một chuỗi ngắn. Cổng dùng nó để tự kiểm cách đổi khổ tại
 * chỗ (P7): dấu vân của trang đã đổi khổ phải trùng hệt dấu vân của một lần nạp mới ở cùng khổ.
 * Trả kèm `count` (số phần tử đã tính) và `sample` (vài dòng đầu) để ghi chú khi lệch.
 */
export function probeFingerprint(): { hash: string; count: number; skipped: number; lines: string[] } {
  const lines: string[] = [];
  const sx = window.scrollX;
  const sy = window.scrollY;
  // Hiệu ứng đang chạy (khung xương nhấp nháy, vòng xoay, nền chuyển màu) đổi giá trị theo thời gian, không theo cách
  // nạp: hai lần đo ở hai thời điểm luôn lệch (trang-thai React, 19/11/2026). Hiệu ứng không đụng hình học: bỏ màu và
  // độ mờ của phần tử đó và cây con (màu kế thừa), giữ vị trí và cỡ. Hiệu ứng transform (vòng xoay, trượt): bỏ cả cây
  // con. Bản đầu bỏ cả cây con với mọi hiệu ứng, nên nền body chuyển màu làm dấu vân gần rỗng và tự kiểm qua mù.
  const paint = new Set<Element>();
  const geometry = new Set<Element>();
  const GEO = /^(transform|translate|rotate|scale|offset|left|top|right|bottom|width|height|margin|padding|inset)/i;
  const collect = (root: Document | ShadowRoot): void => {
    for (const a of root.getAnimations()) {
      const eff = a.effect as KeyframeEffect | null;
      const t = eff?.target;
      if (a.playState !== "running" || !t) continue;
      const props = (eff!.getKeyframes() as Array<Record<string, unknown>>).flatMap((k) => Object.keys(k)).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p));
      const transition = (a as CSSTransition).transitionProperty;
      if ([...props, ...(transition ? [transition] : [])].some((p) => GEO.test(p.replace(/-/g, "")))) geometry.add(t);
      else paint.add(t);
    }
    for (const el of Array.from(root.querySelectorAll("*"))) if (el.shadowRoot) collect(el.shadowRoot);
  };
  collect(document);
  const under = (el: Element, set: Set<Element>): boolean => {
    if (!set.size) return false;
    for (let e: Element | null = el; e; e = e.parentElement ?? (e.parentNode instanceof ShadowRoot ? e.parentNode.host : null)) {
      if (set.has(e)) return true;
    }
    return false;
  };
  let skipped = 0;
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (under(el, geometry)) {
        skipped++;
        continue;
      }
      const tag = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "");
      const box = `${Math.round(r.left + sx)},${Math.round(r.top + sy)} ${Math.round(r.width)}x${Math.round(r.height)} ${cs.fontSize}`;
      lines.push(under(el, paint) ? `${tag} ${box}` : `${tag} ${box} ${cs.color} ${cs.backgroundColor} ${cs.opacity}`);
    }
  };
  walk(document);
  // FNV-1a 32 bit: đủ để so trùng/lệch, không cần chống va chạm.
  let h = 0x811c9dc5;
  const all = lines.join("\n");
  for (let i = 0; i < all.length; i++) {
    h ^= all.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return { hash: h.toString(16), count: lines.length, skipped, lines };
}

/**
 * WCAG 2.2.2 (mức A, Pause, Stop, Hide): nội dung chuyển động tự chạy quá 5 giây, đứng cạnh nội dung khác, phải có
 * cách dừng. Báo hiệu ứng vô hạn hoặc dài hơn 5 giây (CSS/Web Animations, cả trong open shadow root) và video tự phát
 * lặp hay dài hơn 5 giây không có điều khiển, khi trang không có nút dừng nào (tên chứa dừng/tạm dừng/pause/stop/ẩn).
 * Bỏ qua chỉ báo đang tải (trong [aria-busy=true], role status/progressbar/alert, hay nhỏ hơn 64×64px: vòng xoay)
 * và hiệu ứng ẩn khỏi trình đọc (aria-hidden) mà không có chữ.
 */
export function probePause(): Array<{ where: string; value: string }> {
  const out: Array<{ where: string; value: string }> = [];
  const label = (el: Element): string => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "");
  const up = (e: Element): Element | null => e.parentElement ?? (e.parentNode instanceof ShadowRoot ? e.parentNode.host : null);
  const exempt = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width <= 64 && r.height <= 64) return true;
    for (let e: Element | null = el; e; e = up(e)) {
      if (e.getAttribute("aria-busy") === "true" || /^(status|progressbar|alert)$/.test(e.getAttribute("role") ?? "")) return true;
    }
    return !(el.textContent ?? "").trim() && el.closest("[aria-hidden=true]") !== null;
  };
  // Nguyên từ: so chuỗi con thì "Chuẩn bị", "khẩn", "nonstop" cũng thành nút dừng và tắt phép đo cho cả trang.
  const NAME = /(?<!\p{L})(tạm\s*dừng|dừng|pause|stop|ẩn|hide)(?!\p{L})/iu;
  const controls: Element[] = [];
  const anims: Animation[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    anims.push(...root.getAnimations());
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.matches("button, [role=button], input[type=button], input[type=checkbox], [role=switch]")) controls.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  const named = (el: Element): string => [el.getAttribute("aria-label"), el.getAttribute("title"), (el as HTMLInputElement).value, el.textContent, ...Array.from((el as HTMLInputElement).labels ?? []).map((l) => l.textContent)].filter(Boolean).join(" ");
  if (controls.some((c) => NAME.test(named(c)))) return out;
  const seen = new Set<Element>();
  for (const a of anims) {
    if (a.playState !== "running") continue;
    const t = a.effect?.getComputedTiming();
    // Thời gian chuyển động thật (activeDuration), không tính trễ trước khi chạy: hiệu ứng 0,8 s trễ 5,5 s không phải
    // chuyển động 6 s.
    const total = Number(t?.activeDuration);
    if (!(t?.iterations === Infinity || total > 5000)) continue;
    const el = (a.effect as KeyframeEffect | null)?.target;
    if (!el || seen.has(el) || exempt(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out.push({ where: label(el), value: `${(a as CSSAnimation).animationName || "animation"} runs ${t?.iterations === Infinity ? "forever" : `${Math.round(total / 1000)} s`} with no pause or stop control on the page` });
  }
  for (const v of Array.from(document.querySelectorAll("video"))) {
    if (v.paused || v.controls || exempt(v)) continue;
    if (v.loop || v.duration > 5) out.push({ where: label(v), value: `video plays by itself${v.loop ? " in a loop" : ` for ${Math.round(v.duration)} s`} with no controls or pause button` });
  }
  return out;
}

/**
 * Chữ "hiện dần khi cuộn" không bao giờ hiện: sau khi cuộn hết trang (nhịp 150 ms mỗi màn) mà chữ vẫn trong suốt
 * (opacity < 0,05 ở chính nó hay tổ tiên). Gọi ở lượt giảm chuyển động: script chỉ gắn lớp "hiện" khi không bật giảm
 * chuyển động là lỗi hay gặp, người dùng đó thấy những dải trống. Bỏ qua phần tử định vị absolute/fixed (mẹo, menu
 * chờ hover), aria-hidden, [hidden], details đóng, dialog đóng.
 */
export async function probeReveal(): Promise<Array<{ where: string; value: string }>> {
  const de = document.documentElement;
  const step = Math.max(200, Math.round(innerHeight * 0.8));
  for (let y = 0, i = 0; y < de.scrollHeight && i < 30; y += step, i++) {
    window.scrollTo({ top: y, left: 0, behavior: "instant" });
    await new Promise((ok) => setTimeout(ok, 150));
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  await new Promise((ok) => setTimeout(ok, 50));
  const up = (e: Element): Element | null => e.parentElement ?? (e.parentNode instanceof ShadowRoot ? e.parentNode.host : null);
  /** Tổ tiên (hay chính nó) trong suốt; null nếu không; "skip" nếu nằm trong phần tử absolute/fixed. */
  const fadedOf = (el: Element): Element | null | "skip" => {
    let faded: Element | null = null;
    for (let e: Element | null = el; e && e !== de; e = up(e)) {
      const cs = getComputedStyle(e);
      if (cs.position === "absolute" || cs.position === "fixed") return "skip";
      if (!faded && Number(cs.opacity) < 0.05) faded = e;
    }
    return faded;
  };
  const candidates: Array<{ faded: Element; own: string }> = [];
  const hit = new Set<Element>();
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"].includes(el.tagName)) continue;
      let own = "";
      for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) own += n.textContent ?? "";
      if (own.trim().length < 2) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // Ẩn có chủ ý (visibility hidden: khung thu gọn, ngăn kéo đóng) không phải hiện dần hỏng.
      if (getComputedStyle(el).visibility === "hidden") continue;
      if (el.closest("[aria-hidden=true], [hidden], details:not([open]) > :not(summary), dialog:not([open])")) continue;
      const faded = fadedOf(el);
      if (!faded || faded === "skip" || hit.has(faded)) continue;
      hit.add(faded);
      candidates.push({ faded, own: own.trim() });
    }
  };
  walk(document);
  // Cho từng ứng viên một cơ hội nữa: cuộn nó vào giữa màn (cuộn cả khung cuộn bên trong, không chỉ cửa sổ), đợi hiệu
  // ứng của nó xong (cả độ trễ), rồi mới kết luận. Bản đầu chỉ cuộn cửa sổ và đọc sau 150 ms, nên báo nhầm hiện dần
  // đúng nằm trong khung cuộn riêng hay có transition-delay.
  const out: Array<{ where: string; value: string }> = [];
  for (const { faded, own } of candidates.slice(0, 12)) {
    faded.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((ok) => setTimeout(ok, 200));
    const anims = faded.getAnimations({ subtree: true }).filter((a) => a.playState === "running" || a.pending);
    await Promise.race([Promise.all(anims.map((a) => a.finished.catch(() => undefined))), new Promise((ok) => setTimeout(ok, 1500))]);
    const still = fadedOf(faded);
    if (!still || still === "skip") continue;
    const id = still.tagName.toLowerCase() + (still.id ? `#${still.id}` : typeof still.className === "string" && still.className.trim() ? `.${still.className.trim().split(/\s+/)[0]}` : "");
    out.push({ where: id, value: `"${own.slice(0, 40)}" stays invisible after scrolling the whole page with reduced motion (a scroll reveal that never runs)` });
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  return out;
}
