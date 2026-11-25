// Dựng cây vẽ trên terminal bằng Ink (cùng họ renderer với Claude Code, bản Ink gốc chứ không phải bản sửa của Claude
// Code) thành lưới ký tự ở đúng số cột, rồi đo: số hàng, dòng tràn, chữ bị cắt, tương phản, màu cứng.
import stringWidth from "string-width";
import { ANSI, ANSI16, contrast, isRawColor, loadThemes, mix, nearestThemeKey, resolveColor, type Resolved } from "./colors.js";
import { describeNode, isNode, kids, textOf, walk, type Child, type DrawNode, type Scheme } from "./tree.js";

type H = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => unknown;
interface InkKit {
  renderToString: (node: unknown, o: { columns: number }) => string;
  Box: unknown;
  Text: unknown;
  h: H;
  version: string;
}
let kit: InkKit | undefined;
/** Ink nạp động: chalk đọc FORCE_COLOR lúc import, phải đặt trước để Ink in mã màu cả khi stdout không phải TTY. */
export async function loadInk(): Promise<InkKit> {
  if (kit) return kit;
  process.env["FORCE_COLOR"] = "3";
  const react = await import("react");
  const ink = await import("ink");
  // ink không xuất package.json qua "exports": đi từ tệp chính lên tìm.
  let version = "?";
  try {
    const { createRequire } = await import("node:module");
    const { readFileSync, existsSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    let d = dirname(createRequire(import.meta.url).resolve("ink"));
    for (let i = 0; i < 4 && !existsSync(join(d, "package.json")); i++) d = dirname(d);
    version = (JSON.parse(readFileSync(join(d, "package.json"), "utf8")) as { version: string }).version;
  } catch {
    // Chỉ để ghi chú.
  }
  kit = { renderToString: ink.renderToString as InkKit["renderToString"], Box: ink.Box, Text: ink.Text, h: react.createElement as unknown as H, version };
  return kit;
}

const SPACE_X: Record<string, number> = { xs: 1, sm: 1, md: 2, lg: 3, xl: 4 };
const SPACE_Y: Record<string, number> = { xs: 0, sm: 0, md: 1, lg: 1, xl: 2 };
const space = (v: unknown, axis: "x" | "y"): number | undefined =>
  typeof v === "number" ? v : typeof v === "string" ? ((axis === "x" ? SPACE_X : SPACE_Y)[v] ?? 0) : undefined;
const BORDERS = new Set(["single", "double", "round", "bold", "singleDouble", "doubleSingle", "classic"]);
const WRAPS = new Set(["wrap", "end", "middle", "truncate", "truncate-start", "truncate-middle", "truncate-end"]);

const color = (v: unknown, scheme: Scheme): string | undefined => resolveColor(v, scheme).css;
const inactive = (scheme: Scheme): string => loadThemes()[scheme]["inactive"] ?? "#999999";

function boxProps(p: Record<string, unknown>, scheme: Scheme): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of ["flexDirection", "flexGrow", "flexShrink", "flexWrap", "flexBasis", "alignItems", "alignSelf", "justifyContent", "width", "height", "minWidth", "minHeight", "display", "position", "top", "left", "right", "bottom", "borderDimColor"]) {
    if (p[k] !== undefined) o[k] = p[k];
  }
  if (p["gap"] !== undefined) {
    o["columnGap"] = space(p["gap"], "x");
    o["rowGap"] = space(p["gap"], "y");
  }
  if (p["columnGap"] !== undefined) o["columnGap"] = space(p["columnGap"], "x");
  if (p["rowGap"] !== undefined) o["rowGap"] = space(p["rowGap"], "y");
  for (const pre of ["margin", "padding"]) {
    const all = p[pre];
    if (all !== undefined) {
      o[`${pre}X`] = space(all, "x");
      o[`${pre}Y`] = space(all, "y");
    }
    for (const [suf, axis] of [["X", "x"], ["Y", "y"], ["Left", "x"], ["Right", "x"], ["Top", "y"], ["Bottom", "y"]] as const) {
      if (p[`${pre}${suf}`] !== undefined) o[`${pre}${suf}`] = space(p[`${pre}${suf}`], axis);
    }
  }
  if (typeof p["borderStyle"] === "string") o["borderStyle"] = BORDERS.has(p["borderStyle"]) ? p["borderStyle"] : "single";
  if (p["borderColor"] !== undefined) o["borderColor"] = color(p["borderColor"], scheme);
  if (p["backgroundColor"] !== undefined) o["backgroundColor"] = color(p["backgroundColor"], scheme);
  if (p["overflow"] === "hidden") {
    o["overflowX"] = "hidden";
    o["overflowY"] = "hidden";
  }
  return o;
}

