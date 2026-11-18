// Chấm điểm một hình từ số đo: mỗi tiêu chí một điểm 0–100 theo đường cong ghi rõ, điểm chung là trung bình có trọng số
// theo loại hình (logo, icon, minh hoạ). Phát hiện cứng/mềm suy ra từ cùng các số đo đó. Ngưỡng và nguồn: docs/tieu-chi.md.
import { colorfulnessLabel, type Mono, type OnBg } from "./color.js";
import { clamp01, pct } from "./pixels.js";
import type { SvgFacts } from "./render.js";
import type { DetailLoss, InkMode, Margins, PixelFit } from "./shape.js";
import type { EdgeWidth } from "./sharp.js";

export type Kind = "logo" | "icon" | "illustration";
export type Gate = "hard" | "soft";
export const KINDS: Kind[] = ["logo", "icon", "illustration"];

export interface Finding {
  gate: Gate;
  check: string;
  detail: string;
}
export interface Dim {
  id: string;
  score: number;
  weight: number;
  measured: string;
}

export interface Measures {
  kind: Kind;
  format: string;
  bytes: number;
  nw: number;
  nh: number;
  vector: boolean;
  svg?: SvgFacts;
  decodeError?: string;
  inkMode: InkMode;
  /** Có gì để thấy không (độ phủ ≥ 0,5 ở đâu đó). */
  visible: boolean;
  /** Chi tiết mất theo cỡ (cạnh ngắn). */
  loss: DetailLoss[];
  /** Cỡ gốc của icon (px) và độ dày nét ở cỡ đó (px). */
  native?: number;
  stroke?: number;
  margins?: Margins;
  coverage?: number;
  /** Độ phức tạp chu vi (Pelli). */
  pc?: number;
  compression: number;
  symmetry?: number;
  pixelFit?: PixelFit;
  colors: number;
  swatches: Array<{ hex: string; share: number }>;
  blend: number;
  light?: OnBg;
  dark?: OnBg;
  mono: Mono;
  colorfulness: number;
  edge?: EdgeWidth;
  /** Cỡ hiển thị dự kiến (px, cạnh dài; logo: chiều cao), từ --display. */
  display?: number;
  /** Icon maskable: phần hình nằm ngoài vòng an toàn (bán kính 40% cạnh ngắn). */
  maskOutside?: number;
  /** Trọng tâm khối mực lệch khỏi tâm (phần của cạnh), DCM của Hübner & Fillinger. */
  dcm?: number;
}

/**
 * Trọng số theo loại (quy ước design-kit, docs/tieu-chi.md). Logo không chấm độ phức tạp: nghiên cứu không cho mức tối
 * ưu (Henderson & Cote 1998 chỉ nói "vừa phải"; logo đơn giản thắng ngắn hạn, phức tạp thắng dài hạn), nên con số chỉ
 * được ghi để người duyệt xem.
 */
export const WEIGHTS: Record<Kind, Record<string, number>> = {
  logo: { small: 30, contrast: 20, mono: 20, palette: 5, file: 25 },
  icon: { small: 20, pixel: 15, frame: 15, contrast: 10, color: 10, simplicity: 10, file: 20 },
  illustration: { sharpness: 30, resolution: 15, contrast: 15, mono: 10, file: 30 },
};

/** Ngân sách dung lượng (byte) trước khi bị nhắc: icon SVG, logo SVG, mọi hình điểm, minh hoạ SVG. */
export const BUDGET = { iconSvg: 5_000, logoSvg: 50_000, raster: 500_000, illustrationSvg: 500_000 };

