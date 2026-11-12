import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { kitRoot } from "./commands/home.js";
import { fail } from "./errors.js";
import type { ProbeHit } from "./probe.js";

/**
 * Phép đo `copy`: chữ hiển thị trên trang mang dấu "AI viết, chưa ai đọc lại". Danh sách nằm ở
 * data/copy-tells.json (sửa danh sách không cần sửa mã). Khung hai thế hệ mượn ý từ taste-skill 2.5.1
 * references/copy-tells.md (MIT); từ tiếng Việt lấy từ skill viet-tu-nhien.
 */

/** Một nhóm đã biên dịch sẵn thành nguồn regex, để truyền vào trang (page.evaluate chỉ nhận dữ liệu thuần). */
export interface CopyCategory {
  id: string;
  label: string;
  gen: number;
  min: number;
  attr: boolean;
  res: Array<{ src: string; flags: string }>;
}
export interface CopyRules {
  categories: CopyCategory[];
  vagueLinks: { label: string; names: string[] };
  statStrip: { label: string; min: number; max: number; maxChars: number };
  fragmentHeading: { label: string; minParts: number; maxParts: number; maxWords: number };
}
export interface AssumedHit {
  where: string;
  text: string;
  note: string;
}
export interface CopyResult {
  copy: ProbeHit[];
  assumed: AssumedHit[];
}

export const COPY_RULES_FILE = "data/copy-tells.json";

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Ranh giới từ cho chữ có dấu: `\b` của JS chỉ hiểu chữ ASCII ("góp phần" khớp nhầm trong "đóng góp phầnmềm"). */
const word = (body: string): string => `(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`;

/** Đọc và kiểm tệp luật. Sai cấu trúc hay regex hỏng thì báo lỗi rõ chỗ, không chạy trình duyệt. */
export function parseCopyRules(json: string, file: string): CopyRules {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    fail(`${file}: not valid JSON (${(e as Error).message})`, "VALIDATION_ERROR");
  }
  const o = raw as Record<string, unknown>;
  const bad = (what: string): never => fail(`${file}: ${what}`, "VALIDATION_ERROR", [`Fix ${file}; the format is described in its $comment`]);
  if (!Array.isArray(o.categories) || !o.categories.length) bad("categories must be a non-empty list");
  const ids = new Set<string>();
  const categories = (o.categories as Array<Record<string, unknown>>).map((c, i) => {
    const id = typeof c.id === "string" && c.id ? c.id : bad(`category ${i + 1} has no id`);
    if (ids.has(id)) bad(`duplicate category id "${id}"`);
    ids.add(id);
    const label = typeof c.label === "string" ? c.label : id;
    const min = c.min === undefined ? 1 : Number(c.min);
    if (!Number.isInteger(min) || min < 1) bad(`${id}: min must be a whole number ≥ 1`);
    const start = c.at === "start";
    if (c.at !== undefined && !start) bad(`${id}: at must be "start" or absent`);
    const phrases = (c.phrases ?? []) as unknown[];
    const regex = (c.regex ?? []) as unknown[];
    if (!Array.isArray(phrases) || !Array.isArray(regex)) bad(`${id}: phrases and regex must be lists`);
    const res: Array<{ src: string; flags: string }> = [];
    for (const p of phrases) {
      if (typeof p !== "string" || !p.trim()) bad(`${id}: every phrase must be a non-empty string`);
      const body = word(escapeRe((p as string).normalize("NFC").trim()).replace(/\s+/g, "\\s+"));
      res.push({ src: start ? `^${body}` : body, flags: "iu" });
    }
    for (const r of regex) {
      const src = typeof r === "string" ? r : (r as { re?: unknown })?.re;
      const flags = typeof r === "string" ? "iu" : String((r as { flags?: unknown }).flags ?? "iu");
      if (typeof src !== "string" || !src) bad(`${id}: every regex must be a string or {"re": "...", "flags": "u"}`);
      try {
        new RegExp(src as string, flags);
      } catch (e) {
        bad(`${id}: regex /${src as string}/ does not compile (${(e as Error).message})`);
      }
      res.push({ src: start && !(src as string).startsWith("^") ? `^(?:${src as string})` : (src as string), flags });
    }
    if (!res.length) bad(`${id}: no phrases or regex`);
    return { id, label, gen: Number(c.gen ?? 1), min, attr: c.scope === "text+attr", res };
  });
  const v = (o.vagueLinks ?? {}) as Record<string, unknown>;
  const names = Array.isArray(v.names) ? (v.names as unknown[]).filter((n): n is string => typeof n === "string").map((n) => n.normalize("NFC").toLowerCase()) : [];
  const num = (obj: unknown, k: string, d: number): number => {
    const n = Number((obj as Record<string, unknown> | undefined)?.[k] ?? d);
    return Number.isFinite(n) && n > 0 ? n : bad(`${k} must be a positive number`);
  };
  const lbl = (obj: unknown, d: string): string => {
    const l = (obj as Record<string, unknown> | undefined)?.label;
    return typeof l === "string" ? l : d;
  };
  return {
    categories,
    vagueLinks: { label: lbl(o.vagueLinks, "vague link"), names },
    statStrip: { label: lbl(o.statStrip, "stat strip under the hero"), min: num(o.statStrip, "min", 3), max: num(o.statStrip, "max", 4), maxChars: num(o.statStrip, "maxChars", 32) },
    fragmentHeading: {
      label: lbl(o.fragmentHeading, "fragment heading"),
      minParts: num(o.fragmentHeading, "minParts", 2),
      maxParts: num(o.fragmentHeading, "maxParts", 3),
      maxWords: num(o.fragmentHeading, "maxWords", 4),
    },
  };
}

