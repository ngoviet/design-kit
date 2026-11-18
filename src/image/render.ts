// Phần chạy trong trình duyệt: giải mã ảnh, vẽ ra canvas ở các cỡ cần đo, đọc mã SVG bằng DOMParser.
// Các hàm `page*` được truyền vào page.evaluate nên phải tự đủ (không dùng gì ngoài thân hàm).
import type { Page } from "playwright-core";
import type { Bitmap } from "./pixels.js";

export interface RenderReq {
  w: number;
  h: number;
}
interface PageOut {
  nw: number;
  nh: number;
  error?: string;
  out: Array<{ w: number; h: number; b64: string }>;
}

/** Trong trang: vẽ ảnh `src` (data: URL) ở từng cỡ, trả RGBA dạng base64. */
async function pageRender(arg: { src: string; reqs: Array<{ w: number; h: number }> }): Promise<PageOut> {
  const img = new Image();
  img.src = arg.src;
  try {
    await img.decode();
  } catch (e) {
    return { nw: 0, nh: 0, error: (e as Error).message || "cannot decode", out: [] };
  }
  const out: PageOut["out"] = [];
  for (const { w, h } of arg.reqs) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let s = "";
    for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(d.subarray(i, i + 0x8000)));
    out.push({ w, h, b64: btoa(s) });
  }
  return { nw: img.naturalWidth, nh: img.naturalHeight, out };
}

export async function renderImage(page: Page, src: string, reqs: RenderReq[]): Promise<{ nw: number; nh: number; error?: string; bitmaps: Bitmap[] }> {
  const r = await page.evaluate(pageRender, { src, reqs });
  return {
    nw: r.nw,
    nh: r.nh,
    ...(r.error ? { error: r.error } : {}),
    bitmaps: r.out.map((o) => ({ w: o.w, h: o.h, data: new Uint8ClampedArray(Buffer.from(o.b64, "base64")) })),
  };
}

/** Cỡ tự nhiên của ảnh (để chọn cỡ vẽ trước khi vẽ). */
export async function naturalSize(page: Page, src: string): Promise<{ nw: number; nh: number; error?: string }> {
  return page.evaluate(async (s) => {
    const img = new Image();
    img.src = s;
    try {
      await img.decode();
      return { nw: img.naturalWidth, nh: img.naturalHeight };
    } catch (e) {
      return { nw: 0, nh: 0, error: (e as Error).message || "cannot decode" };
    }
  }, src);
}

export interface SvgFacts {
  parseError?: string;
  root?: string;
  viewBox?: string;
  width?: string;
  height?: string;
  /** preserveAspectRatio="none": ảnh bị kéo méo khi khung khác tỉ lệ. */
  stretch: boolean;
  elements: number;
  paths: number;
  /** Số lệnh vẽ trong mọi thuộc tính d (xấp xỉ số nút). */
  commands: number;
  /** Số phần tử <text> và vài mẫu chữ. */
  textCount: number;
  texts: string[];
  /** <image> nhúng ảnh điểm (data:) và <image>/<use> trỏ ra tệp khác. */
  rasters: number;
  external: string[];
  scripts: number;
  handlers: string[];
  jsLinks: number;
  foreign: number;
  /** Màu tô cứng (fill/stroke/stop-color, thuộc tính và style), trừ none, currentColor, url(#…). */
  colors: string[];
  currentColor: boolean;
  strokeWidths: string[];
  title: boolean;
  /** Số thực có ≥ 4 chữ số thập phân / mọi số trong d và points: mã phình vì độ chính xác thừa. */
  longNumbers: number;
  numbers: number;
  animated: boolean;
}

