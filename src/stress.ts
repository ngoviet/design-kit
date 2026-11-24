import type { Page } from "playwright-core";
import { type ProbeHit, probeCovered, probePage, settleAnimations } from "./probe.js";
import { type NetWatch, settleAfterChange } from "./settle.js";

/**
 * Phép đo `stress` (mềm, 24/11/2026): bố cục có chịu được nội dung mà dữ liệu mẫu chưa có không.
 *
 * Trang mẫu luôn vừa vì tên mẫu ngắn và số mẫu nhỏ; trang thật gặp tên cơ quan dài, tên tệp không có dấu cách, doanh thu hàng tỉ.
 * Ba lượt, mỗi lượt sửa chữ ngay trên trang, đo lại tràn ngang, chữ bị cắt, chữ bị che, rồi trả chữ về:
 * - `longer`: chữ ngắn của giao diện (tiêu đề, ô bảng, nhãn, nút, mục danh sách) dài thêm khoảng 50% bằng chữ Việt có dấu.
 * - `word`: thêm một từ không ngắt được (LONG_WORD) vào chỗ dữ liệu: ô tên của bảng, tên, email, tên tệp, tiêu đề thẻ.
 * - `number`: số thêm ba chữ số, giữ cách viết (1.250.000 ₫ → 1.250.000.000 ₫; 12,5% → 12.000,5%).
 * Chỉ báo thứ MỚI so với trước khi kéo dài. Ý ba lượt và luật "số nhiều hơn chữ thì mới là số liệu": renderlint
 * (docs/rules.md `fragile-layout`, MIT), tự viết lại.
 *
 * `data-stress-ok="<lý do>"` trên phần tử hay tổ tiên: chữ cố định, không bao giờ dài hơn (mã trạng thái, hình minh hoạ).
 *
 * Trả chữ về nguyên văn, nhưng trang nghe MutationObserver có thể đã phản ứng, và chữ giống hệt vẫn mất vùng đang chọn: gọi SAU
 * mọi phép đo khác trên cùng lần nạp. Trang giữ lại chữ kéo dài (tự chép chữ sang chỗ khác) thì ném lỗi thay vì báo bừa.
 */
export interface StressFinding {
  check: "stress";
  where: string;
  detail: string;
}

export type StressKind = "longer" | "word" | "number";

/** 37 chữ cái liền: cỡ một email hay tên tệp dài thường gặp. Không có dấu gạch nối hay dấu chấm, vì trình duyệt ngắt dòng ở đó. */
export const LONG_WORD = "baocaotonghopdoanhthuquybachinhanhhue";

/** Phần trăm chữ thêm của lượt `longer`. */
export const LONGER_BY = 0.5;

/** Chữ Việt thật, đủ dấu chồng (ở, vực, phía, những): hộp vừa khít chiều cao mà cắt dấu thì cũng lộ ra. */
export const FILLER = "ở khu vực phía Bắc và những tỉnh lân cận thuộc miền Trung".split(" ");

/** Số phát hiện của mỗi lượt; phần còn lại gộp vào một dòng. */
const CAP = 4;

/** Chữ dài thêm khoảng `by`: nối từ trong FILLER cho tới đủ. Ít nhất một từ. */
export function longer(text: string, by: number, filler: string[]): string {
  const want = Math.max(2, Math.round(text.trim().length * by));
  let add = "";
  for (let i = 0; !add || add.length + 1 < want; i++) add += `${add ? " " : ""}${filler[i % filler.length]}`;
  return text.replace(/(\s*)$/, ` ${add}$1`);
}

