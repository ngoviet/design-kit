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
    // Chữ phụ (gợi ý dưới ô, chú thích) có màu khác chữ thân: 14px là đúng thang, không tính là thân chữ nhỏ.
    const secondary = cs.color !== bodyColor;
    if (isBody && !secondary && text.length > 40 && fs < 16) out.bodySmall.push({ where: label(el), value: `${fs.toFixed(1)}px` });
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