function textProps(p: Record<string, unknown>, scheme: Scheme): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const fg = color(p["color"], scheme);
  // Claude Code vẽ dimColor bằng màu "dim" của theme; có màu riêng thì giữ màu và làm mờ (SGR 2).
  if (fg) o["color"] = fg;
  if (p["dimColor"] === true) {
    if (fg) o["dimColor"] = true;
    else o["color"] = inactive(scheme);
  }
  if (p["backgroundColor"] !== undefined) o["backgroundColor"] = color(p["backgroundColor"], scheme);
  if (p["bold"] === true || p["weight"] === "bold" || p["weight"] === "semibold") o["bold"] = true;
  for (const k of ["italic", "underline", "strikethrough", "inverse"]) if (p[k] === true) o[k] = true;
  if (typeof p["wrap"] === "string" && WRAPS.has(p["wrap"])) o["wrap"] = p["wrap"];
  return o;
}

/** Chữ một phần tử không phải Box/Text hiện ra trên terminal (Button `[ label ]`, Input, Code…). */
function leafText(n: DrawNode): string {
  const p = n.props ?? {};
  switch (n.type) {
    case "Button": {
      const label = typeof p["label"] === "string" && !kids(n).length ? (p["label"] as string) : textOf(n);
      return p["plain"] === true ? label : `[ ${label} ]`;
    }
    case "Input":
      return `${typeof p["prefix"] === "string" ? p["prefix"] : ""}${String(p["value"] ?? p["placeholder"] ?? "")}`;
    case "Code":
    case "Markdown":
      return typeof p["source"] === "string" ? (p["source"] as string) : textOf(n);
    case "Select": {
      const opts = Array.isArray(p["options"]) ? (p["options"] as Array<{ value?: unknown; label?: unknown }>) : [];
      const hit = opts.find((x) => x.value === p["value"]) ?? opts[0];
      return hit ? String(hit.label ?? hit.value ?? "") : "";
    }
    case "Link":
      return textOf(n) || String(p["url"] ?? "");
    default:
      return textOf(n);
  }
}

/**
 * Trong Box overflowX="scroll", terminal không cuộn ngang được: mỗi Text bị cắt ở mép Box như truncate-end (trừ khi `wrap` của nó
 * đã cắt), không xuống dòng. Box bên trong có `width` riêng giữ nguyên thứ nó chứa. (Kiểu của claude-code 2.1.332, BoxProps.overflowX.)
 */
const scrolls = (p: Record<string, unknown>, outer: boolean): boolean => p["overflowX"] === "scroll" || (outer && p["width"] === undefined);

/** Các dòng của một Text, giữ Text lồng bên trong: Ink cắt (truncate) cả chuỗi nhiều dòng thành một dòng. */
function textLines(n: DrawNode): DrawNode[] {
  const lines: Child[][] = [[]];
  for (const c of kids(n)) {
    const parts: Child[] = typeof c === "string" ? c.split("\n") : c.type === "Text" ? textLines(c) : [c];
    parts.forEach((x, i) => (i ? lines.push([x]) : lines.at(-1)!.push(x)));
  }
  return lines.map((children) => ({ ...n, children }));
}

