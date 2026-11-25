import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import type { Page } from "playwright-core";
import { type FlagSpec, listFlag, parseCommandArgs } from "../args.js";
import { launchBrowser } from "../browser.js";
import { fail } from "../errors.js";
import { colorfulness, contrastOn, monoTest, palette, regionMasks } from "../image/color.js";
import { grayOver, median, parseHex } from "../image/pixels.js";
import { naturalSize, renderImage, svgFacts, type SvgFacts } from "../image/render.js";
import { detectKind, type Finding, type Kind, KINDS, type Measures, scoreImage, scoreSet, type SetMember } from "../image/score.js";
import { coverage, detailLoss, inkBox, inkOf, margins, massOffset, mirrorSymmetry, outsideCircle, perimetricComplexity, pixelFit, strokeWidth } from "../image/shape.js";
import { compressionRatio, edgeWidth } from "../image/sharp.js";
import { shootSetSheet, shootSheet } from "../image/sheet.js";
import type { Runtime } from "../runtime.js";

export const CHECK_IMAGE_HELP = `usage: design-kit check-image <file|dir>... [flags]
description: Score logos, icons and symbols, and illustrations (SVG, PNG, JPEG, WebP, AVIF, GIF, ICO, BMP) from what can be measured: each image is drawn in the browser at a reference size and at the small sizes it is used at, then the pixels and the SVG source are measured. Each criterion gets 0–100 and the image a weighted score with a grade (good ≥ 85, fair ≥ 70, weak ≥ 50, poor); hard failures block "done" and cap the score at 49. A contact sheet per image (sizes on light and dark, grayscale, one color, pixel grid, detail lost at 16 px) is saved for the human pass: taste, meaning and fit with the brand are not scored. Icons in the same folder are also compared as a set
flags[9]:
  --kind <auto|logo|icon|illustration>: what the image is (default auto: file name, then size and colors); symbols and pictograms are icons
  --display <px>: size it is shown at (CSS px; logo: height, icon and illustration: longest side): bitmaps need 2×
  --bg <light=#hex,dark=#hex>: backgrounds for the contrast test (default light=#ffffff,dark=#121212)
  --no-set: do not compare icons as a set
  --min-score <n>: exit 1 when an image scores below n (with --strict for hard failures)
  --shots <dir>: contact sheet folder (default .design-kit/shots/images); --no-shots to skip
  --no-shots: do not save contact sheets
  --strict: exit 1 when any image has a hard failure
  --full: every finding and every criterion row
criteria[3]:
  logo: small (detail finer than 1 px at 32 and 16 px tall) 30, contrast (shape ≥ 3:1 on light and on dark, WCAG 1.4.11) 20, mono (touching colors still apart in grayscale) 20, palette (1–3 colors, no gradient) 5, file (SVG, no live text, no embedded bitmap, no external refs, viewBox, size) 25; perimetric complexity is reported, not scored
  icon: small (detail finer than 1 px at its own size and at 16 px) 20, pixel (straight edges on the pixel grid) 15, frame (margin, fills its square box, centered) 15, contrast 10, color (one color, currentColor) 10, simplicity (vs Lucide icons) 10, file 20
  illustration: sharpness (edge width, Marziliano 2002) 30, resolution (with --display) 15, contrast 15, mono 10, file (format and weight) 30
gates[3]:
  hard: a file the browser cannot draw, nothing visible, SVG that is not well-formed or carries script (<script>, on* attributes, javascript: links), a shape that stands out from no background (under 3:1 almost everywhere), an icon mostly finer than 1 px at its own size, a bitmap smaller than the size it is shown at
  soft: small-size, pixel-grid, frame, contrast on one background (ship a reversed version or use currentColor), mono, palette (over 4 colors, gradient), color (hard-coded color on a one-color icon), complexity, sharpness (looks upscaled), resolution (under 2×), vector (a logo or icon as a bitmap), format (JPEG for flat art, PNG for photo-like art), weight, svg-text, svg-raster, svg-external, svg-viewbox, svg-stretch, set (an icon that differs from the rest of its set in stroke, weight, size or grid)
  human: open the contact sheets: is it recognisable at 16 px, does it mean the right thing, does it fit the brand and the other icons
notes[3]:
  Scores rest on measurements, not on a vision model judging taste (the kit's research found such judges pass broken visuals); thresholds and sources: docs/tieu-chi.md
  Folders are read one level deep; icons in the same folder form a set when there are at least 3
  Exit 0 whenever the images were checked: read \`status\`. --strict and --min-score turn failures into exit 1; usage errors exit 2
examples[4]:
  design-kit check-image assets/logo.svg
  design-kit check-image icons/ --strict
  design-kit check-image hero.png --kind illustration --display 1200
  design-kit check-image brand/ --min-score 70 --strict
`;

