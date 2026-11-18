// Phép đo hình dạng trên ảnh đã vẽ ở cỡ tham chiếu: phần "mực" (hình) và phần nền, nét mảnh mất đi khi thu nhỏ, độ dày
// nét, lề, độ phức tạp chu vi (Pelli 2006), đối xứng, cạnh thẳng lệch lưới điểm. Hàm thuần, không cần trình duyệt.
import { type Bitmap, clamp01, labDist, oklab, type Lab } from "./pixels.js";

/**
 * alpha: ảnh có nền trong suốt, độ phủ = alpha.
 * plain: ảnh có nền đặc một màu (lấy từ viền ảnh), độ phủ = độ khác màu so với nền.
 * tile: icon dạng ô gạch (ô vuông hay tròn phủ kín khung, nền phẳng hoặc chuyển sắc đều, hình ở giữa): hình là phần
 *   lệch khỏi mặt phẳng màu khớp trên dải vòng trong của ô. Icon ứng dụng, favicon, icon thương hiệu Home Assistant.
 * full: ảnh tràn viền (ảnh chụp, tranh kín khung), không tách được hình khỏi nền.
 */
export type InkMode = "alpha" | "plain" | "tile" | "full";

export interface Ink {
  mode: InkMode;
  w: number;
  h: number;
  /** Độ phủ 0–1 mỗi điểm. */
  cov: Float32Array;
  /** Màu nền riêng của ảnh (mode plain). */
  bg?: [number, number, number];
  /** Màu nền ước lượng tại từng điểm, sRGB 3 kênh (mode tile). */
  bgAt?: Float32Array;
}

/**
 * Thử đọc ảnh như một ô gạch trong hộp [x0,x1]×[y0,y1]: khớp mặt phẳng màu (sRGB, a + b·x + c·y mỗi kênh) trên dải vòng
 * trong của ô, cách mép 8%, bỏ điểm lệch xa (hình chạm dải vòng) rồi khớp lại. Nền khớp được (sai số trung bình < 0,03
 * OKLab, giữ ≥ minKeep điểm mẫu) và có hình đủ lớn thì trả về; không thì undefined.
 */
