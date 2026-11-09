// Kiểm tương phản mọi cặp màu theo vai trò trong tokens/*.css (WCAG 2 + APCA).
// Dùng: node scripts/kiem-cap-mau.mjs   (cần colorjs.io: DK_COLORJS hoặc node_modules của palette-axi)
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const colorjsPath = process.env.DK_COLORJS ?? join(root, "node_modules/colorjs.io/dist/color.js");
const { default: Color } = await import(pathToFileURL(colorjsPath).href);

// [chữ/thành phần, nền, ngưỡng WCAG]
const PAIRS = [
  ["text", "bg", 4.5], ["text", "surface", 4.5], ["text", "surface-2", 4.5],
  ["text-2", "bg", 4.5], ["text-2", "surface", 4.5], ["text-2", "surface-2", 4.5],
  ["accent-text", "bg", 4.5], ["accent-text", "surface", 4.5], ["accent-text", "accent-soft", 4.5],
  ["on-accent", "accent", 4.5],
  ["ok", "bg", 4.5], ["ok", "ok-soft", 4.5], ["warn", "bg", 4.5], ["warn", "warn-soft", 4.5],
  ["bad", "bg", 4.5], ["bad", "bad-soft", 4.5], ["info", "bg", 4.5], ["info", "info-soft", 4.5],
  ["border-strong", "surface", 3], ["focus", "bg", 3], ["accent", "bg", 3],
];

function blocks(css, theme) {
  // khối sáng = [data-dk="x"] { … } đầu tiên; khối tối = [data-dk="x"][data-theme="dark"] { … }
  const light = css.match(new RegExp(`\\[data-dk="${theme}"\\]\\s*\\{([^}]*)\\}`))[1];
  const dark = css.match(new RegExp(`\\[data-dk="${theme}"\\]\\[data-theme="dark"\\]\\s*\\{([^}]*)\\}`))[1];
  const vars = (s) => Object.fromEntries([...s.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))/g)].map((m) => [m[1], m[2]]));
  return { light: vars(light), dark: vars(dark) };
}

let fails = 0, total = 0;
const rows = [];
for (const theme of ["dem", "giay", "dam"]) {
  const css = readFileSync(join(root, "tokens", `${theme}.css`), "utf8");
  const sets = blocks(css, theme);
  for (const [mode, v] of Object.entries(sets)) {
    for (const [fg, bg, min] of PAIRS) {
      if (!v[fg] || !v[bg]) { rows.push(`${theme},${mode},${fg}/${bg},thiếu token,,`); fails++; total++; continue; }
      const f = new Color(v[fg]), b = new Color(v[bg]);
      const w = b.contrast(f, "WCAG21");
      const lc = Math.abs(b.contrast(f, "APCA"));
      const inGamut = f.inGamut("srgb") && b.inGamut("srgb");
      const ok = w >= min && inGamut;
      total++;
      if (!ok) fails++;
      if (!ok || process.argv.includes("--all")) rows.push(`${theme},${mode},${fg}/${bg},${w.toFixed(2)},${lc.toFixed(0)},${ok ? "đạt" : inGamut ? "TRƯỢT" : "NGOÀI GAMUT"}`);
    }
  }
}
console.log(`status: "${fails ? `${fails} cặp trượt` : "đạt"} / ${total} cặp"`);
if (rows.length) console.log(`pairs[${rows.length}]{theme,mode,pair,wcag,apca_lc,result}:\n  ` + rows.join("\n  "));
process.exitCode = fails ? 1 : 0;