/** Chữ có số nhưng không phải số liệu: giờ, ngày, phân số, mã, phiên bản, sao, độ, "4K", "24h". */
const NOT_AMOUNT = /\d\s*[:h]\s*\d|\d\s*[/]\s*\d|\d{4}-\d{1,2}|\d-\d{1,2}-\d|[★☆⭐°#]|\p{L}[-_.]?\d|\d(?:[KGDhp]|MP|px|fps)\b/u;
/** Điện thoại, tổng đài. */
const PHONE = /^\(?(?:\+\d{1,3}|0)[\d\s().-]{8,}$|^1[89]00[\s.]?\d{4,6}$/;
/** Bốn số 0–255 không có số 0 đứng đầu: địa chỉ IP, kể cả khi trông như dấu nhóm (192.168.100.200). */
const IP = /^(?:(?:0|[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])(?:\.|$)){4}$/;

/**
 * Mọi số trong chữ thêm ba chữ số, giữ dấu nhóm, dấu thập phân, ký hiệu tiền và phần trăm. Trả undefined khi chữ không phải số
 * liệu: ngày, giờ, địa chỉ IP, số điện thoại, phiên bản, mã, năm, phân số, số sao, nhiệt độ, và câu có nhiều chữ cái hơn chữ số
 * ("7 ngày", "Tầng 12"). `vi`: trang tiếng Việt, "1.250" là một nghìn hai trăm năm mươi.
 */
export function bigger(text: string, vi: boolean): string | undefined {
  const t = text.trim();
  const digits = (t.match(/\d/g) ?? []).length;
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  if (t.length < 2 || t.length > 40 || !digits || digits < letters) return undefined;
  if (NOT_AMOUNT.test(t) || PHONE.test(t) || IP.test(t)) return undefined;
  // "1.2.3", "10.0.0.1": từ hai dấu chấm trở lên mà không phải dấu nhóm ba chữ số.
  if ((t.match(/\d+(?:\.\d+){2,}/g) ?? []).some((x) => !/^\d{1,3}(?:\.\d{3})+$/.test(x))) return undefined;
  const out = text.replace(/\d+(?:[.,\s]\d{3}(?!\d))*(?:[.,]\d+)?/g, (tok) => {
    const seps = tok.match(/[.,\s]/g) ?? [];
    const last = seps.at(-1);
    const cut = last === undefined ? tok.length : tok.lastIndexOf(last);
    const tail = tok.length - cut - 1;
    // "12,5": dấu thập phân. "1.250.000": dấu nhóm. Một dấu duy nhất đứng trước đúng ba chữ số thì theo ngôn ngữ của trang.
    const decimal = (last === "." || last === ",") && (tail !== 3 || seps[0] !== last || (seps.length === 1 && last === (vi ? "," : ".")));
    const whole = decimal ? tok.slice(0, cut) : tok;
    const frac = decimal ? tok.slice(cut) : "";
    const raw = whole.replace(/\D/g, "");
    const groups = seps.length - (decimal ? 1 : 0);
    // Viết liền: năm, mã bắt đầu bằng 0, số dài từ chín chữ số (căn cước, tài khoản) thì để yên.
    if (!decimal && !groups && (/^(?:19|20)\d\d$/.test(raw) || /^0\d/.test(raw) || raw.length >= 9)) return tok;
    const grown = `${raw === "0" ? "1" : raw}000`;
    // Số dài viết liền (1250000) thì giữ viết liền; số ngắn (182) lên hàng nghìn thì người ta mới thêm dấu nhóm.
    if (!groups && raw.length > 3) return grown + frac;
    const group = groups ? seps[0]! : decimal ? (last === "," ? "." : ",") : vi ? "." : ",";
    return grown.replace(/\B(?=(?:\d{3})+$)/g, group) + frac;
  });
  return out === text ? undefined : out;
}

/** Sổ của một lượt, giữ trong trang để trả chữ về. */
interface Changed {
  node: Text;
  text: string;
  set: string;
}

/**
 * Chọn nút chữ cho một lượt. Trả về chữ của từng nút; nút được giữ trong `window.__dkStressPick`. Hàm tự chứa, đi xuyên open
 * shadow root.
 */
export function pickText(kind: StressKind): string[] {
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const near = (el: Element, sel: string): Element | null => {
    for (let a: Element | null = el; a; a = up(a)) if (a.matches(sel)) return a;
    return null;
  };
  const SKIP =
    "script, style, noscript, template, textarea, input, select, option, code, pre, kbd, samp, var, svg, time, math, meter, progress, [role=meter], [role=progressbar], [role=img], [role=timer], " +
    "[data-stress-ok], [contenteditable]:not([contenteditable=false]), [aria-hidden=true], [inert], [translate=no]";
  const BRAND = "[class*=logo i], [id*=logo i], [class*=brand i], [id*=brand i], [class*=thuong-hieu i], [itemprop=logo]";
  const UI =
    "h1, h2, h3, h4, h5, h6, td, th, dt, dd, label, legend, button, summary, figcaption, caption, li, [role=button], [role=tab], [role=menuitem], [role=option], [role=heading], [role=cell], [role=gridcell], [role=columnheader], [role=rowheader], [role=listitem], [role=treeitem]";
  const NAME = /(^|[-_\s])(name|ten|email|mail|user(name)?|file(name)?|tep|host(name)?|product|san-pham|khach(-hang)?)([-_\s]|$)/i;
  const TOKEN = /\S@\S+\.\S|\b[\w-]+\.(?:com|net|org|vn|io|pdf|docx?|xlsx?|jpe?g|png|zip|csv)\b/i;
  const PAGE_TITLE =/(^|[-_\s])(page|site|section|hero|trang|muc|doc|app)([-_\s]|$)/i;
  const home = new URL("/", location.href).href;
  const here = location.href.replace(/#.*$/, "");
  // Liên kết đầu tiên của đầu trang dẫn về trang chủ: logo chữ, kể cả khi lớp CSS không có chữ "logo".
  const isHome = (el: Element): boolean => {
    const a = near(el, "a[href]") as HTMLAnchorElement | null;
    const bar = a && near(a, "header, [role=banner], nav");
    if (!a || !bar || bar.querySelector("a[href]") !== a) return false;
    const h = a.href.replace(/#.*$/, "");
    return h === home || h === here || /\/index\.html?$/.test(h);
  };
  // Vùng cuộn ngang có chủ ý: chữ dài trong đó cuộn tới được. Vỏ app tự cuộn (chứa main hay h1) thì không tính, vì `overflow-y: auto`
  // cũng làm overflow-x tính ra auto.
  const scrollers = new Map<Element, boolean>();
  const scrollsX = (el: Element): boolean => {
    if (el === document.body || el === document.documentElement) return false;
    const was = scrollers.get(el);
    if (was !== undefined) return was;
    const own = /^(auto|scroll)$/.test(getComputedStyle(el).overflowX) && !el.matches("main, [role=main]") && !el.querySelector("main, [role=main], h1");
    const p = up(el);
    const out = own || (!!p && scrollsX(p));
    scrollers.set(el, out);
    return out;
  };
  const blockOf = (el: Element): Element => {
    let a: Element = el;
    while (/^(inline|contents|ruby|ruby-text)$/.test(getComputedStyle(a).display)) {
      const p = up(a);
      if (!p) break;
      a = p;
    }
    return a;
  };
  const W = document.documentElement.scrollWidth;
  const shown = (el: Element): boolean => {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    // sr-only, hay nằm ngoài trang (liên kết bỏ qua điều hướng, ngăn kéo đang đóng).
    return r.width > 1 && r.height > 1 && r.right + scrollX > 0 && r.bottom + scrollY > 0 && r.left + scrollX < W;
  };
  // Viên trạng thái: tập giá trị cố định, không phải dữ liệu tự do.
  const isPill = (el: Element, stop: Element): boolean => {
    for (let a: Element | null = el; a && a !== stop; a = up(a)) {
      const cs = getComputedStyle(a);
      if (parseFloat(cs.borderTopLeftRadius) >= 6 && (!/rgba\(\d+, \d+, \d+, 0\)|^transparent$/.test(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0)) return true;
    }
    return false;
  };
  const norm = (s: string): string => s.replace(/\s+/g, " ").trim();
  // Nhãn thứ tự (Thứ 2, Tháng 11, Bước 3): tập giá trị cố định.
  const ORDINAL = /^(thứ|tháng|quý|bước|ngày|tuần|tầng|phòng|bài|chương|phần|mục|kỳ|day|week|month|step|chapter|part)[\s.]+\S{1,5}$/i;
  // Thẻ mang dữ liệu: ngoài tiêu đề còn có liên kết, điều khiển, ảnh, giờ, hay một con số đứng riêng ("3 đơn chờ"). Thẻ chỉ có tiêu
  // đề và vài câu là lời giới thiệu do người viết trang đặt, không bao giờ chứa tên tệp dài. "1", "2": số thứ tự, không tính.
  const isDataCard = (c: Element, h: Element): boolean =>
    c.matches("a[href], button") ||
    !!c.querySelector("a[href], button, input, time, img, [role=img], progress, meter") ||
    Array.from(c.querySelectorAll("*")).some((x) => {
      const t = x.childElementCount || h.contains(x) ? "" : norm(x.textContent ?? "");
      return t.length <= 24 && /\d/.test(t) && !/^\d{1,2}\.?$/.test(t);
    });
  // Tiêu đề thẻ: tiêu đề trong một khối lặp lại (mục danh sách, ô lưới, article cạnh article, ≥ 3 anh em cùng thẻ cùng lớp).
  // `section` lặp lại là các phần của trang, article có h1 là bài viết: tiêu đề ở đó không phải dữ liệu.
  const isCardTitle = (el: Element): boolean => {
    const h = near(el, "h2, h3, h4, h5, h6, [role=heading]") ?? near(el, "[class*=title i], [class*=tieu-de i]");
    if (!h || h.matches("h1, caption, legend, figcaption, label")) return false;
    const item = near(h, "li, td, [role=listitem], [role=row], [role=gridcell]");
    if (item) return isDataCard(item, h);
    const twin = /^H[2-6]$/.test(h.tagName) ? h.tagName : h.classList[0] ? `.${CSS.escape(h.classList[0])}` : h.tagName;
    for (let c = up(h), i = 0; c && i < 4; c = up(c), i++) {
      const p = c.parentElement;
      if (!p) return false;
      if (!/^(A|ARTICLE|BUTTON|DIV|LABEL|LI)$/.test(c.tagName) || c.querySelector("h1")) continue;
      const same = Array.from(p.children).filter((x) => x.tagName === c!.tagName && x.className === c!.className && x.querySelector(twin));
      if (same.length >= (c.tagName === "ARTICLE" ? 2 : 3)) return isDataCard(c, h);
    }
    return false;
  };
  // Ô tên của một hàng: ô đầu tiên có chữ mà không phải ô đánh số, ô chọn. Cột lặp lại cùng giá trị là danh mục, không phải tên.
  const isNameCell = (el: Element): boolean => {
    const cell = near(el, "td, th, [role=cell], [role=gridcell], [role=rowheader]");
    const row = cell && near(cell, "tr, [role=row]");
    if (!cell || !row || near(cell, "thead") || cell.matches("th:not([scope=row]), [role=columnheader]")) return false;
    const cells = Array.from(row.children);
    const first = cells.find((c) => /\p{L}{2}/u.test(c.textContent ?? ""));
    const text = norm(cell.textContent ?? "");
    // Email, tên miền, tên tệp ở cột nào cũng là dữ liệu không ngắt được.
    if (TOKEN.test(text)) return true;
    if (cell !== first) return false;
    const at = cells.indexOf(cell);
    const col = Array.from(row.parentElement?.children ?? []).map((r) => norm(r.children[at]?.textContent ?? ""));
    return col.filter((x) => x === text).length < 2;
  };
  const isName = (el: Element, block: Element): boolean => {
    if (near(el, "button, [role=button], h1, nav, [role=tablist], label, legend, summary")) return false;
    for (let a: Element | null = el, i = 0; a && i < 2; a = up(a), i++) {
      const key = `${typeof a.className === "string" ? a.className : ""} ${a.id} ${a.getAttribute("itemprop") ?? ""} ${a.getAttribute("data-field") ?? ""}`;
      if (NAME.test(key) && !PAGE_TITLE.test(key)) return true;
      if (a === block) break;
    }
    return false;
  };

  // Đơn vị đứng ngay sau số (182,4 Mb/s; 18 ms): không dịch, không dài ra.
  const isUnit = (n: Text, t: string): boolean => {
    if (t.length > 6 || / /.test(t)) return false;
    // Chỉ leo qua thẻ trong dòng: ô bảng bên trái có số không làm chữ của ô này thành đơn vị.
    for (let x: Node = n; x === n || /^(SPAN|SMALL|SUB|SUP|I|EM|B|STRONG|ABBR)$/.test(x.nodeName); x = x.parentNode!) {
      for (let p = x.previousSibling; p; p = p.previousSibling) {
        const before = norm(p.textContent ?? "");
        if (before) return /[0-9]$/.test(before);
      }
    }
    return false;
  };

  const picked: Text[] = [];
  const doneBlocks = new Set<Element>();
  const visit = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) visit(el.shadowRoot);
      const nodes = Array.from(el.childNodes).filter((n): n is Text => n.nodeType === 3 && norm((n as Text).data).length > 1);
      if (!nodes.length || near(el, SKIP) || !shown(el) || near(el, BRAND) || isHome(el) || scrollsX(el)) continue;
      const block = blockOf(el);
      const all = norm(block.textContent ?? "");
      for (const n of nodes) {
        const t = norm(n.data);
        if (kind === "number") {
          picked.push(n);
          continue;
        }
        // Chữ cái đầu trong vòng tròn (NV), từ viết tắt (CPU): không dài thêm. Số, dấu: không phải chữ.
        if (!/\p{L}{2}/u.test(t) || /^[\p{Lu}\d]{2,3}$/u.test(t)) continue;
        if (kind === "longer") {
          if (isUnit(n, t)) continue;
          if (near(el, UI) ? all.length <= 160 : all.length <= 60) picked.push(n);
          continue;
        }
        // Câu thì không phải tên. Mỗi khối một từ dài là đủ.
        if (all.length > 60 || /[.!?…]\s|[.!?…]$/.test(t) || ORDINAL.test(t) || doneBlocks.has(block)) continue;
        const cell = near(el, "td, th, [role=cell], [role=gridcell], [role=rowheader]");
        if (cell ? doneBlocks.has(cell) || isPill(el, cell) || !!near(el, "button, [role=button]") || !isNameCell(el) : !isCardTitle(el) && !isName(el, block) && !TOKEN.test(t)) continue;
        if (!cell && isPill(el, block)) continue;
        doneBlocks.add(cell ?? block);
        picked.push(n);
      }
    }
  };
  visit(document);
  picked.length = Math.min(picked.length, 1500);
  (window as unknown as { __dkStressPick?: Text[] }).__dkStressPick = picked;
  return picked.map((n) => n.data);
}

/** Đặt chữ mới (null: giữ nguyên). Nút đã rời trang hay vừa bị trang đổi chữ thì bỏ qua. */
function applyText({ next, was }: { next: Array<string | null>; was: string[] }): number {
  const w = window as unknown as { __dkStressPick?: Text[]; __dkStress?: { changed: Changed[]; before: string } };
  const changed: Changed[] = [];
  const before = document.body.innerText;
  (w.__dkStressPick ?? []).forEach((node, i) => {
    const set = next[i];
    if (set === null || set === undefined || !node.isConnected || node.data !== was[i]) return;
    node.data = set;
    changed.push({ node, text: was[i]!, set });
  });
  w.__dkStress = { changed, before };
  delete w.__dkStressPick;
  return changed.length;
}

/**
 * Trang (hay vỏ app tự cuộn) rộng hơn khung của nó bao nhiêu, và chữ vừa kéo dài nào thò ra ngoài. `overflow-x: hidden` trên
 * html hay body giấu thanh cuộn nhưng chữ vẫn mất: đo bằng scrollWidth nên vẫn thấy.
 */
function wideOf(): { over: number; width: number; screen: number; culprit: string } {
  const de = document.documentElement;
  const boxes: Element[] = [de];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (el.scrollWidth <= el.clientWidth + 1 || el === document.body || el === de) continue;
      if (/^(auto|scroll)$/.test(getComputedStyle(el).overflowX) && (el.matches("main, [role=main]") || el.querySelector("main, [role=main], h1"))) boxes.push(el);
    }
  };
  walk(document);
  let best = { over: 0, width: de.scrollWidth, screen: de.clientWidth, box: de as Element };
  for (const b of boxes) if (b.scrollWidth - b.clientWidth > best.over) best = { over: b.scrollWidth - b.clientWidth, width: b.scrollWidth, screen: b.clientWidth, box: b };
  let culprit = "";
  if (best.over > 1) {
    const r = document.createRange();
    const edge = best.box === de ? de.clientWidth : best.box.getBoundingClientRect().left + best.box.clientWidth;
    const list = (window as unknown as { __dkStress?: { changed: Changed[] } }).__dkStress?.changed ?? [];
    const sx = best.box === de ? scrollX : 0;
    let score = 0;
    for (const c of list) {
      r.selectNodeContents(c.node);
      const rects = Array.from(r.getClientRects());
      const el = c.node.parentElement;
      if (!el || !rects.length) continue;
      // Chữ trong hộp cắt không đẩy được trang rộng ra.
      if ([el, el.parentElement].some((x) => x && x !== best.box && x !== document.body && getComputedStyle(x).overflowX !== "visible")) continue;
      // Kẻ gây ra là chữ không ngắt được, kể cả khi nó còn nằm trong màn: nó kéo cả khung, và chữ xuống dòng được của khối bên
      // cạnh mới là thứ thò ra. Không có chữ nào như vậy thì lấy dòng dài nhất đang thò ra.
      const stiff = /nowrap|^pre$/.test(getComputedStyle(el).whiteSpace) || (/\S{30}/.test(c.set) && !/\S{30}/.test(c.text));
      const out = rects.some((q) => q.right + sx > edge + 1);
      if (!stiff && !out) continue;
      const wide = Math.max(...rects.map((q) => q.width)) + (stiff ? 1e5 : 0) + (out ? 1e4 : 0);
      if (!(wide > score)) continue;
      score = wide;
      const id = el.id ? `#${el.id}` : typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
      culprit = `${el.tagName.toLowerCase()}${id} "${c.text.replace(/\s+/g, " ").trim().slice(0, 28)}"`;
    }
  }
  return { over: best.over, width: best.width, screen: best.screen, culprit };
}