const FLAGS: Record<string, FlagSpec> = {
  kind: { type: "string", hint: "--kind auto|logo|icon|illustration" },
  display: { type: "string", hint: "--display <px>" },
  bg: { type: "string", hint: "--bg light=#hex,dark=#hex" },
  "no-set": { type: "boolean", hint: "--no-set" },
  "min-score": { type: "string", hint: "--min-score <n>" },
  shots: { type: "string", hint: "--shots <dir>" },
  "no-shots": { type: "boolean", hint: "--no-shots" },
  strict: { type: "boolean", hint: "--strict" },
};

const FORMATS: Record<string, { format: string; mime: string }> = {
  ".svg": { format: "svg", mime: "image/svg+xml" },
  ".png": { format: "png", mime: "image/png" },
  ".jpg": { format: "jpeg", mime: "image/jpeg" },
  ".jpeg": { format: "jpeg", mime: "image/jpeg" },
  ".webp": { format: "webp", mime: "image/webp" },
  ".avif": { format: "avif", mime: "image/avif" },
  ".gif": { format: "gif", mime: "image/gif" },
  ".ico": { format: "ico", mime: "image/x-icon" },
  ".bmp": { format: "bmp", mime: "image/bmp" },
};

/** Cạnh ngắn của ảnh tham chiếu (hình véc-tơ, cạnh dài tối đa 2048); ảnh điểm đo ở cỡ thật, tối đa REF_MAX. */
const REF = 512;
const REF_MAX = 1024;
/** Vùng giữa ở cỡ thật để đo độ sắc ảnh lớn. */
const CROP = 1024;

function expand(inputs: string[], cwd: string): string[] {
  const out: string[] = [];
  for (const t of inputs) {
    const p = resolve(cwd, t);
    if (!existsSync(p)) fail(`not found: ${t}`, "VALIDATION_ERROR", ["Pass image files (svg, png, jpg, webp, avif, gif, ico, bmp) or a folder of them"]);
    if (statSync(p).isDirectory()) {
      // Chỉ tệp: thư mục tên "x.svg" từng lọt qua bộ lọc đuôi rồi làm readFileSync ném EISDIR, hỏng cả lượt.
      const files = readdirSync(p).filter((f) => FORMATS[extname(f).toLowerCase()] && statSync(join(p, f)).isFile()).sort();
      if (!files.length) fail(`no images in ${t}`, "VALIDATION_ERROR", [`Formats: ${Object.keys(FORMATS).join(" ")}`]);
      out.push(...files.map((f) => join(p, f)));
    } else {
      if (!FORMATS[extname(p).toLowerCase()]) fail(`not an image this command reads: ${t}`, "VALIDATION_ERROR", [`Formats: ${Object.keys(FORMATS).join(" ")}`]);
      out.push(p);
    }
  }
  return [...new Set(out)];
}

/** viewBox="minx miny w h" → [w, h]. */
function viewSize(s?: SvgFacts): [number, number] | undefined {
  const v = s?.viewBox?.trim().split(/[\s,]+/).map(Number);
  return v && v.length === 4 && v[2]! > 0 && v[3]! > 0 ? [v[2]!, v[3]!] : undefined;
}

interface Item {
  file: string;
  label: string;
  src: string;
  m: Measures;
  kindWhy: string;
  lost16?: { w: number; h: number; mask: Uint8Array; size: number };
  /** Mặt nạ hình (0–255) khi hình có nền riêng, để tờ soát vẽ bản một màu. */
  figure?: { w: number; h: number; mask: Uint8Array };
  /** Ảnh có điểm trong suốt (tờ soát cần hàng nền tối). */
  seeThrough: boolean;
  stroke24?: number;
  member?: SetMember;
}

