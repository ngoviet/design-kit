// Phép đo màu: bảng màu thật của hình (gộp vùng phẳng, tách phần chuyển sắc), tương phản trên nền sáng/tối (WCAG 1.4.11),
// phép thử đen trắng (vùng màu cạnh nhau có còn tách được khi chỉ còn độ sáng), độ rực màu (Hasler & Süsstrunk 2003).
import { edt2, type Ink } from "./shape.js";
import { type Bitmap, clamp01, labDist, type Lab, luminance, median, oklab, over, ratio, toHex } from "./pixels.js";

/** Hai màu gần hơn ngần này (OKLab) được coi là một màu của bảng (0,02 là vừa nhận ra khác). */
const SAME = 0.06;
/** Một màu phải chiếm ít nhất ngần này phần mực mới được tính vào bảng. */
const MIN_SWATCH = 0.02;
/** Màu phẳng: ít nhất 60% điểm của cụm cách tâm dưới ngần này (nhiễu JPEG khoảng 0,01). */
const FLAT = 0.025;

export interface Swatch {
  hex: string;
  lab: Lab;
  /** Phần của mực (điểm phủ đặc). */
  share: number;
  /** Độ chói WCAG. */
  y: number;
}
export interface Palette {
  swatches: Swatch[];
  /** Phần mực đặc không thuộc màu nào của bảng: chuyển sắc, kết cấu, ảnh chụp. */
  blend: number;
  /** Chỉ số màu của bảng cho mỗi điểm mực đặc (−1: không thuộc màu nào hoặc không phải mực đặc). */
  index: Int32Array;
}

const solid = (bm: Bitmap, ink: Ink, p: number): boolean => ink.cov[p]! >= 0.9 && bm.data[p * 4 + 3]! >= 230;