/**
 * Trả chữ về. Nhãn của phát hiện chứa chữ đã kéo dài, nên trước khi trả thì ghi lại phần tử của từng nhãn, trả xong đọc lại nhãn
 * gốc của nó: so với lần đo trước khi kéo dài mới biết cái nào mới. Kèm cờ: chữ gốc đọc được trọn ở nơi khác (title, aria-label,
 * trang mà thẻ dẫn tới), và trang có giữ lại chữ kéo dài không. Nhãn viết đúng như `label` của probe.ts.
 */
function restoreText(wheres: string[]): { hits: Array<{ was: string; full: boolean; by: string; own: boolean }>; kept: boolean } {
  const w = window as unknown as { __dkStress?: { changed: Changed[]; before: string } };
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const head = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const cls = !id && typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    const host = (el.getRootNode() as ShadowRoot).host;
    return `${host ? `${host.tagName.toLowerCase()}::shadow ` : ""}${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const label = (el: Element): string => {
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${head(el)}${txt ? ` "${txt}"` : ""}`;
  };
  const found = new Map<string, Element[]>();
  const wanted = new Set(wheres);
  if (wanted.size) {
    const walk = (root: Document | ShadowRoot): void => {
      for (const el of Array.from(root.querySelectorAll("*"))) {
        if (el.shadowRoot) walk(el.shadowRoot);
        const h = head(el);
        if (!wheres.some((x) => x === h || x.startsWith(`${h} "`))) continue;
        const l = label(el);
        if (wanted.has(l)) found.set(l, [...(found.get(l) ?? []), el]);
      }
    };
    walk(document);
  }
  const { changed, before } = w.__dkStress ?? { changed: [], before: document.body.innerText };
  // Chữ kéo dài nào thò ra khỏi hộp cắt nhiều nhất: hộp cắt có thể là cả bảng, người sửa cần biết đúng ô.
  const r = document.createRange();
  const worst = (box: Element): Element | null => {
    const b = box.getBoundingClientRect();
    let out: Element | null = null;
    let widest: Element | null = null;
    let far = 1;
    let w0 = 0;
    for (const c of changed) {
      const el = c.node.parentElement;
      if (!el || !box.contains(el)) continue;
      r.selectNodeContents(c.node);
      for (const q of Array.from(r.getClientRects())) {
        const d = Math.max(q.right - b.right, b.left - q.left, q.bottom - b.bottom, b.top - q.top);
        if (d > far) [far, out] = [d, el];
        if (q.width > w0) [w0, widest] = [q.width, el];
      }
    }
    // Chữ kéo dài còn nằm trong hộp nhưng đẩy chữ bên cạnh ra ngoài: nêu chữ dài nhất.
    return out ?? widest;
  };
  const culprits = new Map<Element, Element | null>();
  for (const els of found.values()) for (const el of els) culprits.set(el, worst(el));
  // Ngược thứ tự; chữ đã bị trang đổi tiếp (đồng hồ, bộ đếm) thì để nguyên chữ của trang.
  for (const c of [...changed].reverse()) if (c.node.data === c.set) c.node.data = c.text;
  delete w.__dkStress;
  const after = document.body.innerText;
  const norm = (s: string): string => s.replace(/\s+/g, " ").trim().toLowerCase();
  const says = (el: Element, text: string): boolean => [el.getAttribute("title"), el.getAttribute("aria-label")].some((a) => !!a && !!text && norm(a).includes(text));
  const full = (el: Element): boolean => {
    const text = norm(el.textContent ?? "");
    for (let a: Element | null = el, i = 0; a && i < 4; a = up(a), i++) if (says(a, text)) return true;
    if (Array.from(el.querySelectorAll("[title], [aria-label]")).some((d) => says(d, norm(d.textContent ?? "")) && norm(d.textContent ?? "").length * 2 >= text.length)) return true;
    // Thẻ cắt còn vài dòng mà bấm vào là trang đọc trọn: cắt bớt có chủ ý.
    const a = (el.closest("a[href]") ?? el.querySelector("a[href]")) as HTMLAnchorElement | null;
    return !!a && !(a.getAttribute("href") ?? "").startsWith("#") && a.href.replace(/#.*$/, "") !== location.href.replace(/#.*$/, "") && getComputedStyle(el).getPropertyValue("-webkit-line-clamp") !== "none";
  };
  const used = new Map<string, number>();
  const hits = wheres.map((x) => {
    const at = used.get(x) ?? 0;
    used.set(x, at + 1);
    const els = found.get(x) ?? [];
    const el = els[Math.min(at, els.length - 1)];
    const by = el && culprits.get(el);
    if (!el) return { was: x, full: false, by: "", own: true };
    return { was: label(el), full: full(el), by: by && by !== el ? label(by) : "", own: changed.some((c) => c.node.parentElement === el) };
  });
  const kept = changed.some((c) => {
    const s = norm(c.set);
    return norm(after).includes(s) && !norm(before).includes(s);
  });
  return { hits, kept };
}

