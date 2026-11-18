// Phép đo hình (check-image) trên ảnh tổng hợp: không cần trình duyệt, chạy cả trên CI Linux.
import { describe, expect, it } from "vitest";
import { contrastCredit, contrastOn, monoTest, palette } from "../src/image/color.js";
import { type Bitmap, makeBitmap, median } from "../src/image/pixels.js";
import { detectKind, grade, type Measures, scoreImage, scoreSet } from "../src/image/score.js";
import { detailLoss, inkBox, inkOf, margins, outsideCircle, perimetricComplexity, pixelFit, strokeWidth } from "../src/image/shape.js";
import { edgeWidth } from "../src/image/sharp.js";

/** Vẽ điểm (x, y) bằng màu rgba nếu `inside(x, y)`; độ phủ ở mép lấy mẫu 4×4 cho giống khử răng cưa. */
function paint(bm: Bitmap, rgba: [number, number, number, number], inside: (x: number, y: number) => boolean): Bitmap {
  for (let y = 0; y < bm.h; y++) {
    for (let x = 0; x < bm.w; x++) {
      let hit = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) hit++;
      if (!hit) continue;
      const a = (rgba[3] * hit) / 16;
      const i = (y * bm.w + x) * 4;
      const t = a / 255;
      const old = bm.data[i + 3]! / 255;
      const outA = t + old * (1 - t);
      for (let c = 0; c < 3; c++) bm.data[i + c] = outA ? (rgba[c]! * t + bm.data[i + c]! * old * (1 - t)) / outA : 0;
      bm.data[i + 3] = outA * 255;
    }
  }
  return bm;
}
const disk = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
const BLACK: [number, number, number, number] = [0, 0, 0, 255];

describe("ink: what is shape and what is background", () => {
  it("transparent image: coverage is alpha", () => {
    const bm = paint(makeBitmap(64, 64), BLACK, disk(32, 32, 20));
    expect(inkOf(bm).mode).toBe("alpha");
  });
  it("opaque image on a flat color: the border color is the background", () => {
    const bm = paint(makeBitmap(64, 64, [255, 255, 255, 255]), BLACK, disk(32, 32, 20));
    const ink = inkOf(bm);
    expect(ink.mode).toBe("plain");
    expect(ink.cov[32 * 64 + 32]).toBe(1);
    expect(ink.cov[0]).toBe(0);
  });
  it("edge-to-edge picture: no separate background", () => {
    const bm = makeBitmap(64, 64);
    for (let p = 0; p < 64 * 64; p++) bm.data.set([(p * 7) % 256, (p * 13) % 256, (p * 29) % 256, 255], p * 4);
    expect(inkOf(bm).mode).toBe("full");
  });
  it("a filled square with rounded transparent corners is still read by alpha, not as a black background", () => {
    const bm = paint(makeBitmap(64, 64), BLACK, (x, y) => rect(0, 0, 64, 64)(x, y) && !(x < 6 && y < 6 && (x - 6) ** 2 + (y - 6) ** 2 > 36));
    expect(inkOf(bm).mode).toBe("alpha");
  });
});

describe("detailLoss: detail finer than 1 px at a display size", () => {
  it("a 4-px line on a 512 reference is gone at 16 px (1 px there is 32 reference px), a 64-px bar is not", () => {
    const thin = paint(makeBitmap(512, 512), BLACK, rect(100, 50, 104, 460));
    const thick = paint(makeBitmap(512, 512), BLACK, rect(100, 50, 164, 460));
    expect(detailLoss(inkOf(thin), [16])[0]!.share).toBeGreaterThan(0.9);
    expect(detailLoss(inkOf(thick), [16])[0]!.share).toBe(0);
  });
  it("a sharp spike on a solid block only gets rounded: tips are not counted as lost detail", () => {
    // Khối vuông có một mũi nhọn tam giác thò lên.
    const spike = (x: number, y: number) => rect(100, 250, 400, 450)(x, y) || (y >= 100 && y < 250 && Math.abs(x - 250) < ((y - 100) / 150) * 40);
    const bm = paint(makeBitmap(512, 512), BLACK, spike);
    const [l] = detailLoss(inkOf(bm), [16]);
    expect(l!.ink).toBeGreaterThan(0); // diện tích mũi có bị gọt…
    expect(l!.share).toBe(0); // …nhưng không tính là chi tiết mất
  });
  it("a narrow gap between two blocks fills in", () => {
    const bm = paint(makeBitmap(512, 512), BLACK, (x, y) => rect(50, 100, 250, 400)(x, y) || rect(258, 100, 460, 400)(x, y));
    const [l] = detailLoss(inkOf(bm), [16]);
    expect(l!.gaps).toBeGreaterThan(0);
    expect(l!.share).toBeGreaterThan(0.1);
  });
});