export function palette(bm: Bitmap, ink: Ink): Palette {
  const { w, h, data } = bm;
  const n = w * h;
  const labs = new Array<Lab | undefined>(n);
  const labAt = (p: number): Lab => (labs[p] ??= oklab(data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!));
  // Điểm "phẳng": 4 điểm kề có cùng màu. Bỏ điểm khử răng cưa ở mép, vốn là màu pha giữa hai vùng.
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  let solidCount = 0;
  // Điểm chuyển sắc: không nằm ở mép, khác điểm cách 8 nhiều hơn hẳn điểm kề (độ khác tăng theo khoảng cách). Nhiễu
  // JPEG trên mảng phẳng không tăng theo khoảng cách nên không bị tính; chuyển sắc chậm tới mức mắt không thấy thì
  // cũng coi là phẳng.
  // Lượt 1: điểm "trong vùng" (mực đặc, 4 điểm kề cùng màu): bỏ điểm khử răng cưa ở mép, vốn là màu pha.
  const interior = new Uint8Array(n);
  const d1s = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!solid(bm, ink, p)) continue;
      solidCount++;
      const c = labAt(p);
      let flat = true;
      let d1 = 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0) continue;
        const d = solid(bm, ink, q) ? labDist(c, labAt(q)) : 1;
        if (d > 0.03) {
          flat = false;
          break;
        }
        d1 = Math.max(d1, d);
      }
      if (flat) {
        interior[p] = 1;
        d1s[p] = d1;
      }
    }
  }
  // Lượt 2: điểm chuyển sắc nếu theo một hướng, điểm cách 8 (cũng trong vùng) khác hẳn mà điểm cách 4 khác vừa phải:
  // màu đổi đều theo khoảng cách.
  const gradient = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!interior[p]) continue;
      const c = labAt(p);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x8 = x + 8 * dx, y8 = y + 8 * dy;
        if (x8 < 0 || y8 < 0 || x8 >= w || y8 >= h) continue;
        const q8 = y8 * w + x8;
        const q4 = (y + 4 * dy) * w + x + 4 * dx;
        if (!interior[q8] || !interior[q4]) continue;
        const d8 = labDist(c, labAt(q8));
        const d4 = labDist(c, labAt(q4));
        if (d8 > 0.015 && d8 <= 0.08 && d8 > 3 * d1s[p]! && d4 > 0.25 * d8 && d4 < 0.75 * d8) {
          gradient[p] = 1;
          break;
        }
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!interior[p] || gradient[p]) continue;
      const r = data[p * 4]!, g = data[p * 4 + 1]!, b = data[p * 4 + 2]!;
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const e = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      bins.set(k, e);
    }
  }
  // Gộp tham lam từ ô đông nhất: tâm cụm là màu của ô lớn nhất trong cụm. Ảnh chụp có hàng nghìn cụm nhỏ: chỉ so
  // với 256 cụm đầu, phần còn lại thành cụm riêng (đằng nào cũng dưới ngưỡng 2%).
  const clusters: Array<{ lab: Lab; rgb: [number, number, number]; n: number }> = [];
  const binTo = new Map<number, number>();
  for (const [key, e] of [...bins.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const rgb: [number, number, number] = [e.r / e.n, e.g / e.n, e.b / e.n];
    const lab = oklab(...rgb);
    let hit = -1;
    for (let i = 0; i < clusters.length && i < 256; i++) {
      if (labDist(clusters[i]!.lab, lab) < SAME) {
        hit = i;
        break;
      }
    }
    if (hit >= 0) clusters[hit]!.n += e.n;
    else {
      hit = clusters.length;
      clusters.push({ lab, rgb, n: e.n });
    }
    binTo.set(key, hit);
  }
  // Gán mọi điểm mực đặc vào màu: theo ô màu nếu ô đã có cụm, không thì cụm gần nhất trong 64 cụm lớn nhất.
  const counts = new Array<number>(clusters.length).fill(0);
  // Điểm nằm sát tâm cụm: mảng màu phẳng dồn gần hết vào đây; một khúc chuyển sắc trải đều tới mép cụm.
  const core = new Array<number>(clusters.length).fill(0);
  const idx = new Int32Array(n).fill(-1);
  let blend = 0;
  for (let p = 0; p < n; p++) {
    if (!solid(bm, ink, p)) continue;
    if (gradient[p]) {
      blend++;
      continue;
    }
    const r = data[p * 4]!, g = data[p * 4 + 1]!, b = data[p * 4 + 2]!;
    let best = binTo.get(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) ?? -1;
    let bd = best >= 0 ? labDist(labAt(p), clusters[best]!.lab) : SAME;
    if (bd >= SAME) best = -1;
    if (best < 0) {
      const c = labAt(p);
      bd = SAME;
      for (let i = 0; i < clusters.length && i < 64; i++) {
        const d = labDist(c, clusters[i]!.lab);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    }
    if (best >= 0) {
      counts[best]!++;
      if (bd < FLAT) core[best]!++;
      idx[p] = best;
    } else blend++;
  }
  const total = Math.max(1, solidCount);
  const keep = clusters
    .map((c, i) => ({ c, i, share: counts[i]! / total, flat: counts[i] ? core[i]! / counts[i]! : 0 }))
    .filter((k) => k.share >= MIN_SWATCH && k.flat >= 0.6)
    .sort((a, b) => b.share - a.share);
  const remap = new Map(keep.map((k, j) => [k.i, j]));
  let minor = 0;
  for (let p = 0; p < n; p++) {
    if (idx[p]! < 0) continue;
    const j = remap.get(idx[p]!);
    if (j === undefined) {
      idx[p] = -1;
      minor++;
    } else idx[p] = j;
  }
  return {
    swatches: keep.map(({ c, share }) => ({ hex: toHex(...c.rgb), lab: c.lab, share, y: luminance(...c.rgb) })),
    blend: (blend + minor) / total,
    index: idx,
  };
}

export interface OnBg {
  bg: string;
  /** 0–1: trung bình điểm mỗi điểm mực, 1,5:1 → 0, 3:1 → 1. */
  credit: number;
  /** Phần mực đạt ≥ 3:1. */
  strong: number;
  /** Tỉ số trung vị. */
  median: number;
}

/** Điểm cho một tỉ số tương phản phi chữ: dưới 1,5:1 gần như vô hình, từ 3:1 (WCAG 1.4.11) là đủ. */
export const contrastCredit = (r: number): number => clamp01((r - 1.5) / 1.5);

/**
 * Mặt nạ từng màu của bảng (cỡ ảnh), chia kín phần mực: dùng để đo chi tiết và ranh giới bên trong hình. Điểm mực
 * chưa thuộc màu nào (khử răng cưa, nhiễu JPEG, vệt chuyển sắc nhỏ) về vùng màu gần nhất, để nhiễu không đục thành lỗ
 * mà phép đo chi tiết đọc nhầm là khe hẹp.
 */
export function regionMasks(pal: Palette, ink: Ink): Uint8Array[] {
  const n = ink.w * ink.h;
  const out = pal.swatches.map(() => new Uint8Array(n));
  for (let p = 0; p < n; p++) {
    const i = pal.index[p]!;
    if (i >= 0) out[i]![p] = 1;
  }
  const dist = out.map((m) => edt2(m, ink.w, ink.h));
  for (let p = 0; p < n; p++) {
    if (pal.index[p]! >= 0 || ink.cov[p]! < 0.5) continue;
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < dist.length; i++) {
      if (dist[i]![p]! < bd) {
        bd = dist[i]![p]!;
        best = i;
      }
    }
    if (best >= 0) out[best]![p] = 1;
  }
  return out;
}

