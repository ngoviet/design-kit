// Độ sắc của ảnh điểm và độ phức tạp theo nén.
import { deflateSync } from "node:zlib";

export interface EdgeWidth {
  /** Bề rộng trung bình (điểm ảnh) của các cạnh mạnh nhất. */
  width: number;
  /** Số cạnh đã đo. */
  edges: number;
}

/**
 * Bề rộng cạnh theo Marziliano và cộng sự (2002), "A no-reference perceptual blur metric": tại mỗi điểm cạnh, đi dọc
 * dòng quét tới cực tiểu và cực đại cục bộ hai bên; khoảng cách giữa chúng là bề rộng cạnh. Chỉ lấy cạnh mạnh (≥ một
 * nửa độ dốc ở phân vị 99), để chuyển sắc mềm có chủ ý không bị tính là nhoè. Đo cả hàng lẫn cột.
 * Hình vẽ véc-tơ sắc: 1–2 điểm. Ảnh phóng to ×2 từ bản nhỏ: khoảng 3; ×4: khoảng 5.
 */
export function edgeWidth(gray: Float64Array, w: number, h: number): EdgeWidth {
  const widths: number[] = [];
  const line = (n: number, m: number, at: (k: number, s: number) => number) => {
    const grads: number[] = [];
    for (let s = 0; s < m; s += 2) for (let k = 1; k < n - 1; k++) grads.push(Math.abs(at(k + 1, s) - at(k - 1, s)));
    if (!grads.length) return;
    grads.sort((a, b) => a - b);
    const t = Math.max(24, 0.5 * grads[Math.floor(grads.length * 0.99)]!);
    for (let s = 0; s < m; s++) {
      for (let k = 1; k < n - 1; k++) {
        const g = at(k + 1, s) - at(k - 1, s);
        if (Math.abs(g) < t) continue;
        // Chỉ đỉnh dốc (lớn hơn hai điểm kề) để mỗi cạnh tính một lần.
        const gl = k > 1 ? Math.abs(at(k, s) - at(k - 2, s)) : 0;
        const gr = k < n - 2 ? Math.abs(at(k + 2, s) - at(k, s)) : 0;
        if (Math.abs(g) < gl || Math.abs(g) <= gr) continue;
        const up = g > 0;
        let a = k;
        while (a > 0 && k - a < 24 && (up ? at(a - 1, s) < at(a, s) : at(a - 1, s) > at(a, s))) a--;
        let b = k;
        while (b < n - 1 && b - k < 24 && (up ? at(b + 1, s) > at(b, s) : at(b + 1, s) < at(b, s))) b++;
        widths.push(b - a);
      }
    }
  };
  line(w, h, (k, s) => gray[s * w + k]!);
  line(h, w, (k, s) => gray[k * w + s]!);
  if (!widths.length) return { width: 0, edges: 0 };
  return { width: widths.reduce((a, b) => a + b, 0) / widths.length, edges: widths.length };
}

/**
 * Độ phức tạp theo nén: số byte sau khi nén deflate ảnh xám 8 bit / số byte gốc (0–1). Ảnh càng nhiều chi tiết
 * càng khó nén; tỉ số nén tương quan với độ phức tạp người cảm nhận (Machado và cộng sự 2015; Forsythe và cộng sự 2011).
 * Lọc "Sub" kiểu PNG trước khi nén để vùng chuyển sắc đều không bị coi là chi tiết.
 */
export function compressionRatio(gray: Float64Array, w: number, h: number): number {
  const raw = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    let prev = 0;
    for (let x = 0; x < w; x++) {
      const v = Math.round(gray[y * w + x]!) & 255;
      raw[y * w + x] = (v - prev) & 255;
      prev = v;
    }
  }
  return deflateSync(raw, { level: 9 }).length / raw.length;
}
