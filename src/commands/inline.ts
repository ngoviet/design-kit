import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { type FlagSpec, parseCommandArgs } from "../args.js";
import { serveRoot } from "../browser.js";
import { fail } from "../errors.js";
import type { Runtime } from "../runtime.js";
import { pageWeight, weightDetail } from "../standalone.js";

export const INLINE_HELP = `usage: design-kit inline <page.html> [--ra <out.html>] [--dry-run]
description: Make a page that opens on its own. The Claude app's browser pane opens file:///page.html as a data: URL, so a <link rel="stylesheet"> with a relative path never loads and the page shows bare Times text. This puts each such stylesheet into the page as a <style> in the same place (cascade order unchanged), inlines its relative @imports and rebases its url()s. A stylesheet that only declares fonts stays linked as an extra: with a server it loads, opened as a file the font stack's fallback shows. Fonts are never embedded (the pane does not open a file over 512 KiB)
flags[2]:
  --ra <out.html>: write here instead of overwriting the page
  --dry-run: report what would change, write nothing
notes[2]:
  Running it again on the result changes nothing (no relative stylesheet left)
  Only stylesheets are inlined: a script loaded by path still does not run in the pane
examples[3]:
  design-kit inline .folio/bao-cao.html
  design-kit inline report.html --ra build/report.html
  design-kit inline report.html --dry-run
`;

const FLAGS: Record<string, FlagSpec> = {
  ra: { type: "string", hint: "--ra <out.html>" },
  "dry-run": { type: "boolean", hint: "--dry-run" },
};

/** Có scheme (http:, data:, file:…), bắt đầu bằng // hoặc #: không phải đường dẫn tới tệp cạnh trang. */
const NOT_PATH = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;
/** `@import url(...)` hoặc `@import "..."`, kèm điều kiện (media, layer, supports) tới dấu `;`. URL Google Fonts có `;` bên trong. */
const IMPORT = /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)|"([^"]*)"|'([^']*)')([^;]*);/gi;
const URL_FN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"']*))\s*\)/gi;
const COMMENT = /\/\*[\s\S]*?\*\//g;