/** Ngưỡng điểm → nhãn. */
export function grade(score: number): string {
  return score >= 85 ? "good" : score >= 70 ? "fair" : score >= 50 ? "weak" : "poor";
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const ratioTxt = (x: number) => `${(Math.floor(x * 100) / 100).toFixed(2)}:1`;
const lossAt = (m: Measures, size: number) => m.loss.find((l) => l.size === size);

/** Điểm chi tiết mất: 0% → 1, `zero` → 0. */
const lossCredit = (l: number | undefined, zero: number) => (l === undefined ? 1 : clamp01(1 - l / zero));

export interface Scored {
  dims: Dim[];
  findings: Finding[];
  notes: string[];
  score: number;
  grade: string;
}

export function scoreImage(m: Measures): Scored {
  const findings: Finding[] = [];
  const notes: string[] = [];
  const dims: Dim[] = [];
  const W = WEIGHTS[m.kind];
  const dim = (id: string, credit: number, measured: string) => {
    if (W[id] !== undefined) dims.push({ id, score: Math.round(100 * clamp01(credit)), weight: W[id]!, measured });
  };
  const hard = (check: string, detail: string) => findings.push({ gate: "hard", check, detail });
  const soft = (check: string, detail: string) => findings.push({ gate: "soft", check, detail });

  if (m.decodeError) {
    hard("decode", `the browser cannot draw this file (${m.decodeError}); nobody will see it either`);
    return { dims: [], findings, notes, score: 0, grade: grade(0) };
  }
  if (!m.visible) {
    hard("empty", "nothing visible: the image is fully transparent or one flat color");
    return { dims: [], findings, notes, score: 0, grade: grade(0) };
  }

  // ---- Tệp: định dạng, vệ sinh SVG, dung lượng ----
  let file = 1;
  const fileWhy: string[] = [];
  const s = m.svg;
  if (s) {
    if (s.parseError) {
      hard("svg-parse", `not well-formed XML: ${s.parseError}`);
      file = 0;
      fileWhy.push("not well-formed");
    }
    if (s.scripts || s.handlers.length || s.jsLinks) {
      fileWhy.push("script");
      hard("svg-unsafe", `${[s.scripts && `${s.scripts} <script>`, s.handlers.length && `event attributes ${s.handlers.join(", ")}`, s.jsLinks && `${s.jsLinks} javascript: link(s)`].filter(Boolean).join(", ")}: they run when the SVG is inlined in a page; remove them (an image needs no script)`);
      file = 0;
    }
    if (s.textCount) {
      soft("svg-text", `${s.textCount} <text> element(s) (${s.texts.map((t) => `"${t}"`).join(", ")}): drawn with whatever font the viewer has; as <img> or CSS background no web font loads. Convert text to outlines`);
      file -= 0.3;
      fileWhy.push("live text");
    }
    if (s.rasters) {
      soft("svg-raster", `${s.rasters} embedded bitmap(s) (<image href="data:…">): a vector file that blurs when scaled and weighs more; trace it or ship the bitmap as its own file`);
      file -= 0.3;
      fileWhy.push("embedded bitmap");
    }
    if (s.external.length) {
      soft("svg-external", `refers to other files (${s.external.join(", ")}): nothing outside the file loads when the SVG is an <img> or CSS background, so parts go missing`);
      file -= 0.3;
      fileWhy.push("external references");
    }
    if (!s.viewBox && !s.parseError) {
      soft("svg-viewbox", `no viewBox${s.width ? ` (width="${s.width}" height="${s.height ?? "?"}")` : ""}: as <img> it scales, but inlined as <svg> and sized with CSS it is cropped instead of shrunk. Add viewBox="0 0 W H"`);
      file -= 0.2;
      fileWhy.push("no viewBox");
    }
    if (s.stretch) {
      soft("svg-stretch", `preserveAspectRatio="none": the drawing is distorted whenever its box has another shape`);
      file -= 0.1;
      fileWhy.push("stretches");
    }
    if (s.foreign) notes.push(`${s.foreign} <foreignObject>: HTML inside SVG, which many tools (Figma, Illustrator, PDF) cannot draw`);
    const budget = m.kind === "icon" ? BUDGET.iconSvg : m.kind === "logo" ? BUDGET.logoSvg : BUDGET.illustrationSvg;
    if (m.bytes > budget) {
      soft("weight", `${kb(m.bytes)} SVG (budget ${kb(budget)} for a${m.kind === "icon" ? "n icon" : m.kind === "logo" ? " logo" : "n illustration"})${s.numbers && s.longNumbers / s.numbers > 0.3 ? `; ${pct(s.longNumbers / s.numbers)} of the numbers carry 4+ decimals: run svgo` : ""}`);
      file -= 0.15;
      fileWhy.push("heavy");
    } else if (s.numbers > 200 && s.longNumbers / s.numbers > 0.5) {
      notes.push(`${pct(s.longNumbers / s.numbers)} of path numbers carry 4+ decimals: svgo would shrink the file`);
    }
  } else {
    // Icon ứng dụng, favicon, icon thương hiệu (Home Assistant brands) là ảnh điểm vuông ở cỡ nền tảng đòi: chỉ ghi chú.
    const platformIcon = m.kind === "icon" && m.nw === m.nh && m.nw >= 180;
    if (platformIcon) notes.push(`bitmap icon at an app-icon size (${m.nw}×${m.nh}): right where a platform asks for PNG (app stores, PWA manifest, Home Assistant brands); keep the SVG source for every other use`);
    else if (m.kind !== "illustration") {
      soft("vector", `${m.format.toUpperCase()} ${m.nw}×${m.nh}: a ${m.kind} as a bitmap blurs when scaled up and cannot follow the text color; deliver SVG (a PNG is right only where a platform asks for one: favicon, app store, PWA manifest)`);
      file -= m.kind === "logo" ? 0.4 : 0.3;
      fileWhy.push("bitmap");
    }
    if (m.format === "jpeg" && m.colors && m.blend < 0.2 && m.swatches.reduce((a, b) => a + b.share, 0) >= 0.8) {
      soft("format", `flat colors (${m.colors}) saved as JPEG: ringing around edges and no transparency; use PNG, WebP lossless or SVG`);
      file -= 0.2;
      fileWhy.push("JPEG for flat art");
    } else if (m.format === "png" && m.kind === "illustration" && m.blend > 0.5 && m.bytes > 200_000) {
      soft("format", `photo-like art as PNG (${kb(m.bytes)}): WebP or AVIF is usually 3–5× smaller at the same look`);
      file -= 0.15;
      fileWhy.push("PNG for photo-like art");
    }
    // Chrome DevTools nhắm khoảng 1/6 byte mỗi điểm ảnh (AVIF ~12:1); ảnh nặng hơn 1 byte/điểm còn nén được nhiều.
    const bpp = m.bytes / Math.max(1, m.nw * m.nh);
    if (m.bytes > BUDGET.raster || (m.bytes > 100_000 && bpp > 1)) {
      soft("weight", `${kb(m.bytes)}, ${bpp.toFixed(2)} bytes per pixel (budget ${kb(BUDGET.raster)}; modern formats reach about 1/6 byte per pixel): compress, use WebP/AVIF, or resize to the size it is shown at ×2`);
      file -= m.bytes > 3 * BUDGET.raster ? 0.4 : 0.2;
      fileWhy.push("heavy");
    }
  }
  if (findings.some((f) => f.gate === "hard" && f.check.startsWith("svg"))) file = 0;
  dim("file", file, `${m.format.toUpperCase()} ${kb(m.bytes)}${m.vector ? "" : ` ${m.nw}×${m.nh}`}${fileWhy.length ? `: ${fileWhy.join(", ")}` : ", clean"}`);

  // ---- Thu nhỏ: chi tiết mảnh hơn 1 px ở cỡ nhỏ ----
  // Đo theo đường viền (viền ngoài và ranh giới màu) thuộc chi tiết mảnh hơn 1 px; mũi nhọn không tính (thu nhỏ chỉ
  // làm tròn đi). Hiệu chỉnh 18/11/2026 trên 272 icon Lucide (nét 2 px ở 24): 99% dưới 1% ở cả 24 và 16 px, cao nhất
  // 4,6%. Nét 0,5 px ở 24: 100%. Nét 1 px ở 24: 0% ở 24, 100% ở 16.
  if (m.kind === "logo") {
    const l32 = lossAt(m, 32)?.share;
    const l16 = lossAt(m, 16)?.share;
    const side = m.nw >= m.nh * 1.5 ? "tall" : "across";
    dim("small", 0.6 * lossCredit(l32, 0.4) + 0.4 * lossCredit(l16, 0.6), `outline in detail finer than 1 px: ${pct(l32 ?? 0)} at 32 px, ${pct(l16 ?? 0)} at 16 px ${side}`);
    if ((l32 ?? 0) >= 0.1) soft("small-size", `${pct(l32!)} of the outline belongs to detail finer than 1 px when the logo is 32 px ${side} (thin strokes, small dots, narrow gaps; the NHS sets 30 px as the smallest on-screen logo): it smears in a header or a tab; thicken, or make a simplified mark for small sizes`);
    else if ((l16 ?? 0) >= 0.25) notes.push(`at 16 px (favicon) ${pct(l16!)} of the outline is detail finer than 1 px: use a simplified mark for the favicon`);
  } else if (m.kind === "icon") {
    const n = m.native ?? 24;
    const ln = lossAt(m, n)?.share;
    const l16 = n > 16 ? lossAt(m, 16)?.share : undefined;
    dim("small", 0.5 * lossCredit(ln, 0.3) + 0.5 * lossCredit(l16 ?? ln, 0.5), `outline in detail finer than 1 px: ${pct(ln ?? 0)} at ${n} px${l16 !== undefined ? `, ${pct(l16)} at 16 px` : ""} (Lucide: 99% under 1%); stroke or shape thickness ${r1(m.stroke ?? 0)} px at ${n} px`);
    if ((ln ?? 0) >= 0.5) hard("small-size", `${pct(ln!)} of the outline is detail finer than 1 px at the icon's own size (${n} px): it renders as grey fuzz. Strokes ≥ 1 px at ${n} px (Material: 2 px at 24)`);
    else if ((ln ?? 0) >= 0.05) soft("small-size", `${pct(ln!)} of the outline is detail finer than 1 px at ${n} px (stroke ${r1(m.stroke ?? 0)} px; Lucide icons: 99% under 1%): thin parts turn grey`);
    else if ((l16 ?? 0) >= 0.15) soft("small-size", `${pct(l16!)} of the outline is detail finer than 1 px at 16 px${(m.stroke ?? 0) < 3 ? ` (stroke ${r1(((m.stroke ?? 0) * 16) / n)} px there)` : ""}: draw a 16 px variant, or thicken strokes and widen gaps`);
  }

  // ---- Lưới điểm (icon ở cỡ gốc) ----
  if (m.kind === "icon" && m.pixelFit) {
    const pf = m.pixelFit;
    const n = m.native ?? 24;
    const counts = pf.blurry >= n;
    dim("pixel", counts ? 1 - pf.share : 1, `${pf.blurry} of ${pf.crisp + pf.blurry} straight-edge pixels fall between pixels at ${n} px${counts || !pf.blurry ? "" : " (too few to count)"}`);
    if (counts && pf.share > 0.3) soft("pixel-grid", `${pct(pf.share)} of straight edges sit between two pixels at ${n} px and render as 2-pixel grey lines: snap to the grid (odd stroke widths on .5 coordinates, even on whole numbers)`);
  }

  // ---- Khung (icon): lề, độ đầy, căn giữa, hình vuông ----
  if (m.kind === "icon" && m.margins) {
    const g = m.margins;
    const n = m.native ?? 24;
    let f = 1;
    const why: string[] = [];
    if (g.min < 0.02) {
      soft("frame", `the shape touches the edge of its box: no room for the stroke cap or a focus ring; keep ≥ 1 px of ${n} free (Material keeps 2 of 24)`);
      f -= 0.4;
      why.push("touches edge");
    }
    if (g.fill < 0.5) {
      soft("frame", `the shape fills only ${pct(g.fill)} of its box: beside other icons it looks smaller (Material's live area is 20 of 24, 83%)`);
      f -= 0.4;
      why.push(`fills ${pct(g.fill)}`);
    }
    const off = Math.max(Math.abs(g.dx), Math.abs(g.dy));
    if (off > 0.0625) {
      soft("frame", `off-center by ${r1(off * n)} px at ${n} px (${Math.abs(g.dx) >= Math.abs(g.dy) ? (g.dx > 0 ? "left" : "right") : g.dy > 0 ? "up" : "down"}): fine for a deliberately asymmetric glyph, otherwise center it`);
      f -= 0.3;
      why.push(`off-center ${r1(off * n)} px`);
    }
    const aspect = m.nw / Math.max(1, m.nh);
    if (aspect < 0.9 || aspect > 1.1) {
      soft("frame", `box is ${m.nw}×${m.nh}: icons sit in a square box so they line up and swap without layout shifts`);
      f -= 0.2;
      why.push("not square");
    }
    if (m.maskOutside !== undefined && m.maskOutside > 0.01) {
      soft("frame", `maskable icon: ${pct(m.maskOutside)} of the artwork lies outside the safe circle (radius 40% of the shorter side, W3C manifest); launchers crop it to a circle or squircle`);
      f -= 0.3;
      why.push("outside maskable safe zone");
    }
    dim("frame", f, `margin ${r1(g.min * n)} px, fills ${pct(g.fill)}, center offset ${r1(off * n)} px${why.length ? "" : ", ok"}`);
  }

  // ---- Tương phản trên nền ----
  const themed = m.kind === "icon" && !!s?.currentColor && s.colors.length === 0;
  if (themed) dim("contrast", 1, "currentColor: follows the text color, so it inherits the text's contrast");
  else if (m.inkMode === "full") {
    if (W["contrast"] !== undefined) notes.push("contrast: edge-to-edge image, no separate background to measure against");
  } else {
    const on = [m.light, m.dark].filter((x): x is OnBg => !!x);
    if (on.length) {
      const own = on[0]!.bg.startsWith("own");
      const best = Math.max(...on.map((o) => o.credit));
      const worst = Math.min(...on.map((o) => o.credit));
      const credit = own ? on[0]!.credit : 0.6 * best + 0.4 * worst;
      dim("contrast", credit, on.filter((o, i) => !own || i === 0).map((o) => `${pct(o.strong)} of the outline ≥ 3:1 on ${o.bg} (median ${ratioTxt(o.median)})`).join("; "));
      // WCAG 1.4.11: icon một màu là đối tượng đồ hoạ, phải đạt 3:1; logo được miễn, nên với logo chỉ là cổng mềm.
      if (best < 0.3) {
        const at = pct(Math.max(...on.map((o) => o.strong)));
        if (m.kind === "logo") soft("contrast", `the logo barely stands out from ${own ? "its own background" : "any background"}: at best ${at} of its outline reaches 3:1 (logos are exempt from WCAG contrast, but nobody can recognise what they cannot see)`);
        else hard("contrast", `the shape barely stands out: at best ${at} of its outline reaches 3:1 (WCAG 1.4.11 non-text contrast)`);
      } else if (!own) {
        // Icon một màu tô cứng: lời khuyên currentColor đã nằm ở phát hiện `color`, không nhắc hai lần.
        const advisedElsewhere = m.kind === "icon" && m.colors <= 1 && !!s && !s.currentColor && s.colors.length > 0;
        for (const o of advisedElsewhere ? [] : on) {
          if (o.credit < 0.5) {
            const dark = o === m.dark;
            soft("contrast", `on ${dark ? "a dark" : "a light"} background (${o.bg}) only ${pct(o.strong)} of the outline reaches 3:1: ${m.kind === "icon" ? "use currentColor so it follows the text color" : `ship a ${dark ? "reversed (light)" : "dark"} version for ${dark ? "dark mode and dark" : "light"} backgrounds`}`);
          }
        }
      }
    }
  }

  // ---- Đen trắng ----
  if (W["mono"] !== undefined) {
    if (m.mono.credit === undefined) dim("mono", 1, m.colors <= 1 ? "one color: nothing to merge in grayscale" : "colors do not touch: nothing to merge in grayscale");
    else if (m.kind === "illustration" && m.blend > 0.5) notes.push("grayscale test: skipped, the art is mostly gradients or texture");
    else {
      const worst = m.mono.pairs.filter((p) => p.weight >= 0.05).sort((a, b) => a.ratio - b.ratio)[0];
      dim("mono", m.mono.credit, `${m.mono.pairs.length} touching color pair(s)${worst ? `, weakest ${worst.a}/${worst.b} at ${ratioTxt(worst.ratio)} in grayscale` : ""}`);
      if (worst && (m.mono.credit < 0.5 || worst.ratio < 1.25)) soft("mono", `${worst.a} and ${worst.b} touch over ${pct(worst.weight)} of the color borders but differ only ${ratioTxt(worst.ratio)} in lightness: in one-color print, grayscale and for color-blind viewers they merge; separate them by lightness or with a gap`);
    }
  }

  // ---- Bảng màu ----
  if (m.kind === "logo") {
    let c = m.colors <= 3 ? 1 : m.colors === 4 ? 0.75 : m.colors === 5 ? 0.5 : 0.25;
    if (m.blend > 0.2) c -= 0.3;
    dim("palette", c, `${m.colors} color(s)${m.swatches.length ? ` (${m.swatches.slice(0, 5).map((w) => w.hex).join(" ")})` : ""}${m.blend > 0.05 ? `, ${pct(m.blend)} gradient/texture` : ""}`);
    if (m.colors > 4) soft("palette", `${m.colors} colors: every extra color is another ink in print and another thing to get wrong on merch; most marks work in 1–3`);
    if (m.blend > 0.3) soft("palette", `${pct(m.blend)} of the shape is gradient or texture: it has no clean one-color version (embroidery, stamps, fax, a single-color favicon)`);
  } else if (m.kind === "icon") {
    // Chỉ glyph nền trong suốt (icon giao diện) mới nên theo màu chữ; icon ứng dụng, favicon có nền riêng giữ màu thương hiệu.
    const hardColored = m.inkMode === "alpha" && m.colors <= 1 && !!s && !s.currentColor && s.colors.length > 0;
    let c = hardColored ? 0.7 : m.colors <= 1 ? 1 : m.colors === 2 ? 0.85 : m.colors === 3 ? 0.7 : 0.5;
    if (m.blend > 0.2) c -= 0.3;
    dim("color", c, `${m.colors} color(s)${s?.currentColor ? ", currentColor" : s?.colors.length ? `, fixed ${s.colors.slice(0, 3).join(" ")}` : ""}${m.inkMode === "plain" ? " on its own background" : ""}`);
    if (hardColored) soft("color", `one-color icon painted ${s!.colors[0]}: use fill/stroke="currentColor" so it follows the text color and dark mode`);
    if (m.colors > 3) soft("color", `${m.colors} colors in an icon: at 16–24 px only the outline reads; system icons use one solid color (Fluent, Carbon), two for duotone`);
  }

  // ---- Độ phức tạp ----
  // Pelli 2006 (chu vi²/diện tích, không chia 4π): chữ Helvetica 67, Courier 100, chữ Hán 199, chữ Künstler 451; hiệu
  // suất nhận dạng tỉ lệ nghịch với con số này. Icon Lucide: trung vị 158, 99% dưới 230.
  if (m.pc !== undefined) {
    const anchors = "Helvetica letters 67, Chinese characters 199, Künstler script 451";
    if (W["simplicity"] !== undefined) {
      dim("simplicity", 1 - (m.pc - 230) / (600 - 230), `perimetric complexity ${Math.round(m.pc)} (Lucide icons median 158; ${anchors})`);
      if (m.pc > 400) soft("complexity", `perimetric complexity ${Math.round(m.pc)}, near ornate script (Künstler 451) and far above typical icons (Lucide: 99% under 230): identification gets harder as this number grows; simplify or thicken`);
    } else if (m.kind === "logo") {
      notes.push(`perimetric complexity ${Math.round(m.pc)} (${anchors}); not scored for logos: research finds no best level (simple marks win at first sight, richer ones with repeated exposure)`);
    }
  }
  if (m.dcm !== undefined && m.kind === "logo") notes.push(`balance: the visual weight sits ${pct(m.dcm)} of the size away from the middle (DCM; predicts how balanced it looks, barely how much it is liked)`);

  // ---- Minh hoạ: độ sắc, độ phân giải ----
  if (m.kind === "illustration") {
    if (m.vector) dim("sharpness", 1, "vector: sharp at every size");
    else if (m.edge && m.edge.edges >= 50) {
      const w = m.edge.width;
      // Mốc thử 18/11/2026: cùng một cảnh xuất thẳng 2,0 px; phóng to ×1,5 5,6; ×2 5,8; ×3 10,4; ×4 12,3.
      dim("sharpness", 1 - (w - 2.5) / (6 - 2.5), `strongest edges ${r1(w)} px wide (crisp art 1–2 px)`);
      if (w > 3) soft("sharpness", `strongest edges are ${r1(w)} px wide (crisp art 1–2 px): it was enlarged from a smaller file or blurred; export from a larger source instead of enlarging`);
    } else notes.push("sharpness: too few strong edges to measure");
  }
  // Độ phân giải (Lighthouse): ảnh hiện lớn hơn 64 px cần ≥ 0,75 × DPR 2 = 1,5× cỡ hiển thị; icon ≤ 64 px cần đủ 2×.
  if (m.display) {
    const have = m.kind === "logo" ? m.nh : Math.max(m.nw, m.nh);
    const factor = m.display <= 64 ? 2 : 1.5;
    const need = Math.ceil(factor * m.display);
    if (m.vector) dim("resolution", 1, `vector at ${m.display} px`);
    else {
      dim("resolution", have >= need ? 1 : have >= m.display ? 0.6 : 0, `${have} px for ${m.display} px shown (2× screens need ${need})`);
      if (have < m.display) hard("resolution", `${have} px for ${m.display} px shown: enlarged even on ordinary screens`);
      else if (have < need) soft("resolution", `${have} px for ${m.display} px shown: soft on 2× (retina) screens, which need ${need} (Lighthouse: ${factor}× for ${m.display <= 64 ? "icons up to 64 px" : "images over 64 px"})`);
    }
  }

  if (m.symmetry !== undefined && m.kind !== "illustration") notes.push(`mirror symmetry ${m.symmetry.toFixed(2)} (1 = left and right match)`);
  notes.push(`colorfulness ${Math.round(m.colorfulness)}: ${colorfulnessLabel(m.colorfulness)} (Hasler–Süsstrunk M; describes the image, does not predict liking)`);

  const wsum = dims.reduce((a, d) => a + d.weight, 0);
  let score = wsum ? Math.round(dims.reduce((a, d) => a + d.score * d.weight, 0) / wsum) : 0;
  // Lỗi cứng: điểm không vượt quá 49 (hỏng thì không thể "khá").
  if (findings.some((f) => f.gate === "hard")) score = Math.min(score, 49);
  return { dims, findings, notes, score, grade: grade(score) };
}

export function kb(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

// ---- Bộ icon: so từng icon với trung vị của cả bộ ----

export interface SetMember {
  file: string;
  stroke: number;
  coverage: number;
  fill: number;
  native: number;
}
export interface SetResult {
  score: number;
  stroke: number;
  coverage: number;
  fill: number;
  outliers: Array<{ file: string; detail: string }>;
}

export function scoreSet(members: SetMember[], median: (xs: number[]) => number): SetResult {
  const ms = median(members.map((m) => m.stroke));
  const mc = median(members.map((m) => m.coverage));
  const mf = median(members.map((m) => m.fill));
  const natives = new Map<number, number>();
  for (const m of members) natives.set(m.native, (natives.get(m.native) ?? 0) + 1);
  const mainNative = [...natives.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const outliers: SetResult["outliers"] = [];
  let credit = 0;
  for (const m of members) {
    let c = 1;
    const why: string[] = [];
    if (Math.abs(m.stroke - ms) > Math.max(0.25 * ms, 0.3)) {
      why.push(`stroke ${r1(m.stroke)} px vs ${r1(ms)} px in the set${m.stroke > 2 * ms ? " (filled among outlines?)" : ""}`);
      c -= 0.4;
    }
    // Độ đậm tự nhiên dao động nhiều (Lucide: 0,46–1,37 lần trung vị ở phân vị 5–95): chỉ báo khi lệch quá 0,4–2 lần.
    if (mc > 0 && (m.coverage / mc > 2 || m.coverage / mc < 0.4)) {
      why.push(`${m.coverage > mc ? "heavier" : "lighter"}: ${pct(m.coverage)} of the box inked vs ${pct(mc)}`);
      c -= 0.3;
    }
    if (Math.abs(m.fill - mf) > 0.2) {
      why.push(`${m.fill > mf ? "larger" : "smaller"}: fills ${pct(m.fill)} of the box vs ${pct(mf)}`);
      c -= 0.3;
    }
    if (m.native !== mainNative) {
      why.push(`drawn on a ${m.native} px grid, the set on ${mainNative} px`);
      c -= 0.2;
    }
    credit += clamp01(c);
    if (why.length) outliers.push({ file: m.file, detail: why.join("; ") });
  }
  return { score: Math.round((100 * credit) / members.length), stroke: ms, coverage: mc, fill: mf, outliers };
}

// ---- Nhận loại hình ----

export function detectKind(file: string, f: { format: string; vector: boolean; nw: number; nh: number; inkMode: InkMode; colors: number; blend: number; viewW?: number; viewH?: number }): { kind: Kind; why: string } {
  const name = file.replace(/\\/g, "/").split("/").pop()!.toLowerCase();
  if (/logo|brand|wordmark|lockup|logotype|nhan-hieu|thuong-hieu/.test(name)) return { kind: "logo", why: "file name" };
  if (/icon|favicon|glyph|symbol|bieu-tuong|ky-hieu|apple-touch|maskable/.test(name) || f.format === "ico") return { kind: "icon", why: "file name" };
  if (/illus|minh-hoa|hinh-ve|drawing|artwork|banner|hero|cover|poster|scene|tranh/.test(name)) return { kind: "illustration", why: "file name" };
  const w = f.viewW ?? f.nw;
  const h = f.viewH ?? f.nh;
  const square = w / Math.max(1, h) >= 0.8 && w / Math.max(1, h) <= 1.25;
  if (square && Math.max(w, h) <= 64) return { kind: "icon", why: `${Math.round(w)}×${Math.round(h)} square` };
  if (f.inkMode === "full") return { kind: "illustration", why: "edge-to-edge picture" };
  if (f.blend > 0.4 || f.colors > 8) return { kind: "illustration", why: "many colors or gradients" };
  return { kind: "logo", why: "flat shape on a background" };
}
