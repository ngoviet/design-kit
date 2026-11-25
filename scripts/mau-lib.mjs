// Thư viện màu dùng chung: đọc khối token theo chế độ, kiểm cặp tương phản, kẹp gamut.
import { pathToFileURL } from "node:url";

// Tên gói, không phải đường dẫn: npm đưa gói phụ thuộc lên node_modules của nơi cài (25/11/2026).
const colorjs = process.env.DK_COLORJS ? pathToFileURL(process.env.DK_COLORJS).href : "colorjs.io";
export const { default: Color } = await import(colorjs);

// [chữ/thành phần, nền, ngưỡng WCAG]
export const PAIRS = [
  ["text", "bg", 4.5], ["text", "surface", 4.5], ["text", "surface-2", 4.5],
  ["text-2", "bg", 4.5], ["text-2", "surface", 4.5], ["text-2", "surface-2", 4.5],
  ["accent-text", "bg", 4.5], ["accent-text", "surface", 4.5], ["accent-text", "accent-soft", 4.5],
  ["on-accent", "accent", 4.5],
  ["ok", "bg", 4.5], ["ok", "ok-soft", 4.5], ["warn", "bg", 4.5], ["warn", "warn-soft", 4.5],
  ["bad", "bg", 4.5], ["bad", "bad-soft", 4.5], ["info", "bg", 4.5], ["info", "info-soft", 4.5],
  ["border-strong", "surface", 3], ["focus", "bg", 3], ["accent", "bg", 3],
];

/** Khối sáng và tối của một hướng: { light: {tên: "oklch(...)"}, dark: {...} }. */
export function blocks(css, huong) {
  const light = css.match(new RegExp(`\\[data-dk="${huong}"\\]\\s*\\{([^}]*)\\}`))?.[1];
  const dark = css.match(new RegExp(`\\[data-dk="${huong}"\\]\\[data-theme="dark"\\]\\s*\\{([^}]*)\\}`))?.[1];
  // Sai --huong (tệp của hướng khác) từng đổ vỡ với "Cannot read properties of null" (19/11/2026).
  if (light === undefined || dark === undefined) throw new Error(`no [data-dk="${huong}"]${light === undefined ? "" : '[data-theme="dark"]'} block in the file: wrong --huong?`);
  const vars = (s) => Object.fromEntries([...s.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))/g)].map((m) => [m[1], m[2]]));
  return { light: vars(light), dark: vars(dark) };
}

export const wcag = (fg, bg) => new Color(bg).contrast(new Color(fg), "WCAG21");
export const apca = (fg, bg) => Math.abs(new Color(bg).contrast(new Color(fg), "APCA"));
export const inGamut = (c) => new Color(c).inGamut("srgb");

/** Chroma lớn nhất còn trong sRGB ở L, H cho trước. */
export function maxChroma(L, H) {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (new Color(`oklch(${L} ${mid} ${H})`).inGamut("srgb")) lo = mid;
    else hi = mid;
  }
  return lo;
}

export const ok = (L, C, H) => `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
export const parse = (s) => s.match(/oklch\(([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/).slice(1, 4).map((v) => (v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v)));

/** Kiểm mọi cặp; trả danh sách cặp trượt { mode, pair, wcag }. */
export function checkPairs(sets) {
  const fails = [];
  let total = 0;
  for (const [mode, v] of Object.entries(sets)) {
    for (const [fg, bg, min] of PAIRS) {
      total++;
      if (!v[fg] || !v[bg]) { fails.push({ mode, pair: `${fg}/${bg}`, wcag: "thiếu token" }); continue; }
      const w = wcag(v[fg], v[bg]);
      const out = !inGamut(v[fg]) || !inGamut(v[bg]);
      if (w < min || out) fails.push({ mode, pair: `${fg}/${bg}`, wcag: `${w.toFixed(2)}${out ? " (out of sRGB gamut)" : ""}` });
    }
  }
  return { fails, total };
}
