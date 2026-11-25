/**
 * Phép đo `css` (mềm, 24/11/2026): những điều trong bộ tiêu chí phải đọc CSS mới thấy. Trang nhìn đúng trên máy đo mà sai trên
 * máy thật (thanh địa chỉ che đáy khối 100vh, thanh sát mép nằm dưới vạch Home), hoặc chỉ sai khi người dùng làm việc khác
 * (dán mật khẩu, đổi cỡ chữ).
 *
 * Mỗi phát hiện mang mã luật con ở đầu `detail`:
 * - `vh-full` (BC-06; MDN N62): khối cao gần bằng màn lấy chiều cao từ `100vh`, không có `dvh`/`svh` thay. Trên điện thoại
 *   `100vh` là chiều cao lúc thanh địa chỉ đã thu, nên đáy khối nằm dưới thanh đó.
 * - `transition-all` (TD-07; quy ước c68): `transition: all` chạy cả cỡ chữ, bề rộng, màu của chế độ tối.
 * - `vi-hyphen` (CH-07; c76): chữ Việt có `hyphens: auto` hay `word-break: break-all` bị cắt giữa âm tiết.
 * - `scheme` (MA-01; MDN N65): nền trang sáng hay tối mà `color-scheme` nói ngược, nên thanh cuộn, ô nhập, ô tích sai màu.
 * - `safe-area` (NT-01; WebKit N85, MDN N60): có `viewport-fit=cover` mà thanh sát mép không chừa `env(safe-area-inset-*)`.
 * - `img-size` (TD-03; web.dev N91): ảnh, video, iframe không giữ chỗ trước khi tải xong.
 * - `theme-color` (MA-08; MDN N70): thẻ `theme-color` lệch hẳn nền đầu trang ở chế độ màu đang đo.
 * - `paste` (RT-06; WCAG 3.3.8 AA N06): ô mật khẩu, mã, email chặn dán. Tách thành `probePaste` vì phép này bắn sự kiện vào
 *   trang, phải chạy cuối cùng.
 *
 * `data-css-ok="<lý do>"` trên phần tử hay tổ tiên: cố ý. Mở đầu bằng mã luật (`data-css-ok="vh-full: …"`) thì chỉ miễn luật đó,
 * để đặt trên `<html>` hay `<body>` mà không tắt cả phép đo.
 *
 * Giá trị đã tính (computed) quyết định có báo hay không; CSSOM chỉ dùng khi computed không nói được (100vh hay 100dvh, có env()
 * hay không), và luật phải thật sự thắng: giá trị của nó bằng giá trị đã tính.
 */
export interface CssHit {
  where: string;
  detail: string;
}