export function loadCopyRules(file = join(kitRoot(), COPY_RULES_FILE)): CopyRules {
  if (!existsSync(file)) fail(`copy rules not found: ${file}`, "VALIDATION_ERROR", ["Reinstall design-kit (the package ships data/copy-tells.json) or pass --no-copy"]);
  return parseCopyRules(readFileSync(file, "utf8"), file);
}

/**
 * Chạy trong trang (page.evaluate ⇒ tự chứa). Đi xuyên shadow DOM như probePage.
 * - copy: chữ hiện trên trang khớp các nhóm luật, cộng hai dấu cấu trúc (dải chỉ số dưới hero, tiêu đề mảnh cụt)
 *   và nút/liên kết ghi chung chung. Bỏ qua code/pre/kbd/samp, chữ bị ẩn, và vùng `data-copy-ok`.
 * - assumed: mọi phần tử `data-assumed` (dữ kiện agent tự điền: giờ mở cửa, giá, số liệu), hiện hay ẩn.
 */
export function probeCopy(rules: CopyRules): CopyResult {
  const out: CopyResult = { copy: [], assumed: [] };
  const all: Element[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      all.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  const norm = (s: string): string => s.normalize("NFC").replace(/\s+/g, " ").trim();
  const label = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const cls = !id && typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    const host = (el.getRootNode() as ShadowRoot).host;
    const prefix = host ? `${host.tagName.toLowerCase()}::shadow ` : "";
    return `${prefix}${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "CODE", "PRE", "KBD", "SAMP", "TEXTAREA"]);
  const skipped = (el: Element): boolean => SKIP.has(el.tagName) || el.hasAttribute("data-copy-ok") || !!el.closest("[data-copy-ok], code, pre, kbd, samp");
  const shown = (el: Element): boolean => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const inline = (el: Element): boolean => {
    const d = getComputedStyle(el).display;
    return d.startsWith("inline") || d === "contents";
  };
  /** Chữ của một khối: nút chữ và phần tử inline bên trong, dừng ở khối con (khối con được chấm riêng). */
  const blockText = (el: Element): string => {
    let s = "";
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3) s += n.textContent ?? "";
      else if (n.nodeType === 1) {
        const c = n as Element;
        if (c.tagName === "BR") s += " ";
        else if (!skipped(c) && getComputedStyle(c).display !== "none" && inline(c)) s += blockText(c);
        else s += " ";
      }
    }
    return s;
  };
  // Khối chữ: tổ tiên gần nhất (kể cả chính nó) không phải inline của mỗi phần tử có chữ trực tiếp.
  const blocks = new Set<Element>();
  for (const el of all) {
    if (skipped(el)) continue;
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
    if (!own) continue;
    let b: Element = el;
    while (inline(b) && b.parentElement) b = b.parentElement;
    if (!skipped(b) && shown(b)) blocks.add(b);
  }
  const texts: Array<{ el: Element; text: string; attr: boolean }> = [];
  for (const b of blocks) {
    const t = norm(blockText(b));
    if (t) texts.push({ el: b, text: t, attr: false });
  }
  // Thuộc tính người dùng vẫn thấy hoặc nghe (alt, aria-label, title) và tiêu đề tab: chỉ cho nhóm scope text+attr.
  for (const el of all) {
    if (skipped(el)) continue;
    for (const a of ["alt", "aria-label", "title"]) {
      const v = el.getAttribute(a);
      if (v && norm(v)) texts.push({ el, text: norm(v), attr: true });
    }
  }
  if (document.title) texts.push({ el: document.documentElement, text: norm(document.title), attr: true });

  const regs = rules.categories.map((c) => ({ c, res: c.res.map((r) => new RegExp(r.src, r.flags)) }));
  for (const { c, res } of regs) {
    const distinct = new Map<string, Element>();
    for (const t of texts) {
      if (t.attr && !c.attr) continue;
      for (const re of res) {
        const m = re.exec(t.text);
        if (!m) continue;
        const hit = norm(m[0]).slice(0, 60);
        const where = t.el === document.documentElement ? "<title>" : `${label(t.el)}${t.attr ? " (attribute)" : ""}`;
        if (c.min === 1) {
          out.copy.push({ where, value: `${c.label}: "${hit}"` });
          break; // một dòng cho mỗi khối và nhóm
        }
        // Nhóm đếm cụm khác nhau: thử mọi cụm trong khối ("hành trình khám phá" là hai cụm).
        if (!distinct.has(hit.toLowerCase())) distinct.set(hit.toLowerCase(), t.el);
      }
    }
    if (c.min > 1 && distinct.size >= c.min) {
      out.copy.push({ where: "page", value: `${distinct.size} ${c.label}: ${[...distinct.keys()].slice(0, 8).join(", ")}` });
    }
  }

  // ---- Thế hệ 2: dấu ở hình dạng chữ, không ở từ ----
  // Nút/liên kết chỉ ghi "Xem thêm", "Learn more": aria-label nói rõ đích thì không bị báo.
  const vague = new Set(rules.vagueLinks.names);
  for (const el of all) {
    const isBtn = el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button" ||
      (el.tagName === "INPUT" && ["submit", "button"].includes((el as HTMLInputElement).type));
    if (!isBtn || skipped(el) || !shown(el)) continue;
    const name = norm(el.getAttribute("aria-label") || (el.tagName === "INPUT" ? (el as HTMLInputElement).value : el.textContent) || "")
      .toLowerCase()
      .replace(/[\s→›»>…]+$/u, "");
    if (vague.has(name)) out.copy.push({ where: label(el), value: `${rules.vagueLinks.label}: "${name}"` });
  }
  // Tiêu đề mảnh cụt: "Nhanh. Gọn.", "Built for speed. Made for you."
  const fh = rules.fragmentHeading;
  for (const el of all) {
    if (!/^H[1-3]$/.test(el.tagName) || skipped(el) || !shown(el)) continue;
    const t = norm(el.textContent ?? "");
    const parts = t.split(/(?<=\.)\s+/);
    if (parts.length < fh.minParts || parts.length > fh.maxParts) continue;
    if (parts.every((p) => /^[^.!?…]+\.$/u.test(p) && p.split(" ").length <= fh.maxWords)) {
      out.copy.push({ where: label(el), value: `${fh.label}: "${t.slice(0, 60)}"` });
    }
  }
  // Dải chỉ số dưới hero: trong khối chứa h1 (có nút hay liên kết hành động, tức là trang giới thiệu chứ không phải
  // bảng điều khiển) hoặc khối ngay sau nó, một hàng 3–4 ô chữ ngắn, ô nào cũng có con số.
  const ss = rules.statStrip;
  const h1 = all.find((el) => el.tagName === "H1" && shown(el));
  const hero = h1?.closest("section, header, [class*='hero' i]") ?? h1?.parentElement ?? null;
  if (hero && hero.querySelector("a[href], button")) {
    const region = [hero, hero.nextElementSibling].filter((e): e is Element => !!e);
    const NUM = /\d[\d.,]*\s*(\+|%|k\b|m\b|x\b|×|\/\d+)?/iu;
    for (const r of region) {
      // Không tính: hàng của bảng, nhóm nút lọc ("24 giờ · 7 ngày · 30 ngày"), và hình minh hoạ sản phẩm trong
      // <figure> hay aria-hidden (ảnh chụp giả của app, số liệu trạng thái chứ không phải chỉ số khoe).
      const strip = [r, ...Array.from(r.querySelectorAll("*"))].find((el) => {
        if (el.closest("table, figure, [aria-hidden='true']")) return false;
        const kids = Array.from(el.children).filter(shown);
        return kids.length >= ss.min && kids.length <= ss.max &&
          kids.every((k) => {
            if (k.matches("a[href], button, input, select, [role=button]") || k.querySelector("a[href], button, input, select, [role=button]")) return false;
            const t = norm(k.textContent ?? "");
            return t.length > 0 && t.length <= ss.maxChars && NUM.test(t);
          });
      });
      if (strip && !skipped(strip)) {
        const cells = Array.from(strip.children).filter(shown).map((k) => norm(k.textContent ?? "")).join(" · ");
        out.copy.push({ where: label(strip), value: `${ss.label}: "${cells.slice(0, 80)}"` });
        break;
      }
    }
  }

  // ---- data-assumed: dữ kiện agent tự điền, chờ chủ duyệt ----
  for (const el of all) {
    if (!el.hasAttribute("data-assumed")) continue;
    const text = norm(el.getAttribute("content") || (el as HTMLInputElement).value || el.getAttribute("alt") || el.textContent || "");
    out.assumed.push({ where: label(el), text: text.length > 80 ? `${text.slice(0, 80)}…` : text, note: norm(el.getAttribute("data-assumed") ?? "") });
  }
  return out;
}