async function measure(page: Page, file: string, label: string, opts: { kind?: Kind; display?: number; bg: { light: [number, number, number]; dark: [number, number, number]; lightHex: string; darkHex: string } }): Promise<Item> {
  const bytes = readFileSync(file);
  const { format, mime } = FORMATS[extname(file).toLowerCase()]!;
  const vector = format === "svg";
  const src = `data:${mime};base64,${bytes.toString("base64")}`;
  const svg = vector ? await svgFacts(page, bytes.toString("utf8")) : undefined;
  const nat = await naturalSize(page, src);
  // SVG chỉ có viewBox: Chrome cho cỡ tự nhiên 300 × (300 / tỉ lệ), làm tròn về 0 khi hình dẹt hơn khoảng 600:1
  // (viewBox "0 0 2000 1"), dù vẽ theo viewBox vẫn được. Lấy cỡ của viewBox.
  const vb = viewSize(svg);
  if (!nat.error && vb && (!nat.nw || !nat.nh)) [nat.nw, nat.nh] = vb;
  const base: Measures = {
    kind: opts.kind ?? "logo", format, bytes: bytes.length, nw: nat.nw, nh: nat.nh, vector, ...(svg ? { svg } : {}),
    inkMode: "alpha", visible: false, loss: [], compression: 0, colors: 0, swatches: [], blend: 0, mono: { pairs: [] }, colorfulness: 0,
    ...(opts.display ? { display: opts.display } : {}),
  };
  if (nat.error || !nat.nw || !nat.nh) {
    return { file, label, src, m: { ...base, decodeError: nat.error ?? "zero size" }, kindWhy: opts.kind ? "--kind" : "unknown", seeThrough: false };
  }
  const vs = viewSize(svg);
  // width/height khác tỉ lệ viewBox: trình duyệt đặt hình vào khung của width/height, vẽ theo tỉ lệ viewBox là bóp méo
  // rồi đo nét trên hình méo (25/11/2026). Lệch trong mức làm tròn cỡ tự nhiên về số nguyên thì vẫn theo viewBox.
  const reshaped = vs && Math.abs((nat.nw * vs[1]) / (nat.nh * vs[0]) - 1) > 1 / nat.nw + 1 / nat.nh;
  const aw = vs && !reshaped ? vs[0] : nat.nw;
  const ah = vs && !reshaped ? vs[1] : nat.nh;
  // Ảnh tham chiếu: véc-tơ (và ảnh điểm nhỏ hơn 128) vẽ với cạnh NGẮN 512, để nét mảnh của logo dài 3:1 vẫn rộng hơn
  // một điểm (vẽ theo cạnh dài, vòng nét 0,6 của logo 480×160 chỉ còn 0,6 điểm và lọt khỏi mặt nạ); cạnh dài tối đa
  // 2048. Ảnh điểm khác giữ cỡ thật, cạnh dài tối đa 1024.
  const small = vector || Math.max(nat.nw, nat.nh) < 128;
  let rw = small ? (aw >= ah ? (REF * aw) / ah : REF) : nat.nw;
  let rh = small ? (aw >= ah ? REF : (REF * ah) / aw) : nat.nh;
  const cap = small ? 4 * REF : REF_MAX;
  if (Math.max(rw, rh) > cap) {
    const k = cap / Math.max(rw, rh);
    rw *= k;
    rh *= k;
  }
  rw = Math.max(1, Math.round(rw));
  rh = Math.max(1, Math.round(rh));
  // Cỡ gốc của icon: viewBox (hoặc cỡ ảnh điểm) nếu 12–64, không thì 24.
  const nativeGuess = (() => {
    const s = Math.max(aw, ah);
    return s >= 12 && s <= 64 && Math.abs(s - Math.round(s)) < 0.01 ? Math.round(s) : 24;
  })();
  const reqs = [{ w: rw, h: rh }, { w: Math.max(1, Math.round((nativeGuess * aw) / Math.max(aw, ah))), h: Math.max(1, Math.round((nativeGuess * ah) / Math.max(aw, ah))) }];
  const r = await renderImage(page, src, reqs);
  if (r.error || !r.bitmaps.length) return { file, label, src, m: { ...base, decodeError: r.error ?? "cannot draw" }, kindWhy: "unknown", seeThrough: false };
  const ref = r.bitmaps[0]!;
  const ink = inkOf(ref);
  const box = inkBox(ink);
  const pal = palette(ref, ink);
  const visible = ink.mode === "full" || !!box;
  const k = opts.kind ? { kind: opts.kind, why: "--kind" } : detectKind(file, { format, vector, nw: nat.nw, nh: nat.nh, inkMode: ink.mode, colors: pal.swatches.length, blend: pal.blend, ...(vs ? { viewW: vs[0], viewH: vs[1] } : {}) });
  const kind = k.kind;
  const m: Measures = {
    ...base, kind, inkMode: ink.mode, visible,
    colors: pal.swatches.length, swatches: pal.swatches.map((s) => ({ hex: s.hex, share: s.share })), blend: pal.blend,
    mono: monoTest(ref, ink, pal),
    colorfulness: colorfulness(ref, ink),
    compression: compressionRatio(grayOver(ref, [255, 255, 255]), ref.w, ref.h),
  };
  // Ảnh điểm nhỏ bị phóng có làm mịn: mép thành dải pha màu, dải viền đo tương phản phải nằm sau nó.
  const upscale = vector ? 1 : ref.w / nat.nw;
  const light = contrastOn(ref, ink, opts.bg.light, opts.bg.lightHex, upscale);
  const dark = ink.mode === "alpha" ? contrastOn(ref, ink, opts.bg.dark, opts.bg.darkHex, upscale) : undefined;
  if (light) m.light = light;
  if (dark) m.dark = dark;
  let clear = false;
  for (let p = 3; p < ref.data.length && !clear; p += 4) if (ref.data[p]! < 250) clear = true;
  const item: Item = { file, label, src, m, kindWhy: k.why, seeThrough: clear };
  if (ink.mode === "plain" || ink.mode === "tile") item.figure = { w: ref.w, h: ref.h, mask: Uint8Array.from(ink.cov, (c) => Math.round(c * 255)) };
  if (!visible) {
    // Hình có vẽ nhưng mờ dưới nửa: nói đúng độ mờ thay vì "trong suốt hoàn toàn".
    if (ink.mode === "alpha") m.peak = ink.cov.reduce((a, c) => Math.max(a, c), 0);
    return item;
  }

  if (ink.mode !== "full" && box) {
    const short = Math.min(ref.w, ref.h);
    if (kind === "icon") m.native = nativeGuess;
    const sizes = kind === "logo" ? [32, 16] : kind === "icon" ? [...new Set([nativeGuess, 16])] : [];
    // Ảnh điểm nhỏ hơn cỡ cần thử thì không đo được chi tiết ở cỡ đó (đã mờ sẵn).
    const usable = sizes.filter((s) => s < short);
    // Vùng màu bên trong hình chỉ dùng được khi hình là các mảng màu phẳng (không phải chuyển sắc, ảnh chụp).
    const regions = pal.blend < 0.2 && pal.swatches.length >= 2 && m.mono.pairs.length > 0 ? regionMasks(pal, ink) : [];
    if (usable.length) m.loss = detailLoss(ink, usable, regions);
    const at16 = m.loss.find((l) => l.size === 16);
    if (at16 && kind !== "illustration") item.lost16 = { w: ref.w, h: ref.h, mask: at16.lost, size: 16 };
    const g = margins(ink, box);
    m.margins = g;
    m.coverage = coverage(ink);
    m.pc = perimetricComplexity(ink, regions);
    m.symmetry = mirrorSymmetry(ink, box);
    m.dcm = massOffset(ink, box);
    if (kind === "icon" && /maskable/i.test(basename(file))) m.maskOutside = outsideCircle(ink, 0.4);
    if (kind === "icon") {
      // Độ dày nét quy về cỡ gốc: điểm tham chiếu × cỡ gốc / cạnh dài tham chiếu.
      m.stroke = (strokeWidth(ink) * nativeGuess) / Math.max(ref.w, ref.h);
      const nat2 = r.bitmaps[1];
      if (nat2) m.pixelFit = pixelFit(inkOf(nat2));
      item.member = { file: label, stroke: (m.stroke * 24) / nativeGuess, coverage: m.coverage, fill: g.fill, native: nativeGuess };
    }
  }
  if (!vector) {
    // Độ sắc ở cỡ thật: ảnh lớn lấy vùng giữa CROP×CROP, không thu nhỏ (thu nhỏ làm cạnh sắc giả).
    let gray: Float64Array;
    let gw: number;
    let gh: number;
    if (Math.max(nat.nw, nat.nh) <= CROP) {
      const full = ref.w === nat.nw && ref.h === nat.nh ? ref : (await renderImage(page, src, [{ w: nat.nw, h: nat.nh }])).bitmaps[0]!;
      gray = grayOver(full, [255, 255, 255]);
      gw = full.w;
      gh = full.h;
    } else {
      const crop = await page.evaluate(async (a: { src: string; c: number }) => {
        const img = new Image();
        img.src = a.src;
        await img.decode();
        const sx = Math.max(0, Math.floor((img.naturalWidth - a.c) / 2));
        const sy = Math.max(0, Math.floor((img.naturalHeight - a.c) / 2));
        const w = Math.min(a.c, img.naturalWidth);
        const h = Math.min(a.c, img.naturalHeight);
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const g = cv.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, sx, sy, w, h, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data;
        let s = "";
        for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(d.subarray(i, i + 0x8000)));
        return { w, h, b64: btoa(s) };
      }, { src, c: CROP });
      const bm = { w: crop.w, h: crop.h, data: new Uint8ClampedArray(Buffer.from(crop.b64, "base64")) };
      gray = grayOver(bm, [255, 255, 255]);
      gw = bm.w;
      gh = bm.h;
    }
    m.edge = edgeWidth(gray, gw, gh);
  }
  return item;
}

