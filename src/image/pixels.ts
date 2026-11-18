// Ảnh dạng điểm (RGBA, không nhân sẵn alpha, như getImageData trả về) và các phép đổi màu nhanh dùng cho mọi phép đo hình.
// Tự viết thay cho colorjs.io: phải chạy trên hàng trăm nghìn điểm mỗi ảnh.

export interface Bitmap {
  w: number;
  h: number;
  /** RGBA, 4 byte mỗi điểm, alpha không nhân sẵn. */
  data: Uint8ClampedArray;
}

export function makeBitmap(w: number, h: number, fill?: [number, number, number, number]): Bitmap {
  const data = new Uint8ClampedArray(w * h * 4);
  if (fill) for (let i = 0; i < data.length; i += 4) data.set(fill, i);
  return { w, h, data };
}

/** sRGB 0–255 → tuyến tính 0–1 (bảng tra). */
export const LIN = (() => {
  const t = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return t;
})();

/** Độ chói tương đối WCAG (0–1) của màu sRGB 0–255. */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * LIN[r | 0]! + 0.7152 * LIN[g | 0]! + 0.0722 * LIN[b | 0]!;
}

/** Tỉ số tương phản WCAG 2 giữa hai độ chói. */
export function ratio(y1: number, y2: number): number {
  const hi = Math.max(y1, y2);
  const lo = Math.min(y1, y2);
  return (hi + 0.05) / (lo + 0.05);
}

export type Lab = [number, number, number];
/** sRGB 0–255 → OKLab (L 0–1). Khoảng cách Euclid trong OKLab ≈ khác biệt cảm nhận (0,02 vừa thấy). */
export function oklab(r: number, g: number, b: number): Lab {
  const R = LIN[r | 0]!;
  const G = LIN[g | 0]!;
  const B = LIN[b | 0]!;
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export const labDist = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function parseHex(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Điểm (r,g,b,a) phủ lên nền đặc `bg`. */
export function over(r: number, g: number, b: number, a: number, bg: [number, number, number]): [number, number, number] {
  const t = a / 255;
  return [r * t + bg[0] * (1 - t), g * t + bg[1] * (1 - t), b * t + bg[2] * (1 - t)];
}

/** Độ chói 0–255 (WCAG, đã về sRGB) của cả ảnh phủ lên nền: dùng cho thang xám, đo cạnh, đo độ phức tạp. */
export function grayOver(bm: Bitmap, bg: [number, number, number]): Float64Array {
  const out = new Float64Array(bm.w * bm.h);
  const d = bm.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const [r, g, b] = over(d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!, bg);
    const y = luminance(r, g, b);
    out[p] = 255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055);
  }
  return out;
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export const pct = (x: number, digits = 0): string => `${(x * 100).toFixed(digits)}%`;