function toInk(c: Child, k: InkKit, scheme: Scheme, inText: boolean, key: number, scroll = false): unknown {
  if (typeof c === "string") return inText ? c : k.h(k.Text, { key, ...(scroll ? { wrap: "truncate-end" } : {}) }, c);
  const p = c.props ?? {};
  const inner = c.type === "Box" ? scrolls(p, scroll) : scroll;
  const children = (inside: boolean) => kids(c).map((x, i) => toInk(x, k, scheme, inside, i, inner));
  if (c.type === "Text") {
    const tp = textProps(p, scheme);
    if (scroll && !inText && (tp["wrap"] ?? "wrap") === "wrap") {
      const lines = textLines(c).map((l, i) => k.h(k.Text, { key: key + i, ...tp, wrap: "truncate-end" }, ...(textOf(l) ? kids(l).map((x, j) => toInk(x, k, scheme, true, j)) : [" "])));
      return lines.length > 1 ? k.h(k.Box, { key, flexDirection: "column" }, ...lines) : lines[0];
    }
    return k.h(k.Text, { key, ...tp }, ...children(true));
  }
  if (inText) return leafText(c); // Ink không cho Box nằm trong Text: lấy chữ của nó.
  if (c.type === "Box") return k.h(k.Box, { key, ...boxProps(p, scheme) }, ...children(false));
  if (c.type === "Svg" || c.type === "Client" || c.type === "Raster" || c.type === "Image") {
    // Terminal không có Svg (engine đã đổi thành hộp rỗng); Client/Raster/Image: giữ chỗ theo kích thước nếu có.
    const size: Record<string, unknown> = {};
    if (typeof p["width"] === "number") size["width"] = p["width"];
    if (typeof p["height"] === "number") size["height"] = p["height"];
    return k.h(k.Box, { key, ...size });
  }
  const tp: Record<string, unknown> = { key };
  if (c.type === "Button") {
    if (p["dimColor"] === true) tp["color"] = inactive(scheme);
    else if (p["variant"] === "primary") tp["color"] = color("claude", scheme);
  }
  if (c.type === "Link") tp["underline"] = true;
  return k.h(k.Text, tp, leafText(c));
}

export interface TermRender {
  columns: number;
  /** Các dòng có mã ANSI. */
  ansi: string[];
  /** Các dòng chữ trơn. */
  plain: string[];
  rows: number;
  /** Bề rộng (ô) của dòng rộng nhất. */
  widest: number;
  error?: string;
}

// eslint-disable-next-line no-control-regex -- mã ANSI bắt đầu bằng ESC
export const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

export function renderTerm(tree: DrawNode, columns: number, scheme: Scheme, k: InkKit): TermRender {
  let out = "";
  let error: string | undefined;
  try {
    out = k.renderToString(toInk(tree, k, scheme, false, 0), { columns });
  } catch (e) {
    error = (e as Error).message.split("\n")[0];
  }
  const ansi = out.split("\n");
  while (ansi.length && !stripAnsi(ansi[ansi.length - 1]!).trim()) ansi.pop();
  const plain = ansi.map(stripAnsi);
  return { columns, ansi, plain, rows: plain.length, widest: Math.max(0, ...plain.map((l) => stringWidth(l))), ...(error ? { error } : {}) };
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Một dòng thành các ô: ký tự hai ô (chữ Hán, emoji) chiếm ô của nó và một ô rỗng "" theo sau. */
function cellsOf(line: string): string[] {
  const out: string[] = [];
  for (const { segment } of new Intl.Segmenter().segment(line)) {
    out.push(segment);
    for (let i = stringWidth(segment); i > 1; i--) out.push("");
  }
  return out;
}

/**
 * Chữ có hiện đủ qua các dòng xuống hàng không: mỗi đoạn nằm ở hàng kế tiếp, bắt đầu cùng một cột. Nối cả dòng của lưới
 * (joined) không đủ khi có khung viền, có cột khác bên cạnh, hay Ink bẻ giữa một từ dài (25/11/2026).
 */
function wrapsWhole(raw: string, grid: string[][]): boolean {
  const lines = raw.replace(/^(\s*\n)+/, "").trimEnd().split("\n").map((l) => cellsOf(l.trimEnd()));
  const first = lines[0]?.[0];
  if (first === undefined) return false;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y]!.length; x++) {
      if (grid[y]![x] !== first) continue;
      const failed = new Set<string>();
      const rest = (li: number, p: number, r: number): boolean => {
        if (li === lines.length) return true;
        const key = `${li},${p},${r}`;
        const row = grid[r];
        if (!row || failed.has(key)) return false;
        const line = lines[li]!;
        if (!line.length && (row[x] ?? " ") === " " && rest(li + 1, 0, r + 1)) return true;
        let n = 0;
        while (p + n < line.length && row[x + n] === line[p + n]) n++;
        if (n && p + n === line.length && rest(li + 1, 0, r + 1)) return true;
        for (let k = n; k > 0; k--) {
          // Dấu cách ở chỗ ngắt có thể ở cuối hàng này hoặc đầu hàng sau.
          let q = p + k;
          if (q >= line.length || line[q] === "") continue;
          if (rest(li, q, r + 1)) return true;
          while (line[q] === " ") q++;
          if (q > p + k && rest(li, q, r + 1)) return true;
        }
        failed.add(key);
        return false;
      };
      if (rest(0, 0, y)) return true;
    }
  }
  return false;
}