function tileOf(bm: Bitmap, alpha: Float32Array, x0: number, y0: number, x1: number, y1: number, minKeep = 0.6): Ink | undefined {
  const { w, h, data } = bm;
  const inset = Math.max(2, Math.round(0.08 * Math.min(x1 - x0, y1 - y0)));
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    if (alpha[y * w + x]! >= 0.98) {
      xs.push(x);
      ys.push(y);
    }
  };
  for (let x = x0 + inset; x <= x1 - inset; x += 2) {
    add(x, y0 + inset);
    add(x, y1 - inset);
  }
  for (let y = y0 + inset; y <= y1 - inset; y += 2) {
    add(x0 + inset, y);
    add(x1 - inset, y);
  }
  if (xs.length < 40) return undefined;
  const ch = (i: number, c: number) => data[(ys[i]! * w + xs[i]!) * 4 + c]!;
  const fit = (keep: boolean[]): number[][] => {
    // Bình phương tối thiểu cho [1, x, y] → mỗi kênh, giải hệ 3×3 bằng Cramer.
    let s = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    const rhs = [0, 1, 2].map(() => [0, 0, 0]);
    for (let i = 0; i < xs.length; i++) {
      if (!keep[i]) continue;
      const x = xs[i]!, y = ys[i]!;
      s++; sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
      for (let c = 0; c < 3; c++) {
        const v = ch(i, c);
        rhs[c]![0]! += v; rhs[c]![1]! += v * x; rhs[c]![2]! += v * y;
      }
    }
    const m = [[s, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]];
    const det = (a: number[][]) => a[0]![0]! * (a[1]![1]! * a[2]![2]! - a[1]![2]! * a[2]![1]!) - a[0]![1]! * (a[1]![0]! * a[2]![2]! - a[1]![2]! * a[2]![0]!) + a[0]![2]! * (a[1]![0]! * a[2]![1]! - a[1]![1]! * a[2]![0]!);
    const d = det(m);
    return rhs.map((r) => {
      if (Math.abs(d) < 1e-9) return [r[0]! / Math.max(1, s), 0, 0];
      return [0, 1, 2].map((k) => det(m.map((row, i) => row.map((v, j) => (j === k ? r[i]! : v)))) / d);
    });
  };
  const at = (cf: number[][], x: number, y: number): [number, number, number] => [0, 1, 2].map((c) => cf[c]![0]! + cf[c]![1]! * x + cf[c]![2]! * y) as [number, number, number];
  const clampRgb = (v: [number, number, number]) => v.map((c) => Math.max(0, Math.min(255, c))) as [number, number, number];
  let keep = xs.map(() => true);
  let cf = fit(keep);
  const resid = (i: number) => labDist(oklab(ch(i, 0), ch(i, 1), ch(i, 2)), oklab(...clampRgb(at(cf, xs[i]!, ys[i]!))));
  keep = xs.map((_, i) => resid(i) < 0.08);
  const kept = keep.filter(Boolean).length;
  if (kept < minKeep * xs.length) return undefined;
  cf = fit(keep);
  let err = 0;
  for (let i = 0; i < xs.length; i++) if (keep[i]) err += resid(i);
  if (err / kept >= 0.03) return undefined;
  const n = w * h;
  const cov = new Float32Array(n);
  const bgAt = new Float32Array(n * 3);
  let inked = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const b = clampRgb(at(cf, x, y));
      bgAt.set(b, p * 3);
      if (alpha[p]! < 0.02) continue;
      const d = labDist(oklab(data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!), oklab(...b));
      cov[p] = alpha[p]! * clamp01((d - 0.04) / 0.08);
      if (cov[p]! >= 0.5) inked++;
    }
  }
  // Ô trơn không có hình bên trong: không phải ô gạch, để chế độ khác đọc.
  if (inked < 0.005 * (x1 - x0 + 1) * (y1 - y0 + 1)) return undefined;
  return { mode: "tile", w, h, cov, bgAt };
}

/** Viền ảnh: các điểm ở hàng/cột ngoài cùng. */
function borderIdx(w: number, h: number): number[] {
  const out: number[] = [];
  for (let x = 0; x < w; x++) out.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) out.push(y * w, y * w + w - 1);
  return out;
}

export function inkOf(bm: Bitmap): Ink {
  const { w, h, data } = bm;
  const n = w * h;
  const border = borderIdx(w, h);
  // Có kênh alpha thật (góc bo trong suốt của một ô vuông đặc cũng tính): độ phủ = alpha. Ảnh đục hoàn toàn mới đi
  // tìm nền đặc trên viền.
  const clearBorder = border.filter((p) => data[p * 4 + 3]! < 250).length / border.length;
  let seeThrough = 0;
  for (let p = 0; p < n; p++) if (data[p * 4 + 3]! < 250) seeThrough++;
  if (clearBorder >= 0.02 || seeThrough / n >= 0.01) {
    const cov = new Float32Array(n);
    for (let p = 0; p < n; p++) cov[p] = data[p * 4 + 3]! / 255;
    // Ô gạch trong suốt ở góc (ô bo góc, ô tròn) phủ kín khung: hình thật là phần bên trong ô.
    let x0 = w, y0 = h, x1 = -1, y1 = -1, solid = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (cov[y * w + x]! < 0.5) continue;
        solid++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 >= 0 && x1 - x0 + 1 >= 0.9 * w && y1 - y0 + 1 >= 0.9 * h && solid >= 0.75 * (x1 - x0 + 1) * (y1 - y0 + 1)) {
      const t = tileOf(bm, cov, x0, y0, x1, y1);
      if (t) return t;
    }
    return { mode: "alpha", w, h, cov };
  }
  // Nền đặc: màu phổ biến nhất trên viền (lượng tử 4 bit mỗi kênh), phải phủ ≥ 60% viền.
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (const p of border) {
    const r = data[p * 4]!, g = data[p * 4 + 1]!, b = data[p * 4 + 2]!;
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    bins.set(k, e);
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0]!;
  const bg: [number, number, number] = [top.r / top.n, top.g / top.n, top.b / top.n];
  const bgLab = oklab(...bg);
  const near = border.filter((p) => labDist(oklab(data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!), bgLab) < 0.05).length / border.length;
  if (near < 0.6) {
    // Nền không một màu: có thể là ô gạch đục chuyển sắc (icon ứng dụng tràn khung), nếu không là ảnh tràn viền.
    // Ảnh đục: đòi 85% dải vòng khớp nền, vì tranh phong cảnh (trời phẳng, đất phẳng) cũng khớp được một phần.
    const t = w >= 16 && h >= 16 ? tileOf(bm, new Float32Array(n).fill(1), 0, 0, w - 1, h - 1, 0.85) : undefined;
    return t ?? { mode: "full", w, h, cov: new Float32Array(n).fill(1) };
  }
  const cov = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const d = labDist(oklab(data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!), bgLab);
    cov[p] = clamp01((d - 0.015) / 0.07);
  }
  return { mode: "plain", w, h, cov, bg };
}

