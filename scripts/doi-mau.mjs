// Đổi màu nhấn (và sắc nhuốm trung tính) của một hướng theo thương hiệu, tự giữ tương phản.
// Cấu trúc hướng (nhịp, thang chữ, độ sáng nền) giữ nguyên; chỉ đổi sắc (hue) rồi dò lại độ sáng
// của màu nhấn để mọi cặp vẫn đạt WCAG. Kết quả là tệp thay thế tương đương tokens/<hướng>.css.
//
// Dùng: node scripts/doi-mau.mjs --huong dem --nhan 45 [--trung-tinh 60] [--ra du-an/dem.css]
//   --nhan       sắc màu nhấn 0–360 (đỏ 25, cam 45, hổ phách 70, xanh lá 145, ngọc 180, lam 250, tím 300)
//   --trung-tinh sắc nhuốm của nền và chữ (mặc định giữ nguyên); tông ấm 50–70, tông lạnh 240–260
//   --ra         tệp ghi ra (mặc định in ra màn hình)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { blocks, checkPairs, maxChroma, ok, parse, wcag } from "./mau-lib.mjs";

const { values: a } = parseArgs({ options: { huong: { type: "string" }, nhan: { type: "string" }, "trung-tinh": { type: "string" }, ra: { type: "string" } } });
const huong = a.huong;
const H = Number(a.nhan);
const N = a["trung-tinh"] === undefined ? undefined : Number(a["trung-tinh"]);
if (!["dem", "giay", "dam"].includes(huong ?? "") || !(H >= 0 && H <= 360) || (N !== undefined && !(N >= 0 && N <= 360))) {
  console.error('error: "cần --huong dem|giay|dam và --nhan 0–360 (tuỳ chọn --trung-tinh 0–360)"\ncode: VALIDATION_ERROR');
  process.exit(2);
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let css = readFileSync(join(root, "tokens", `${huong}.css`), "utf8");
const orig = blocks(css, huong);

const NEUTRAL = ["bg", "surface", "surface-2", "border", "border-strong", "text", "text-2"];
const clampC = (L, C, h) => Math.min(C, maxChroma(L, h) * 0.98);

function solve(v, mode) {
  const out = { ...v };
  const dark = mode === "dark";
  if (N !== undefined) for (const k of NEUTRAL) { const [L, C] = parse(v[k]); out[k] = ok(L, clampC(L, C, N), N); }
  const [La, Ca] = parse(v["accent"]);
  const [Lt, Ct] = parse(v["accent-text"]);
  const [Ls, Cs] = parse(v["accent-soft"]);
  const [Lo, Co] = parse(v["on-accent"]);
  out["accent-soft"] = ok(Ls, clampC(Ls, Cs, H), H);
  out["on-accent"] = ok(Lo, clampC(Lo, Co, H), H);
  // Màu tô: dò L (tối dần ở sáng, sáng dần ở tối) tới khi chữ on-accent ≥ 4.6 và màu tô ≥ 3.1 so với nền.
  let L = La;
  const step = dark ? 0.005 : -0.005;
  for (let i = 0; i < 120; i++) {
    const c = ok(L, clampC(L, Ca, H), H);
    if (wcag(out["on-accent"], c) >= 4.6 && wcag(c, out["bg"]) >= 3.1) { out["accent"] = c; break; }
    L += step;
  }
  // Chữ màu nhấn: ≥ 4.6 trên bg, surface và accent-soft.
  L = Lt;
  for (let i = 0; i < 120; i++) {
    const c = ok(L, clampC(L, Ct, H), H);
    if (["bg", "surface", "accent-soft"].every((b) => wcag(c, out[b]) >= 4.6)) { out["accent-text"] = c; break; }
    L += step;
  }
  out["focus"] = out["accent"];
  return out;
}

const next = { light: solve(orig.light, "light"), dark: solve(orig.dark, "dark") };
// Ghi đè giá trị trong từng khối (khối sáng; hai khối tối giống nhau).
function rewrite(block, from, to) {
  let b = block;
  for (const k of Object.keys(to)) if (from[k] !== to[k]) b = b.replace(new RegExp(`(--${k}:\\s*)${from[k].replace(/[()]/g, "\\$&")}`), `$1${to[k]}`);
  return b;
}
const lightRe = new RegExp(`(\\[data-dk="${huong}"\\]\\s*\\{)([^}]*)(\\})`);
css = css.replace(lightRe, (_, a1, body, a3) => a1 + rewrite(body, orig.light, next.light) + a3);
const darkRe = new RegExp(`(\\[data-dk="${huong}"\\](?::not\\(\\[data-theme="light"\\]\\)|\\[data-theme="dark"\\])\\s*\\{)([^}]*)(\\})`, "g");
css = css.replace(darkRe, (_, a1, body, a3) => a1 + rewrite(body, orig.dark, next.dark) + a3);
if (N !== undefined) css = css.replace(/oklch\(([\d.]+) ([\d.]+) 250 \//g, `oklch($1 $2 ${N} /`);
css = `/* Sinh bằng: node scripts/doi-mau.mjs --huong ${huong} --nhan ${H}${N !== undefined ? ` --trung-tinh ${N}` : ""}\n   Từ tokens/${huong}.css: giữ cấu trúc, đổi sắc màu nhấn${N !== undefined ? " và trung tính" : ""}, dò lại độ sáng để giữ tương phản. */\n` + css;

const check = checkPairs(blocks(css, huong));
if (a.ra) writeFileSync(a.ra, css); else process.stdout.write(css);
const summary = [
  `status: "${check.fails.length ? `${check.fails.length} cặp trượt` : "đạt"} / ${check.total} cặp"`,
  `accent: "sáng ${next.light.accent}, tối ${next.dark.accent}"`,
  ...(check.fails.length ? [`fails[${check.fails.length}]{mode,pair,wcag}:`, ...check.fails.map((f) => `  ${f.mode},${f.pair},${f.wcag}`)] : []),
  ...(a.ra ? [`help[1]: "Link ${a.ra} thay cho tokens/${huong}.css, rồi chạy design-kit check"`] : []),
];
console.error(summary.join("\n"));
process.exitCode = check.fails.length ? 1 : 0;