describe("shape measures", () => {
  it("perimetric complexity of a disk is about 4π (Pelli: perimeter²/area)", () => {
    const pc = perimetricComplexity(inkOf(paint(makeBitmap(512, 512), BLACK, disk(256, 256, 200))));
    expect(pc).toBeGreaterThan(12.2);
    expect(pc).toBeLessThan(13.2);
  });
  it("stroke width reads a 40-px line as about 40, by area so a star's spikes do not pull it down", () => {
    const w = strokeWidth(inkOf(paint(makeBitmap(512, 512), BLACK, rect(100, 50, 140, 460))));
    expect(w).toBeGreaterThan(37);
    expect(w).toBeLessThan(43);
  });
  it("margins, fill and centering of an icon in its box", () => {
    const ink = inkOf(paint(makeBitmap(240, 240), BLACK, rect(20, 20, 220, 220)));
    const g = margins(ink, inkBox(ink)!);
    expect(g.min).toBeCloseTo(20 / 240, 2);
    expect(g.fill).toBeCloseTo(200 / 240, 2);
    expect(Math.abs(g.dx)).toBeLessThan(0.01);
  });
  it("maskable safe zone: share of artwork outside the 40% circle", () => {
    const inside = inkOf(paint(makeBitmap(200, 200), BLACK, disk(100, 100, 70)));
    const corner = inkOf(paint(makeBitmap(200, 200), BLACK, rect(0, 0, 60, 60)));
    expect(outsideCircle(inside)).toBe(0);
    expect(outsideCircle(corner)).toBeGreaterThan(0.8);
  });
  it("pixel grid: a 1-px line on a pixel row is crisp, the same line half a pixel down is two grey rows", () => {
    const crisp = paint(makeBitmap(24, 24), BLACK, rect(4, 10, 20, 11));
    const blurry = paint(makeBitmap(24, 24), BLACK, rect(4, 10.5, 20, 11.5));
    expect(pixelFit(inkOf(crisp)).share).toBe(0);
    expect(pixelFit(inkOf(blurry)).share).toBe(1);
  });
});