export interface Cut {
  node: DrawNode;
  text: string;
  shown: string;
}
/**
 * Chữ của một Text (hay nhãn Button) không hiện đủ: không có trên một dòng nào, kể cả khi nối các dòng (chữ xuống dòng
 * thì không tính là cắt). `shown` là đoạn đầu dài nhất còn thấy.
 */
export function textCuts(tree: DrawNode, r: TermRender): Cut[] {
  const joined = norm(r.plain.join(" "));
  let grid: string[][] | undefined;
  const out: Cut[] = [];
  const visit = (n: DrawNode, scroll: boolean) => {
    if (n.type === "Text" || n.type === "Button") {
      const raw = n.type === "Button" ? leafText(n) : textOf(n);
      const t = norm(raw);
      // Chữ đặt wrap khác "wrap" (truncate, end…) không bao giờ xuống hàng: hàng dưới khớp phần thiếu chỉ là tình cờ.
      const wraps = n.type === "Button" || (!scroll && (n.props?.["wrap"] ?? "wrap") === "wrap");
      if (t.length >= 2 && !r.plain.some((l) => l.includes(t)) && !joined.includes(t) && !(wraps && wrapsWhole(raw, (grid ??= r.plain.map(cellsOf))))) {
        let len = t.length - 1;
        while (len > 0 && !joined.includes(t.slice(0, len))) len--;
        out.push({ node: n, text: t, shown: t.slice(0, len) });
      }
      return; // Text lồng trong Text: đo ở Text ngoài cùng.
    }
    const inner = n.type === "Box" ? scrolls(n.props ?? {}, scroll) : scroll;
    for (const c of kids(n)) if (isNode(c)) visit(c, inner);
  };
  visit(tree, false);
  return out;
}

export interface ContrastHit {
  node: DrawNode;
  text: string;
  fg: Resolved;
  /** Màu chữ đã tính (sau khi làm mờ). */
  fgCss: string;
  bg: string;
  ratio: number;
  lc: number;
  /** Ngưỡng áp dụng: 4,5 cho chữ, 3 cho một ký hiệu đơn (×, |, ⚡). */
  need: number;
}

