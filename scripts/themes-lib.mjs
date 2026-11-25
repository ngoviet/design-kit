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

// ---------- ngưỡng theo mức tương phản ----------
/**
 * Một bảng cho cả bộ giải lẫn cổng, [WCAG, |Lc|]: ngưỡng là tham số của mức, thuật toán chỉ có một (ý của Leonardo và của
 * ContrastCurve trong Material). `thuong` là AA (riêng thân chữ 7:1); `cao` là `@media (prefers-contrast: more)`: người dùng đã tự xin tương phản
 * cao nên chữ lấy mức AAA (7:1), thân chữ 12:1.
 *  - text: thân chữ; textMau: thân chữ trên nền nhạt của màu trạng thái; chu: chữ phụ, chữ màu nhấn, màu trạng thái, chữ trên nút;
 *  - nhanNhat: chữ màu nhấn trên nền nhấn nhạt. Mức cao cũng chỉ bắt 4,5: bộ giải nhắm 7, nhưng lùi lại khi 7 làm chữ đã đọc
 *    (karaoke) trắng bệch như chữ chưa đọc, vì ở đó hai thứ chỉ khác nhau bằng màu;
 *  - net: viền, vòng focus, màu nhấn dùng làm hình khối (không phải chữ nên không có ngưỡng APCA).
 */
export const LEVELS = {
  thuong: { text: [7, 75], textMau: [4.5, 60], chu: [4.5, 60], nhanNhat: [4.5, 60], net: [3, 0] },
  cao: { text: [12, 75], textMau: [12, 75], chu: [7, 60], nhanNhat: [4.5, 60], net: [4.5, 0] },
};
/** Bộ giải nhắm cao hơn cổng một chút, để sai số làm tròn ra hex không đánh trượt chính nó. */
const BUF = { text: 0, chu: 0.1, net: 0.05 };
const goal = (level) => Object.fromEntries(Object.entries(BUF).map(([k, d]) => [k, [LEVELS[level][k][0] + d, LEVELS[level][k][1]]]));
const STATUS = ["ok", "warn", "bad", "info"];
/** Chữ xa nền nhất có thể của một bản. */
const pole = (dark) => (dark ? "#ffffff" : "#000000");

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

/** Đẩy mặt nút ra xa chữ `on` trên nó. Không dùng `solve`: APCA có chiều, ở đây chữ là `on` còn màu di chuyển là nền. */
function fill(accent, on, up, cr, lc) {
  const [L0, C, H] = toOklch(accent);
  let L = L0;
  let a = accent;
  for (let i = 0; i < 200; i++) {
    a = toHex(L, C, H);
    if (wcag(on, a) >= cr && Math.abs(apca(on, a)) >= lc) break;
    L += up ? 0.005 : -0.005;
  }
  return { a, shift: Math.abs(L - L0) };
}

/** Bản sáng: cực chữ trắng phải kéo màu nhấn tối đi quá mức này (OKLCH L) thì thử cực chữ đậm. */
export const POLE_SHIFT = 0.15;
/**
 * Mặt nút chính và chữ trên nó. Bản tối: nền sáng, chữ đen nhuốm. Bản sáng: nền đậm, chữ trắng nhuốm, trừ khi màu nhấn vốn sáng
 * (vàng, chanh, bạc hà): chữ trắng buộc kéo vàng #facc15 xuống nâu #8a700f, tức là đổi hẳn màu người ta chọn. Khi đó, nếu chữ đậm
 * đạt ngay trên đúng màu ấy thì giữ màu và dùng chữ đậm (ý: Radix Colors chọn chữ tối cho các thang sáng). Cam #f97316 không rơi
 * vào nhánh này: chữ đậm trên cam chỉ được Lc 50 (cần 60).
 * Bản tối không có nhánh này (chữ của nó vốn đã là chữ đậm): màu nhấn ở đó được kéo SÁNG lên, vẫn là màu ấy; giữ một màu nhấn
 * đậm với chữ trắng thì nút chìm vào nền.
 */