// ---- Biến đổi khoảng cách Euclid (Felzenszwalb & Huttenlocher 2012), bình phương khoảng cách ----

const INF = 1e20;
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    d[q] = (q - v[k]!) ** 2 + f[v[k]!]!;
  }
}

/** Bình phương khoảng cách từ mỗi điểm tới điểm "đích" gần nhất (feature[p] = 1). */
export function edt2(feature: Uint8Array, w: number, h: number): Float64Array {
  const out = new Float64Array(w * h);
  const m = Math.max(w, h);
  const f = new Float64Array(m);
  const d = new Float64Array(m);
  const v = new Int32Array(m);
  const z = new Float64Array(m + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = feature[y * w + x] ? 0 : INF;
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y]!;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x]!;
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x]!;
  }
  return out;
}

/** Mặt nạ đã đệm thêm `pad` điểm nền ở mỗi phía (ngoài khung ảnh cũng là nền). */
export interface Grid {
  w: number;
  h: number;
  pad: number;
  /** 1 = mực. */
  ink: Uint8Array;
  inkArea: number;
}

export function gridOf(ink: Ink, pad: number, cut = 0.5): Grid {
  const W = ink.w + 2 * pad;
  const H = ink.h + 2 * pad;
  const g = new Uint8Array(W * H);
  let area = 0;
  for (let y = 0; y < ink.h; y++) {
    for (let x = 0; x < ink.w; x++) {
      if (ink.cov[y * ink.w + x]! >= cut) {
        g[(y + pad) * W + x + pad] = 1;
        area++;
      }
    }
  }
  return { w: W, h: H, pad, ink: g, inkArea: area };
}

/** Phần của tập `set` biến mất khi mở hình (co rồi giãn) bằng đĩa bán kính r: mọi chi tiết mảnh hơn 2r. */
function openingLost(set: Uint8Array, w: number, h: number, r: number, distOut?: Float64Array): Uint8Array {
  const out = distOut ?? edt2(set.map((v) => 1 - v), w, h);
  const r2 = r * r;
  const core = new Uint8Array(w * h);
  for (let p = 0; p < core.length; p++) core[p] = set[p] && out[p]! > r2 ? 1 : 0;
  const toCore = edt2(core, w, h);
  const lost = new Uint8Array(w * h);
  for (let p = 0; p < lost.length; p++) lost[p] = set[p] && toCore[p]! > r2 ? 1 : 0;
  return lost;
}

export interface DetailLoss {
  /** Cỡ hiển thị (cạnh ngắn, px). */
  size: number;
  /** Phần diện tích mực mảnh hơn 1 px ở cỡ đó (nét, chấm). */
  ink: number;
  /** Khe hở, lòng chữ hẹp hơn 1 px ở cỡ đó (bị lấp), so với diện tích mực. */
  gaps: number;
  /**
   * Phần đường viền của hình (viền ngoài và ranh giới giữa các vùng màu) thuộc chi tiết mất. Đo theo viền chứ không
   * theo diện tích: một vòng nét mảnh dài chiếm ít mực nhưng là cả một chi tiết người xem thấy.
   */
  share: number;
  /** Mặt nạ điểm mất (kích thước ảnh tham chiếu, không đệm): 1 mực mất, 2 khe mất. */
  lost: Uint8Array;
}