/** Trong trang: đọc mã SVG. */
function pageSvgFacts(text: string): SvgFacts {
  const facts: SvgFacts = {
    stretch: false, elements: 0, paths: 0, commands: 0, textCount: 0, texts: [], rasters: 0, external: [], scripts: 0, handlers: [], jsLinks: 0,
    foreign: 0, colors: [], currentColor: false, strokeWidths: [], title: false, longNumbers: 0, numbers: 0, animated: false,
  };
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const err = doc.querySelector("parsererror");
  if (err) {
    facts.parseError = (err.textContent ?? "parse error").replace(/\s+/g, " ").trim().slice(0, 160);
    return facts;
  }
  const root = doc.documentElement;
  facts.root = root.localName;
  if (root.localName !== "svg") return facts;
  const attr = (k: string) => root.getAttribute(k) ?? undefined;
  const vb = attr("viewBox");
  if (vb) facts.viewBox = vb;
  const w = attr("width");
  if (w) facts.width = w;
  const h = attr("height");
  if (h) facts.height = h;
  facts.stretch = /^\s*none\b/.test(attr("preserveAspectRatio") ?? "");
  const colors = new Set<string>();
  const strokes = new Set<string>();
  const external = new Set<string>();
  const handlers = new Set<string>();
  const paint = (v: string | null | undefined) => {
    if (!v) return;
    const s = v.trim();
    if (!s || /^(none|transparent|inherit)$/i.test(s) || /^url\(\s*#/i.test(s)) return;
    if (/^currentcolor$/i.test(s)) {
      facts.currentColor = true;
      return;
    }
    colors.add(s.toLowerCase());
  };
  const all = Array.from(root.querySelectorAll("*"));
  facts.elements = all.length + 1;
  for (const el of [root, ...all]) {
    const tag = el.localName;
    if (tag === "path") facts.paths++;
    if (tag === "script") facts.scripts++;
    if (tag === "foreignObject") facts.foreign++;
    if (tag === "title" && el.parentElement === root) facts.title = true;
    if (/^(animate|animateTransform|animateMotion|set)$/.test(tag)) facts.animated = true;
    if (tag === "text") {
      facts.textCount++;
      if (facts.texts.length < 3) facts.texts.push((el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || "(empty)");
    }
    for (const a of Array.from(el.attributes)) {
      const name = a.name.toLowerCase();
      const val = a.value;
      if (name.startsWith("on")) handlers.add(name);
      if (name === "href" || name === "xlink:href") {
        if (/^\s*javascript:/i.test(val)) facts.jsLinks++;
        else if (tag === "image" && /^\s*data:/i.test(val)) facts.rasters++;
        else if (!/^\s*(#|data:)/i.test(val) && (tag === "image" || tag === "use" || tag === "feImage")) external.add(val.slice(0, 80));
      }
      if (name === "fill" || name === "stroke" || name === "stop-color" || name === "color") paint(val);
      if (name === "stroke-width") strokes.add(val.trim());
      if (name === "style") {
        for (const m of val.matchAll(/(?:^|;)\s*(fill|stroke|stop-color)\s*:\s*([^;]+)/gi)) paint(m[2]);
        for (const m of val.matchAll(/(?:^|;)\s*stroke-width\s*:\s*([^;]+)/gi)) strokes.add(m[1]!.trim());
        for (const m of val.matchAll(/url\(\s*['"]?(https?:[^'")]+)/gi)) external.add(m[1]!.slice(0, 80));
      }
      if (name === "d" || name === "points") {
        if (name === "d") facts.commands += (val.match(/[a-df-z]/gi) ?? []).length;
        const nums = val.match(/-?\d*\.\d+|-?\d+/g) ?? [];
        facts.numbers += nums.length;
        facts.longNumbers += nums.filter((x) => /\.\d{4,}/.test(x)).length;
      }
    }
    if (tag === "style") {
      const css = el.textContent ?? "";
      for (const m of css.matchAll(/(?:fill|stroke|stop-color)\s*:\s*([^;}]+)/gi)) paint(m[1]);
      for (const m of css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/gi)) external.add(m[1]!.slice(0, 80));
      for (const m of css.matchAll(/url\(\s*['"]?(https?:[^'")]+)/gi)) external.add(m[1]!.slice(0, 80));
      if (/@keyframes|animation\s*:/i.test(css)) facts.animated = true;
    }
  }
  facts.colors = [...colors].slice(0, 12);
  facts.strokeWidths = [...strokes].slice(0, 8);
  facts.external = [...external].slice(0, 6);
  facts.handlers = [...handlers].slice(0, 6);
  return facts;
}

export async function svgFacts(page: Page, text: string): Promise<SvgFacts> {
  return page.evaluate(pageSvgFacts, text);
}
