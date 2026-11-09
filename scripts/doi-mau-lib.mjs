// Lõi đổi màu theo thương hiệu (dùng chung cho scripts/doi-mau.mjs và lệnh `design-kit doi-mau`).
// Giữ cấu trúc hướng (nhịp, thang chữ, độ sáng nền); chỉ đổi sắc (hue) rồi dò lại độ sáng của màu nhấn
// để mọi cặp vẫn đạt WCAG. Trả về CSS thay thế tương đương tokens/<hướng>.css.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blocks, checkPairs, maxChroma, ok, parse, wcag } from "./mau-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEUTRAL = ["bg", "surface", "surface-2", "border", "border-strong", "text", "text-2"];
export const HUONG = ["dem", "giay", "dam"];

/**
 * @param {{ huong: string, nhan: number, trungTinh?: number }} o
 * @returns {{ css: string, check: { fails: Array<{mode:string,pair:string,wcag:string}>, total: number }, accent: { light: string, dark: string } }}
 */
export function doiMau({ huong, nhan: H, trungTinh: N }) {
  let css = readFileSync(join(root, "tokens", `${huong}.css`), "utf8");
  const orig = blocks(css, huong);
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
  css = `/* Sinh bằng: design-kit doi-mau --huong ${huong} --nhan ${H}${N !== undefined ? ` --trung-tinh ${N}` : ""}\n   Từ tokens/${huong}.css: giữ cấu trúc, đổi sắc màu nhấn${N !== undefined ? " và trung tính" : ""}, dò lại độ sáng để giữ tương phản. */\n` + css;

  return { css, check: checkPairs(blocks(css, huong)), accent: { light: next.light.accent, dark: next.dark.accent } };
}

/** Kiểm mọi cặp màu của các tệp token: [[tệp, hướng], …]; mặc định ba tệp của kit. */
export function kiemMau(targets = HUONG.map((h) => [join(root, "tokens", `${h}.css`), h])) {
  let total = 0;
  const fails = [];
  for (const [file, huong] of targets) {
    const r = checkPairs(blocks(readFileSync(file, "utf8"), huong));
    total += r.total;
    for (const f of r.fails) fails.push({ huong, ...f });
  }
  return { total, fails };
}