/** Bề dày dải viền ngoài (điểm tham chiếu) dùng để đo tương phản: phần chạm nền. */
const RIM = 3;

/**
 * Tương phản của phần mực với nền `bg` (ảnh trong suốt đặt lên nền đó) hoặc với nền riêng của ảnh (mode plain).
 * Chỉ đo dải viền ngoài (điểm mực cách nền ≤ RIM): chiếc lá trắng nằm trong hình tròn xanh không cần nổi trên nền
 * trắng, viền của hình tròn mới cần. Lấy mẫu tối đa ~40 nghìn điểm cho nhanh.
 * `upscale`: số điểm tham chiếu ứng với một điểm ảnh gốc (ảnh điểm nhỏ bị phóng có làm mịn). Mép của ảnh đó là một
 * dải pha màu rộng chừng `upscale` điểm, nên dải viền bắt đầu sau nửa dải pha đó (icon PNG 64 px đỏ trên trắng, tỉ số
 * thật 6:1, từng bị đo 1,66:1 và dính lỗi cứng). Dải đó trống (nét quá mảnh) thì đo như cũ.
 */
export function contrastOn(bm: Bitmap, ink: Ink, bgRgb: [number, number, number], bgName: string, upscale = 1): OnBg | undefined {
  const skip = upscale > 1 ? Math.ceil(upscale / 2) : 0;
  return rimContrast(bm, ink, bgRgb, bgName, skip) ?? (skip ? rimContrast(bm, ink, bgRgb, bgName, 0) : undefined);
}

function rimContrast(bm: Bitmap, ink: Ink, bgRgb: [number, number, number], bgName: string, skip: number): OnBg | undefined {
  if (ink.mode === "full") return undefined;
  // Ô gạch: so hình với màu nền của chính ô tại chỗ đó (nền chuyển sắc); nền đặc: với màu nền của ảnh.
  const base = ink.mode === "plain" ? ink.bg! : bgRgb;
  const own = ink.mode === "plain" || ink.mode === "tile";
  const ybBase = luminance(...base);
  const ybAt = (p: number) => (ink.mode === "tile" ? luminance(ink.bgAt![p * 3]!, ink.bgAt![p * 3 + 1]!, ink.bgAt![p * 3 + 2]!) : ybBase);
  const n = bm.w * bm.h;
  const bgSet = new Uint8Array(n);
  for (let p = 0; p < n; p++) bgSet[p] = ink.cov[p]! < 0.5 ? 1 : 0;
  const toBg = edt2(bgSet, bm.w, bm.h);
  const lo = skip * skip;
  const hi = (skip + RIM) * (skip + RIM);
  const inRim = (p: number) => toBg[p]! > lo && toBg[p]! <= hi;
  let rimCount = 0;
  for (let p = 0; p < n; p++) if (!bgSet[p] && inRim(p)) rimCount++;
  const step = Math.max(1, Math.floor(rimCount / 40000));
  let seen = 0;
  let wsum = 0;
  let csum = 0;
  let strong = 0;
  const rs: number[] = [];
  for (let p = 0; p < n; p++) {
    const c = ink.cov[p]!;
    // Điểm chạm mép khung ảnh cũng là viền (ngoài khung là nền của trang).
    const x = p % bm.w;
    const y = (p - x) / bm.w;
    const edge = x < RIM || y < RIM || x >= bm.w - RIM || y >= bm.h - RIM;
    if (c < 0.5 || (!inRim(p) && !edge)) continue;
    if (seen++ % step) continue;
    const d = bm.data;
    const [r, g, b] = ink.mode === "alpha" ? over(d[p * 4]!, d[p * 4 + 1]!, d[p * 4 + 2]!, d[p * 4 + 3]!, base) : [d[p * 4]!, d[p * 4 + 1]!, d[p * 4 + 2]!];
    const rt = ratio(luminance(r, g, b), ybAt(p));
    wsum += c;
    csum += c * contrastCredit(rt);
    if (rt >= 3) strong += c;
    rs.push(rt);
  }
  if (!wsum) return undefined;
  return { bg: ink.mode === "tile" ? "own tile" : own ? `own ${toHex(...base)}` : bgName, credit: csum / wsum, strong: strong / wsum, median: median(rs) };
}