/**
 * Chi tiết mất khi hiển thị ảnh với cạnh ngắn `size` px: nét và khe mảnh hơn 1 điểm ảnh ở cỡ đó thành vệt xám hoặc
 * biến mất. Ở ảnh tham chiếu, 1 px hiển thị = short/size điểm, nên mở hình bằng đĩa đường kính short/size.
 * `regions`: mặt nạ từng vùng màu (cỡ ảnh, không đệm). Có từ hai vùng thì phần mảnh của từng vùng bên trong hình
 * (chiếc lá trắng trong hình tròn xanh, vạch cắt ngang) cũng được tính, không chỉ đường viền ngoài.
 */
export function detailLoss(ink: Ink, sizes: number[], regions: Uint8Array[] = []): DetailLoss[] {
  const short = Math.min(ink.w, ink.h);
  const pad = Math.ceil(short / (2 * Math.min(...sizes))) + 2;
  const g = gridOf(ink, pad);
  const bgSet = g.ink.map((v) => 1 - v);
  const distIn = edt2(bgSet, g.w, g.h); // từ mực tới nền
  const distOut = edt2(g.ink, g.w, g.h); // từ nền tới mực
  const padded = (m: Uint8Array) => {
    const o = new Uint8Array(g.w * g.h);
    for (let y = 0; y < ink.h; y++) for (let x = 0; x < ink.w; x++) o[(y + pad) * g.w + x + pad] = m[y * ink.w + x]!;
    return o;
  };
  const parts = regions.length >= 2 ? regions.map(padded) : [];
  const sil = perimeter(ink.cov, ink.w, ink.h);
  const total = Math.max(1, parts.length ? (regions.reduce((s, r) => s + perimeter(r, ink.w, ink.h), 0) + sil) / 2 : sil);
  const partDist = parts.map((part) => edt2(part.map((v) => 1 - v), g.w, g.h));
  // Khoảng cách tới mép gần nhất, kể cả mép giữa hai vùng màu (độ dày thật của một vạch màu bên trong hình).
  const localIn = Float64Array.from(distIn);
  parts.forEach((part, i) => {
    for (let q = 0; q < part.length; q++) if (part[q] && partDist[i]![q]! < localIn[q]!) localIn[q] = partDist[i]![q]!;
  });
  // Mảnh mất mỏng hơn CORE điểm tham chiếu là lớp "bào" ở mép do rời rạc hoá (cả hình tròn đặc cũng có), không phải chi
  // tiết: chỉ đo viền của phần lõi của chi tiết mất.
  const CORE2 = 4;
  return sizes.map((size) => {
    const r = short / (2 * size);
    const lostInk = openingLost(g.ink, g.w, g.h, r, distIn);
    const lostBg = openingLost(bgSet, g.w, g.h, r, distOut);
    const coreInk = new Uint8Array(lostInk.length);
    for (let q = 0; q < lostInk.length; q++) if (lostInk[q] && distIn[q]! >= CORE2) coreInk[q] = 1;
    parts.forEach((part, i) => {
      const l = openingLost(part, g.w, g.h, r, partDist[i]);
      for (let q = 0; q < l.length; q++) {
        if (!l[q]) continue;
        lostInk[q] = 1;
        if (partDist[i]![q]! >= CORE2) coreInk[q] = 1;
      }
    });
    const lost = new Uint8Array(ink.w * ink.h);
    const coreA = new Uint8Array(lost.length);
    const coreB = new Uint8Array(lost.length);
    let a = 0;
    let b = 0;
    for (let y = 0; y < ink.h; y++) {
      for (let x = 0; x < ink.w; x++) {
        const q = (y + pad) * g.w + x + pad;
        const p = y * ink.w + x;
        if (lostInk[q]) {
          lost[p] = 1;
          a++;
          if (coreInk[q]) coreA[p] = 1;
        } else if (lostBg[q]) {
          lost[p] = 2;
          b++;
          if (distOut[q]! >= CORE2) coreB[p] = 1;
        }
      }
    }
    const area = Math.max(1, g.inkArea);
    // Phần còn lại sau khi thu nhỏ: mực không mất, nền không bị lấp (cỡ ảnh, không đệm).
    const keepInk = new Uint8Array(lost.length);
    const keepBg = new Uint8Array(lost.length);
    for (let y = 0; y < ink.h; y++) {
      for (let x = 0; x < ink.w; x++) {
        const q = (y + pad) * g.w + x + pad;
        const p = y * ink.w + x;
        if (g.ink[q] && !lostInk[q]) keepInk[p] = 1;
        if (!g.ink[q] && !lostBg[q]) keepBg[p] = 1;
      }
    }
    dropTips(coreA, keepInk, ink.w, ink.h);
    dropTips(coreB, keepBg, ink.w, ink.h);
    const edge = perimeter(coreA, ink.w, ink.h) + perimeter(coreB, ink.w, ink.h);
    return { size, ink: a / area, gaps: b / area, share: Math.min(1, edge / total), lost };
  });
}

