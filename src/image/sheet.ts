// Tờ soát cho người duyệt (phần "human" của cổng): hình ở nhiều cỡ trên nền sáng và tối, thang xám, một màu, lưới điểm ở
// cỡ gốc, chỗ chi tiết mất ở 16px, bản nheo mắt. Vẽ bằng chính trình duyệt rồi chụp thành PNG.
import type { Page } from "playwright-core";
import type { Kind } from "./score.js";

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#f4f4f2;color:#1c1c1a;font:14px/1.5 system-ui,"Segoe UI",sans-serif}
#sheet{display:inline-block;padding:20px 24px;min-width:640px}
h1{font-size:16px;margin:0 0 2px;font-weight:650}
.sub{color:#55554f;margin:0 0 14px;font-size:13px}
.row{display:flex;align-items:flex-end;gap:18px;padding:12px 14px;border-radius:8px;margin-bottom:8px}
.row>b{width:108px;flex:none;font-size:13px;font-weight:600;align-self:center}
.light{background:#ffffff;border:1px solid #e2e2dc}.dark{background:#121212;color:#ececea}
.cell{display:flex;flex-direction:column;align-items:center;gap:4px}
.cell span{font-size:12px;color:#6b6b64}.dark .cell span{color:#a5a59e}
.gray img{filter:grayscale(1)}.one img{filter:brightness(0)}.dark.one img{filter:brightness(0) invert(1)}
.check{background-color:#fff;background-image:linear-gradient(45deg,#ddd 25%,transparent 25%,transparent 75%,#ddd 75%),linear-gradient(45deg,#ddd 25%,transparent 25%,transparent 75%,#ddd 75%);background-size:16px 16px;background-position:0 0,8px 8px}
canvas.px{image-rendering:pixelated}
.squint img{filter:blur(5px)}
.legend{font-size:12px;color:#55554f}.legend i{display:inline-block;width:10px;height:10px;margin:0 4px 0 10px;vertical-align:-1px}
table{border-collapse:collapse;background:#fff;border:1px solid #e2e2dc;border-radius:8px}
td,th{padding:6px 10px;border-bottom:1px solid #ecece6;font-size:13px;text-align:center}
th{font-weight:600;color:#55554f}td.name{text-align:left;max-width:240px;overflow-wrap:anywhere}
td.dk{background:#121212}td.flag{color:#a33a00;text-align:left;font-size:12px;max-width:320px}
`;

export interface SheetInput {
  title: string;
  subtitle: string;
  kind: Kind;
  /** Ảnh dạng data: URL; chèn bằng blob URL trong trang. */
  src: string;
  nw: number;
  nh: number;
  /** Có tách được hình khỏi nền (alpha/plain) để thử một màu. */
  oneColor: boolean;
  /** Nền trong suốt: mới cần hàng nền tối riêng. */
  transparent: boolean;
  /** Icon tô bằng currentColor: trong <img> nó luôn đen, trên trang tối nó lấy màu chữ (trắng). */
  themed?: boolean;
  native?: number;
  /** Mặt nạ chi tiết mất ở 16 px (1 mực, 2 khe), cỡ ảnh tham chiếu. */
  lost?: { w: number; h: number; mask: Uint8Array; size: number };
  /**
   * Độ phủ của hình (0–255, cỡ tham chiếu) khi hình có nền riêng (nền đặc, ô gạch): bản một màu vẽ từ mặt nạ này,
   * vì lọc CSS brightness(0) sẽ tô đen cả ô.
   */
  figure?: { w: number; h: number; mask: Uint8Array };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Kích thước một ô: icon theo cạnh, logo theo chiều cao, minh hoạ theo bề rộng. */
function box(kind: Kind, size: number, nw: number, nh: number): { w: number; h: number } {
  const a = nw / Math.max(1, nh);
  if (kind === "illustration") return { w: size, h: Math.round(size / a) };
  if (kind === "icon") return a >= 1 ? { w: size, h: Math.round(size / a) } : { w: Math.round(size * a), h: size };
  return { w: Math.round(size * a), h: size };
}

function cells(kind: Kind, sizes: number[], nw: number, nh: number, unit: string, fig?: "black" | "white"): string {
  return sizes.map((s) => {
    const b = box(kind, s, nw, nh);
    const el = fig
      ? `<canvas data-fig="${fig}" data-w="${b.w}" data-h="${b.h}" style="width:${b.w}px;height:${b.h}px"></canvas>`
      : `<img data-img width="${b.w}" height="${b.h}" alt="">`;
    return `<div class="cell">${el}<span>${s}${unit}</span></div>`;
  }).join("");
}

export function sheetHtml(x: SheetInput): string {
  const sizes = x.kind === "icon" ? [16, 20, 24, 32, 48, 96] : x.kind === "logo" ? [16, 24, 32, 48, 96] : [160, 320];
  const big = x.kind === "illustration" ? 560 : x.kind === "logo" ? 200 : 192;
  const unit = x.kind === "logo" ? " px tall" : " px";
  const row = (cls: string, label: string, list = sizes) => `<div class="row ${cls}"><b>${label}</b>${cells(x.kind, list, x.nw, x.nh, unit)}</div>`;
  const bigBox = box(x.kind, big, x.nw, x.nh);
  const parts = [
    `<h1>${esc(x.title)}</h1><p class="sub">${esc(x.subtitle)}</p>`,
    row("light", x.transparent ? "On light" : "Sizes"),
    ...(x.transparent ? [x.themed ? row("dark one", "On dark (text color)") : row("dark", "On dark")] : []),
    row("light gray", "Grayscale"),
  ];
  if (x.oneColor && x.kind !== "illustration") {
    if (x.figure) {
      // Hình có nền riêng: vẽ từ mặt nạ hình, nền ô bỏ đi.
      parts.push(
        `<div class="row light"><b>One color</b>${cells(x.kind, sizes, x.nw, x.nh, unit, "black")}</div>`,
        `<div class="row dark"><b>Reversed</b>${cells(x.kind, sizes, x.nw, x.nh, unit, "white")}</div>`,
      );
    } else parts.push(row("light one", "One color"), row("dark one", "Reversed"));
  }
  if (x.kind === "icon" && x.native) {
    parts.push(`<div class="row light"><b>Pixels at ${x.native} px</b><div class="cell"><canvas class="px" data-px="${x.native}" style="width:${x.native * 8}px;height:${x.native * 8}px"></canvas><span>×8, each square is one screen pixel</span></div></div>`);
  }
  if (x.lost) {
    parts.push(`<div class="row light"><b>Lost at ${x.lost.size} px</b><div class="cell"><canvas data-lost style="width:${bigBox.w}px;height:${bigBox.h}px"></canvas><span class="legend"><i style="background:#d62d20"></i>stroke or dot finer than 1 px<i style="background:#f2a900"></i>gap that fills in</span></div></div>`);
  }
  if (x.kind === "illustration") {
    parts.push(`<div class="row light squint"><b>Squint</b>${cells(x.kind, [320], x.nw, x.nh, " px")}<span class="legend">what still stands out when blurred is what the eye goes to first</span></div>`);
  }
  parts.push(`<div class="row check"><b style="color:#1c1c1a">Large</b><div class="cell"><img data-img width="${bigBox.w}" height="${bigBox.h}" alt=""></div></div>`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="sheet">${parts.join("")}</div></body></html>`;
}

/** Trong trang: gắn ảnh vào mọi ô, vẽ ô lưới điểm, ô chi tiết mất và bản một màu từ mặt nạ hình. */
async function pageFill(arg: { src: string; lost?: { w: number; h: number; b64: string }; figure?: { w: number; h: number; b64: string } }): Promise<void> {
  if (arg.figure) {
    const { w, h } = arg.figure;
    const bytes = atob(arg.figure.b64);
    for (const color of ["black", "white"] as const) {
      const src = document.createElement("canvas");
      src.width = w;
      src.height = h;
      const id = src.getContext("2d")!.createImageData(w, h);
      const v = color === "black" ? 0 : 255;
      for (let p = 0; p < w * h; p++) id.data.set([v, v, v, bytes.charCodeAt(p)], p * 4);
      src.getContext("2d")!.putImageData(id, 0, 0);
      for (const c of Array.from(document.querySelectorAll<HTMLCanvasElement>(`canvas[data-fig="${color}"]`))) {
        c.width = Number(c.dataset["w"]);
        c.height = Number(c.dataset["h"]);
        const g = c.getContext("2d")!;
        g.imageSmoothingQuality = "high";
        g.drawImage(src, 0, 0, c.width, c.height);
      }
    }
  }
  const blob = await (await fetch(arg.src)).blob();
  const url = URL.createObjectURL(blob);
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[data-img]"));
  for (const i of imgs) i.src = url;
  await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)));
  const base = new Image();
  base.src = url;
  await base.decode().catch(() => undefined);
  for (const c of Array.from(document.querySelectorAll<HTMLCanvasElement>("canvas[data-px]"))) {
    const n = Number(c.dataset["px"]);
    c.width = n;
    c.height = n;
    c.getContext("2d")!.drawImage(base, 0, 0, n, n);
  }
  const lc = document.querySelector<HTMLCanvasElement>("canvas[data-lost]");
  if (lc && arg.lost) {
    const { w, h } = arg.lost;
    lc.width = w;
    lc.height = h;
    const g = lc.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.35;
    g.drawImage(base, 0, 0, w, h);
    g.globalAlpha = 1;
    const bytes = atob(arg.lost.b64);
    const over = g.createImageData(w, h);
    for (let p = 0; p < w * h; p++) {
      const v = bytes.charCodeAt(p);
      if (!v) continue;
      const [r, gg, b] = v === 1 ? [214, 45, 32] : [242, 169, 0];
      over.data.set([r, gg, b, 255], p * 4);
    }
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    tmp.getContext("2d")!.putImageData(over, 0, 0);
    g.drawImage(tmp, 0, 0);
  }
}

export async function shootSheet(page: Page, x: SheetInput, path: string): Promise<void> {
  await page.setContent(sheetHtml(x), { waitUntil: "load" });
  await page.evaluate(pageFill, {
    src: x.src,
    ...(x.lost ? { lost: { w: x.lost.w, h: x.lost.h, b64: Buffer.from(x.lost.mask).toString("base64") } } : {}),
    ...(x.figure ? { figure: { w: x.figure.w, h: x.figure.h, b64: Buffer.from(x.figure.mask).toString("base64") } } : {}),
  });
  await page.locator("#sheet").screenshot({ path });
}

export interface SetRow {
  name: string;
  src: string;
  flag: string;
}

/** Tờ soát cả bộ icon: mỗi icon một hàng, 16/24/32/48 trên nền sáng và 24 trên nền tối, kèm điểm lệch. */
export async function shootSetSheet(page: Page, rows: SetRow[], title: string, path: string): Promise<void> {
  const head = `<tr><th>Icon</th><th>16</th><th>24</th><th>32</th><th>48</th><th>24 dark</th><th>Differs from the set</th></tr>`;
  const body = rows.map((r, i) => `<tr><td class="name">${esc(r.name)}</td>${[16, 24, 32, 48].map((s) => `<td><img data-i="${i}" width="${s}" height="${s}" alt=""></td>`).join("")}<td class="dk"><img data-i="${i}" width="24" height="24" alt="" style="filter:brightness(0) invert(1)"></td><td class="flag">${esc(r.flag)}</td></tr>`).join("");
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="sheet"><h1>${esc(title)}</h1><p class="sub">Dark column shows the icon in white (one-color), as currentColor would on a dark background</p><table>${head}${body}</table></div></body></html>`, { waitUntil: "load" });
  await page.evaluate(async (srcs: string[]) => {
    const urls = await Promise.all(srcs.map(async (s) => URL.createObjectURL(await (await fetch(s)).blob())));
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[data-i]"));
    for (const i of imgs) i.src = urls[Number(i.dataset["i"])]!;
    await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)));
  }, rows.map((r) => r.src));
  await page.locator("#sheet").screenshot({ path });
}