export function buttonPole(accent, dark) {
  const [cr, lc] = goal("thuong").chu;
  const H = toOklch(accent)[2];
  const ink = toHex(0.17, 0.03, H);
  const on = dark ? ink : toHex(0.99, 0.008, H);
  const { a, shift } = fill(accent, on, dark, cr, lc);
  const flip = shift > POLE_SHIFT && wcag(ink, accent) >= cr && Math.abs(apca(ink, accent)) >= lc;
  return flip ? { accent: accent.toLowerCase(), on: ink, flip } : { accent: a, on, flip };
}

/** Hạt giống của một bản (sáng hoặc tối) → token đủ vai trò, mức tương phản thường. */
export function build(m, dark) {
  const { text, chu, net } = goal("thuong");
  const { bg, surface: sf, surface2: s2 } = m;
  const edge = m.edge ?? bg;
  const on3 = [bg, sf, s2];
  const on4 = [...on3, edge];
  const t = { bg, "bg-edge": edge, surface: sf, "surface-2": s2, border: m.border };
  t["border-strong"] = solve(m.border2 ?? m.text2, on3, dark, ...net);
  t["text"] = solve(m.text, on4, dark, ...text);
  t["text-2"] = solve(m.text2, on4, dark, ...chu);
  // Nền chữ đang đọc (karaoke) phải tách khỏi khung lời: tăng phần màu nhấn tới khi cách ≥ 0,055 OKLab.
  let k = dark ? 0.16 : 0.12;
  while (dE(mix(sf, m.accent, k), s2) < 0.055 && k < 0.4) k += 0.02;
  t["accent-soft"] = mix(sf, m.accent, k);
  t["accent-text"] = solve(m.accent, [...on4, t["accent-soft"]], dark, ...chu);
  t["text"] = solve(t["text"], [...on4, t["accent-soft"]], dark, ...text);
  const btn = buttonPole(m.accent, dark);
  t["accent"] = btn.accent;
  t["on-accent"] = btn.on;
  // Màu nhấn sáng giữ nguyên thì không tách nổi khỏi nền sáng (vàng trên trắng 1,5:1), nên viền nút, vạch, vòng, công tắc dùng
  // `accent-border`: cùng sắc, đậm tới 3:1. Không kéo `accent` xuống 3:1 vì như thế là quay lại màu nâu; không bỏ cổng 3:1 vì
  // thanh tiến độ, viền thẻ đang chọn, công tắc là hình khối mang nghĩa (WCAG 1.4.11).
  if (btn.flip) t["accent-border"] = solve(m.accent, on3, dark, ...net);
  for (const s of STATUS) {
    t[`${s}-soft`] = mix(sf, m[s], dark ? 0.16 : 0.12);
    t[s] = solve(m[s], [...on4, t[`${s}-soft`]], dark, ...chu);
  }
  t["focus"] = solve(t["accent-text"], on4, dark, ...net);
  const grad = `linear-gradient(160deg, ${m.tren ?? bg} 0%, ${bg} 46%, ${edge} 100%)`;
  t["nen-trang"] = m.pattern ? `${pattern(m.pattern)}, ${grad}` : grad;
  t["shadow-1"] = dark ? "0 1px 2px oklch(0 0 0 / .45)" : "0 1px 2px oklch(0.3 0.03 60 / .10)";
  t["shadow-2"] = dark ? "0 10px 30px -10px oklch(0 0 0 / .70)" : "0 10px 28px -12px oklch(0.3 0.03 60 / .28)";
  return t;
}

/**
 * Bản `prefers-contrast: more` của một bản đã giải: cùng bộ giải, ngưỡng `cao`, đi tiếp từ token thường (nên làm được cả bản
 * `fixed` không có hạt giống). Nền giữ nguyên; chữ, màu trạng thái, viền, vòng focus và mặt nút đi xa nền hơn. Trả về ĐỦ token.
 */
