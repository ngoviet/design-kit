import type { Page } from "playwright-core";

/**
 * Phép đo `contrast-px` (mềm, 24/11/2026): tương phản của chữ nằm trên ảnh, gradient, hoạ tiết, video, canvas. Ở đó axe không
 * biết màu nền nên trả "incomplete" và cổng coi như đạt.
 *
 * Đo trên điểm ảnh thật: chụp vùng chữ hai lần, một lần chữ trong suốt (còn lại đúng nền), một lần chữ tô một màu chắc chắn khác
 * nền (biết điểm nào thuộc nét). Không dùng ảnh "chữ màu thật" để tìm nét: chữ trắng trên mảng trắng thì hai ảnh giống hệt nhau,
 * đúng chỗ tệ nhất lại không có nét nào. Màu chữ lấy từ kiểu đã tính, trộn với nền theo độ trong của nó.
 *
 * Nền tại mỗi điểm là trung bình một ô nhỏ quanh nét (mắt cũng gộp như vậy), nên đường kẻ 1px hay chấm hoạ tiết nhạt không làm
 * trượt. Kết quả là bách phân vị 5 của vùng tệ nhất, không phải một điểm đơn lẻ. Ngưỡng WCAG 1.4.3 (s5): 4,5:1, chữ lớn 3:1; axe để ngỏ chỗ này (c45).
 * Ý chụp hai lần và bách phân vị: renderlint `src/contrast.js` (MIT), tự viết lại.
 *
 * `data-contrast-ok="<lý do>"` trên phần tử hay tổ tiên: chữ trang trí, hay logo vẽ bằng chữ (1.4.3 miễn).
 */
export interface PixelFinding {
  check: "contrast-px";
  where: string;
  detail: string;
}

export interface PixelRatio {
  where: string;
  ratio: number;
  need: number;
  /** Màu chữ và màu nền tại chỗ tệ nhất, #rrggbb. */
  fg: string;
  bg: string;
}

/** Số khối chữ được đo mỗi trang, và số chỗ cuộn tới để chụp (mỗi chỗ hai ảnh, khoảng 0,15 s). */
export const PX_BLOCKS = 12;
export const PX_VIEWS = 3;
/** Sai số của phép đo (làm tròn 8 bit, khử răng cưa): dưới mức này so với ngưỡng thì chưa báo. */
const SLACK = 0.05;

interface Cand {
  el: Element;
  nodes: Text[];
  fill: [number, number, number, number];
  opacity: number;
  size: number;
  need: number;
  where: string;
  done: boolean;
  rects: DOMRect[];
}
interface Store {
  list: Cand[];
  view: Cand[];
  scrolls: Array<{ el: Element; x: number; y: number }>;
  sheet: CSSStyleSheet;
  off?: ImageData;
  marker?: [number, number, number];
}

/**
 * Chọn tối đa `cap` khối chữ đáng đo và giữ trong `window.__dkPx`. Đáng đo: từ chữ lên tới nền đặc gần nhất có background-image (cả
 * của ::before, ::after định vị), hay có img, video, canvas, lớp nền định vị nằm sau dòng chữ và không bị nền đặc nào ngăn.
 * So bằng hình học chứ không bằng elementsFromPoint: ảnh nền hay mang `pointer-events: none` nên hit-test không thấy. Chọn dư thì
 * chỉ tốn chỗ, vì kết quả lấy từ điểm ảnh. Hàm tự chứa.
 */
