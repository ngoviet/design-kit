// Dựng cây vẽ của surface desktop thành trang HTML gần với renderer của app Claude, để chạy các phép đo sẵn có của
// design-kit (axe, cỡ chữ kể cả chữ SVG đã co, chữ bị cắt, chuyển động, ảnh chụp).
//
// Đây là bản phỏng theo: app không công bố CSS của nó. Những gì đoán (ghi trong README):
// - một ô của "monospace metric" = 8px ngang, 20px dọc; bậc khoảng cách xs/sm/md/lg/xl = 4/8/12/16/24px;
// - cỡ chữ caption/footnote/body/heading/title = 12/13/14/17/22px;
// - nền và chữ của app, màu khoá theme: lấy theme mặc định của Claude Code (data/claude-themes.json).
// Thứ mod tự đặt (hex, cỡ chữ trong SVG, độ dài source, hoạt ảnh) thì không phụ thuộc phỏng đoán.
import { loadThemes, resolveColor } from "./colors.js";
import { kids, textOf, type Child, type DrawNode, type Scheme } from "./tree.js";

export const CELL_PX = 8;
/** Svg không quá cỡ này mỗi chiều là icon: vẽ thành ảnh, chữ bên trong không đo như chữ. */
export const ICON_PX = 32;
export const ROW_PX = 20;
const STEP_PX: Record<string, number> = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const SIZE_PX: Record<string, number> = { caption: 12, footnote: 13, body: 14, heading: 17, title: 22 };
const WEIGHT: Record<string, number> = { regular: 400, medium: 500, semibold: 600, bold: 700 };

/** Nền và chữ của app (xấp xỉ). */
export const DESK: Record<Scheme, { bg: string; fg: string; line: string; accentFg: string }> = {
  light: { bg: "#faf9f5", fg: "#141413", line: "#d6d3c8", accentFg: "#ffffff" },
  dark: { bg: "#262624", fg: "#faf9f5", line: "#4a4945", accentFg: "#ffffff" },
};

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const px = (v: unknown, cell: number): string | undefined =>
  typeof v === "number" ? `${v * cell}px` : typeof v === "string" && /%$/.test(v) ? v : typeof v === "string" && STEP_PX[v] !== undefined ? `${STEP_PX[v]}px` : undefined;
const sp = (v: unknown): string | undefined => (typeof v === "number" ? `${v * CELL_PX}px` : typeof v === "string" ? `${STEP_PX[v] ?? 0}px` : undefined);