describe("color measures", () => {
  it("contrast credit: 1.5:1 is nothing, 3:1 (WCAG 1.4.11) is full", () => {
    expect(contrastCredit(1.5)).toBe(0);
    expect(contrastCredit(3)).toBe(1);
    expect(contrastCredit(2.25)).toBeCloseTo(0.5);
  });
  it("a black mark on a dark background: only the rim is measured, and it fails there", () => {
    const bm = paint(makeBitmap(128, 128), [20, 20, 20, 255], disk(64, 64, 50));
    const ink = inkOf(bm);
    expect(contrastOn(bm, ink, [255, 255, 255], "#ffffff")!.strong).toBeGreaterThan(0.95);
    expect(contrastOn(bm, ink, [18, 18, 18], "#121212")!.strong).toBe(0);
  });
  it("a small bitmap enlarged ×8 with smoothing: the blended edge band is skipped, a 6:1 red disk still passes", () => {
    // #c02020 trên trắng: 6,05:1 theo công thức WCAG. Mép pha màu tuyến tính rộng 8 điểm như khi phóng PNG 64 px lên 512.
    const red = [0xc0, 0x20, 0x20];
    const bm = makeBitmap(512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const t = Math.min(1, Math.max(0, (160 - Math.hypot(x + 0.5 - 256, y + 0.5 - 256)) / 8 + 0.5));
        bm.data.set([...red.map((c) => Math.round(255 + (c - 255) * t)), 255], (y * 512 + x) * 4);
      }
    }
    const ink = inkOf(bm);
    expect(contrastOn(bm, ink, [255, 255, 255], "#ffffff", 8)!.strong).toBeGreaterThan(0.8);
    expect(contrastOn(bm, ink, [255, 255, 255], "#ffffff")!.strong).toBeLessThan(0.5); // dải viền cũ nằm trọn trong mép pha
  });
  it("a white shape inside a dark disk does not count against the white page: it does not touch it", () => {
    // Hình tròn phủ 78% khung (chưa tới 90%): vẫn là hình trên nền trong suốt, không phải ô gạch.
    const bm = paint(paint(makeBitmap(128, 128), [30, 90, 60, 255], disk(64, 64, 50)), [255, 255, 255, 255], disk(64, 64, 20));
    expect(inkOf(bm).mode).toBe("alpha");
    expect(contrastOn(bm, inkOf(bm), [255, 255, 255], "#ffffff")!.strong).toBeGreaterThan(0.95);
  });
  it("an app-icon tile (rounded square, gradient fill, white glyph): the glyph is the figure, measured against the tile", () => {
    const bm = makeBitmap(256, 256);
    const tile = (x: number, y: number) => x >= 8 && x < 248 && y >= 8 && y < 248 && !(Math.min(x - 8, 247 - x) < 40 && Math.min(y - 8, 247 - y) < 40 && Math.hypot(Math.min(x - 8, 247 - x) - 40, Math.min(y - 8, 247 - y) - 40) > 40);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) if (tile(x + 0.5, y + 0.5)) bm.data.set([0, 90 + Math.round(y / 4), 160, 255], (y * 256 + x) * 4);
    paint(bm, [255, 255, 255, 255], disk(128, 128, 50));
    const ink = inkOf(bm);
    expect(ink.mode).toBe("tile");
    expect(ink.cov[128 * 256 + 128]).toBeGreaterThan(0.9); // hình trắng
    expect(ink.cov[30 * 256 + 128]).toBeLessThan(0.1); // nền ô chuyển sắc
    const g = margins(ink, inkBox(ink)!);
    expect(g.fill).toBeLessThan(0.5); // đo hình bên trong, không phải cả ô
    expect(contrastOn(bm, ink, [18, 18, 18], "#121212")!.bg).toBe("own tile");
  });
  it("palette counts flat colors, and a gradient is not a pile of colors", () => {
    const flat = paint(paint(makeBitmap(200, 100), [214, 48, 49, 255], rect(0, 0, 100, 100)), [0, 168, 107, 255], rect(100, 0, 200, 100));
    expect(palette(flat, inkOf(flat)).swatches.length).toBe(2);
    // Dải xám đều theo cảm nhận (dải đỏ→vàng có một quãng gần như phẳng ở đầu, vì kênh lục nhỏ gần như không đổi độ sáng).
    const grad = makeBitmap(200, 100);
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 200; x++) {
        const v = Math.round(30 + (x / 199) * 200);
        grad.data.set([v, v, v, 255], (y * 200 + x) * 4);
      }
    }
    const pal = palette(grad, { ...inkOf(grad), mode: "alpha", cov: new Float32Array(200 * 100).fill(1) });
    expect(pal.swatches.length).toBe(0);
    expect(pal.blend).toBeGreaterThan(0.9);
  });
  it("grayscale test: red beside green of the same lightness merges, black beside white does not", () => {
    // #d63031 và một màu xanh lá cùng độ chói.
    const same = paint(paint(makeBitmap(200, 100), [214, 48, 49, 255], rect(0, 0, 100, 100)), [0, 128, 60, 255], rect(100, 0, 200, 100));
    const apart = paint(paint(makeBitmap(200, 100), [0, 0, 0, 255], rect(0, 0, 100, 100)), [255, 255, 255, 255], rect(100, 0, 200, 100));
    const m1 = monoTest(same, inkOf(same), palette(same, inkOf(same)));
    const m2 = monoTest(apart, inkOf(apart), palette(apart, inkOf(apart)));
    expect(m1.credit).toBeLessThan(0.2);
    expect(m2.credit).toBe(1);
  });
});

describe("edgeWidth: blur (Marziliano 2002)", () => {
  const step = (ramp: number) => {
    const g = new Float64Array(100 * 40);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 100; x++) g[y * 100 + x] = Math.max(0, Math.min(255, ((x - 50) / ramp + 0.5) * 255));
    return edgeWidth(g, 100, 40);
  };
  it("a hard edge is 1–2 px wide, a soft one as wide as its ramp", () => {
    expect(step(1).width).toBeLessThanOrEqual(2);
    expect(step(8).width).toBeGreaterThan(7);
  });
});

const base = (over: Partial<Measures>): Measures => ({
  kind: "icon", format: "svg", bytes: 300, nw: 24, nh: 24, vector: true, inkMode: "alpha", visible: true, loss: [], compression: 0.02,
  colors: 1, swatches: [{ hex: "#000000", share: 1 }], blend: 0, mono: { pairs: [] }, colorfulness: 0, native: 24, stroke: 2,
  svg: { stretch: false, elements: 3, paths: 2, commands: 10, textCount: 0, texts: [], rasters: 0, external: [], scripts: 0, handlers: [], jsLinks: 0, foreign: 0, colors: [], currentColor: true, strokeWidths: ["2"], title: false, longNumbers: 0, numbers: 20, animated: false, viewBox: "0 0 24 24" },
  ...over,
});