/**
 * Bỏ khỏi `mask` các mũi nhọn: đầu cánh sao, đỉnh chữ A, góc trong sắc. Thu nhỏ chỉ làm chúng tròn đi một chút, hình
 * vẫn đọc được; còn nét mảnh, chấm nhỏ, khe hẹp thì mất thật. Một mũi nhọn dính vào phần còn lại (`keep`) bằng cả chân
 * của nó: diện tích / (độ dài chỗ dính)² nhỏ (mũi 36° ≈ 0,8; góc vuông ≈ 0,25). Nét mảnh dài thò ra có tỉ số lớn, chấm
 * hay nét đứng riêng không dính vào đâu. Ngưỡng 2: mũi hẹp tới khoảng 15° vẫn là mũi.
 */
function dropTips(mask: Uint8Array, keep: Uint8Array, w: number, h: number): void {
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    const comp: number[] = [];
    let attach = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      comp.push(p);
      const x = p % w;
      const y = (p - x) / w;
      let touches = false;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0) continue;
        if (keep[q]) touches = true;
        if (mask[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
      if (touches) attach++;
    }
    if (attach > 0 && comp.length / (attach * attach) < 2) for (const p of comp) mask[p] = 0;
  }
}

/** Chu vi (marching squares, mức 0,5) của một trường độ phủ 0–1 cỡ w×h; ngoài khung coi là 0. */
export function perimeter(cov: ArrayLike<number>, w: number, h: number): number {
  const W = w + 2;
  const H = h + 2;
  const c = new Float32Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c[(y + 1) * W + x + 1] = cov[y * w + x]!;
  let per = 0;
  const t = 0.5;
  const cross = (a: number, b: number) => (t - a) / (b - a);
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = c[y * W + x]!, b = c[y * W + x + 1]!, d = c[(y + 1) * W + x]!, e = c[(y + 1) * W + x + 1]!;
      const pts: Array<[number, number]> = [];
      if ((a >= t) !== (b >= t)) pts.push([cross(a, b), 0]);
      if ((b >= t) !== (e >= t)) pts.push([1, cross(b, e)]);
      if ((d >= t) !== (e >= t)) pts.push([cross(d, e), 1]);
      if ((a >= t) !== (d >= t)) pts.push([0, cross(a, d)]);
      for (let i = 0; i + 1 < pts.length; i += 2) per += Math.hypot(pts[i]![0] - pts[i + 1]![0], pts[i]![1] - pts[i + 1]![1]);
    }
  }
  return per;
}

/**
 * Độ dày nét hay khối (điểm ảnh tham chiếu), tính theo diện tích: 4 × khoảng cách trung bình tới mép. Một nét đều dày
 * t có khoảng cách phân bố đều 0…t/2, trung bình t/4, nên ra đúng t; hình tô đặc ra độ dày khối (hình tròn bán kính R:
 * 4R/3). Không dùng trung vị trên "sống" của hình: ngôi sao có mười nhánh sống nhọn dần nên ra con số quá nhỏ.
 */