function collectPixelText(cap: number): number {
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const inside = (anc: Element | null, n: Element): boolean => {
    if (!anc) return true;
    for (let a: Element | null = n; a; a = up(a)) if (a === anc) return true;
    return false;
  };
  const cv = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true })!;
  const seenColor = new Map<string, [number, number, number, number]>();
  // oklch(), color(), tên màu: để canvas đổi sang RGBA.
  const rgba = (c: string): [number, number, number, number] => {
    const was = seenColor.get(c);
    if (was) return was;
    cv.clearRect(0, 0, 1, 1);
    cv.fillStyle = "rgba(0,0,0,0)";
    cv.fillStyle = c;
    cv.fillRect(0, 0, 1, 1);
    const d = cv.getImageData(0, 0, 1, 1).data;
    const out: [number, number, number, number] = [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    seenColor.set(c, out);
    return out;
  };
  const label = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const cls = !id && typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    const host = (el.getRootNode() as ShadowRoot).host;
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${host ? `${host.tagName.toLowerCase()}::shadow ` : ""}${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ""}`;
  };
  // 2: ảnh điểm (jpg, png, webp); 1: gradient, SVG.
  const rankOf = (image: string): number => (!image || image === "none" ? 0 : /url\((?!["']?data:image\/svg)/i.test(image) ? 2 : 1);
  interface Info {
    rank: number;
    opaque: boolean;
    bad: boolean;
    opacity: number;
  }
  const infos = new Map<Element, Info>();
  const info = (a: Element): Info => {
    const was = infos.get(a);
    if (was) return was;
    const cs = getComputedStyle(a);
    let rank = rankOf(cs.backgroundImage);
    for (const p of ["::before", "::after"]) {
      const ps = getComputedStyle(a, p);
      if (ps.content !== "none" && ps.content !== "normal" && /^(absolute|fixed)$/.test(ps.position)) rank = Math.max(rank, rankOf(ps.backgroundImage));
    }
    const out = {
      rank,
      opaque: rgba(cs.backgroundColor)[3] >= 0.99,
      // Bộ lọc và chế độ trộn đổi màu chữ thật: màu đã tính không còn đúng. Chữ tô bằng nền (background-clip: text): chưa đo.
      bad: cs.filter !== "none" || cs.mixBlendMode !== "normal" || /\btext\b/.test(cs.backgroundClip),
      opacity: Number(cs.opacity),
    };
    infos.set(a, out);
    return out;
  };
  const all: Element[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      all.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  const shown = (el: Element): boolean => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  // Lớp có thể nằm sau chữ mà không phải tổ tiên của nó.
  const layers: Array<{ el: Element; r: DOMRect; rank: number }> = [];
  for (const el of all) {
    const media = /^(IMG|VIDEO|CANVAS)$/.test(el.tagName);
    const rank = media ? 3 : info(el).rank;
    if (!rank || (!media && !/^(absolute|fixed)$/.test(getComputedStyle(el).position)) || !shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= 24 && r.height >= 24) layers.push({ el, r, rank });
  }
  const range = document.createRange();
  const found: Array<Cand & { rank: number; key: string }> = [];
  for (const el of all) {
    if (el.closest("svg, script, style, noscript, template, textarea, select, option, [aria-hidden=true], [inert]") || el.closest(":disabled, [aria-disabled=true]")) continue;
    const nodes = Array.from(el.childNodes).filter((n): n is Text => n.nodeType === 3 && /[\p{L}\p{N}]/u.test((n as Text).data));
    if (!nodes.length || !shown(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.textShadow !== "none" || parseFloat(cs.webkitTextStrokeWidth) > 0) continue;
    const fill = rgba(cs.webkitTextFillColor || cs.color);
    let rank = 0;
    let opacity = 1;
    let bad = fill[3] < 0.05;
    let wall: Element | null = null;
    for (let a: Element | null = el; a && !bad; a = up(a)) {
      const i = info(a);
      bad = i.bad || a.hasAttribute("data-contrast-ok");
      opacity *= i.opacity;
      if (wall) continue;
      rank = Math.max(rank, i.rank);
      if (i.opaque) wall = a;
    }
    if (bad || opacity < 0.1) continue;
    const rects: DOMRect[] = [];
    for (const n of nodes) {
      range.selectNodeContents(n);
      rects.push(...Array.from(range.getClientRects()).filter((q) => q.width >= 4 && q.height >= 4));
    }
    if (!rects.length) continue;
    for (const l of layers) {
      if (l.rank <= rank || inside(el, l.el) || inside(l.el, el) || !inside(wall, l.el)) continue;
      if (rects.some((q) => q.left < l.r.right && q.right > l.r.left && q.top < l.r.bottom && q.bottom > l.r.top)) rank = l.rank;
    }
    if (!rank) continue;
    const size = parseFloat(cs.fontSize);
    const need = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5;
    found.push({ el, nodes, fill, opacity, size, need, where: label(el), done: false, rects: [], rank, key: `${fill.join()}|${size}|${need}|${wall ? label(wall) : ""}|${rank}` });
  }
  // Ảnh trước gradient. Cùng kiểu chữ thì lấy khối đầu và khối cuối (hai đầu của gradient) trước, rồi mới tới phần giữa.
  const groups = new Map<string, typeof found>();
  for (const f of found) groups.set(f.key, [...(groups.get(f.key) ?? []), f]);
  const order: Array<{ f: (typeof found)[number]; turn: number }> = [];
  for (const g of groups.values()) g.forEach((f, i) => order.push({ f, turn: i === 0 ? 0 : i === g.length - 1 ? 1 : 1 + i }));
  order.sort((a, b) => b.f.rank - a.f.rank || a.turn - b.turn);
  const list = order.slice(0, cap).map((o) => o.f);
  const scrolls: Store["scrolls"] = [];
  const noted = new Set<Element>();
  for (const f of list) {
    for (let a: Element | null = f.el; a; a = up(a)) {
      if (noted.has(a)) continue;
      noted.add(a);
      if (a.scrollTop || a.scrollLeft || a.scrollHeight > a.clientHeight || a.scrollWidth > a.clientWidth) scrolls.push({ el: a, x: a.scrollLeft, y: a.scrollTop });
    }
  }
  if (list.length) (window as unknown as { __dkPx: Store }).__dkPx = { list, view: [], scrolls, sheet: new CSSStyleSheet() };
  return list.length;
}

/**
 * Cuộn tới khối chưa đo đầu tiên, gom mọi khối đang nằm trọn chiều cao màn, trả vùng cần chụp. Thử ba chỗ dừng (khối ở giữa, gần
 * đỉnh, gần đáy) và lấy chỗ gom được nhiều khối nhất: mỗi chỗ dừng tốn hai ảnh chụp. Không chụp cả trang một lần dù rẻ hơn: trình
 * duyệt nới khung nhìn để chụp, khối cao 100vh đổi bố cục giữa lúc đo.
 */
function framePixelText(): { x: number; y: number; width: number; height: number } | null {
  const px = (window as unknown as { __dkPx: Store }).__dkPx;
  const next = px.list.find((c) => !c.done);
  if (!next) return null;
  const range = document.createRange();
  // Dòng chữ của khối, cắt theo khung nhìn; `whole`: mọi dòng nằm trọn theo chiều dọc.
  const linesOf = (c: Cand): { rects: DOMRect[]; whole: boolean } => {
    const rects: DOMRect[] = [];
    let whole = true;
    for (const n of c.nodes) {
      range.selectNodeContents(n);
      for (const q of Array.from(range.getClientRects())) {
        if (q.width < 4 || q.height < 4) continue;
        if (q.top < 0 || q.bottom > innerHeight) {
          whole = false;
          continue;
        }
        const left = Math.max(0, q.left);
        const right = Math.min(innerWidth, q.right);
        if (right - left >= 4) rects.push(new DOMRect(left, q.top, right - left, q.height));
      }
    }
    return { rects, whole };
  };
  const stops: Array<() => void> = [
    () => next.el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }),
    () => {
      next.el.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
      window.scrollBy({ top: -100, behavior: "instant" }); // chừa chỗ cho thanh dính ở đỉnh
    },
    () => {
      next.el.scrollIntoView({ block: "end", inline: "nearest", behavior: "instant" });
      window.scrollBy({ top: 60, behavior: "instant" });
    },
  ];
  let best = 0;
  let most = -1;
  stops.forEach((go, i) => {
    go();
    const n = px.list.filter((c) => !c.done && linesOf(c).whole).length;
    if (n > most && (i === 0 || linesOf(next).whole)) [most, best] = [n, i];
  });
  stops[best]!();
  px.view = [];
  let box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const c of px.list) {
    if (c.done) continue;
    const { rects, whole } = linesOf(c);
    // Khối cao hơn cả màn thì lấy phần đang thấy; khối khác đợi tới lượt.
    if (c !== next && !whole) continue;
    c.done = true;
    c.rects = rects;
    if (!rects.length) continue;
    px.view.push(c);
    for (const q of rects) box = [Math.min(box[0], q.left), Math.min(box[1], q.top), Math.max(box[2], q.right), Math.max(box[3], q.bottom)];
  }
  if (!px.view.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.max(0, Math.floor(box[0]) - 6);
  const y = Math.max(0, Math.floor(box[1]) - 6);
  return { x, y, width: Math.min(innerWidth, Math.ceil(box[2]) + 6) - x, height: Math.min(innerHeight, Math.ceil(box[3]) + 6) - y };
}

/**
 * Tô mọi chữ một màu (null: trả lại). Constructable stylesheet nên CSP không chặn, DOM không đổi. Gạch chân được giấu ở cả hai ảnh
 * để không bị tính là nét. Trả lại hai bước: bỏ màu khi còn `transition: none`, rồi mới bỏ cả tờ, kẻo `transition: all` chạy lại
 * màu chữ từ trong suốt.
 */
function paintText(color: string | null): void {
  const px = (window as unknown as { __dkPx: Store }).__dkPx;
  const roots: Array<Document | ShadowRoot> = [];
  const walk = (root: Document | ShadowRoot): void => {
    roots.push(root);
    for (const el of Array.from(root.querySelectorAll("*"))) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
  const still = "transition: none !important; caret-color: transparent !important;";
  // Trúng mọi phần tử như `*` mà độ đặc hiệu bằng bốn id: trang tự đặt màu tô !important thì khối đó từng không có nét nào và lặng lẽ
  // không được đo (25/11/2026). Thuộc tính style !important và !important trong @layer thì vẫn thắng.
  const any = ":is(*, #dk#dk#dk#dk)";
  const every = `${any}, ${any}::before, ${any}::after`;
  if (color === null) {
    px.sheet.replaceSync(`${every} { ${still} }`);
    for (const r of roots) void (r instanceof Document ? r.documentElement : r.firstElementChild)?.getBoundingClientRect();
    for (const el of px.list) void getComputedStyle(el.el).webkitTextFillColor;
    for (const r of roots) r.adoptedStyleSheets = r.adoptedStyleSheets.filter((s) => s !== px.sheet);
    return;
  }
  px.sheet.replaceSync(`${every} { ${still} -webkit-text-fill-color: ${color} !important; text-decoration-color: transparent !important; text-emphasis-color: transparent !important; }`);
  for (const r of roots) if (!r.adoptedStyleSheets.includes(px.sheet)) r.adoptedStyleSheets = [...r.adoptedStyleSheets, px.sheet];
}

/** Giải mã ảnh nền và chọn màu tô khác nền nhất trong vùng chữ. */
async function readBack({ png, clip }: { png: string; clip: { x: number; y: number; width: number; height: number } }): Promise<string> {
  const px = (window as unknown as { __dkPx: Store }).__dkPx;
  const bytes = Uint8Array.from(atob(png), (ch) => ch.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }), { colorSpaceConversion: "none" });
  const g = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0);
  const img = g.getImageData(0, 0, bmp.width, bmp.height);
  px.off = img;
  const k = bmp.width / clip.width;
  const markers: Array<[number, number, number]> = [[255, 0, 255], [0, 255, 0], [0, 0, 0], [255, 255, 255]];
  const far = markers.map(() => [] as number[]);
  for (const c of px.view) {
    for (const q of c.rects) {
      for (let y = Math.floor((q.top - clip.y) * k); y < (q.bottom - clip.y) * k; y += 3) {
        for (let x = Math.floor((q.left - clip.x) * k); x < (q.right - clip.x) * k; x += 3) {
          const i = (y * img.width + x) * 4;
          if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
          markers.forEach((m, j) => far[j]!.push(Math.hypot(m[0] - img.data[i]!, m[1] - img.data[i + 1]!, m[2] - img.data[i + 2]!)));
        }
      }
    }
  }
  let best = 0;
  let score = -1;
  far.forEach((list, j) => {
    list.sort((a, b) => a - b);
    const low = list[Math.floor(list.length * 0.02)] ?? 0;
    if (low > score) [score, best] = [low, j];
  });
  px.marker = markers[best]!;
  return `rgb(${px.marker.join(", ")})`;
}

/** So ảnh chữ tô màu với ảnh nền, trả tương phản ở vùng tệ nhất của từng khối. */
async function judgeText({ png, clip }: { png: string; clip: { x: number; y: number; width: number; height: number } }): Promise<PixelRatio[]> {
  const px = (window as unknown as { __dkPx: Store }).__dkPx;
  const off = px.off!;
  const m = px.marker!;
  const bytes = Uint8Array.from(atob(png), (ch) => ch.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }), { colorSpaceConversion: "none" });
  const g = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0);
  const on = g.getImageData(0, 0, bmp.width, bmp.height);
  const out: PixelRatio[] = [];
  if (on.width !== off.width || on.height !== off.height) return out;
  const W = on.width;
  const H = on.height;
  const k = W / clip.width;
  const lin = (v: number): number => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  const lum = (r: number, gg: number, b: number): number => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
  const hex = (c: number[]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  for (const c of px.view) {
    const alphaText = c.fill[3] * c.opacity;
    const reach = Math.max(2, Math.round((c.size * k) / 10));
    const regions: Array<Array<{ ratio: number; bg: number[] }>> = [];
    let open: Array<{ ratio: number; bg: number[] }> = [];
    for (const q of c.rects) {
      const x0 = Math.max(0, Math.floor((q.left - clip.x) * k));
      const y0 = Math.max(0, Math.floor((q.top - clip.y) * k));
      const x1 = Math.min(W, Math.ceil((q.right - clip.x) * k));
      const y1 = Math.min(H, Math.ceil((q.bottom - clip.y) * k));
      // Độ phủ của nét: chiếu hiệu hai ảnh lên hướng từ nền tới màu tô. Lệch khỏi hướng đó là thứ khác đang động (video, canvas).
      const cover: Array<{ x: number; y: number; a: number }> = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          const d = [m[0] - off.data[i]!, m[1] - off.data[i + 1]!, m[2] - off.data[i + 2]!];
          const e = [on.data[i]! - off.data[i]!, on.data[i + 1]! - off.data[i + 1]!, on.data[i + 2]! - off.data[i + 2]!];
          const dd = d[0]! * d[0]! + d[1]! * d[1]! + d[2]! * d[2]!;
          if (dd < 900) continue;
          const a = (d[0]! * e[0]! + d[1]! * e[1]! + d[2]! * e[2]!) / dd;
          if (a < 0.1) continue;
          // Khử răng cưa theo điểm con (LCD) lệch màu ở mép nét; phần lõi thì không.
          if (Math.hypot(e[0]! - a * d[0]!, e[1]! - a * d[1]!, e[2]! - a * d[2]!) > 110) continue;
          cover.push({ x, y, a });
        }
      }
      if (cover.length < 8) continue;
      const tops = cover.map((p) => p.a).sort((a, b) => a - b);
      const core = 0.5 * tops[Math.floor(tops.length * 0.95)]!;
      for (const p of cover) {
        if (p.a < core) continue;
        let r = 0;
        let gg = 0;
        let b = 0;
        let n = 0;
        for (let y = Math.max(0, p.y - reach); y <= Math.min(H - 1, p.y + reach); y++) {
          for (let x = Math.max(0, p.x - reach); x <= Math.min(W - 1, p.x + reach); x++) {
            const i = (y * W + x) * 4;
            r += off.data[i]!;
            gg += off.data[i + 1]!;
            b += off.data[i + 2]!;
            n++;
          }
        }
        const bg = [r / n, gg / n, b / n];
        const fg = bg.map((v, j) => c.fill[j]! * alphaText + v * (1 - alphaText));
        const l1 = lum(fg[0]!, fg[1]!, fg[2]!);
        const l2 = lum(bg[0]!, bg[1]!, bg[2]!);
        open.push({ ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), bg });
      }
      // Đủ mẫu thì dòng này (hay vài dòng ngắn gộp lại) là một vùng: một dòng chìm trong đoạn dài không bị các dòng khác che đi.
      if (open.length >= 300) {
        regions.push(open);
        open = [];
      }
    }
    if (open.length && (!regions.length || open.length >= 150)) regions.push(open);
    let worst: { ratio: number; bg: number[] } | undefined;
    for (const s of regions) {
      if (s.length < 30) continue;
      s.sort((a, b) => a.ratio - b.ratio);
      const p5 = s[Math.floor(s.length * 0.05)]!;
      if (!worst || p5.ratio < worst.ratio) worst = p5;
    }
    if (worst) out.push({ where: c.where, ratio: worst.ratio, need: c.need, fg: hex(worst.bg.map((v, j) => c.fill[j]! * alphaText + v * (1 - alphaText))), bg: hex(worst.bg) });
  }
  return out;
}

/** Trả cuộn về chỗ cũ và dọn biến. */
function cleanPixelText(): void {
  const w = window as unknown as { __dkPx?: Store };
  for (const s of w.__dkPx?.scrolls ?? []) s.el.scrollTo({ left: s.x, top: s.y, behavior: "instant" });
  delete w.__dkPx;
}

/** Đo mọi khối đã chọn, kể cả khối đạt. Tách ra để test thấy phép đo có đo thật chứ không chỉ im lặng. */
export async function measurePixelText(page: Page, blocks = PX_BLOCKS, views = PX_VIEWS): Promise<PixelRatio[]> {
  const out: PixelRatio[] = [];
  if (!(await page.evaluate(collectPixelText, blocks))) return out;
  try {
    for (let i = 0; i < views; i++) {
      const clip = await page.evaluate(framePixelText);
      if (!clip) break;
      if (!clip.width) continue;
      // Không chờ khung hình: lệnh chụp tự dựng khung mới sau khi đổi kiểu. `caret: "initial"` để Playwright khỏi chèn thẻ style.
      const shot = async (): Promise<string> => (await page.screenshot({ clip, animations: "disabled", caret: "initial", scale: "css" })).toString("base64");
      await page.evaluate(paintText, "transparent");
      const marker = await page.evaluate(readBack, { png: await shot(), clip });
      await page.evaluate(paintText, marker);
      out.push(...(await page.evaluate(judgeText, { png: await shot(), clip })));
      await page.evaluate(paintText, null);
    }
  } finally {
    await page.evaluate(paintText, null).catch(() => undefined);
    await page.evaluate(cleanPixelText).catch(() => undefined);
  }
  return out;
}

/**
 * Gọi ở trạng thái đầu, mỗi chế độ màu, đủ ở khổ rộng nhất (và khổ điện thoại nếu muốn: ảnh nền hay cắt khác đi). Không đổi DOM,
 * trả cuộn về chỗ cũ; trang nghe sự kiện cuộn có thể đã phản ứng, nên gọi sau các phép đo bố cục.
 */
export async function pixelContrastPass(page: Page): Promise<PixelFinding[]> {
  return (await measurePixelText(page))
    .filter((t) => !(t.ratio >= t.need - SLACK))
    .map((t) => ({
      check: "contrast-px" as const,
      where: t.where,
      detail: `text ${t.fg} over ${t.bg} is ${t.ratio.toFixed(2)}:1 at its worst part, want ${t.need}:1: put a scrim or a solid panel behind it, or change the image or gradient there`,
    }));
}