/** Đọc, không đổi trang (có gắn rồi gỡ một phần tử thử ẩn, và đổi rồi trả ngay một khai báo khi phải biết luật nào thắng). Chạy trong trang đã yên, đang ở đầu trang. Hàm tự chứa. */
export function probeCss(): CssHit[] {
  const out: CssHit[] = [];
  const IDS = ["vh-full", "transition-all", "vi-hyphen", "scheme", "safe-area", "img-size", "theme-color", "paste"];
  const de = document.documentElement;
  const W = innerWidth;
  const H = innerHeight;
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const label = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const cls = !id && typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    const host = (el.getRootNode() as ShadowRoot).host;
    return `${host ? `${host.tagName.toLowerCase()}::shadow ` : ""}${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const okd = (el: Element, rule: string): boolean => {
    for (let a: Element | null = el; a; a = up(a)) {
      const v = a.getAttribute("data-css-ok");
      if (v === null) continue;
      const only = /^\s*([a-z-]+)\s*:/.exec(v)?.[1];
      if (!only || !IDS.includes(only) || only === rule) return true;
    }
    return false;
  };
  const shown = (el: Element): boolean => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const hidden = (el: Element): boolean => {
    for (let a: Element | null = el; a; a = up(a)) if (a.getAttribute("aria-hidden") === "true" || a.hasAttribute("inert")) return true;
    return false;
  };
  /** Giá trị đã tính nhưng chưa thành px (giữ `auto`, `50%`), đọc bằng Typed OM; trình duyệt không có thì chuỗi rỗng. */
  const typed = (el: Element, prop: string): string => {
    try {
      return el.computedStyleMap().get(prop)?.toString() ?? "";
    } catch {
      return "";
    }
  };
  const push = (rule: string, list: Array<{ where: string; text: string }>, max: number): void => {
    for (const h of list.slice(0, max)) out.push({ where: h.where, detail: `${rule}: ${h.text}` });
    if (list.length > max) out.push({ where: `+${list.length - max} more`, detail: `${rule}: ${list[max]!.text}` });
  };

  // ---- Mọi phần tử và mọi luật CSS đang áp (document, open shadow root, @import, @layer, @media khớp, adoptedStyleSheets) ----
  const all: Element[] = [];
  const roots: Array<Document | ShadowRoot> = [];
  const walk = (root: Document | ShadowRoot): void => {
    roots.push(root);
    for (const el of Array.from(root.querySelectorAll("*"))) {
      all.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  interface Decl {
    sel: string;
    style: CSSStyleDeclaration;
    root: Document | ShadowRoot;
    /** Trong `@supports (-webkit-touch-callout: none)`: chỉ iOS áp, trình duyệt của cổng bỏ qua. Chỉ dùng làm bằng chứng "đã sửa". */
    ios: boolean;
  }
  const decls: Decl[] = [];
  // Có stylesheet không đọc được thì không được kết luận "thiếu env()". Kho phông chữ chỉ chứa @font-face nên không tính.
  const FONT_CSS = /^https:\/\/(fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit\.net|fonts\.cdnfonts\.com|api\.fontshare\.com)\//;
  let blind = false;
  const mediaOn = (m: MediaList): boolean => !m.mediaText || matchMedia(m.mediaText).matches;
  const rulesOf = (list: CSSRuleList, root: Document | ShadowRoot, parent: string, ios: boolean): void => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSImportRule) {
        if (r.styleSheet && mediaOn(r.media)) sheetOf(r.styleSheet, root, ios);
        continue;
      }
      if (r instanceof CSSMediaRule && !mediaOn(r.media)) continue;
      if (r instanceof CSSKeyframesRule || r.constructor.name === "CSSStartingStyleRule") continue;
      let touch = ios;
      if (r instanceof CSSSupportsRule && !CSS.supports(r.conditionText)) {
        if (!/-webkit-touch-callout/.test(r.conditionText)) continue;
        touch = true;
      }
      // Luật lồng (CSS nesting): `&` là bộ chọn của luật cha. Khai báo lồng (CSSNestedDeclarations) không có bộ chọn riêng.
      let sel = parent;
      if (r instanceof CSSStyleRule) {
        if (!parent) sel = r.selectorText;
        else sel = r.selectorText.includes("&") ? r.selectorText.replace(/&/g, `:is(${parent})`) : `:is(${parent}) ${r.selectorText}`;
      }
      const style = (r as CSSStyleRule).style as CSSStyleDeclaration | undefined;
      if (sel && style?.length) decls.push({ sel, style, root, ios: touch });
      const inner = (r as CSSGroupingRule).cssRules as CSSRuleList | undefined;
      if (inner?.length) rulesOf(inner, root, sel, touch);
    }
  };
  const sheetOf = (s: CSSStyleSheet, root: Document | ShadowRoot, ios: boolean): void => {
    if (s.disabled || !mediaOn(s.media)) return;
    let list: CSSRuleList;
    try {
      list = s.cssRules;
    } catch {
      // Stylesheet khác nguồn: không đọc được.
      if (!FONT_CSS.test(s.href ?? "")) blind = true;
      return;
    }
    rulesOf(list, root, "", ios);
  };
  for (const root of roots) for (const s of [...Array.from(root.styleSheets), ...(root.adoptedStyleSheets ?? [])]) sheetOf(s, root, false);
  // Tách bộ chọn theo dấu phẩy ngoài ngoặc.
  const parts = (sel: string): string[] => {
    const list: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of sel) {
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (ch === "," && depth === 0) {
        list.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    list.push(cur.trim());
    return list;
  };
  const PSEUDO = "(?:before|after|marker|placeholder|first-line|first-letter|backdrop|file-selector-button|selection)(?![\\w-])";
  const ALONE = new RegExp(`(^|[\\s,>+~(])::?${PSEUDO}`, "g");
  const ATTACHED = new RegExp(`::?${PSEUDO}`, "g");
  const matched = new Map<Decl, Element[]>();
  const elsOf = (d: Decl): Element[] => {
    const had = matched.get(d);
    if (had) return had;
    const found = new Set<Element>();
    for (const part of parts(d.sel)) {
      const host = d.root instanceof ShadowRoot ? /^:host(?:\((.+)\))?(?:::?[\w-]+)?$/.exec(part) : null;
      try {
        if (host) {
          if (!host[1] || (d.root as ShadowRoot).host.matches(host[1])) found.add((d.root as ShadowRoot).host);
        } else {
          // Đứng một mình (`::before` của bộ đặt lại) là mọi phần tử; dính sau bộ chọn thì bỏ đi.
          for (const el of Array.from(d.root.querySelectorAll(part.replace(ALONE, "$1*").replace(ATTACHED, "")))) found.add(el);
        }
      } catch {
        /* bộ chọn lạ: bỏ qua phần này, giữ các phần khác của danh sách */
      }
    }
    const list = Array.from(found);
    matched.set(d, list);
    return list;
  };
  // Luật của phần tử giả không nói về chính khối: chỉ lấy những phần của danh sách bộ chọn trỏ tới đúng thứ đang hỏi (25/11/2026).
  const elsFor = (d: Decl, pseudo: string): Element[] => {
    const list = parts(d.sel);
    const own = list.filter((s) => {
      let flat = s;
      while (/\([^()]*\)/.test(flat)) flat = flat.replace(/\([^()]*\)/g, "");
      return pseudo ? new RegExp(`:${pseudo.slice(2)}(?![\\w-])`).test(flat) : flat.search(ATTACHED) < 0;
    });
    return elsOf(own.length === list.length ? d : { ...d, sel: own.join(", ") });
  };
  // Biến CSS: lấy giá trị trên phần tử, lần theo tối đa ba tầng.
  const resolve = (value: string, el: Element): string => {
    let v = value;
    for (let i = 0; i < 3 && v.includes("var("); i++) {
      v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_m, name: string, fb: string | undefined) => getComputedStyle(el).getPropertyValue(name).trim() || fb || "");
    }
    return v;
  };
  // Hộp thử nằm trong shadow root riêng: CSS của trang không chạm tới, và không đổi `:last-child` của nội dung.
  let lab: HTMLElement | undefined;
  let cell: HTMLElement | undefined;
  const pxOf = (v: string, el: Element): number => {
    const simple = /^(\d*\.?\d+)v[hb]$/i.exec(v.trim());
    if (simple) return (Number(simple[1]) * H) / 100;
    if (!cell) {
      lab = document.createElement("div");
      for (const [k, x] of [["all", "initial"], ["position", "fixed"], ["visibility", "hidden"], ["pointer-events", "none"], ["width", "0"], ["height", "0"]] as const) lab.style.setProperty(k, x, "important");
      cell = document.createElement("div");
      cell.style.position = "fixed";
      lab.attachShadow({ mode: "open" }).append(cell);
      de.append(lab);
    }
    cell.style.fontSize = getComputedStyle(el).fontSize;
    cell.style.height = "";
    cell.style.height = v;
    return cell.style.height ? parseFloat(getComputedStyle(cell).height) : NaN;
  };

  // ---- vh-full ----
  if (W <= 480) {
    const PROPS = ["height", "min-height", "max-height", "block-size", "min-block-size", "max-block-size"];
    const VH = /\dv[hb](?![a-z])/i;
    const FIXED = /\d[sld]v[hb](?![a-z])|fill-available|stretch/i;
    const fixed: Array<{ el: Element; prop: string; v: string; ios: boolean; style: CSSStyleDeclaration }> = [];
    const cand: Array<{ el: Element; prop: string; v: string }> = [];
    const see = (style: CSSStyleDeclaration, els: () => Element[], ios: boolean): void => {
      for (const prop of PROPS) {
        const raw = style.getPropertyValue(prop);
        if (!raw || !(VH.test(raw) || FIXED.test(raw) || raw.includes("var("))) continue;
        for (const el of els()) {
          const v = resolve(raw, el);
          if (FIXED.test(v)) fixed.push({ el, prop, v, ios, style });
          else if (!ios && VH.test(v)) cand.push({ el, prop, v });
        }
      }
    };
    for (const d of decls) see(d.style, () => elsFor(d, ""), d.ios);
    for (const el of all) if ((el as HTMLElement).style?.length) see((el as HTMLElement).style, () => [el], false);
    // Luật quyết định chiều cao: giá trị đã tính đúng bằng số px của nó (không phải `100%` hay một luật khác), và chiều cao của khối
    // đúng bằng số đó. undefined: giá trị đã tính không phải px nên không so được.
    const pxSaid = (el: Element, prop: string): number | undefined => {
      const px = /^(-?[\d.]+)px$/.exec(typed(el, prop))?.[1];
      return px === undefined ? undefined : Number(px);
    };
    const decides = (el: Element, prop: string, v: string): boolean | undefined => {
      const px = pxSaid(el, prop);
      return px === undefined ? undefined : Math.abs(px - pxOf(v, el)) <= 0.6 && Math.abs(parseFloat(getComputedStyle(el).height) - px) <= 1.5;
    };
    // Hai luật cùng ra một số px (trình duyệt đo có 100dvh bằng 100vh) thì hỏi chính trình duyệt luật nào thắng: đổi tạm khai báo
    // dvh sang từ khoá, giá trị đã tính đổi theo là nó thắng, rồi trả lại ngay. Nhờ vậy độ đặc hiệu, thứ tự, !important, @layer,
    // :is/:where, cây bóng đều đúng mà không phải tự tính. Từ khoá không nội suy được với px nên không chuyển tiếp nào chạy; trang cho
    // chuyển tiếp rời rạc thì không thử. Khai báo lặp trục logic trong cùng luật cũng không: trả lại có thể sai thứ tự (25/11/2026).
    const wins = (f: (typeof fixed)[number]): boolean => {
      const cs = getComputedStyle(f.el);
      const pair = f.prop.endsWith("height") ? f.prop.replace("height", "block-size") : f.prop.replace("block-size", "height");
      // Thuộc tính style: đổi là trang (MutationObserver) thấy, và nó chỉ thua !important.
      if (f.style === (f.el as HTMLElement).style || f.style.getPropertyValue(pair) || cs.getPropertyValue("interpolate-size") === "allow-keywords" || /allow-discrete/.test(cs.getPropertyValue("transition-behavior"))) return true;
      const [was, mark] = [f.style.getPropertyValue(f.prop), f.style.getPropertyPriority(f.prop)];
      const before = typed(f.el, f.prop);
      f.style.setProperty(f.prop, f.prop.startsWith("max") ? "none" : "auto", mark);
      const won = typed(f.el, f.prop) !== before;
      f.style.setProperty(f.prop, was, mark);
      void typed(f.el, f.prop);
      return won;
    };
    // Đã sửa khi luật dvh/svh thật sự cho ra chiều cao này. Không so được (luật chỉ iOS áp, fill-available, min(…, 100%),
    // biến lồng quá sâu) thì coi là đã sửa.
    const safe = (el: Element): boolean =>
      fixed.some((f) => {
        if (f.el !== el) return false;
        if (f.ios || f.v.includes("var(") || Number.isNaN(pxOf(f.v, el))) return true;
        const same = decides(el, f.prop, f.v);
        return same === undefined || (same && wins(f));
      });
    const hits = new Map<Element, { where: string; text: string }>();
    for (const { el, prop, v } of cand) {
      if (hits.has(el) || !shown(el) || hidden(el) || okd(el, "vh-full")) continue;
      const cs = getComputedStyle(el);
      // Lớp nền trang trí dài quá đáy không che ai.
      if (cs.pointerEvents === "none" || (cs.zIndex !== "auto" && Number(cs.zIndex) < 0)) continue;
      const r = el.getBoundingClientRect();
      // Bố cục làm tròn tới 1/64 px: 90vh của 844 là 759,594.
      if (!(r.height >= H * 0.9 - 0.5) || r.right <= 1 || r.left >= W - 1) continue;
      // Khối dài hơn min-height thì cao vì nội dung. Cao hơn màn (120vh) là cố ý cho cuộn, không phải khối vừa khít màn.
      if (!decides(el, prop, v) || pxSaid(el, prop)! > H + 1 || safe(el)) continue;
      hits.set(el, { where: label(el), text: `${prop}: ${v.slice(0, 40)} on a block that fills the phone screen: the address bar covers its bottom edge. Write the same value in dvh (or svh) after it` });
    }
    push("vh-full", [...hits.values()], 4);
  }
  lab?.remove();

  // ---- transition-all ----
  {
    const runsAll = (cs: CSSStyleDeclaration): boolean => {
      const props = cs.transitionProperty.split(/,\s*/);
      const durs = cs.transitionDuration.split(/,\s*/);
      return props.some((p, i) => p.trim() === "all" && parseFloat(durs[i % durs.length] ?? "0") > 0);
    };
    const owner = new Map<string, { sel: string; rank: number }>();
    const ids = new Map<Element, number>();
    const keyOf = (el: Element, pseudo: string): string => {
      if (!ids.has(el)) ids.set(el, ids.size);
      return `${ids.get(el)}${pseudo}`;
    };
    for (const d of decls) {
      if (d.ios) continue;
      const short = d.style.getPropertyValue("transition");
      const prop = d.style.getPropertyValue("transition-property");
      const dur = d.style.getPropertyValue("transition-duration");
      if (!short && !prop && !dur) continue;
      for (const pseudo of ["", ...(/:before\b/.test(d.sel) ? ["::before"] : []), ...(/:after\b/.test(d.sel) ? ["::after"] : [])]) {
        for (const el of elsFor(d, pseudo)) {
          if (!shown(el) || okd(el, "transition-all")) continue;
          const cs = getComputedStyle(el, pseudo || null);
          if (pseudo && (cs.content === "none" || cs.content === "normal")) continue;
          if (!runsAll(cs)) continue;
          // Computed đã nói phần tử này chạy mọi thuộc tính. Chỉ còn việc nêu tên luật: luật ghi `all` trước, `transition` qua biến
          // không ghi thuộc tính sau. Chỉ có `transition-duration` thì không báo: không ai viết `all` cả, và đó là lớp
          // `duration-200` mà hộp thoại shadcn cần cho hiệu ứng mở của nó (đo trên blocks/react/dist, 24/11/2026).
          const named = resolve(prop || short, el);
          const rank = /(^|[\s,])all(?![\w-])/.test(named) ? 2 : short && !prop ? 1 : 0;
          if (!rank) continue;
          const key = keyOf(el, pseudo);
          if ((owner.get(key)?.rank ?? 0) <= rank) owner.set(key, { sel: d.sel, rank });
        }
      }
    }
    for (const el of all) {
      const st = (el as HTMLElement).style;
      if (!st || !(st.transition || st.transitionProperty) || !shown(el) || okd(el, "transition-all") || !runsAll(getComputedStyle(el))) continue;
      owner.set(keyOf(el, ""), { sel: `${label(el)}[style]`, rank: 3 });
    }
    const by = new Map<string, number>();
    for (const { sel } of owner.values()) by.set(sel, (by.get(sel) ?? 0) + 1);
    const rows = [...by].sort((a, b) => b[1] - a[1]);
    for (const [i, [sel, n]] of rows.slice(0, 3).entries()) {
      const more = i === 2 && rows.length > 3 ? ` (and ${rows.length - 3} more selectors)` : "";
      out.push({ where: sel.slice(0, 60), detail: `transition-all: animates every property of ${n} element${n > 1 ? "s" : ""}, font-size and width included: name the properties that change (transition-property: color, background-color, transform)${more}` });
    }
  }

  // ---- vi-hyphen ----
  {
    const VI = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i;
    const langOf = (el: Element): string => {
      for (let a: Element | null = el; a; a = up(a)) {
        const l = a.getAttribute("lang");
        if (l !== null) return l.trim().toLowerCase();
      }
      return "";
    };
    const badOf = (cs: CSSStyleDeclaration): string => {
      if (cs.wordBreak === "break-all") return "word-break: break-all";
      return (cs.hyphens || cs.getPropertyValue("-webkit-hyphens")) === "auto" ? "hyphens: auto" : "";
    };
    const origins = new Map<Element, { where: string; text: string }>();
    for (const el of all) {
      if (el.closest("script, style, template, noscript, textarea, code, pre, kbd, samp, svg")) continue;
      let own = "";
      for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) own += n.textContent ?? "";
      if (!VI.test(own)) continue;
      const cs = getComputedStyle(el);
      const bad = badOf(cs);
      if (!bad || /nowrap|^pre$/.test(cs.whiteSpace) || !/^(vi\b|$)/.test(langOf(el)) || !shown(el) || okd(el, "vi-hyphen")) continue;
      // Hai thuộc tính này kế thừa: báo ở phần tử xa nhất còn mang nó, một dòng cho cả cây con.
      let top: Element = el;
      for (let a = up(el); a && badOf(getComputedStyle(a)) === bad; a = up(a)) top = a;
      if (!origins.has(top)) {
        const word = own.replace(/\s+/g, " ").trim().slice(0, 32);
        origins.set(top, { where: label(top), text: `${bad} on Vietnamese text ("${word}") may break a syllable in two: remove it, and use overflow-wrap: anywhere on the code or link that needs it` });
      }
    }
    push("vi-hyphen", [...origins.values()], 4);
  }

  // ---- Màu: scheme, theme-color ----
  const cx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  const rgba = (c: string): [number, number, number, number] => {
    if (!cx) return [0, 0, 0, 0];
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
  };
  const lin = (v: number): number => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  /** Chế độ màu trình duyệt đang dùng cho phần tử: thuộc tính `color-scheme`, không có thì thẻ meta cùng tên. */
  const schemeOf = (el: Element): { used: "light" | "dark"; said: string } => {
    let said = getComputedStyle(el).colorScheme || "normal";
    if (said === "normal") said = document.querySelector('meta[name="color-scheme" i]')?.getAttribute("content")?.trim().toLowerCase() || "normal";
    const list = said.split(/\s+/).filter((x): x is "light" | "dark" => x === "light" || x === "dark");
    const want = prefersDark ? "dark" : "light";
    return { used: list.includes(want) ? want : (list[0] ?? "light"), said };
  };
  // Nền trang: vỏ app phủ TRỌN tài liệu (không chỉ một màn: khối hero tối cao bằng màn của trang sáng không phải nền trang), rồi
  // body khi nền của nó lan ra khung nhìn, rồi html. Nền bằng ảnh, chuyển sắc hay màu trong thì không biết, không báo.
  const pageBack = (): { el: Element; c: [number, number, number] } | undefined => {
    const bottom = Math.max(H, de.scrollHeight - scrollY);
    const cands: Element[] = document.elementsFromPoint(W / 2, H / 2).filter((el) => {
      const r = el.getBoundingClientRect();
      // Chừa 5%: lề của đoạn đầu trang gộp ra ngoài làm hộp body tụt xuống 16px.
      return el !== de && r.width >= W * 0.95 && r.top <= H * 0.05 && r.bottom >= bottom - H * 0.05;
    });
    if (document.body && !cands.includes(document.body) && rgba(getComputedStyle(de).backgroundColor)[3] < 0.05) cands.push(document.body);
    cands.push(de);
    for (const el of cands) {
      const cs = getComputedStyle(el);
      const c = rgba(cs.backgroundColor);
      if (c[3] >= 0.9) return { el, c: [c[0], c[1], c[2]] };
      if (cs.backgroundImage !== "none" || c[3] > 0.05) return undefined;
    }
    return undefined;
  };
  const back = cx ? pageBack() : undefined;
  if (back && !okd(back.el, "scheme")) {
    const L = 0.2126 * lin(back.c[0]) + 0.7152 * lin(back.c[1]) + 0.0722 * lin(back.c[2]);
    const is = L < 0.1 ? "dark" : L > 0.5 ? "light" : undefined;
    const s = schemeOf(back.el);
    if (is && s.used !== is) {
      push("scheme", [{ where: label(back.el), text: `the page background is ${is} (rgb ${back.c.join(" ")}) but the browser draws scrollbars, fields and checkboxes ${s.used} (color-scheme: ${s.said}): declare color-scheme: ${is} on html for this theme` }], 1);
    }
  }
  if (cx && scrollY === 0) {
    const meta = Array.from(document.querySelectorAll('meta[name="theme-color" i]')).find((m) => {
      const media = m.getAttribute("media");
      const c = m.getAttribute("content")?.trim() ?? "";
      return (!media || matchMedia(media).matches) && c && !/var\(|currentcolor/i.test(c) && CSS.supports("color", c);
    });
    if (meta && !okd(meta, "theme-color")) {
      const said = meta.getAttribute("content")!.trim();
      const lab3 = (c: [number, number, number]): [number, number, number] => {
        const [r, g, b] = [lin(c[0]), lin(c[1]), lin(c[2])];
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
        const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
        const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
        return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
      };
      const far = (a: [number, number, number], b: [number, number, number]): number => {
        const [x, y] = [lab3(a), lab3(b)];
        return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
      };
      // Chồng phần tử tại một điểm, lớp trên trước, đi vào open shadow root.
      const stack = (root: Document | ShadowRoot, x: number, y: number): Element[] =>
        root.elementsFromPoint(x, y).filter((e) => e.getRootNode() === root).flatMap((e) => (e.shadowRoot ? [...stack(e.shadowRoot, x, y), e] : [e]));
      const topAt = (x: number): [number, number, number] | undefined => {
        const acc: [number, number, number] = [0, 0, 0];
        let a = 0;
        const lay = (c: [number, number, number, number]): void => {
          for (const i of [0, 1, 2] as const) acc[i] += (1 - a) * c[3] * c[i];
          a += (1 - a) * c[3];
        };
        const under = stack(document, x, 1);
        for (const e of under) {
          // Ảnh, video, hình vẽ ở mép trên: không biết màu thật.
          if (/^(IMG|VIDEO|CANVAS|IFRAME|OBJECT|EMBED)$/.test(e.tagName) || e.closest("svg")) return undefined;
          const cs = getComputedStyle(e);
          if (cs.backgroundImage !== "none" || Number(cs.opacity) < 0.99 || cs.mixBlendMode !== "normal") return undefined;
          // Điểm nằm ngoài hộp của nó là trúng `::backdrop` của hộp thoại hay phần tử giả; phần tử giả định vị có nền cũng không biết.
          const r = e.getBoundingClientRect();
          if (x < r.left || x > r.right || r.top > 1 || r.bottom < 1) return undefined;
          for (const ps of ["::before", "::after"]) {
            const pc = getComputedStyle(e, ps);
            if (pc.content !== "none" && pc.content !== "normal" && /^(absolute|fixed)$/.test(pc.position) && (pc.backgroundImage !== "none" || rgba(pc.backgroundColor)[3] > 0.05)) return undefined;
          }
          const c = rgba(cs.backgroundColor);
          // Màn che mờ phủ cả khung nhìn (sau hộp thoại, ngăn kéo): tạm thời, không phải nền đầu trang.
          if (c[3] > 0.05 && c[3] < 0.95 && r.width >= W * 0.95 && r.height >= H * 0.95) return undefined;
          lay(c);
          if (a > 0.99) return acc;
        }
        // Nền của body lan ra cả khung nhìn khi html trong suốt; cuối cùng là nền mặc định của trình duyệt. html, và body nằm ngay
        // dưới điểm này, đã tính trong vòng trên (25/11/2026).
        if (document.body && !under.includes(document.body) && rgba(getComputedStyle(de).backgroundColor)[3] === 0) lay(rgba(getComputedStyle(document.body).backgroundColor));
        if (a <= 0.99) lay(schemeOf(de).used === "dark" ? [18, 18, 18, 1] : [255, 255, 255, 1]);
        return acc;
      };
      const tc = rgba(said);
      const tops = [0.1, 0.5, 0.9].map((k) => topAt(W * k));
      if (tc[3] > 0.99 && tops.every((t) => t && far(t, [tc[0], tc[1], tc[2]]) > 0.12)) {
        const t = tops[1]!.map(Math.round);
        push("theme-color", [{ where: "meta[name=theme-color]", text: `"${said.slice(0, 30)}" next to a page top that is rgb ${t.join(" ")}: match it, one meta per scheme with media="(prefers-color-scheme: …)"` }], 1);
      }
    }
  }

  // ---- safe-area ----
  const metas = document.querySelectorAll('meta[name="viewport" i]');
  if (!blind && /viewport-fit\s*=\s*cover/i.test(metas[metas.length - 1]?.getAttribute("content") ?? "")) {
    const bars: Array<{ el: Element; sides: Array<"top" | "bottom"> }> = [];
    for (const el of all) {
      const cs = getComputedStyle(el);
      if ((cs.position !== "fixed" && cs.position !== "sticky") || cs.pointerEvents === "none" || Number(cs.zIndex) < 0) continue;
      const r = el.getBoundingClientRect();
      // Cao gần cả màn là vỏ app hay lớp phủ, không phải thanh.
      if (r.width < W * 0.6 || r.height < 8 || r.height >= H * 0.7 || !shown(el) || hidden(el) || okd(el, "safe-area")) continue;
      if (!(el.textContent ?? "").trim() && !el.querySelector("a, button, input, img, svg")) continue;
      const sides: Array<"top" | "bottom"> = [];
      if (Math.abs(r.top) <= 1.5) sides.push("top");
      if (Math.abs(H - r.bottom) <= 1.5 && (cs.position === "fixed" || cs.bottom !== "auto")) sides.push("bottom");
      if (sides.length) bars.push({ el, sides });
    }
    const outer = bars.filter((b) => !bars.some((o) => o !== b && o.el.contains(b.el)));
    if (outer.length) {
      for (const side of ["top", "bottom"] as const) {
        // Biến CSS mang env(safe-area-inset-<mép>), kể cả qua biến khác. Tên biến tự nói (Capacitor, Ionic đặt bằng script) cũng nhận.
        const NAME = new RegExp(`safe-?area[\\w-]*-${side}`, "i");
        const vars = new Set<string>();
        const uses = (text: string): boolean => NAME.test(text) || Array.from(text.matchAll(/var\(\s*(--[\w-]+)/g)).some((m) => vars.has(m[1]!));
        // Cả biến khai trong thuộc tính style (framework hay đặt ngay trên thẻ html; 25/11/2026).
        const styles = [...decls.map((d) => d.style), ...all.flatMap((el) => (el as HTMLElement).style ?? [])];
        const custom = styles.flatMap((st) => Array.from(st).filter((p) => p.startsWith("--")).map((p) => ({ p, text: st.getPropertyValue(p) })));
        for (let grew = true, i = 0; grew && i < 5; i++) {
          grew = false;
          for (const { p, text } of custom) {
            if (!vars.has(p) && uses(text)) {
              vars.add(p);
              grew = true;
            }
          }
        }
        const used = new Set<Element>();
        // Chỉ khai báo thật, không tính chính chỗ khai báo biến: có biến mà không dùng thì thanh vẫn bị che.
        const applied = (css: string): boolean => uses(css.replace(/--[\w-]+\s*:[^;]*;?/g, ""));
        for (const d of decls) if (applied(d.style.cssText)) for (const el of elsOf(d)) used.add(el);
        for (const el of all) if (applied(el.getAttribute("style") ?? "")) used.add(el);
        const list: Array<{ where: string; text: string }> = [];
        for (const b of outer) {
          if (!b.sides.includes(side)) continue;
          // Chừa ở chính thanh hay ở phần tử bên trong nó (kể cả trong shadow root của nó).
          let done = false;
          for (const u of used) for (let a: Element | null = u; a && !done; a = up(a)) done = a === b.el;
          if (!done) list.push({ where: label(b.el), text: `viewport-fit=cover lets this ${side} bar slide under the ${side === "bottom" ? "home indicator" : "status bar or notch"}: add padding-${side}: env(safe-area-inset-${side}) to it` });
        }
        push("safe-area", list, 3);
      }
    }
  }

  // ---- img-size ----
  {
    const hasRatio = (el: Element): boolean => !/^(auto|)$/.test(getComputedStyle(el).aspectRatio);
    /** Chiều cao biết trước, không chờ nội dung: px, tỉ lệ, hay phần trăm của một khối biết trước. */
    const known = (el: Element, depth: number): boolean => {
      const h = typed(el, "height");
      if (h === "" || /^(-?[\d.]+)px$/.test(h)) return true;
      if (hasRatio(el)) return true;
      const cs = getComputedStyle(el);
      if (/^(absolute|fixed)$/.test(cs.position) && typed(el, "top") !== "auto" && typed(el, "bottom") !== "auto") return true;
      const p = up(el);
      return /%/.test(h) && depth < 8 && !!p && p !== document.body && p !== de && known(p, depth + 1);
    };
    const groups = new Map<string, { n: number; tag: string }>();
    for (const el of all) {
      if (!/^(IMG|VIDEO|IFRAME)$/.test(el.tagName) || !shown(el) || okd(el, "img-size")) continue;
      const img = el.tagName === "IMG" ? (el as HTMLImageElement) : undefined;
      // Ảnh hỏng là việc của phép khác; data: đi cùng trang nên không có lúc chờ.
      if (img && ((img.complete && !img.naturalWidth) || /^data:/i.test(img.currentSrc || img.src))) continue;
      const r = el.getBoundingClientRect();
      // Ảnh lười tải chưa về có hộp rỗng: chính nó sẽ đẩy trang khi về. Còn lại, hộp vài px là ảnh trang trí hay ảnh đếm lượt xem.
      if ((r.width <= 2 || r.height <= 2) && !(img && !img.complete)) continue;
      if (known(el, 0)) continue;
      // Nằm trong khối không theo dòng chảy, hay trong khung cao cố định có cắt: ảnh về muộn không đẩy phần còn lại.
      let held = false;
      for (let a: Element | null = el; a && a !== document.body && a !== de && !held; a = up(a)) {
        const cs = getComputedStyle(a);
        held = /^(absolute|fixed)$/.test(cs.position) || (a !== el && /^(hidden|clip)$/.test(cs.overflowY) && known(a, 0));
      }
      if (held) continue;
      const key = label(el);
      groups.set(key, { n: (groups.get(key)?.n ?? 0) + 1, tag: el.tagName.toLowerCase() });
    }
    push("img-size", [...groups].map(([where, g]) => ({
      where,
      text: g.tag === "iframe"
        ? `no height or aspect-ratio${g.n > 1 ? ` (${g.n} of them)` : ""}: it stays 150px tall until a script resizes it. Set height, or aspect-ratio in CSS`
        : `no width and height attributes, aspect-ratio or fixed height${g.n > 1 ? ` (${g.n} of them)` : ""}: the page jumps when it loads. Write width="…" height="…" (its real pixels) and keep height: auto in CSS`,
    })), 4);
  }
  return out;
}

/**
 * Luật con `paste`: ô mật khẩu, mã, email chặn dán. Gửi một sự kiện `paste` hủy được rồi xem `defaultPrevented`, theo cách của
 * Lighthouse `paste-preventing-inputs` (Apache-2.0), thêm hai điều: sự kiện nổi bọt và xuyên shadow root (React nghe ở gốc, trang
 * hay nghe ở document), và ô TỰ xử lý dán (đọc clipboard rồi chia vào sáu ô mã) không bị báo: chúng cũng gọi preventDefault,
 * nhưng có đọc `clipboardData`. Clipboard giả rỗng nên ô tự xử lý không điền gì và không tự gửi.
 *
 * PHẢI CHẠY CUỐI CÙNG trên trang (trước lượt nạp lại của motion): trang có thể hiện thông báo "không được dán". Giá trị ô được
 * trả về như cũ. Hàm tự chứa.
 */
export function probePaste(): CssHit[] {
  const out: CssHit[] = [];
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const label = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const cls = !id && typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    const host = (el.getRootNode() as ShadowRoot).host;
    return `${host ? `${host.tagName.toLowerCase()}::shadow ` : ""}${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const okd = (el: Element): boolean => {
    for (let a: Element | null = el; a; a = up(a)) {
      const v = a.getAttribute("data-css-ok");
      if (v === null) continue;
      const only = /^\s*([a-z-]+)\s*:/.exec(v)?.[1];
      if (!only || only === "paste" || !/^(vh-full|transition-all|vi-hyphen|scheme|safe-area|img-size|theme-color)$/.test(only)) return true;
    }
    return false;
  };
  const CODE = /(?<!\p{L})(otp|pin|passcode|token|verif\w*|one-?time|2fa|mfa|mã)(?!\p{L})|code/iu;
  const fields: HTMLInputElement[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (el.tagName !== "INPUT") continue;
      const f = el as HTMLInputElement;
      const words = [f.name, f.id, f.autocomplete, f.placeholder, f.getAttribute("aria-label"), ...Array.from(f.labels ?? []).map((l) => l.textContent)].join(" ").normalize("NFC");
      const wanted = /^(password|email)$/.test(f.type) || /\b(one-time-code|current-password|new-password|email)\b/.test(f.autocomplete) ||
        (/^(text|tel|number|search)$/.test(f.type) && (CODE.test(words) || (f.inputMode === "numeric" && f.maxLength === 1)));
      if (wanted && !f.disabled && !f.readOnly && f.checkVisibility({ checkVisibilityCSS: true }) && !okd(f)) fields.push(f);
    }
  };
  walk(document);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  const hits = new Map<string, number>();
  for (const f of fields.slice(0, 40)) {
    const was = f.value;
    let read = false;
    const dt = new DataTransfer();
    const spy = (name: string, value: unknown): void => {
      Object.defineProperty(dt, name, typeof value === "function" ? { value: () => ((read = true), "") } : { get: () => ((read = true), value) });
    };
    spy("getData", () => "");
    spy("items", dt.items);
    spy("types", dt.types);
    spy("files", dt.files);
    // Vài trang chặn mặc định rồi tự đọc bằng navigator.clipboard.
    const board = navigator.clipboard as (Clipboard & Record<string, unknown>) | undefined;
    for (const m of ["readText", "read"]) {
      if (board) Object.defineProperty(board, m, { configurable: true, value: () => ((read = true), Promise.resolve(m === "read" ? [] : "")) });
    }
    let blocked: boolean;
    try {
      const ev = new ClipboardEvent("paste", { bubbles: true, cancelable: true, composed: true, clipboardData: dt });
      f.dispatchEvent(ev);
      blocked = ev.defaultPrevented && !read;
    } finally {
      for (const m of ["readText", "read"]) if (board) delete board[m];
    }
    if (f.value !== was) {
      // Trang đã xoá ô: trả giá trị cũ bằng setter gốc rồi báo `input`, để React và Vue biết.
      setValue.call(f, was);
      f.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
    if (blocked) hits.set(label(f), (hits.get(label(f)) ?? 0) + 1);
  }
  for (const [where, n] of [...hits].slice(0, 4)) {
    out.push({ where, detail: `paste: blocks pasting${n > 1 ? ` (${n} fields)` : ""}, so a password manager or a code copied from a message cannot fill it (WCAG 3.3.8): remove the paste handler` });
  }
  return out;
}
