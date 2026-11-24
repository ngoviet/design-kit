/**
 * Phép đo `nfc` và `lang-part` (mềm, 24/11/2026).
 *
 * - `nfc`: chữ Latinh tổ hợp rời (chữ cái + dấu kết hợp U+0300–U+036F mà NFC ghép được thành một ký tự). Trông giống nhau
 *   nhưng tìm kiếm, so chuỗi và nối chữ sai, vài font vẽ lệch dấu. W3C i18n khuyên dùng NFC khi soạn nội dung và giữ nhất
 *   quán (N118). Chỉ xét chữ Latinh: ký tự tương thích CJK, dấu Ohm… đổi dưới NFC không phải lỗi gõ tiếng Việt.
 * - `lang-part` (WCAG 3.1.2, N23): chữ Hán không nằm trong phần tử có `lang` của một ngôn ngữ dùng chữ Hán (zh, ja, ko, yue,
 *   … hay `-Han*`); câu tiếng Anh nằm trong vùng `lang="vi"`. Thiếu `lang` thì trình duyệt chọn sai bộ font Hán và trình đọc
 *   màn hình đọc sai giọng. Phần tiếng Anh nhận theo hư từ (the, is, of…), nên nhãn một hai chữ và tên riêng không bị báo.
 *
 * `data-lang-ok="<lý do>"` trên phần tử hay tổ tiên: chữ nước ngoài cố ý để nguyên. Hàm tự chứa, chạy trong trang.
 */
export interface LangHits {
  nfc: Array<{ where: string; value: string }>;
  han: Array<{ where: string; value: string }>;
  english: Array<{ where: string; value: string }>;
}

export function probeLangParts(): LangHits {
  const out: LangHits = { nfc: [], han: [], english: [] };
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const label = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const cls = !id && typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    const host = (el.getRootNode() as ShadowRoot).host;
    return `${host ? `${host.tagName.toLowerCase()}::shadow ` : ""}${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const langOf = (el: Element): string => {
    for (let a: Element | null = el; a; a = up(a)) {
      const l = a.getAttribute("lang") ?? a.getAttribute("xml:lang");
      if (l !== null) return l.trim().toLowerCase();
    }
    return "";
  };
  const okd = (el: Element): boolean => {
    for (let a: Element | null = el; a; a = up(a)) if (a.hasAttribute("data-lang-ok")) return true;
    return false;
  };
  const SKIP = "script, style, noscript, template, textarea, code, pre, kbd, samp, var, svg";
  const shown = (el: Element): boolean => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const LATIN_MARK = /[A-Za-zÀ-ɏḀ-ỿ][̀-ͯ]/;
  const decomposed = (s: string): boolean => LATIN_MARK.test(s) && s.normalize("NFC") !== s;
  const HAN = /\p{Script=Han}/u;
  const HAN_LANG = /^(zh|ja|ko|yue|wuu|nan|hak|lzh|cmn|gan|hsn|cdo|och|ltc)\b|-han[ist]?\b/;
  // Hư từ có trong hầu như mọi câu tiếng Anh. WEAK trùng âm tiết tiếng Việt viết không dấu ("thể", "thêm", "thân", "thật",
  // "cần", "ít", "nốt"), nên một mình chúng không đủ: "ban co the di hoc cung cac ban khong" từng bị báo là tiếng Anh.
  const STRONG = new Set("is are was were of and this these those with for from your you they she we his their our have has been will would could should what when where which who how there because about into".split(" "));
  const WEAK = new Set("the that them than then it can not her".split(" "));
  const VIET = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i;
  const pageVi = /^vi\b/i.test(document.documentElement.lang || "");
  const blocks = new Map<Element, string>();
  const blockOf = (el: Element): Element => {
    let a: Element = el;
    for (;;) {
      const d = getComputedStyle(a).display;
      if (!/^(inline|contents|ruby|ruby-text)/.test(d)) return a;
      const p = up(a);
      if (!p) return a;
      a = p;
    }
  };
  const visit = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) visit(el.shadowRoot);
      if (el.closest(SKIP)) continue;
      for (const at of ["alt", "title", "aria-label", "placeholder"]) {
        const v = el.getAttribute(at);
        if (v && decomposed(v)) out.nfc.push({ where: `${label(el)}[${at}]`, value: `"${v.slice(0, 40)}"` });
      }
      const texts = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && (n.textContent ?? "").trim()).map((n) => n.textContent ?? "");
      if (!texts.length || !shown(el)) continue;
      const own = texts.join(" ");
      if (decomposed(own)) out.nfc.push({ where: label(el), value: `"${own.replace(/\s+/g, " ").trim().slice(0, 40)}"` });
      const lang = langOf(el);
      if (HAN.test(own) && !HAN_LANG.test(lang) && !okd(el)) {
        const run = own.match(/\p{Script=Han}[\p{Script=Han}\p{P}\s]*/u)?.[0]?.trim() ?? own;
        out.han.push({ where: label(el), value: `"${run.slice(0, 20)}" inside lang="${lang}": add lang="zh" (or ja, ko), so the right Han font and voice are used` });
      }
      if (pageVi && /^(vi\b|$)/.test(lang)) {
        const b = blockOf(el);
        blocks.set(b, `${blocks.get(b) ?? ""} ${own}`);
      }
    }
  };
  visit(document);
  for (const [b, raw] of blocks) {
    if (okd(b)) continue;
    // Địa chỉ web, tệp, mã: không phải câu.
    const text = raw.replace(/\S*[/@\\_]\S*|\S+\.\w{2,4}\b/g, " ").replace(/\s+/g, " ").trim();
    // Từng câu một: đoạn tiếng Việt có trích một câu Anh cũng phải thấy.
    for (const s of text.split(/(?<=[.!?…:;”"])\s+/)) {
      if (VIET.test(s)) continue;
      const words = s.toLowerCase().match(/[a-z][a-z'’]*/g) ?? [];
      if (words.length < 4) continue;
      const strong = words.filter((x) => STRONG.has(x)).length;
      const weak = words.filter((x) => WEAK.has(x)).length;
      if (!strong || (strong + weak < 2 && words.length < 6)) continue;
      out.english.push({ where: label(b), value: `English "${s.slice(0, 48)}" inside lang="vi": wrap it in lang="en"` });
      break;
    }
  }
  return out;
}