export function strokeWidth(ink: Ink): number {
  const g = gridOf(ink, 2);
  const d2 = edt2(g.ink.map((v) => 1 - v), g.w, g.h);
  let sum = 0;
  let n = 0;
  for (let p = 0; p < d2.length; p++) {
    if (!g.ink[p]) continue;
    sum += Math.sqrt(d2[p]!) - 0.5;
    n++;
  }
  return n ? (4 * sum) / n : 0;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Hộp bao phần mực (độ phủ ≥ cut); undefined nếu ảnh trống. */
export function inkBox(ink: Ink, cut = 0.5): Box | undefined {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < ink.h; y++) {
    for (let x = 0; x < ink.w; x++) {
      if (ink.cov[y * ink.w + x]! >= cut) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? undefined : { x0, y0, x1, y1 };
}

export interface Margins {
  /** Lề nhỏ nhất (phần của cạnh khung). */
  min: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Cạnh dài của hộp mực / cạnh khung tương ứng. */
  fill: number;
  /** Tâm hộp mực lệch khỏi tâm khung (phần của cạnh khung), theo x và y. */
  dx: number;
  dy: number;
}
export function margins(ink: Ink, box: Box): Margins {
  const left = box.x0 / ink.w;
  const right = (ink.w - 1 - box.x1) / ink.w;
  const top = box.y0 / ink.h;
  const bottom = (ink.h - 1 - box.y1) / ink.h;
  return {
    min: Math.min(left, right, top, bottom),
    left, right, top, bottom,
    fill: Math.max((box.x1 - box.x0 + 1) / ink.w, (box.y1 - box.y0 + 1) / ink.h),
    dx: (right - left) / 2,
    dy: (bottom - top) / 2,
  };
}

/** Phần mực nằm ngoài vòng tròn giữa ảnh bán kính `ratio` × cạnh ngắn (vùng an toàn của icon maskable: 0,4). */
export function outsideCircle(ink: Ink, ratio = 0.4): number {
  const cx = (ink.w - 1) / 2;
  const cy = (ink.h - 1) / 2;
  const r = ratio * Math.min(ink.w, ink.h);
  let all = 0;
  let out = 0;
  for (let y = 0; y < ink.h; y++) {
    for (let x = 0; x < ink.w; x++) {
      const c = ink.cov[y * ink.w + x]!;
      if (c < 0.5) continue;
      all++;
      if (Math.hypot(x - cx, y - cy) > r) out++;
    }
  }
  return all ? out / all : 0;
}

/**
 * Độ lệch trọng tâm (DCM, Hübner & Fillinger 2016): khoảng cách từ trọng tâm khối mực (theo độ phủ) tới tâm hộp mực,
 * chia cho đường chéo nửa hộp. 0 = cân giữa.
 */
export function massOffset(ink: Ink, box: Box): number {
  let s = 0, sx = 0, sy = 0;
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const c = ink.cov[y * ink.w + x]!;
      s += c;
      sx += c * x;
      sy += c * y;
    }
  }
  if (!s) return 0;
  const hw = (box.x1 - box.x0) / 2;
  const hh = (box.y1 - box.y0) / 2;
  return Math.hypot(sx / s - (box.x0 + hw), sy / s - (box.y0 + hh)) / Math.max(1, Math.hypot(hw, hh));
}

/** Tổng độ phủ / diện tích khung: "độ đậm" thị giác của icon. */
export function coverage(ink: Ink): number {
  let s = 0;
  for (const c of ink.cov) s += c;
  return s / (ink.w * ink.h);
}