describe("scoreImage", () => {
  it("a clean currentColor icon scores 100", () => {
    const s = scoreImage(base({ loss: [{ size: 24, ink: 0, gaps: 0, share: 0, lost: new Uint8Array(0) }], margins: { min: 0.083, left: 0.083, right: 0.083, top: 0.083, bottom: 0.083, fill: 0.83, dx: 0, dy: 0 }, pc: 150, pixelFit: { crisp: 80, blurry: 0, share: 0 } }));
    expect(s.score).toBe(100);
    expect(s.findings).toEqual([]);
  });
  it("script in an SVG is hard and caps the score at 49", () => {
    const s = scoreImage(base({ svg: { ...base({}).svg!, scripts: 1, handlers: ["onload"] } }));
    expect(s.findings.find((f) => f.check === "svg-unsafe")?.gate).toBe("hard");
    expect(s.score).toBeLessThanOrEqual(49);
  });
  it("an icon mostly finer than 1 px at its own size is hard", () => {
    const s = scoreImage(base({ loss: [{ size: 24, ink: 1, gaps: 0, share: 1, lost: new Uint8Array(0) }, { size: 16, ink: 1, gaps: 0, share: 1, lost: new Uint8Array(0) }] }));
    expect(s.findings.find((f) => f.check === "small-size")?.gate).toBe("hard");
  });
  it("logos are exempt from WCAG contrast: invisible is soft for a logo, hard for an icon", () => {
    const dim = { bg: "#ffffff", credit: 0.05, strong: 0.02, median: 1.1 };
    const logo = scoreImage(base({ kind: "logo", svg: { ...base({}).svg!, currentColor: false, colors: ["#eeeeee"] }, light: dim, dark: dim }));
    const icon = scoreImage(base({ svg: { ...base({}).svg!, currentColor: false, colors: ["#eeeeee"] }, light: dim, dark: dim }));
    expect(logo.findings.find((f) => f.check === "contrast")?.gate).toBe("soft");
    expect(icon.findings.find((f) => f.check === "contrast")?.gate).toBe("hard");
  });
  it("a raster logo is told to ship SVG; a bitmap smaller than its display size is hard", () => {
    const { svg: _svg, ...raster } = base({ kind: "logo", format: "png", vector: false, nw: 60, nh: 30, display: 48 });
    void _svg;
    const s = scoreImage(raster);
    expect(s.findings.map((f) => f.check)).toEqual(expect.arrayContaining(["vector", "resolution"]));
    expect(s.findings.find((f) => f.check === "resolution")?.gate).toBe("hard");
  });
  it("grades", () => {
    expect([grade(90), grade(75), grade(55), grade(20)]).toEqual(["good", "fair", "weak", "poor"]);
  });
});

describe("scoreSet: one icon among the others", () => {
  it("flags a thin and a filled icon in a 2-px outline set", () => {
    const m = (file: string, stroke: number, coverage = 0.25) => ({ file, stroke, coverage, fill: 0.85, native: 24 });
    const r = scoreSet([m("a", 2), m("b", 2), m("c", 2.05), m("d", 1), m("e", 4.5, 0.3)], median);
    expect(r.outliers.map((o) => o.file)).toEqual(["d", "e"]);
    expect(r.outliers[1]!.detail).toMatch(/filled among outlines/);
  });
});

describe("detectKind", () => {
  const f = { format: "svg", vector: true, nw: 150, nh: 150, inkMode: "alpha" as const, colors: 1, blend: 0 };
  it("file name first, then size and colors", () => {
    expect(detectKind("brand/logo-dark.svg", f).kind).toBe("logo");
    expect(detectKind("x/favicon.png", f).kind).toBe("icon");
    expect(detectKind("x/minh-hoa-trang-chu.png", f).kind).toBe("illustration");
    expect(detectKind("x/a.svg", { ...f, viewW: 24, viewH: 24 }).kind).toBe("icon");
    expect(detectKind("x/a.png", { ...f, vector: false, nw: 1200, nh: 800, inkMode: "full" }).kind).toBe("illustration");
    expect(detectKind("x/a.svg", { ...f, viewW: 400, viewH: 120 }).kind).toBe("logo");
  });
});