const HOW: Record<StressKind, { when: string; fix: string }> = {
  longer: { when: "with text 50% longer", fix: "let it wrap or let the box grow: no fixed height, min-width: 0 on flex and grid items" },
  word: { when: `with a ${LONG_WORD.length}-letter word`, fix: "add overflow-wrap: anywhere (and min-width: 0 on flex and grid items)" },
  number: { when: "with three more digits", fix: "let the box grow or wrap, or shorten the format (1,2 tỉ)" },
};

interface Lost {
  clip: ProbeHit[];
  covered: ProbeHit[];
  wide: { over: number; width: number; screen: number; culprit: string };
}
const lostOf = async (page: Page): Promise<Lost> => ({
  clip: (await page.evaluate(probePage)).textClip,
  covered: await page.evaluate(probeCovered),
  wide: await page.evaluate(wideOf),
});

/** Phát hiện mới: mỗi nhãn gốc chỉ được trừ đúng số lần nó đã có trước khi kéo dài. */
function fresh<T extends { was: string }>(after: T[], before: ProbeHit[]): T[] {
  const left = new Map<string, number>();
  for (const h of before) left.set(h.where, (left.get(h.where) ?? 0) + 1);
  return after.filter((h) => {
    const n = left.get(h.was) ?? 0;
    if (n > 0) left.set(h.was, n - 1);
    return n <= 0;
  });
}