export async function checkImageCommand(args: string[], rt: Runtime): Promise<Record<string, unknown>> {
  const p = parseCommandArgs("check-image", args, FLAGS, { min: 1, max: Infinity, usage: "<file|dir>..." });
  const kindArg = p.str("kind") ?? "auto";
  if (kindArg !== "auto" && !KINDS.includes(kindArg as Kind)) fail(`--kind: auto, ${KINDS.join(", ")}`, "VALIDATION_ERROR");
  const display = p.str("display") === undefined ? undefined : Number(p.str("display"));
  if (display !== undefined && (!Number.isInteger(display) || display < 8 || display > 8000)) fail("--display: a whole number of CSS px, 8 to 8000", "VALIDATION_ERROR");
  const minScore = p.str("min-score") === undefined ? undefined : Number(p.str("min-score"));
  if (minScore !== undefined && (!Number.isInteger(minScore) || minScore < 0 || minScore > 100)) fail("--min-score: 0 to 100", "VALIDATION_ERROR");
  const bg = { light: [255, 255, 255] as [number, number, number], dark: [18, 18, 18] as [number, number, number], lightHex: "#ffffff", darkHex: "#121212" };
  for (const kv of listFlag(p, "bg") ?? []) {
    const m = /^(light|dark)=(#[0-9a-f]{6})$/i.exec(kv);
    if (!m) fail(`--bg: light=#rrggbb and/or dark=#rrggbb, got ${kv}`, "VALIDATION_ERROR");
    if (m[1]!.toLowerCase() === "light") {
      bg.light = parseHex(m[2]!);
      bg.lightHex = m[2]!.toLowerCase();
    } else {
      bg.dark = parseHex(m[2]!);
      bg.darkHex = m[2]!.toLowerCase();
    }
  }
  const files = expand(p.positionals, rt.cwd);
  const shotsDir = p.bool("no-shots") ? undefined : resolve(rt.cwd, p.str("shots") ?? ".design-kit/shots/images");
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });
  const rel = (f: string) => relative(rt.cwd, f).replace(/\\/g, "/") || basename(f);

  const { browser, via } = await launchBrowser(rt.env);
  const items: Item[] = [];
  const t0 = Date.now();
  let reports: Array<{ it: Item; s: ReturnType<typeof scoreImage> }> = [];
  const sets: Array<{ folder: string; icons: typeof reports; res: ReturnType<typeof scoreSet> }> = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent("<!doctype html><title>design-kit</title>");
    for (const f of files) {
      const kind = kindArg !== "auto" ? (kindArg as Kind) : undefined;
      try {
        items.push(await measure(page, f, rel(f), { ...(kind ? { kind } : {}), ...(display ? { display } : {}), bg }));
      } catch (e) {
        // Một ảnh hỏng (không đọc được, trình duyệt ném lỗi khi vẽ) chỉ hỏng ảnh đó, như ảnh không giải mã được.
        const { format } = FORMATS[extname(f).toLowerCase()]!;
        const m: Measures = {
          kind: kind ?? "logo", format, bytes: 0, nw: 0, nh: 0, vector: format === "svg", inkMode: "alpha", visible: false, loss: [], compression: 0,
          colors: 0, swatches: [], blend: 0, mono: { pairs: [] }, colorfulness: 0, decodeError: (e as Error).message.split("\n")[0]!.slice(0, 160),
        };
        items.push({ file: f, label: rel(f), src: "", m, kindWhy: kind ? "--kind" : "unknown", seeThrough: false });
      }
    }
    // ---- Chấm, rồi so từng bộ icon: các icon cùng thư mục là một bộ (từ 3 icon) ----
    reports = items.map((it) => ({ it, s: scoreImage(it.m) }));
    if (!p.bool("no-set")) {
      const byDir = new Map<string, typeof reports>();
      for (const r of reports.filter((x) => x.it.member)) {
        const d = rel(dirname(r.it.file)) || ".";
        byDir.set(d, [...(byDir.get(d) ?? []), r]);
      }
      for (const [folder, icons] of byDir) {
        if (icons.length < 3) continue;
        const res = scoreSet(icons.map((r) => r.it.member!), median);
        sets.push({ folder, icons, res });
        for (const o of res.outliers) reports.find((r) => r.it.label === o.file)!.s.findings.push({ gate: "soft", check: "set", detail: o.detail });
      }
    }
    // Tờ soát: một ảnh một tờ, và một tờ cho cả bộ icon.
    if (shotsDir) {
      for (const { it, s } of reports) {
        if (it.m.decodeError) continue;
        await shootSheet(page, {
          title: it.label,
          subtitle: `${it.m.kind} · score ${s.score} (${s.grade}) · ${it.m.format.toUpperCase()} ${it.m.vector ? "vector" : `${it.m.nw}×${it.m.nh}`}`,
          kind: it.m.kind, src: it.src, nw: it.m.nw, nh: it.m.nh,
          oneColor: it.m.inkMode !== "full", transparent: it.seeThrough, ...(it.figure ? { figure: it.figure } : {}),
          themed: it.m.kind === "icon" && !!it.m.svg?.currentColor && !it.m.svg.colors.length,
          ...(it.m.native ? { native: it.m.native } : {}), ...(it.lost16 ? { lost: it.lost16 } : {}),
        }, join(shotsDir, `${slugOf(it.label)}.png`));
      }
      for (const { folder, icons, res } of sets) {
        await shootSetSheet(page, icons.map((r) => ({ name: r.it.label, src: r.it.src, flag: res.outliers.find((o) => o.file === r.it.label)?.detail ?? "" })), `Icon set ${folder} · ${icons.length} icons · consistency ${res.score}`, join(shotsDir, `set-${folder === "." ? "root" : slugOf(folder)}.png`));
      }
    }
    await ctx.close();
  } finally {
    await browser.close();
  }

  const hardOf = (f: Finding[]) => f.filter((x) => x.gate === "hard").length;
  const softOf = (f: Finding[]) => f.filter((x) => x.gate === "soft").length;
  const failing = reports.filter((r) => hardOf(r.s.findings) > 0);
  const low = minScore === undefined ? [] : reports.filter((r) => r.s.score < minScore);
  const avg = reports.length ? Math.round(reports.reduce((a, r) => a + r.s.score, 0) / reports.length) : 0;
  const out: Record<string, unknown> = {
    status: failing.length
      ? `fail: ${failing.length} of ${reports.length} images have hard failures`
      : low.length
        ? `fail: ${low.length} of ${reports.length} images score under ${minScore}`
        : `pass: ${reports.length} image${reports.length === 1 ? "" : "s"}, 0 hard failures, ${reports.length > 1 ? `mean score ${avg}` : `score ${reports[0]!.s.score} (${reports[0]!.s.grade})`}`,
    renders: `via ${via}; contrast on ${bg.lightHex} and ${bg.darkHex}; ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  };
  out["images"] = reports.map(({ it, s }) => ({
    file: it.label,
    kind: `${it.m.kind}${it.kindWhy === "--kind" ? "" : ` (${it.kindWhy})`}`,
    score: s.score,
    grade: s.grade,
    hard: hardOf(s.findings),
    soft: softOf(s.findings),
  }));
  const full = p.global.full || reports.length === 1;
  const rows = reports.flatMap(({ it, s }) =>
    s.dims.map((d) => ({ ...(reports.length > 1 ? { file: it.label } : {}), criterion: d.id, score: d.score, weight: d.weight, measured: d.measured })));
  if (full) out["scores"] = rows.length ? rows : "0 criteria scored";
  else out["scores"] = `${rows.length} criterion rows: add --full (or check one image) to see them`;
  if (sets.length) {
    out["sets"] = sets.map(({ folder, icons, res }) => ({
      folder,
      icons: icons.length,
      consistency: res.score,
      median: `stroke ${res.stroke.toFixed(2)} px at 24, ${(res.coverage * 100).toFixed(0)}% of the box inked, fills ${(res.fill * 100).toFixed(0)}% of the box`,
      outliers: res.outliers.length,
    }));
  }
  const limit = p.global.full ? Infinity : (p.global.limit ?? 30);
  const all = reports.flatMap(({ it, s }) => s.findings.map((f) => ({ ...f, file: it.label }))).sort((a, b) => (a.gate === b.gate ? 0 : a.gate === "hard" ? -1 : 1));
  const shown = all.slice(0, limit).map((f) => ({ gate: f.gate, ...(reports.length > 1 ? { file: f.file } : {}), check: f.check, detail: f.detail }));
  if (shown.length < all.length) out["count"] = `${shown.length} of ${all.length} total`;
  out["findings"] = shown.length ? shown : "0 findings found";
  const notes = reports.length === 1 ? reports[0]!.s.notes : [];
  if (notes.length) out["notes"] = notes;
  const help: string[] = [];
  if (all.some((f) => f.gate === "hard")) help.push("Fix hard failures, then rerun the same command; soft ones need a fix or a written reason");
  if (all.length > shown.length) help.push(`${all.length - shown.length} more findings: add --full`);
  if (all.some((f) => f.check === "svg-text")) help.push("Text to outlines: Inkscape `inkscape --export-text-to-path --export-plain-svg -o out.svg in.svg`, or Illustrator/Figma Outline Stroke / Flatten");
  if (all.some((f) => f.check === "weight" && /SVG/.test(f.detail))) help.push("Shrink SVG with svgo: `npx svgo in.svg -o out.svg`, then check the output still has its viewBox");
  if (reports.some((r) => r.it.kindWhy !== "--kind")) help.push("Kind was guessed (shown in brackets): pass --kind logo|icon|illustration when the guess is wrong, the criteria differ");
  if (shotsDir) help.push(`Open the contact sheets in ${rel(shotsDir)}/ (one per image${sets.length ? ", set-<folder>.png per icon set" : ""}) and judge what is not scored: recognisable at 16 px, meaning, fit with the brand${sets.length ? ", icons that look like one family" : ""}`);
  out["help"] = help;
  if ((p.bool("strict") && failing.length) || low.length) process.exitCode = 1;
  return out;
}

/**
 * Tên tệp tờ soát theo đường dẫn tương đối, giữ đuôi tệp: icons/a.svg và logos/a.svg, icon.svg và icon.png cùng thư
 * mục không ghi đè nhau. Chỉ bỏ đuôi ở tên tệp cuối, không ở "../" đầu đường dẫn.
 */
export const slugOf = (label: string): string => {
  const ext = extname(label);
  // "../" đầu đường dẫn thành "up~": trước kia bị cắt đi, nên ../logo.svg và logo.svg ghi đè cùng một tờ.
  const stem = (ext ? `${label.slice(0, -ext.length)}-${ext.slice(1).toLowerCase()}` : label).replace(/^(\.\.[\\/]?)+/, (m) => "up~".repeat(m.split("..").length - 1));
  // Giữ chữ có dấu (\p{M}: dấu tách rời của NFD): \w làm "một" và "mốt" cùng thành "m_t", hai tờ ghi đè nhau (25/11/2026).
  return stem.replace(/[\\/]+/g, "~").replace(/[^\p{L}\p{N}\p{M}_.~-]+/gu, "_").replace(/^[._~]+/, "") || "image";
};