/** Tương phản của mọi đoạn chữ có màu (khoá theme, hex, tên ANSI) với nền của nó trên terminal. */
export function termContrast(tree: DrawNode, scheme: Scheme, termBg: string): ContrastHit[] {
  const out: ContrastHit[] = [];
  const themeText = loadThemes()[scheme]["text"] ?? "#ffffff";
  const visit = (c: Child, fg: Resolved | undefined, faint: boolean, bg: string | undefined, owner: DrawNode) => {
    if (typeof c === "string") {
      const t = c.trim();
      if (!t || (!fg && !bg)) return;
      const back = bg ?? termBg;
      const base = fg?.css ?? themeText;
      const fgCss = faint ? mix(base, back) : base;
      const { ratio, lc } = contrast(fgCss, back);
      // Đồ hoạ chứ không phải chữ (WCAG 1.4.11, 3:1): một ký hiệu đơn (×, |, ⚡), hay một dải ký tự khối, kẻ khung,
      // hình học (thanh tiến độ ████░░, khung ─│).
      const symbol = ([...t].length === 1 && !/[\p{L}\p{N}]/u.test(t)) || /^[─-◿\s]+$/u.test(t);
      out.push({ node: owner, text: t, fg: fg ?? { kind: "theme", css: themeText, value: "text" }, fgCss, bg: back, ratio, lc, need: symbol ? 3 : 4.5 });
      return;
    }
    const p = c.props ?? {};
    let f = fg;
    let fa = faint;
    let b = bg;
    const bgr = resolveColor(p["backgroundColor"], scheme);
    if (bgr.css) b = bgr.css;
    if (c.type === "Text" || c.type === "Button") {
      const r = resolveColor(p["color"], scheme);
      if (r.css) f = r;
      if (p["dimColor"] === true) {
        if (r.css) fa = true;
        else f = { kind: "theme", css: inactive(scheme), value: "dimColor" };
      }
      if (c.type === "Button" && p["variant"] === "primary" && !r.css) f = resolveColor("claude", scheme);
      if (c.type === "Button") {
        visit(leafText(c), f, fa, b, c);
        return;
      }
    }
    const own = c.type === "Text" && !(owner.type === "Text") ? c : owner;
    for (const x of kids(c)) visit(x, f, fa, b, own);
  };
  visit(tree, undefined, false, undefined, tree);
  return out;
}

export interface RawColor {
  node: DrawNode;
  prop: string;
  value: string;
  suggest: string;
}
/** Màu hex/rgb cứng: không theo theme sáng/tối của người dùng. */
export function rawColors(tree: DrawNode): RawColor[] {
  const out: RawColor[] = [];
  walk(tree, (n) => {
    for (const prop of ["color", "backgroundColor", "borderColor"]) {
      const v = n.props?.[prop];
      if (isRawColor(v)) out.push({ node: n, prop, value: v.trim(), suggest: nearestThemeKey(v.trim()) });
    }
  });
  return out;
}

/** Chỗ desktop vẽ Svg mà terminal chỉ còn hộp rỗng: hình và alt mất trên terminal. */
export function droppedSvgs(desktop: DrawNode, terminal: DrawNode): DrawNode[] {
  const out: DrawNode[] = [];
  const pair = (d: Child | undefined, t: Child | undefined) => {
    if (!isNode(d) || !isNode(t)) return;
    if (d.type === "Svg") {
      if (t.type === "Box" && !kids(t).length) out.push(d);
      return;
    }
    if (d.type !== t.type) return;
    const dk = kids(d);
    const tk = kids(t);
    if (dk.length !== tk.length) return;
    dk.forEach((x, i) => pair(x, tk[i]));
  };
  pair(desktop, terminal);
  return out;
}

export const where = (component: string, n: DrawNode): string => describeNode(component, n);

// ---- Lưới ANSI → HTML (ảnh chụp) ----