/** Engine gỡ script và thuộc tính sự kiện khỏi SVG ("scrub"); làm giống để trang đo không chạy mã của mod. */
export function scrubSvg(src: string): string {
  return src.replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

/** Hoạt ảnh trong SVG mà giảm chuyển động không tắt được: SMIL luôn chạy; CSS animation thiếu media query. */
export function svgMotionIssue(src: string): string | undefined {
  if (/<(animate|animateTransform|animateMotion|set)\b/i.test(src)) return "SMIL <animate> runs whatever prefers-reduced-motion says: use CSS animation inside @media (prefers-reduced-motion: no-preference)";
  const css = /@keyframes|animation\s*:|animation-name\s*:/i.test(src);
  if (css && !/prefers-reduced-motion/i.test(src)) return "CSS animation with no prefers-reduced-motion rule";
  return undefined;
}

function style(parts: Array<[string, string | number | undefined]>): string {
  const s = parts.filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}:${v}`).join(";");
  return s ? ` style="${esc(s)}"` : "";
}

function boxCss(p: Record<string, unknown>, scheme: Scheme): string {
  const border = typeof p["borderStyle"] === "string" ? p["borderStyle"] : undefined;
  const bc = resolveColor(p["borderColor"], scheme).css ?? DESK[scheme].line;
  const borderCss = border ? `${border === "double" ? "3px double" : border === "bold" ? "2px solid" : "1px solid"} ${bc}` : undefined;
  const gap = p["gap"] !== undefined ? sp(p["gap"]) : undefined;
  const parts: Array<[string, string | number | undefined]> = [
    ["flex-direction", typeof p["flexDirection"] === "string" ? (p["flexDirection"] as string) : undefined],
    ["flex-grow", typeof p["flexGrow"] === "number" ? (p["flexGrow"] as number) : undefined],
    ["flex-shrink", typeof p["flexShrink"] === "number" ? (p["flexShrink"] as number) : undefined],
    ["flex-wrap", typeof p["flexWrap"] === "string" ? (p["flexWrap"] as string) : undefined],
    ["align-items", typeof p["alignItems"] === "string" ? (p["alignItems"] as string) : undefined],
    ["align-self", typeof p["alignSelf"] === "string" ? (p["alignSelf"] as string) : undefined],
    ["justify-content", typeof p["justifyContent"] === "string" ? (p["justifyContent"] as string) : undefined],
    ["column-gap", p["columnGap"] !== undefined ? sp(p["columnGap"]) : gap],
    ["row-gap", p["rowGap"] !== undefined ? sp(p["rowGap"]) : gap],
    ["width", px(p["width"], CELL_PX)],
    ["height", px(p["height"], ROW_PX)],
    ["min-width", px(p["minWidth"], CELL_PX)],
    ["min-height", px(p["minHeight"], ROW_PX)],
    ["border", borderCss],
    ["border-radius", border === "round" ? "8px" : undefined],
    ["background", resolveColor(p["backgroundColor"], scheme).css],
    ["overflow", p["overflow"] === "hidden" ? "hidden" : undefined],
    ["display", p["display"] === "none" ? "none" : undefined],
    ["position", p["position"] === "absolute" ? "absolute" : undefined],
    ["top", px(p["top"], ROW_PX)],
    ["left", px(p["left"], CELL_PX)],
    ["right", px(p["right"], CELL_PX)],
    ["bottom", px(p["bottom"], ROW_PX)],
  ];
  for (const pre of ["margin", "padding"]) {
    const all = sp(p[pre]);
    const x = sp(p[`${pre}X`]) ?? all;
    const y = sp(p[`${pre}Y`]) ?? all;
    parts.push([`${pre}-left`, sp(p[`${pre}Left`]) ?? x], [`${pre}-right`, sp(p[`${pre}Right`]) ?? x], [`${pre}-top`, sp(p[`${pre}Top`]) ?? y], [`${pre}-bottom`, sp(p[`${pre}Bottom`]) ?? y]);
  }
  return style(parts);
}

function textCss(p: Record<string, unknown>, scheme: Scheme): string {
  const fg = resolveColor(p["color"], scheme).css;
  const dim = p["dimColor"] === true;
  const weight = typeof p["weight"] === "string" ? WEIGHT[p["weight"]] : p["bold"] === true ? 600 : undefined;
  const deco = [p["underline"] === true ? "underline" : "", p["strikethrough"] === true ? "line-through" : ""].filter(Boolean).join(" ");
  return style([
    ["color", fg ?? (dim ? loadThemes()[scheme]["inactive"] : undefined)],
    ["opacity", fg && dim ? 0.6 : undefined],
    ["background", resolveColor(p["backgroundColor"], scheme).css],
    ["font-size", typeof p["size"] === "string" ? `${SIZE_PX[p["size"]] ?? 14}px` : undefined],
    ["font-weight", weight],
    ["font-style", p["italic"] === true ? "italic" : undefined],
    ["text-decoration", deco || undefined],
    ["font-family", p["mono"] === true ? 'ui-monospace,"Cascadia Mono",Consolas,monospace' : undefined],
    ["font-variant-numeric", p["tabular"] === true ? "tabular-nums" : undefined],
  ]);
}

/**
 * Màu chữ và màu nền ở chỗ đang dựng có do mod tự chọn không (hex, rgb, tên ANSI). Không thì đó là màu của app hay của
 * khoá theme, mà bản desktop này chỉ đoán: chữ như vậy mang `data-dk-guess`, và tương phản thấp ở đó chỉ là lỗi mềm.
 */
interface Ctx {
  inText: boolean;
  modFg: boolean;
  modBg: boolean;
}
const OUTSIDE: Ctx = { inText: false, modFg: false, modBg: false };
const modColor = (v: unknown, scheme: Scheme): boolean => ["raw", "named"].includes(resolveColor(v, scheme).kind);
const guessAttr = (x: Ctx): string => (x.modFg || x.modBg ? "" : " data-dk-guess");

function render(c: Child, scheme: Scheme, ctx: Ctx): string {
  if (typeof c === "string") return ctx.inText ? esc(c) : `<span class="t"${guessAttr(ctx)}>${esc(c)}</span>`;
  const p = c.props ?? {};
  const inner = (next: Ctx) => kids(c).map((x) => render(x, scheme, next)).join("");
  const modBg = ctx.modBg || modColor(p["backgroundColor"], scheme);
  switch (c.type) {
    case "Box":
      return `<div class="b"${boxCss(p, scheme)}>${inner({ ...ctx, inText: false, modBg })}</div>`;
    case "Text": {
      const wrap = typeof p["wrap"] === "string" ? (p["wrap"] as string) : "wrap";
      const cls = ctx.inText ? "" : wrap === "wrap" ? "t" : "t cut";
      const dir = p["dir"] === "rtl" ? ' dir="rtl"' : "";
      // Màu riêng của Text thay màu thừa hưởng; dimColor không kèm màu là khoá theme inactive.
      const own = resolveColor(p["color"], scheme).kind;
      const modFg = own === "raw" || own === "named" ? true : own === "theme" || (own === "none" && p["dimColor"] === true) ? false : ctx.modFg;
      const next: Ctx = { inText: true, modFg, modBg };
      return `<span${cls ? ` class="${cls}"` : ""}${dir}${guessAttr(next)}${textCss(p, scheme)}>${inner(next)}</span>`;
    }
    case "Button": {
      const label = typeof p["label"] === "string" ? (p["label"] as string) : "";
      // role dismiss: desktop vẽ nút đóng của chính nó ở mép cuối, nhãn thành tên đọc cho trình đọc màn hình.
      if (p["role"] === "dismiss") return `<button type="button" class="btn plain" aria-label="${esc(label || textOf(c) || "Dismiss")}" data-dk-guess>✕</button>`;
      const next: Ctx = { inText: true, modFg: false, modBg };
      const body = kids(c).length ? inner(next) : esc(label);
      const cls = p["plain"] === true ? "btn plain" : p["variant"] === "primary" ? "btn primary" : "btn";
      const dim = p["dimColor"] === true ? ` style="color:${loadThemes()[scheme]["inactive"]}"` : "";
      const name = kids(c).length && label ? ` aria-label="${esc(label)}"` : "";
      // Màu nút là CSS của bản phỏng theo; nút trơn (plain) thì nằm trên nền của chỗ chứa nó.
      const guess = p["plain"] === true ? guessAttr(next) : " data-dk-guess";
      return `<button type="button" class="${cls}"${dim}${name}${guess}>${body}</button>`;
    }
    case "Svg": {
      const src = typeof p["source"] === "string" ? scrubSvg(p["source"] as string) : "";
      const w = typeof p["width"] === "number" ? `${p["width"]}px` : undefined;
      const h = typeof p["height"] === "number" ? `${p["height"]}px` : undefined;
      const alt = esc(String(p["alt"] ?? ""));
      // Icon (≤ ICON_PX mỗi chiều): vẽ thành ảnh như app thật vẽ Svg không tương tác. Chữ trong icon là nét vẽ (chữ "$"
      // trong đồng xu), không đo như chữ. Hình lớn hơn thì nhúng thẳng để đo cỡ chữ SVG đã co theo viewBox.
      if (typeof p["width"] === "number" && typeof p["height"] === "number" && (p["width"] as number) <= ICON_PX && (p["height"] as number) <= ICON_PX && p["isInteractive"] !== true) {
        return `<img class="svg" alt="${alt}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}"${style([["width", w], ["height", h]])}>`;
      }
      // Shadow root riêng cho mỗi hình: <style> trong SVG nội tuyến áp lên cả trang (các mod dùng lớp ngắn như .s, .t).
      return `<span class="svg" role="img" aria-label="${esc(String(p["alt"] ?? ""))}"${style([["width", w], ["height", h]])}><template shadowrootmode="open"><style>:host{display:inline-flex;max-width:100%}svg{display:block;${w ? "width:100%;" : ""}${h ? "height:100%;" : ""}max-width:100%}</style>${src}</template></span>`;
    }
    case "Input":
      return `<input class="in" aria-label="${esc(String(p["prefix"] ?? p["placeholder"] ?? "input"))}" value="${esc(String(p["value"] ?? ""))}" placeholder="${esc(String(p["placeholder"] ?? ""))}">`;
    case "Select": {
      const opts = Array.isArray(p["options"]) ? (p["options"] as Array<{ value?: unknown; label?: unknown }>) : [];
      return `<select class="in" aria-label="select">${opts.map((o) => `<option${o.value === p["value"] ? " selected" : ""}>${esc(String(o.label ?? o.value ?? ""))}</option>`).join("")}</select>`;
    }
    case "Link":
      return `<a href="${esc(String(p["url"] ?? "#"))}">${kids(c).length ? inner({ ...ctx, inText: true, modBg }) : esc(String(p["url"] ?? ""))}</a>`;
    case "Code":
      return `<pre class="code">${esc(String(p["source"] ?? ""))}</pre>`;
    case "Markdown":
      return `<div class="md">${esc(String(p["source"] ?? "")) || inner({ ...ctx, inText: true, modBg })}</div>`;
    case "Client":
      return `<div class="client"${style([["width", px(p["width"], CELL_PX)], ["height", px(p["height"], ROW_PX)]])}></div>`;
    default:
      return ctx.inText ? inner({ ...ctx, modBg }) : `<div class="b">${inner({ ...ctx, modBg })}</div>`;
  }
}

