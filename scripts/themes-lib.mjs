// Bộ giải tương phản cho nhiều bộ màu (24/11/2026). Từ hạt giống của một bộ (nền, mặt, chữ, màu nhấn, màu trạng thái) dò lại độ
// sáng OKLCH của từng vai trò tới khi MỌI cặp chữ/nền đạt cả WCAG 2 lẫn APCA; giữ sắc và chroma. Hàm thuần, không phụ thuộc gói
// nào. Bản gốc viết bằng Python, chạy thật trong một app học ngoại ngữ; bản này cho cùng từng mã màu (test/themes.test.ts).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- đổi hệ màu, đo ----------
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16) / 255);
// Làm tròn nửa về số chẵn như Python, để hai bản cho cùng mã màu.
const roundEven = (x) => {
  const f = Math.floor(x);
  const d = x - f;
  return d < 0.5 ? f : d > 0.5 ? f + 1 : f % 2 ? f + 1 : f;
};
const hex = (r) => "#" + r.map((x) => roundEven(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0")).join("");
const rad = (d) => (d * Math.PI) / 180;

export function toOklch(h) {
  const [r, g, b] = rgb(h).map(lin);
  const l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3);
  const m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3);
  const s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, bb), (((Math.atan2(bb, a) * 180) / Math.PI) % 360 + 360) % 360];
}

/** OKLCH → hex, giảm chroma tới khi nằm trong sRGB. */
export function toHex(L, C0, H) {
  let C = C0;
  let r = [0, 0, 0];
  for (let i = 0; i < 60; i++) {
    const a = C * Math.cos(rad(H));
    const b = C * Math.sin(rad(H));
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    r = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (r.every((x) => x >= -0.0005 && x <= 1.0005)) break;
    C *= 0.95;
  }
  return hex(r.map((x) => gam(Math.max(0, x))));
}

/** `oklch(L C H)` hay hex → hex. */
export function asHex(v) {
  const m = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(v);
  return m ? toHex(Number(m[1]), Number(m[2]), Number(m[3])) : v;
}

export function wcag(a, b) {
  const y = (h) => {
    const [r, g, bb] = rgb(h).map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  };
  const [u, v] = [y(a), y(b)].sort((p, q) => q - p);
  return (u + 0.05) / (v + 0.05);
}

/** APCA Lc có dấu (chữ, nền). */
export function apca(fg, bg) {
  const y = (h) => {
    const [r, g, b] = rgb(h);
    const v = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
    return v < 0.022 ? v + (0.022 - v) ** 1.414 : v;
  };
  const t = y(fg);
  const b = y(bg);
  if (Math.abs(b - t) < 0.0005) return 0;
  if (b > t) {
    const c = (b ** 0.56 - t ** 0.57) * 1.14;
    return c < 0.1 ? 0 : (c - 0.027) * 100;
  }
  const c = (b ** 0.65 - t ** 0.62) * 1.14;
  return c > -0.1 ? 0 : (c + 0.027) * 100;
}

const lab = (h) => {
  const [L, C, H] = toOklch(h);
  return [L, C * Math.cos(rad(H)), C * Math.sin(rad(H))];
};
/** Khoảng cách trong OKLab. */
export const dE = (a, b) => Math.hypot(...lab(a).map((x, i) => x - lab(b)[i]));
/** Trộn trong OKLab, t là phần của b. */
export function mix(a, b, t) {
  const x = lab(a);
  const y = lab(b);
  const [L, p, q] = x.map((v, i) => v * (1 - t) + y[i] * t);
  return toHex(L, Math.hypot(p, q), (((Math.atan2(q, p) * 180) / Math.PI) % 360 + 360) % 360);
}

// ---------- bộ giải ----------
/** Đẩy độ sáng của `color` ra xa nền tới khi đạt `cr` và |Lc| ≥ `lc` với MỌI nền; giữ sắc và chroma. */
export function solve(color, backgrounds, dark, cr, lc) {
  let [L, C, H] = toOklch(color);
  let h = color;
  for (let i = 0; i < 200; i++) {
    h = toHex(L, C, H);
    if (backgrounds.every((n) => wcag(h, n) >= cr && Math.abs(apca(h, n)) >= lc)) return h;
    L += dark ? 0.005 : -0.005;
    if (!(L > 0.02 && L < 0.995)) break;
  }
  return h;
}