export function moreContrast(t, mode) {
  const dark = mode === "dark";
  const { text, chu, net } = goal("cao");
  const h = (k) => asHex(t[k]);
  const on3 = ["bg", "surface", "surface-2"].map(h);
  const on4 = [...on3, h("bg-edge")];
  const out = { ...t };
  // Trùng màu cũ thì giữ cách ghi cũ (oklch của bản `fixed`), để themes.css chỉ ghi token khác.
  const put = (k, v) => {
    if (v !== h(k)) out[k] = v;
  };
  // 12:1 hoặc cao nhất có thể: trên nền sáng vừa (xanh xám của Rừng thông) thì chữ trắng tinh cũng chưa tới 12.
  const under = [...on4, h("accent-soft"), ...STATUS.map((s) => h(`${s}-soft`))];
  const tx = solve(h("text"), under, dark, ...text);
  put("text", under.every((b) => wcag(tx, b) >= text[0]) ? tx : pole(dark));
  put("text-2", solve(h("text-2"), on4, dark, ...chu));
  // 7:1 trên bốn nền; trên nền nhấn nhạt thì cao nhất (tới 7) mà chữ đã đọc còn tách khỏi chữ chưa đọc.
  const base = solve(h("accent-text"), on4, dark, ...chu);
  let at = base;
  for (let x = chu[0]; x >= LEVELS.cao.nhanNhat[0]; x -= 0.1) {
    at = solve(base, [h("accent-soft")], dark, x, chu[1]);
    if (dE(at, asHex(out["text"])) >= KARAOKE.text + 0.005) break;
  }
  put("accent-text", at);
  for (const s of STATUS) put(s, solve(h(s), [...on4, h(`${s}-soft`)], dark, ...chu));
  put("border-strong", solve(h("border-strong"), on3, dark, ...net));
  put("focus", solve(h("focus"), on4, dark, ...net));
  // Mặt nút đi xa chữ của nó (cực nào cũng được), rồi xa nền nếu chính nó là hình khối.
  let { a } = fill(h("accent"), h("on-accent"), toOklch(h("accent"))[0] > toOklch(h("on-accent"))[0], ...chu);
  if (!t["accent-border"]) a = solve(a, on3, dark, ...net);
  put("accent", a);
  if (t["accent-border"]) put("accent-border", solve(h("accent-border"), on3, dark, ...net));
  return out;
}

// ---------- cổng đo ----------
/** Vai trò bản nào cũng phải có (ý `core/required-modes` của Terrazzo, MIT; tự viết). */
const COLOR_ROLES = ["bg", "bg-edge", "surface", "surface-2", "border", "border-strong", "text", "text-2", "accent", "accent-text", "on-accent", "accent-soft", ...STATUS.flatMap((s) => [s, `${s}-soft`]), "focus"];
export const ROLES = [...COLOR_ROLES, "shadow-1", "shadow-2", "nen-trang", "font-display"];
/** Chữ đã đọc so với chưa đọc, và nền chữ đang đọc so với khung lời: dưới mức này mắt không thấy chữ đang sáng tới đâu. */
export const KARAOKE = { text: 0.12, back: 0.05 };
/** [chữ hay thành phần, nền, WCAG, |Lc|] của một mức. Dòng cuối: hình khối màu nhấn; bộ có `accent-border` thì kiểm nó thay `accent`. */
const pairsOf = ({ text, textMau, chu, nhanNhat, net }) => [
  ...["bg", "bg-edge", "surface", "surface-2", "accent-soft"].map((b) => ["text", b, ...text]),
  ...["bg", "bg-edge", "surface", "surface-2"].map((b) => ["text-2", b, ...chu]),
  ...["bg", "surface", "surface-2", "accent-soft"].map((b) => ["accent-text", b, ...(b === "accent-soft" ? nhanNhat : chu)]),
  ["on-accent", "accent", ...chu],
  ...STATUS.flatMap((s) => [[s, `${s}-soft`, ...chu], [s, "bg", ...chu], [s, "surface", ...chu], ["text", `${s}-soft`, ...textMau], ["surface", s, chu[0], 0]]),
  ...["border-strong", "focus"].flatMap((f) => ["bg", "surface", "surface-2"].map((b) => [f, b, ...net])),
  ...["bg", "surface", "surface-2"].map((b) => ["accent", b, ...net]),
];
export const THEME_PAIRS = { thuong: pairsOf(LEVELS.thuong), cao: pairsOf(LEVELS.cao) };