function xterm256(n: number): string {
  if (n < 16) return ANSI[ANSI16[n]!]!;
  if (n >= 232) {
    const v = 8 + (n - 232) * 10;
    return `rgb(${v},${v},${v})`;
  }
  const i = n - 16;
  const lv = [0, 95, 135, 175, 215, 255];
  return `rgb(${lv[Math.floor(i / 36)]},${lv[Math.floor(i / 6) % 6]},${lv[i % 6]})`;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Một dòng ANSI thành các span có style. */
export function ansiLineToHtml(line: string): string {
  const st: { fg?: string; bg?: string; bold?: boolean; faint?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; inverse?: boolean } = {};
  let html = "";
  let i = 0;
  const flush = (text: string) => {
    if (!text) return;
    const fg = st.inverse ? (st.bg ?? "var(--bg)") : st.fg;
    const bg = st.inverse ? (st.fg ?? "var(--fg)") : st.bg;
    const css = [
      fg ? `color:${fg}` : "",
      bg ? `background:${bg}` : "",
      st.bold ? "font-weight:700" : "",
      st.faint ? "opacity:.5" : "",
      st.italic ? "font-style:italic" : "",
      st.underline || st.strike ? `text-decoration:${[st.underline ? "underline" : "", st.strike ? "line-through" : ""].join(" ").trim()}` : "",
    ].filter(Boolean).join(";");
    html += css ? `<span style="${css}">${esc(text)}</span>` : esc(text);
  };
  // eslint-disable-next-line no-control-regex -- mã SGR bắt đầu bằng ESC
  const re = /\x1b\[([0-9;]*)m/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    flush(line.slice(i, m.index));
    i = re.lastIndex;
    const codes = (m[1] || "0").split(";").map(Number);
    for (let j = 0; j < codes.length; j++) {
      const c = codes[j]!;
      if (c === 0) Object.keys(st).forEach((key) => delete st[key as keyof typeof st]);
      else if (c === 1) st.bold = true;
      else if (c === 2) st.faint = true;
      else if (c === 22) st.bold = st.faint = false;
      else if (c === 3) st.italic = true;
      else if (c === 23) st.italic = false;
      else if (c === 4) st.underline = true;
      else if (c === 24) st.underline = false;
      else if (c === 7) st.inverse = true;
      else if (c === 27) st.inverse = false;
      else if (c === 9) st.strike = true;
      else if (c === 29) st.strike = false;
      else if (c >= 30 && c <= 37) st.fg = ANSI[ANSI16[c - 30]!];
      else if (c >= 90 && c <= 97) st.fg = ANSI[ANSI16[c - 90 + 8]!];
      else if (c === 39) delete st.fg;
      else if (c >= 40 && c <= 47) st.bg = ANSI[ANSI16[c - 40]!];
      else if (c >= 100 && c <= 107) st.bg = ANSI[ANSI16[c - 100 + 8]!];
      else if (c === 49) delete st.bg;
      else if ((c === 38 || c === 48) && codes[j + 1] === 2) {
        const v = `rgb(${codes[j + 2]},${codes[j + 3]},${codes[j + 4]})`;
        if (c === 38) st.fg = v;
        else st.bg = v;
        j += 4;
      } else if ((c === 38 || c === 48) && codes[j + 1] === 5) {
        const v = xterm256(codes[j + 2] ?? 0);
        if (c === 38) st.fg = v;
        else st.bg = v;
        j += 2;
      }
    }
  }
  flush(line.slice(i));
  return html;
}

/** Trang HTML vẽ lại lưới terminal ở một hay nhiều nền (mỗi nền một khung), có vạch mép phải ở số cột. */
export function termShotHtml(panels: Array<{ label: string; bg: string; fg: string; render: TermRender }>): string {
  const body = panels
    .map(
      // Mỗi dòng một hộp cao đúng một hàng, cắt phần thừa: ký tự khối, bóng (█ ░) của font dự phòng cao hơn dòng và
      // đè lên dòng trên, còn terminal thật thì vẽ đúng trong ô.
      (p) => `<figure><figcaption>${esc(p.label)}</figcaption><div class="term" style="--bg:${p.bg};--fg:${p.fg};--cols:${p.render.columns}"><pre>${(p.render.ansi.length ? p.render.ansi : [""]).map((l) => `<div class="ln">${ansiLineToHtml(l) || " "}</div>`).join("")}</pre></div></figure>`,
    )
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>terminal</title><style>
body{margin:0;padding:12px;background:#8a8a8a;font-family:system-ui,sans-serif}
figure{margin:0 0 12px}figcaption{font:600 12px/1.4 system-ui,sans-serif;color:#111;margin:0 0 4px}
.term{display:inline-block;background:var(--bg);color:var(--fg);padding:8px 0 8px 8px;border-radius:6px}
pre{margin:0;font:14px/1.35 "Cascadia Mono",Consolas,"DejaVu Sans Mono",monospace;width:calc(var(--cols) * 1ch);border-right:1px dashed #e0846b;white-space:pre;overflow:visible}
.ln{height:1.35em;overflow-y:clip;overflow-x:visible}
</style></head><body>${body}</body></html>`;
}