const url = (svg) => `url("data:image/svg+xml,${svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23")}")`;
/** Hoạ tiết nền nét mảnh: vảy sóng, hoặc chấm thưa. */
export function pattern({ kind, color, opacity }) {
  if (kind === "waves") {
    return url(`<svg xmlns='http://www.w3.org/2000/svg' width='72' height='36' fill='none' stroke='${color}' stroke-opacity='${opacity}'><path d='M0 36a36 36 0 0 1 72 0M12 36a24 24 0 0 1 48 0M24 36a12 12 0 0 1 24 0M-36 18a36 36 0 0 1 72 0M-24 18a24 24 0 0 1 48 0M36 18a36 36 0 0 1 72 0M48 18a24 24 0 0 1 48 0'/></svg>`);
  }
  const dots = [[14, 22, 1.4], [88, 10, 1], [140, 60, 1.7], [52, 96, 1.1], [176, 128, 1.3], [104, 150, 1], [24, 168, 1.6], [196, 30, 1]];
  return url(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='190' fill='${color}' fill-opacity='${opacity}'>${dots.map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}'/>`).join("")}</svg>`);
}

/** Hạt giống của một bản (sáng hoặc tối) → token đủ vai trò. */
export function build(m, dark) {
  const { bg, surface: sf, surface2: s2 } = m;
  const edge = m.edge ?? bg;
  const on3 = [bg, sf, s2];
  const on4 = [...on3, edge];
  const t = { bg, "bg-edge": edge, surface: sf, "surface-2": s2, border: m.border };
  t["border-strong"] = solve(m.border2 ?? m.text2, on3, dark, 3.05, 0);
  t["text"] = solve(m.text, on4, dark, 7, 75);
  t["text-2"] = solve(m.text2, on4, dark, 4.6, 60);
  // Nền chữ đang đọc (karaoke) phải tách khỏi khung lời: tăng phần màu nhấn tới khi cách ≥ 0,055 OKLab.
  let k = dark ? 0.16 : 0.12;
  while (dE(mix(sf, m.accent, k), s2) < 0.055 && k < 0.4) k += 0.02;
  t["accent-soft"] = mix(sf, m.accent, k);
  t["accent-text"] = solve(m.accent, [...on4, t["accent-soft"]], dark, 4.6, 60);
  t["text"] = solve(t["text"], [...on4, t["accent-soft"]], dark, 7, 75);
  // Nút chính: bản tối nền sáng chữ đen nhuốm, bản sáng nền đậm chữ trắng nhuốm.
  let [L, C, H] = toOklch(m.accent);
  const on = dark ? toHex(0.17, 0.03, H) : toHex(0.99, 0.008, H);
  let a = m.accent;
  for (let i = 0; i < 200; i++) {
    a = toHex(L, C, H);
    if (wcag(on, a) >= 4.6 && Math.abs(apca(on, a)) >= 60) break;
    L += dark ? 0.005 : -0.005;
  }
  t["accent"] = a;
  t["on-accent"] = on;
  for (const s of ["ok", "warn", "bad", "info"]) {
    t[`${s}-soft`] = mix(sf, m[s], dark ? 0.16 : 0.12);
    t[s] = solve(m[s], [...on4, t[`${s}-soft`]], dark, 4.6, 60);
  }
  t["focus"] = solve(t["accent-text"], on4, dark, 3.05, 0);
  const grad = `linear-gradient(160deg, ${m.tren ?? bg} 0%, ${bg} 46%, ${edge} 100%)`;
  t["nen-trang"] = m.pattern ? `${pattern(m.pattern)}, ${grad}` : grad;
  t["shadow-1"] = dark ? "0 1px 2px oklch(0 0 0 / .45)" : "0 1px 2px oklch(0.3 0.03 60 / .10)";
  t["shadow-2"] = dark ? "0 10px 30px -10px oklch(0 0 0 / .70)" : "0 10px 28px -12px oklch(0.3 0.03 60 / .28)";
  return t;
}

// ---------- cổng đo ----------
/** Chữ đã đọc so với chưa đọc, và nền chữ đang đọc so với khung lời: dưới mức này mắt không thấy chữ đang sáng tới đâu. */
export const KARAOKE = { text: 0.12, back: 0.05 };
/** [chữ hay thành phần, nền, WCAG, |Lc|] */
export const THEME_PAIRS = [
  ...["bg", "bg-edge", "surface", "surface-2", "accent-soft"].map((b) => ["text", b, 7, 75]),
  ...["bg", "bg-edge", "surface", "surface-2"].map((b) => ["text-2", b, 4.5, 60]),
  ...["bg", "surface", "surface-2", "accent-soft"].map((b) => ["accent-text", b, 4.5, 60]),
  ["on-accent", "accent", 4.5, 60],
  ...["ok", "warn", "bad", "info"].flatMap((s) => [[s, `${s}-soft`, 4.5, 60], [s, "bg", 4.5, 60], [s, "surface", 4.5, 60], ["text", `${s}-soft`, 4.5, 60], ["surface", s, 4.5, 0]]),
  ...["border-strong", "focus"].flatMap((f) => ["bg", "surface", "surface-2"].map((b) => [f, b, 3, 0])),
  ...["bg", "surface", "surface-2"].map((b) => ["accent", b, 3, 0]),
];

/** Cặp hỏng của một bản, viết thành chữ; rỗng là đạt. `relax`: {"dark info/info-soft": 59} nới |Lc| có lý do ghi ở data/themes.json. */
export function checkTheme(tokens, mode, relax = {}) {
  const t = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, /^(#|oklch\()/.test(v) && !v.includes("/") ? asHex(v) : v]));
  const bad = [];
  for (const [f, b, cr, lc0] of THEME_PAIRS) {
    const lc = relax[`${mode} ${f}/${b}`] ?? lc0;
    const w = wcag(t[f], t[b]);
    const c = Math.abs(apca(t[f], t[b]));
    if (w < cr - 0.01 || c < lc - 0.5) bad.push(`${f}/${b} ${w.toFixed(2)}:1 Lc ${c.toFixed(0)} (cần ${cr}:1 Lc ${lc})`);
  }
  const kt = dE(t["accent-text"], t["text"]);
  const kb = dE(t["accent-soft"], t["surface-2"]);
  if (kt < KARAOKE.text) bad.push(`karaoke: chữ đã đọc cách chưa đọc ${kt.toFixed(3)} (cần ${KARAOKE.text})`);
  if (kb < KARAOKE.back) bad.push(`karaoke: nền chữ đang đọc cách khung lời ${kb.toFixed(3)} (cần ${KARAOKE.back})`);
  return bad;
}

// ---------- bộ màu và CSS ----------
// Phông tiêu đề có chân dự phòng bằng Times New Roman, không Georgia: Georgia thiếu chữ Việt dấu chồng ("Giấy" thành "Giâ´y").
const FONTS = {
  viet: '"Be Vietnam Pro", system-ui, sans-serif',
  chan: '"Literata", "Times New Roman", serif',
  dam: '"Bricolage Grotesque", "Be Vietnam Pro", sans-serif',
};

export function loadSeeds(file = join(root, "data", "themes.json")) {
  const list = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(list) || !list.length) throw new Error("themes: cần một mảng JSON không rỗng");
  for (const s of list) {
    if (!/^[a-z][a-z0-9-]*$/.test(s.id ?? "")) throw new Error(`themes: id không hợp lệ: ${JSON.stringify(s.id)}`);
    for (const m of ["light", "dark"]) {
      const need = s[m]?.fixed ? [] : ["bg", "surface", "surface2", "border", "text", "text2", "accent", "ok", "warn", "bad", "info"];
      const miss = s[m] ? need.filter((k) => !/^#[0-9a-f]{6}$/i.test(s[m][k] ?? "")) : ["(cả bản)"];
      if (miss.length) throw new Error(`themes: bộ ${s.id}, bản ${m}: thiếu hoặc sai hex: ${miss.join(", ")}`);
    }
  }
  return list;
}

/** Mọi bản đã giải: [{id, name, mode, tokens, relax}]. */
export function buildAll(seeds) {
  return seeds.flatMap((s) =>
    ["light", "dark"].map((mode) => {
      const tokens = s[mode].fixed ? { ...s[mode].fixed } : build(s[mode], mode === "dark");
      tokens["font-display"] = FONTS[s.font] ?? FONTS.viet;
      if (s.radius) [tokens["r-sm"], tokens["r-md"], tokens["r-lg"]] = s.radius;
      return { id: s.id, name: s.name, mode, tokens, relax: s.relax ?? {} };
    }),
  );
}

const ROWS = [["bg-edge", "bg"], ["surface", "surface-2"], ["border", "border-strong"], ["text", "text-2"], ["accent", "accent-text"], ["on-accent", "accent-soft"], ["ok", "ok-soft"], ["warn", "warn-soft"], ["bad", "bad-soft"], ["info", "info-soft"], ["focus"], ["shadow-1"], ["shadow-2"], ["nen-trang"], ["font-display"], ["r-sm", "r-md", "r-lg"]];
const SWATCH = [["m-nen", "bg"], ["m-mat", "surface"], ["m-vien", "border-strong"], ["m-chu", "text"], ["m-nhan", "accent"], ["m-ok", "ok"], ["m-info", "info"]];

/** Toàn văn tokens/themes.css. */
export function themesCss(seeds) {
  const all = buildAll(seeds);
  const at = (id, mode) => all.find((x) => x.id === id && x.mode === mode).tokens;
  const body = (t, mode, pad) => [`${pad}color-scheme: ${mode};`, ...ROWS.map((r) => r.filter((k) => k in t)).filter((r) => r.length).map((r) => pad + r.map((k) => `--${k}: ${t[k]};`).join(" "))].join("\n");
  const sw = (t) => SWATCH.map(([n, k]) => `--${n}: ${t[k]};`).join(" ");
  const out = [`/* design-kit · bộ màu cho người dùng tự chọn. SINH bằng \`node scripts/sinh-themes.mjs\` từ data/themes.json; đừng sửa tay
   (test/themes.test.ts so hai bên). Nạp SAU tokens/<hướng>.css. Chọn bằng <html data-dk="…" data-chu-de="<id>">; bỏ thuộc tính
   là màu của hướng. Sáng/tối theo máy, hoặc ép bằng data-theme="light|dark" như các hướng. Áp TRƯỚC lần vẽ đầu bằng script ngắn
   trong <head> (blocks/html/chon-mau.html). Nguồn và giấy phép bảng màu: tokens/NOTICE-themes.txt. */
`];
  for (const s of seeds) {
    const src = s.source ? `${s.source.palette}, ${s.source.author}, ${s.source.license}` : "tự phối";
    out.push(`
/* ── ${s.name} (${s.id}) · ${src} ── */
[data-dk][data-chu-de="${s.id}"] {
${body(at(s.id, "light"), "light", "  ")}
}
@media (prefers-color-scheme: dark) {
  [data-dk][data-chu-de="${s.id}"]:not([data-theme="light"]) {
${body(at(s.id, "dark"), "dark", "    ")}
  }
}
[data-dk][data-chu-de="${s.id}"][data-theme="dark"] {
${body(at(s.id, "dark"), "dark", "  ")}
}
`);
  }
  out.push(`
/* Ô màu mẫu trên thẻ chọn: màu của CHÍNH bộ ấy theo sáng/tối đang áp, không theo bộ đang dùng. */
`);
  for (const s of seeds) {
    out.push(`[data-mau="${s.id}"] { ${sw(at(s.id, "light"))} }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) [data-mau="${s.id}"] { ${sw(at(s.id, "dark"))} } }
:root[data-theme="dark"] [data-mau="${s.id}"] { ${sw(at(s.id, "dark"))} }
`);
  }
  return out.join("");
}