/**
 * Độ phức tạp chu vi (perimetric complexity, Pelli và cộng sự 2006): chu vi² / diện tích mực, chu vi gồm cả viền trong
 * lẫn viền ngoài. Hình tròn = 4π ≈ 12,6. Không đổi theo cỡ. Chu vi đo bằng marching squares ở mức phủ 0,5 (dưới điểm
 * ảnh), không đếm cạnh điểm, để đường chéo không bị thổi phồng (Watson 2012).
 * `regions` (từ hai vùng màu): cộng cả ranh giới giữa các vùng màu bên trong hình. Mỗi ranh giới trong được hai vùng
 * đếm, viền ngoài được một vùng và hình bóng đếm, nên chu vi = (Σ chu vi vùng + chu vi hình bóng) / 2.
 */
export function perimetricComplexity(ink: Ink, regions: Uint8Array[] = []): number {
  let area = 0;
  for (const v of ink.cov) area += v;
  if (area < 1) return 0;
  const sil = perimeter(ink.cov, ink.w, ink.h);
  const per = regions.length >= 2 ? (regions.reduce((s, r) => s + perimeter(r, ink.w, ink.h), 0) + sil) / 2 : sil;
  return (per * per) / area;
}

/** Đối xứng gương trái–phải quanh trục giữa hộp mực: IoU của hình và ảnh gương (1 = đối xứng hoàn toàn). */
export function mirrorSymmetry(ink: Ink, box: Box): number {
  let both = 0;
  let any = 0;
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const a = ink.cov[y * ink.w + x]! >= 0.5;
      const b = ink.cov[y * ink.w + (box.x0 + box.x1 - x)]! >= 0.5;
      if (a && b) both++;
      if (a || b) any++;
    }
  }
  return any ? both / any : 1;
}

export interface PixelFit {
  /** Điểm cạnh thẳng nằm đúng lưới (đầy cạnh rỗng). */
  crisp: number;
  /** Điểm cạnh thẳng nằm giữa hai điểm ảnh (vệt xám nửa phủ). */
  blurry: number;
  /** blurry / (crisp + blurry). */
  share: number;
}

/**
 * Cạnh ngang/dọc thẳng ở cỡ gốc của icon: đúng lưới thì sắc, lệch nửa điểm thì thành vệt xám nhoè. Chỉ đếm đoạn
 * thẳng ≥ 3 điểm liên tiếp có cùng độ phủ, nên đường cong (khử răng cưa là bình thường) không bị tính.
 */
export function pixelFit(ink: Ink): PixelFit {
  const { w, h, cov } = ink;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : cov[y * w + x]!);
  const lo = (v: number) => v <= 0.1;
  const hi = (v: number) => v >= 0.9;
  const mid = (v: number) => v >= 0.2 && v <= 0.8;
  let crisp = 0;
  let blurry = 0;
  // Một dòng quét (hàng hoặc cột): k là vị trí dọc theo dòng, s là vị trí ngang qua dòng.
  const scan = (n: number, m: number, get: (k: number, s: number) => number) => {
    for (let s = 0; s < m; s++) {
      let runC = 0;
      let runB = 0;
      let last = -1;
      const flush = () => {
        if (runC >= 3) crisp += runC;
        if (runB >= 3) blurry += runB;
        runC = 0;
        runB = 0;
      };
      for (let k = 0; k < n; k++) {
        const v = get(k, s), up = get(k, s - 1), dn = get(k, s + 1);
        const isCrisp = hi(v) && (lo(up) || lo(dn));
        // Nửa phủ giữa rỗng và đầy, hoặc nét 1px lệch lưới thành hai hàng nửa phủ.
        const isBlur = mid(v) && ((lo(up) && (hi(dn) || mid(dn))) || (lo(dn) && (hi(up) || mid(up))));
        if (isBlur) {
          // Độ phủ đổi hẳn giữa chừng: đây là đường cong hay nét khác, bắt đầu đoạn mới.
          if (runC || (runB && Math.abs(v - last) >= 0.12)) flush();
          runB++;
          last = v;
        } else if (isCrisp) {
          if (runB) flush();
          runC++;
        } else flush();
      }
      flush();
    }
  };
  scan(w, h, (k, s) => at(k, s));
  scan(h, w, (k, s) => at(s, k));
  const total = crisp + blurry;
  return { crisp, blurry, share: total ? blurry / total : 0 };
}

export type { Lab };