export interface DesktopPage {
  columns: number;
  scheme: Scheme;
  lang: string;
  title: string;
}

const isRtl = (lang: string): boolean => /^(he|ar|fa|ur)\b/i.test(lang);

/** Một cây trong một khung rộng đúng số cột; `id` để quy phát hiện về cây. */
export function desktopSlot(tree: DrawNode, o: { columns: number; scheme: Scheme; lang: string; id: string }): string {
  return `<div class="slot" id="${esc(o.id)}" lang="${esc(o.lang)}"${isRtl(o.lang) ? ' dir="rtl"' : ""} style="width:${o.columns * CELL_PX}px">${render(tree, o.scheme, OUTSIDE)}</div>`;
}

/**
 * Trang chứa nhiều khung (mọi cây của một component ở một bề rộng và một chế độ màu): một lần nạp, một lần axe cho
 * cả loạt. agents-panel có 384 cây desktop khác nhau; mỗi cây một trang thì mất hơn 6 phút.
 */
export function desktopDoc(slots: string[], o: { scheme: Scheme; lang: string; title: string }): string {
  const c = DESK[o.scheme];
  const accent = loadThemes()[o.scheme]["claude"] ?? "#d77757";
  return `<!doctype html>
<html lang="${esc(o.lang)}"${isRtl(o.lang) ? ' dir="rtl"' : ""}>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(o.title)}</title>
<style>
:root{color-scheme:${o.scheme}}
html,body{margin:0;background:${c.bg};color:${c.fg}}
body{font:14px/1.45 "Segoe UI",system-ui,-apple-system,sans-serif;padding:12px}
.slot{display:block;box-sizing:border-box;margin:0 0 24px}
.slot:last-child{margin-bottom:0}
.b{display:flex;flex-direction:row;flex-shrink:1;min-width:0;box-sizing:border-box;position:relative}
.t{white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}
.t.cut{white-space:pre;overflow:hidden;text-overflow:ellipsis}
.svg{flex:none}
.btn{font:inherit;color:inherit;background:transparent;border:1px solid ${c.line};border-radius:6px;padding:2px 10px;min-height:24px;cursor:pointer}
.btn.plain{border:0;padding:0 2px}
.btn.primary{background:${accent};border-color:${accent};color:${c.accentFg}}
.in{font:inherit;color:inherit;background:transparent;border:1px solid ${c.line};border-radius:6px;padding:2px 8px}
.code{margin:0;font:13px/1.45 ui-monospace,"Cascadia Mono",Consolas,monospace;white-space:pre-wrap}
.client{border:1px dashed ${c.line}}
</style></head>
<body>${slots.join("\n")}</body></html>
`;
}

/** Trang một cây (ảnh chụp, test). */
export function desktopHtml(tree: DrawNode, o: DesktopPage): string {
  return desktopDoc([desktopSlot(tree, { columns: o.columns, scheme: o.scheme, lang: o.lang, id: "slot" })], { scheme: o.scheme, lang: o.lang, title: o.title });
}