export interface MonoPair {
  a: string;
  b: string;
  ratio: number;
  /** Phần của đường ranh giới giữa các vùng màu. */
  weight: number;
}
export interface Mono {
  /** 0–1, trung bình theo độ dài ranh giới. undefined: ít hơn hai màu chạm nhau. */
  credit?: number;
  pairs: MonoPair[];
}

/**
 * Phép thử đen trắng: các vùng màu chạm nhau còn tách được khi in một màu, chuyển thang xám, hay với người mù màu
 * (WCAG 1.4.1) không? Đo tỉ số độ chói giữa từng cặp màu kề nhau, cân theo độ dài ranh giới chung.
 */
export function monoTest(bm: Bitmap, ink: Ink, pal: Palette): Mono {
  const { w, h } = bm;
  const cov = ink.cov;
  const k = pal.swatches.length;
  if (k < 2) return { pairs: [] };
  const counts = new Float64Array(k * k);
  // Đi sang phải và xuống dưới, nhảy qua dải màu pha ở ranh giới (khử răng cưa, ảnh mờ) tới điểm màu kế tiếp, tối đa
  // REACH điểm; dừng ở nền (độ phủ < 0,5).
  const REACH = 10;
  const next = (x: number, y: number, dx: number, dy: number): number => {
    for (let s = 1; s <= REACH; s++) {
      const xx = x + dx * s;
      const yy = y + dy * s;
      if (xx >= w || yy >= h) return -1;
      const q = yy * w + xx;
      const j = pal.index[q]!;
      if (j >= 0) return j;
      if (cov[q]! < 0.5) return -1;
    }
    return -1;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = pal.index[y * w + x]!;
      if (i < 0) continue;
      for (const j of [next(x, y, 1, 0), next(x, y, 0, 1)]) {
        if (j >= 0 && j !== i) counts[Math.min(i, j) * k + Math.max(i, j)]!++;
      }
    }
  }
  let total = 0;
  for (const c of counts) total += c;
  if (!total) return { pairs: [] };
  const pairs: MonoPair[] = [];
  let credit = 0;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const c = counts[i * k + j]!;
      if (!c) continue;
      const a = pal.swatches[i]!, b = pal.swatches[j]!;
      const rt = ratio(a.y, b.y);
      pairs.push({ a: a.hex, b: b.hex, ratio: rt, weight: c / total });
      credit += (c / total) * contrastCredit(rt);
    }
  }
  pairs.sort((x, y) => y.weight - x.weight);
  return { credit, pairs };
}

/** Độ rực màu M của Hasler & Süsstrunk (2003), trên phần mực (hoặc cả ảnh nếu tràn viền). */
export function colorfulness(bm: Bitmap, ink: Ink): number {
  const n = bm.w * bm.h;
  const step = Math.max(1, Math.floor(n / 60000));
  let c = 0, mrg = 0, myb = 0, srg = 0, syb = 0;
  for (let p = 0; p < n; p += step) {
    if (ink.mode !== "full" && ink.cov[p]! < 0.5) continue;
    const r = bm.data[p * 4]!, g = bm.data[p * 4 + 1]!, b = bm.data[p * 4 + 2]!;
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    c++;
    mrg += rg; myb += yb; srg += rg * rg; syb += yb * yb;
  }
  if (!c) return 0;
  mrg /= c; myb /= c;
  const sd = Math.sqrt(Math.max(0, srg / c - mrg * mrg) + Math.max(0, syb / c - myb * myb));
  return sd + 0.3 * Math.hypot(mrg, myb);
}

/** Nhãn của Hasler & Süsstrunk cho M (điểm giữa các mốc 0, 15, 33, 45, 59, 82, 109). */
export function colorfulnessLabel(m: number): string {
  const marks: Array<[number, string]> = [[7, "not colorful"], [24, "slightly colorful"], [39, "moderately colorful"], [52, "averagely colorful"], [70, "quite colorful"], [95, "highly colorful"]];
  return marks.find(([t]) => m < t)?.[1] ?? "extremely colorful";
}