/**
 * Lỗi của một bản, viết thành chữ; rỗng là đạt. `relax`: {"dark info/info-soft": 59} nới |Lc| có lý do ghi ở data/themes.json, chỉ
 * cho mức thường. `level`: "thuong", hay "cao" cho bản prefers-contrast: more.
 */
export function checkTheme(tokens, mode, relax = {}, level = "thuong") {
  const t = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, /^(#|oklch\()/.test(v) && !v.includes("/") ? asHex(v) : v]));
  const bad = [];
  const miss = ROLES.filter((k) => !t[k]);
  if (miss.length) bad.push(`thiếu token: ${miss.join(", ")}`);
  const odd = COLOR_ROLES.filter((k) => t[k] && !/^#[0-9a-f]{6}$/i.test(t[k]));
  if (odd.length) bad.push(`sai màu: ${odd.join(", ")}`);
  for (const [f0, b, cr0, lc0] of THEME_PAIRS[level]) {
    const f = f0 === "accent" && t["accent-border"] ? "accent-border" : f0;
    if (!t[f] || !t[b]) continue;
    let cr = cr0;
    let lc = (level === "thuong" ? relax[`${mode} ${f}/${b}`] : undefined) ?? lc0;
    // Mức cao, thân chữ: 12:1 hoặc cao nhất mà nền đó cho phép.
    if (level === "cao" && f === "text") {
      cr = Math.min(cr, wcag(pole(mode === "dark"), t[b]));
      lc = Math.min(lc, Math.abs(apca(pole(mode === "dark"), t[b])));
    }
    const w = wcag(t[f], t[b]);
    const c = Math.abs(apca(t[f], t[b]));
    // Viết ngược để NaN (màu hỏng) cũng là trượt: `w < cr` với NaN luôn sai, nên từng cho qua.
    if (!(w >= cr - 0.01) || !(c >= lc - 0.5)) bad.push(`${f}/${b} ${w.toFixed(2)}:1 Lc ${c.toFixed(0)} (cần ${+cr.toFixed(2)}:1 Lc ${Math.round(lc)})`);
  }
  if (miss.length) return bad;
  const kt = dE(t["accent-text"], t["text"]);
  const kb = dE(t["accent-soft"], t["surface-2"]);
  if (!(kt >= KARAOKE.text)) bad.push(`karaoke: chữ đã đọc cách chưa đọc ${kt.toFixed(3)} (cần ${KARAOKE.text})`);
  if (!(kb >= KARAOKE.back)) bad.push(`karaoke: nền chữ đang đọc cách khung lời ${kb.toFixed(3)} (cần ${KARAOKE.back})`);
  return bad;
}

/**
 * Lỗi của cả tập bộ màu (đầu ra của buildAll); rỗng là đạt. Token chỉ có ở một bản là lỗi: hai bản cùng gắn trên một phần tử, nên
 * bản thiếu không "trống" mà thừa hưởng giá trị của bản kia. Hai bộ trùng hệt mọi token là chép nhầm (ý `core/duplicate-values`
 * của Terrazzo).
 */
export function checkSet(built) {
  const bad = [];
  const of = (id, mode) => built.find((b) => b.id === id && b.mode === mode)?.tokens;
  const seen = new Map();
  for (const id of new Set(built.map((b) => b.id))) {
    for (const [m, other] of [["light", "dark"], ["dark", "light"]]) {
      const here = of(id, m);
      if (!here) bad.push(`${id}: thiếu bản ${m}`);
      const lack = here ? Object.keys(of(id, other) ?? {}).filter((k) => !(k in here)) : [];
      if (lack.length) bad.push(`${id} ${m}: thiếu token mà bản ${other} có: ${lack.join(", ")}`);
    }
    const print = JSON.stringify(["light", "dark"].map((m) => Object.entries(of(id, m) ?? {}).map(([k, v]) => [k, asHex(v)]).sort()));
    if (seen.has(print)) bad.push(`${id}: mọi token trùng hệt bộ ${seen.get(print)}`);
    else seen.set(print, id);
  }
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
    if (list.filter((x) => x?.id === s.id).length > 1) throw new Error(`themes: id dùng hai lần: ${s.id}`);
    // Ba thứ dưới đây chép thẳng vào CSS mà không cặp màu nào nhìn tới (25/11/2026: radius thiếu từng ghi "--r-lg: undefined" và báo đạt).
    if (s.radius && !(Array.isArray(s.radius) && s.radius.length === 3 && s.radius.every((r) => typeof r === "string" && /^[^;{}]+$/.test(r)))) throw new Error(`themes: bộ ${s.id}: radius cần đúng ba chuỗi [nhỏ, vừa, lớn], vd ["6px", "10px", "16px"]`);
    for (const [k, v] of [["name", s.name], ...["palette", "author", "license"].map((x) => [`source.${x}`, s.source?.[x]])]) {
      if (String(v).includes("*/")) throw new Error(`themes: bộ ${s.id}: ${k} không được chứa "*/" (đóng chú thích CSS)`);
    }
    for (const m of ["light", "dark"]) {
      const fx = s[m]?.fixed;
      if (fx && (typeof fx !== "object" || Array.isArray(fx))) throw new Error(`themes: bộ ${s.id}, bản ${m}: fixed cần một đối tượng {vai trò: giá trị}`);
      const notText = Object.entries(fx ?? {}).filter(([, v]) => typeof v !== "string").map(([k]) => `fixed.${k}`);
      if (notText.length) throw new Error(`themes: bộ ${s.id}, bản ${m}: không phải chuỗi: ${notText.join(", ")}`);
      const need = s[m]?.fixed ? [] : ["bg", "surface", "surface2", "border", "text", "text2", "accent", "ok", "warn", "bad", "info"];
      // Khoá tuỳ chọn có ghi thì cũng phải đúng: border2 sai từng cho ra "#NaNNaNNaN" mà vẫn báo đạt.
      const opt = ["edge", "border2", "tren"].filter((k) => s[m]?.[k] !== undefined);
      const miss = s[m] ? [...need, ...opt].filter((k) => !/^#[0-9a-f]{6}$/i.test(s[m][k] ?? "")) : ["(cả bản)"];
      const pat = s[m]?.pattern;
      if (pat && (!/^(waves|dots)$/.test(pat.kind ?? "") || !/^#[0-9a-f]{6}$/i.test(pat.color ?? "") || !(pat.opacity > 0 && pat.opacity <= 1))) miss.push("pattern");
      if (miss.length) throw new Error(`themes: bộ ${s.id}, bản ${m}: thiếu hoặc sai hex: ${miss.join(", ")}`);
    }
  }
  return list;
}

/** Mọi bản đã giải: [{id, name, mode, tokens, more, relax}]. `more`: đủ token của bản prefers-contrast: more. */
export function buildAll(seeds) {
  return seeds.flatMap((s) => {
    const two = ["light", "dark"].map((mode) => ({ mode, tokens: s[mode].fixed ? { ...s[mode].fixed } : build(s[mode], mode === "dark") }));
    // Một bản có `accent-border` thì bản kia cũng phải ghi, không thì bản tối thừa hưởng viền đậm của bản sáng.
    if (two.some((x) => x.tokens["accent-border"])) for (const x of two) x.tokens["accent-border"] ??= x.tokens["accent"];
    return two.map(({ mode, tokens }) => {
      tokens["font-display"] = FONTS[s.font] ?? FONTS.viet;
      if (s.radius) [tokens["r-sm"], tokens["r-md"], tokens["r-lg"]] = s.radius;
      // Bản `fixed` thiếu vai trò thì không giải tiếp được; để nguyên cho checkTheme nói thiếu gì.
      const more = COLOR_ROLES.every((k) => tokens[k]) ? moreContrast(tokens, mode) : { ...tokens };
      return { id: s.id, name: s.name, mode, tokens, more, relax: s.relax ?? {} };
    });
  });
}

const ROWS = [["bg-edge", "bg"], ["surface", "surface-2"], ["border", "border-strong"], ["text", "text-2"], ["accent", "accent-text"], ["on-accent", "accent-soft"], ["accent-border"], ["ok", "ok-soft"], ["warn", "warn-soft"], ["bad", "bad-soft"], ["info", "info-soft"], ["focus"], ["shadow-1"], ["shadow-2"], ["nen-trang"], ["font-display"], ["r-sm", "r-md", "r-lg"]];
const SWATCH = [["m-nen", "bg"], ["m-mat", "surface"], ["m-vien", "border-strong"], ["m-chu", "text"], ["m-nhan", "accent"], ["m-ok", "ok"], ["m-info", "info"]];

/** Toàn văn tokens/themes.css. */
export function themesCss(seeds) {
  const all = buildAll(seeds);
  const at = (id, mode) => all.find((x) => x.id === id && x.mode === mode).tokens;
  const body = (t, mode, pad) => [`${pad}color-scheme: ${mode};`, ...ROWS.map((r) => r.filter((k) => k in t)).filter((r) => r.length).map((r) => pad + r.map((k) => `--${k}: ${t[k]};`).join(" "))].join("\n");
  // Bản tương phản cao: chỉ token khác bản thường.
  const diff = (id, mode, pad) => {
    const b = all.find((x) => x.id === id && x.mode === mode);
    return ROWS.map((r) => r.filter((k) => b.more[k] !== b.tokens[k])).filter((r) => r.length).map((r) => pad + r.map((k) => `--${k}: ${b.more[k]};`).join(" ")).join("\n");
  };
  const sw = (t) => SWATCH.map(([n, k]) => `--${n}: ${t[k]};`).join(" ");
  const out = [`/* design-kit · bộ màu cho người dùng tự chọn. SINH bằng \`node scripts/sinh-themes.mjs\` từ data/themes.json; đừng sửa tay
   (test/themes.test.ts so hai bên). Nạp SAU tokens/<hướng>.css. Chọn bằng <html data-dk="…" data-chu-de="<id>">; bỏ thuộc tính
   là màu của hướng. Sáng/tối theo máy, hoặc ép bằng data-theme="light|dark" như các hướng. Áp TRƯỚC lần vẽ đầu bằng script ngắn
   trong <head> (blocks/html/chon-mau.html). Nguồn và giấy phép bảng màu: tokens/NOTICE-themes.txt.
   Máy xin tương phản cao (prefers-contrast: more): mỗi bộ ghi đè những token cần đi xa nền hơn; bản tối vẫn thắng bản sáng vì bộ
   chọn của nó nặng hơn. Bộ có màu nhấn sáng (vàng, chanh) còn có --accent-border: mặt nút giữ màu nhấn, còn viền nút, vạch, vòng,
   công tắc dùng var(--accent-border, var(--accent)). */
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
    const sel = `[data-dk][data-chu-de="${s.id}"]`;
    const block = (head, mode, pad) => `${pad}${head} {\n${diff(s.id, mode, `${pad}  `)}\n${pad}}\n`;
    const more = [
      diff(s.id, "light", "") && block(sel, "light", "  "),
      diff(s.id, "dark", "") && `  @media (prefers-color-scheme: dark) {\n${block(`${sel}:not([data-theme="light"])`, "dark", "    ")}  }\n${block(`${sel}[data-theme="dark"]`, "dark", "  ")}`,
    ].filter(Boolean);
    if (more.length) out.push(`@media (prefers-contrast: more) {\n${more.join("")}}\n`);
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