/**
 * Ba lượt kéo dài ở khổ hiện tại. Gọi sau mọi phép đo khác của lần nạp (trước `text-spacing` hay sau đều được), ở trạng thái đầu;
 * đủ ở khổ rộng nhất và khổ điện thoại. `optional()` của cổng biến lỗi ném ra thành ghi chú.
 */
export async function stressPass(page: Page, net: NetWatch): Promise<StressFinding[]> {
  const out: StressFinding[] = [];
  const vi = await page.evaluate(() => /^(vi\b|$)/i.test(document.documentElement.lang));
  const before = await lostOf(page);
  const settle = async (): Promise<void> => {
    await settleAfterChange(page, net);
    await page.evaluate(settleAnimations, 300);
  };
  for (const kind of ["longer", "word", "number"] as const) {
    const was = await page.evaluate(pickText, kind);
    const next = was.map((t) => (kind === "longer" ? longer(t, LONGER_BY, FILLER) : kind === "word" ? t.replace(/(\s*)$/, ` ${LONG_WORD}$1`) : (bigger(t, vi) ?? null)));
    if (!next.some((t) => t !== null)) continue;
    let lost: Lost | undefined;
    let back: ReturnType<typeof restoreText> | undefined;
    try {
      await page.evaluate(applyText, { next, was });
      await settle();
      lost = await lostOf(page);
    } finally {
      back = await page.evaluate(restoreText, [...(lost?.clip ?? []), ...(lost?.covered ?? [])].map((h) => h.where));
    }
    if (!lost) continue;
    if (back.kept) throw new Error(`the page kept the stressed text (${kind}): it copies text elsewhere when it changes`);
    const { when, fix } = HOW[kind];
    const clip = lost.clip.map((h, i) => ({ ...h, ...back!.hits[i]! }));
    const covered = lost.covered.map((h, i) => ({ ...h, ...back!.hits[lost!.clip.length + i]! }));
    const rows: Array<{ where: string; detail: string }> = [];
    if (lost.wide.over > 1 && before.wide.over <= 1) {
      rows.push({ where: lost.wide.culprit || "page", detail: `${when}: the page is ${lost.wide.width}px wide in ${lost.wide.screen}px; ${fix}` });
    }
    for (const h of fresh(clip, before.clip)) {
      // Cắt bằng dấu ba chấm mà chữ đầy đủ đọc được ở nơi khác là chủ ý. Cắt thẳng thì không.
      if (h.full && /by (ellipsis|line-clamp)/.test(h.value)) continue;
      // Hộp cắt lớn (cả bảng) thì đoạn chữ nó đang hiện chỉ gây rối: nêu đúng ô và tên hộp cắt.
      rows.push(h.by ? { where: h.by, detail: `${when}: text cut off ${h.value.split(":")[0]} on ${h.was.split(' "')[0]}; ${fix}` } : { where: h.was, detail: `${when}: text cut off ${h.value}; ${fix}` });
    }
    for (const h of fresh(covered, before.covered)) {
      // Chữ không đổi mà bị che chỉ là hệ quả của chữ dài đã báo ở trên.
      if (h.own || !rows.length) rows.push({ where: h.was, detail: `${when}: text ${h.value}; ${fix}` });
    }
    out.push(...rows.slice(0, CAP).map((x) => ({ check: "stress" as const, ...x })));
    if (rows.length > CAP) out.push({ check: "stress", where: `+${rows.length - CAP} more`, detail: `more text lost ${when}` });
  }
  await page.evaluate(() => {
    delete (window as unknown as { __dkStressPick?: Text[] }).__dkStressPick;
  });
  await settle();
  return out;
}
