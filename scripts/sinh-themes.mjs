// Sinh tokens/themes.css từ data/themes.json, hoặc giải bộ màu của dự án khác.
//   node scripts/sinh-themes.mjs                              ghi lại tokens/themes.css của kit
//   node scripts/sinh-themes.mjs --kiem                       chỉ kiểm: mọi cặp màu đạt, tệp khớp
//   node scripts/sinh-themes.mjs mau.json --ra themes.css     hạt giống của dự án (cùng khuôn data/themes.json)
// Mã thoát: 0 đạt, 1 có cặp màu hỏng hoặc tệp lệch, 2 sai cách gọi.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll, checkTheme, dE, asHex, loadSeeds, themesCss, THEME_PAIRS } from "./themes-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fail = (msg, code, help) => {
  console.error(`error: ${JSON.stringify(msg)}\ncode: ${code === 2 ? "VALIDATION_ERROR" : "THEME_FAILED"}\nhelp[1]: ${JSON.stringify(help)}`);
  process.exit(code);
};
const USAGE = "node scripts/sinh-themes.mjs [<mau.json>] [--ra <tệp.css>] [--kiem]";
let seedFile;
let out;
let only = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--kiem") only = true;
  else if (args[i] === "--ra") out = args[++i] ?? fail("--ra cần một đường dẫn", 2, USAGE);
  else if (args[i] === "--help") {
    console.log(`usage: ${USAGE}`);
    process.exit(0);
  } else if (args[i].startsWith("-")) fail(`cờ lạ: ${args[i]}`, 2, USAGE);
  else seedFile = args[i];
}
if (seedFile && !existsSync(seedFile)) fail(`không thấy: ${seedFile}`, 2, "Hạt giống theo khuôn data/themes.json của design-kit");
if (seedFile && !out && !only) fail("bộ màu của dự án cần --ra <tệp.css>", 2, USAGE);
const target = resolve(out ?? join(root, "tokens", "themes.css"));
let seeds;
try {
  seeds = loadSeeds(seedFile ? resolve(seedFile) : undefined);
} catch (e) {
  fail(e.message, 2, "Mỗi bộ cần id, name, light và dark (bg, surface, surface2, border, text, text2, accent, ok, warn, bad, info dạng #rrggbb)");
}
const all = buildAll(seeds);
const rows = all.map((b) => {
  const t = b.tokens;
  const bad = checkTheme(t, b.mode, b.relax);
  return { id: b.id, mode: b.mode, bad, karaoke: dE(asHex(t["accent-text"]), asHex(t["text"])).toFixed(2) };
});
const failed = rows.filter((r) => r.bad.length);
console.log(`status: "${failed.length ? `fail: ${failed.length} of ${rows.length} modes` : `pass: ${seeds.length} themes × light/dark, ${rows.length * THEME_PAIRS.length} pairs`}"`);
console.log(`modes[${rows.length}]{id,mode,karaoke,bad}:`);
for (const r of rows) console.log(`  ${r.id},${r.mode},${r.karaoke},${r.bad.length ? JSON.stringify(r.bad.join("; ")) : 0}`);
if (failed.length) fail("có cặp màu không đạt", 1, "Đổi hạt giống màu (thường là accent quá nhạt hay bg2 quá gần surface) rồi chạy lại");
const css = themesCss(seeds);
if (only && seedFile && !out) {
  console.log(`file: ${JSON.stringify("không so tệp: chưa có --ra")}`);
} else if (only) {
  const same = existsSync(target) && readFileSync(target, "utf8").replace(/\r\n/g, "\n") === css;
  if (!same) fail(`${target.replace(/\\/g, "/")} ${existsSync(target) ? "lệch hạt giống" : "không có"}`, 1, "Chạy lại không có --kiem để ghi");
  console.log(`file: ${JSON.stringify("khớp, không ghi")}`);
} else {
  writeFileSync(target, css);
  console.log(`file: ${JSON.stringify(target.replace(/\\/g, "/"))}`);
}
