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
  innerScroll: ProbeHit[];
  /** Chữ bị cắt mất nội dung: ellipsis hay line-clamp đang giấu chữ, overflow hidden/clip cắt ngang chữ hoặc cắt mất dấu. */
  textClip: ProbeHit[];
  /** Số ô nhập đang hiện cùng lúc (form dài một màn ⇒ nên chia bước). */
  visibleFields: number;
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
    const ratio = lhRaw / fs;
    const tag = el.tagName;
    if (fs * k < 12) out.textMin.push({ where: label(el), value: px(fs, k) });
    const isBody = tag === "P" || tag === "LI" || tag === "DD" || tag === "BLOCKQUOTE";
    // Hộp bao đã co theo k, dòng chữ khai báo thì chưa: quy về cùng một hệ.
    const lines = Math.round(el.getBoundingClientRect().height / (lhRaw * k));
    // Chữ phụ (gợi ý dưới ô, chú thích) có màu khác chữ thân: 14px là đúng thang, không tính là thân chữ nhỏ.
    const secondary = cs.color !== bodyColor;
    if (isBody && !secondary && text.length > 40 && fs * k < 16) out.bodySmall.push({ where: label(el), value: px(fs, k) });
    if (isBody && lines >= 2 && ratio < 1.5) out.bodyTight.push({ where: label(el), value: ratio.toFixed(2) });
    if (/^H[1-4]$/.test(tag) && ratio < 1.2) out.headingTight.push({ where: label(el), value: ratio.toFixed(2) });
    if (isBody && lines >= 2 && canvas) {
      // Bề rộng ký tự trung bình đo trên chính chữ của đoạn (không dùng "0" như đơn vị ch:
      // chữ Việt trong Be Vietnam Pro hẹp hơn "0" ~37%, nên 68ch thành ~93 ký tự mỗi dòng).
      canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const sample = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400);
      const avg = sample ? canvas.measureText(sample).width / sample.length : 0;
      const [a, b] = lin(el);
      const width = el.getBoundingClientRect().width / (Math.hypot(a, b) || 1) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (avg > 0 && width / avg > 80) out.measure.push({ where: label(el), value: `~${Math.round(width / avg)} chars/line` });
    }
    const first = (cs.fontFamily.split(",")[0] || "").replace(/["']/g, "").trim();
    const key = first.toLowerCase();
    if (first && !seenFont.has(key)) {
      seenFont.add(key);
      if (!GENERIC.test(first) && !loaded.has(key)) out.fontFallback.push({ where: label(el), value: first });
    }
  }
  // Ô nhập đang hiện (bỏ hidden, nút, ô chọn trong nhóm radio tính một lần theo name)
  const radioNames = new Set<string>();
  for (const el of all) {
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) continue;
    const inp = el as HTMLInputElement;
    if (["hidden", "submit", "button", "reset", "image"].includes(inp.type)) continue;
    if (!visible(el, getComputedStyle(el)) && inp.type !== "radio" && inp.type !== "checkbox") continue;
    if (inp.type === "radio") { if (radioNames.has(inp.name)) continue; radioNames.add(inp.name); }
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
    const eff = parseFloat(cs.fontSize) * (svg.getBoundingClientRect().width / vb.width);
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
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    for (const t of nodes) {
      const rects = rectsOf(t);
      if (!rects.length) continue;
      const u = rng.getBoundingClientRect();
      // absolute/fixed thoát các hộp cắt nằm giữa nó và khối chứa của nó (tooltip, menu thả xuống).
      let escaping: "abs" | "fixed" | null = null;
      // Đã qua một hộp cuộn ở trục nào thì chữ ở trục đó tới được bằng cách cuộn: hộp cắt bên ngoài cùng cỡ (gốc của
      // ScrollArea kiểu Radix) không làm mất chữ. Khung cuộn giấu nội dung là việc của inner-scroll.
      let scrolledX = false;
      let scrolledY = false;
      for (let a: Element | null = el; a; a = parentOf(a)) {
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

/** Phần tử đang focus (đi xuyên shadow root) và chỉ báo focus của nó. */
export function probeFocus(): { where: string; indicator: boolean; obscured: boolean; hidden: boolean } | null {
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
    obscured = !!hit && !mine(hit) && !(hit.shadowRoot && hit.shadowRoot.contains(el));
  }
  return { where, indicator: hasRing(cs) || proxies.some((p) => hasRing(getComputedStyle(p))), obscured, hidden };
}

/**
 * Chờ các hiệu ứng có hồi kết (mở mẹo, chuyển màu focus) chạy xong, tối đa 600ms; bỏ qua hiệu ứng lặp vô hạn.
 * Đo giữa chừng một hiệu ứng mở (opacity 0 → 1) sẽ tưởng phần tử vô hình (gặp ở mẹo của khối bat-dau).
 */
export function settleAnimations(): Promise<void> {
  const finite = document.getAnimations().filter((a) => {
    const t = a.effect?.getComputedTiming();
    return a.playState === "running" && t !== undefined && Number.isFinite(Number(t.endTime));
  });
  return Promise.race([
    Promise.all(finite.map((a) => a.finished.catch(() => undefined))).then(() => undefined),
    new Promise<void>((done) => setTimeout(done, 600)),
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