const kb = (n: number): number => Math.round(n / 1024);
const slash = (p: string): string => p.split(sep).join("/");
const escAttr = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** Thuộc tính của một thẻ mở (`<link rel=stylesheet href="a.css">`), tên viết thường. */
export function tagAttrs(tag: string): Map<string, string> {
  const out = new Map<string, string>();
  const inner = tag.replace(/^<\w+/, "").replace(/\/?>$/, "");
  for (const m of inner.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    out.set(m[1]!.toLowerCase(), m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

/** Stylesheet chỉ khai báo font: toàn @font-face, hoặc @import tới dịch vụ font (fonts.css của kit gọi Google Fonts). */
export function isFontSheet(css: string): boolean {
  const body = css.replace(COMMENT, "");
  let fonts = 0;
  let rest = body.replace(/@font-face\s*\{[^}]*\}/gi, () => {
    fonts++;
    return "";
  });
  rest = rest.replace(/@charset[^;]*;/gi, "");
  for (const m of rest.matchAll(IMPORT)) {
    if (!/font/i.test(m[0])) return false;
    fonts++;
  }
  return fonts > 0 && rest.replace(IMPORT, "").trim() === "";
}

/** Đường dẫn tệp mà `ref` (tương đối với `fromDir`, hoặc từ gốc "/") trỏ tới; bỏ ?query và #hash. */
function refFile(ref: string, fromDir: string, root: string): string {
  const clean = decodeURIComponent(ref.replace(/[?#].*$/, ""));
  return clean.startsWith("/") ? join(root, clean) : resolve(fromDir, clean);
}

/** Viết lại `ref` (đang tương đối với `fromDir`) cho tệp nằm ở `toDir`. Khác ổ đĩa thì dùng file:// tuyệt đối. */
function rebase(ref: string, fromDir: string, toDir: string, root: string): string {
  if (NOT_PATH.test(ref) || fromDir === toDir) return ref;
  const suffix = /[?#].*$/.exec(ref)?.[0] ?? "";
  const target = refFile(ref, fromDir, root);
  const rel = relative(toDir, target);
  return `${isAbsolute(rel) ? pathToFileURL(target).href : slash(rel) || "."}${suffix}`;
}

interface CssCtx {
  outDir: string;
  root: string;
  warnings: string[];
}

/**
 * Nội dung CSS của `file` (đường dẫn `fromDir`), sẵn để đặt vào trang ở `ctx.outDir`: @import tương đối được gộp
 * vào chỗ (đệ quy), url() được viết lại theo vị trí trang, @import còn lại (tuyệt đối) dồn lên đầu vì @import
 * đứng sau luật khác bị bỏ qua.
 */
function inlineCss(css: string, fromDir: string, ctx: CssCtx, chain: string[]): string {
  const hoisted: string[] = [];
  let body = css.replace(/@charset[^;]*;/gi, "");
  body = body.replace(IMPORT, (stmt, d: string | undefined, s: string | undefined, u: string | undefined, d2: string | undefined, s2: string | undefined, cond: string) => {
    const ref = (d ?? s ?? u ?? d2 ?? s2 ?? "").trim();
    if (NOT_PATH.test(ref)) {
      hoisted.push(stmt);
      return "";
    }
    const file = refFile(ref, fromDir, ctx.root);
    if (cond.trim() || !existsSync(file) || chain.includes(file)) {
      const why = cond.trim() ? `has a condition (${cond.trim()})` : !existsSync(file) ? "file not found" : "imports itself";
      ctx.warnings.push(`@import ${ref} left as is: ${why}`);
      hoisted.push(stmt.replace(ref, rebase(ref, fromDir, ctx.outDir, ctx.root)));
      return "";
    }
    return `/* ---- @import ${ref} ---- */\n${inlineCss(readFileSync(file, "utf8"), dirname(file), ctx, [...chain, file])}\n`;
  });
  body = body.replace(URL_FN, (whole, d: string | undefined, s: string | undefined, u: string | undefined) => {
    const ref = (d ?? s ?? u ?? "").trim();
    if (!ref || NOT_PATH.test(ref)) return whole;
    return `url("${rebase(ref, fromDir, ctx.outDir, ctx.root)}")`;
  });
  return [...hoisted, body.trim()].join("\n");
}

export async function inlineCommand(args: string[], rt: Runtime): Promise<Record<string, unknown>> {
  const p = parseCommandArgs("inline", args, FLAGS, { min: 1, max: 1, usage: "<page.html>" });
  const arg = p.positionals[0]!;
  const page = resolve(rt.cwd, arg);
  if (!existsSync(page) || statSync(page).isDirectory()) fail(`not found: ${arg}`, "VALIDATION_ERROR", ["Pass one .html file"]);
  if (!/\.html?$/i.test(page)) fail(`not an .html file: ${arg}`, "VALIDATION_ERROR", ["Pass the page, not a stylesheet"]);
  const ra = p.str("ra");
  const out = ra ? resolve(rt.cwd, ra) : page;
  if (ra && existsSync(out) && statSync(out).isDirectory()) fail(`--ra is a folder: ${ra}`, "VALIDATION_ERROR", ["Give a file name, e.g. --ra build/page.html"]);
  const dry = p.bool("dry-run");
  const pageDir = dirname(page);
  const outDir = dirname(out);
  const root = serveRoot(page);
  const show = (f: string): string => slash(relative(rt.cwd, f)) || f;

  const html = readFileSync(page, "utf8");
  const comments = [...html.matchAll(/<!--[\s\S]*?-->/g)].map((m) => [m.index, m.index + m[0].length] as const);
  const inComment = (i: number): boolean => comments.some(([a, b]) => i >= a && i < b);
  const ctx: CssCtx = { outDir, root, warnings: [] };
  const inlined: Array<{ href: string; kb: number }> = [];
  const kept: Array<{ href: string; why: string }> = [];
  const missing: string[] = [];

  let next = html.replace(/<link\b[^>]*>/gi, (tag: string, at: number) => {
    if (inComment(at)) return tag;
    const a = tagAttrs(tag);
    const href = a.get("href");
    if (!(a.get("rel") ?? "").toLowerCase().split(/\s+/).includes("stylesheet") || !href || NOT_PATH.test(href) || a.has("disabled")) return tag;
    const file = refFile(href, pageDir, root);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      missing.push(href);
      return tag;
    }
    const css = readFileSync(file, "utf8");
    if (isFontSheet(css)) {
      kept.push({ href, why: "font stylesheet: loads with a server, the font stack's fallback shows when opened as a file" });
      const moved = rebase(href, pageDir, outDir, root);
      return moved === href ? tag : tag.replace(href, escAttr(moved));
    }
    const body = inlineCss(css, dirname(file), ctx, [file]).replace(/<\/style/gi, "<\\/style");
    inlined.push({ href, kb: Math.max(1, kb(Buffer.byteLength(body))) });
    const media = a.get("media");
    return `<style data-dk-inline="${escAttr(href)}"${media && media !== "all" ? ` media="${escAttr(media)}"` : ""}>\n${body}\n</style>`;
  });
  // <style> của chính trang: gộp @import tương đối; đổi thư mục (--ra) thì viết lại url() theo chỗ mới.
  next = next.replace(/(<style\b(?![^>]*data-dk-inline)[^>]*>)([\s\S]*?)(<\/style>)/gi, (whole, open: string, css: string, close: string) => {
    const relImport = [...css.matchAll(IMPORT)].some((m) => !NOT_PATH.test((m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "").trim()));
    if (!relImport && outDir === pageDir) return whole;
    const before = inlined.length;
    if (relImport) inlined.push({ href: "<style> @import", kb: 0 });
    const body = inlineCss(css, pageDir, ctx, [page]);
    if (relImport) inlined[before]!.kb = Math.max(1, kb(Buffer.byteLength(body)));
    return `${open}\n${body.replace(/<\/style/gi, "<\\/style")}\n${close}`;
  });
  if (outDir !== pageDir && /\s(src|href)\s*=\s*["']?(?![a-z][a-z0-9+.-]*:|\/\/|#)[^"'\s>]/i.test(next.replace(/<link\b[^>]*>/gi, ""))) {
    ctx.warnings.push("the page has other relative paths (img, script, a): they were not rebased for the new folder");
  }

  const before = Buffer.byteLength(html);
  const { bytes, fontBytes } = pageWeight(next);
  const changed = next !== html || out !== page;
  if (changed && !dry) writeFileSync(out, next, "utf8");
  const weight = weightDetail(bytes, fontBytes);
  if (weight) ctx.warnings.push(weight);

  const result: Record<string, unknown> = {
    status: inlined.length
      ? `${dry ? "would inline" : "inlined"} ${inlined.length} stylesheet${inlined.length > 1 ? "s" : ""}${kept.length ? `, kept ${kept.length} font link${kept.length > 1 ? "s" : ""}` : ""}`
      : `nothing to inline: no <link rel="stylesheet"> with a relative path${kept.length ? ` other than ${kept.length} font link${kept.length > 1 ? "s" : ""}` : ""}`,
    page: show(page),
    written: dry ? "dry run: nothing written" : changed ? `${show(out)} (${kb(before)} → ${kb(bytes)} KB)` : "nothing written: no change",
  };
  if (inlined.length) result["inlined"] = inlined;
  if (kept.length) result["kept"] = kept;
  if (missing.length) result["missing"] = missing.map((m) => `${m}: file not found, link left as is`);
  if (ctx.warnings.length) result["warnings"] = ctx.warnings;
  const help: string[] = [];
  if (dry && inlined.length) help.push(`Run without --dry-run to write ${show(out)}`);
  if (!dry && changed) help.push(`Run \`design-kit check ${show(out)}\`: the standalone row should read ok`);
  if (missing.length) help.push("Fix the missing paths (or remove the links), then run inline again");
  if (inlined.length && out === page && !dry) help.push("The page now holds a copy of the CSS: when the token files will still change, keep the linked page as the source and write the copy with --ra");
  result["help"] = help;
  return result;
}
