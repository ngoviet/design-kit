/**
 * Điểm gãy của chính trang, để `--sweep` đo thêm hai bề rộng sát hai bên mỗi mốc (24/11/2026).
 *
 * Khổ quét cố định (sizes.ts) gặp mốc của trang hay không là ngẫu nhiên: bốn cột bật ở 900px thì thẻ hẹp nhất ở đúng 900, mà
 * 900 và 1024 cách nhau quá xa để thấy. Lỗi chỉ có trong một khoảng hẹp quanh mốc là lớp "small-range" của ReDeCheck
 * (docs/nguon.md c40). Ý quét hai bên mốc: renderlint (MIT), tự viết lại.
 */

/** Tối đa ngần này bề rộng thêm: mỗi bề rộng mất một lượt đổi khổ và đo. */
export const AROUND_CAP = 24;

/**
 * Các mốc bề rộng trong `@media` của trang, mốc nhiều luật đứng trước. Mốc là bề rộng nguyên ĐẦU TIÊN ở phía bên kia điều kiện,
 * nên `min-width: 768px`, `max-width: 767px`, `max-width: 767.98px` và `width < 768px` cùng ra 768 và được cộng số luật.
 *
 * Đọc cả @import, @layer, @supports đang đúng, CSS lồng, thuộc tính media của link và style, adoptedStyleSheets, open shadow
 * root. Bỏ qua: stylesheet khác nguồn (trình duyệt không cho đọc), luật chỉ để in, `device-width` (theo màn, không theo cửa sổ)
 * và `@container` (theo khung chứa). Hàm tự chứa, chạy trong trang. em và rem trong media query luôn theo cỡ chữ gốc 16px.
 */
export function probeBreakpoints(): number[] {
  const weight = new Map<number, number>();
  const PX: Record<string, number> = { px: 1, em: 16, rem: 16, pt: 96 / 72, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6 };
  const len = (s: string): number => {
    const m = /^([+-]?(?:\d+\.?\d*|\.\d+))([a-z]*)$/i.exec(s.trim());
    if (!m) return NaN;
    const k = m[2] ? PX[m[2].toLowerCase()] : Number(m[1]) === 0 ? 1 : undefined;
    // Làm tròn phần nghìn: 47.99875em × 16 ra 767,98 chứ không phải 767,9799999.
    return k === undefined ? NaN : Math.round(Number(m[1]) * k * 1000) / 1000;
  };
  // calc() trong media query gần như luôn là một phép cộng trừ ("calc(40rem - 1px)"); phức tạp hơn thì NaN và bị bỏ.
  const sum = (e: string): number => {
    const parts = e.trim().split(/\s+([+-])\s+/);
    let total = len(parts[0] ?? "");
    for (let i = 1; i < parts.length; i += 2) total += (parts[i] === "-" ? -1 : 1) * len(parts[i + 1] ?? "");
    return total;
  };
  // Bề rộng nguyên đầu tiên mà điều kiện đổi giá trị.
  const edges = (op: string, px: number): number[] => {
    if (!(px > 0)) return [];
    const at = Math.ceil(px);
    const after = Math.floor(px) + 1;
    if (op === ">=" || op === "<") return [at];
    if (op === "<=" || op === ">") return [after];
    return [at, after];
  };
  const FLIP: Record<string, string> = { "<": ">", "<=": ">=", ">": "<", ">=": "<=", "=": "=" };
  const parse = (media: string): number[] => {
    const out: number[] = [];
    for (const query of media.split(",")) {
      if (/^\s*(only\s+)?(print|speech|aural|braille|embossed|tty|projection)\b/i.test(query)) continue;
      const plain = query.replace(/calc\(([^()]*)\)/gi, (_m, e: string) => `${sum(e)}px`);
      for (const m of plain.matchAll(/\(([^()]*)\)/g)) {
        const g = m[1]!.trim();
        const old = /^(min|max)-width\s*:\s*(.+)$/i.exec(g);
        if (old) {
          out.push(...edges(old[1]!.toLowerCase() === "min" ? ">=" : "<=", len(old[2]!)));
          continue;
        }
        const range = /^(?:([^\s<>=]+)\s*(<=|>=|<|>|=)\s*)?width(?:\s*(<=|>=|<|>|=)\s*([^\s<>=]+))?$/i.exec(g);
        if (!range) continue;
        if (range[1]) out.push(...edges(FLIP[range[2]!]!, len(range[1])));
        if (range[4]) out.push(...edges(range[3]!, len(range[4])));
      }
    }
    return out;
  };
  // Media chỉ để in: cả phần bên trong không liên quan tới màn.
  const printOnly = (media: string): boolean => !!media && media.split(",").every((q) => /^\s*(only\s+)?(print|speech|aural|braille|embossed|tty|projection)\b/i.test(q));
  const rulesOf = (sheet: CSSStyleSheet | null): CSSRuleList | null => {
    try {
      return sheet ? sheet.cssRules : null;
    } catch {
      return null; // khác nguồn
    }
  };
  const inner = (r: CSSRule): CSSRuleList | null => {
    if (r instanceof CSSKeyframesRule) return null;
    if (r instanceof CSSImportRule) return rulesOf(r.styleSheet);
    return (r as CSSGroupingRule).cssRules ?? null;
  };
  // Số luật có khai báo bên trong, kể cả trong khối lồng: mốc đổi nhiều thứ thì đáng đo trước.
  const count = (list: CSSRuleList | null): number => {
    let n = 0;
    for (const r of Array.from(list ?? [])) {
      if ((r as CSSStyleRule).style && !(r instanceof CSSFontFaceRule)) n++;
      n += count(inner(r));
    }
    return n;
  };
  const note = (media: string, list: CSSRuleList | null): void => {
    const n = count(list);
    if (!n) return;
    for (const b of new Set(parse(media))) weight.set(b, (weight.get(b) ?? 0) + n);
  };
  const walk = (list: CSSRuleList | null): void => {
    for (const r of Array.from(list ?? [])) {
      const media = r instanceof CSSMediaRule || r instanceof CSSImportRule ? r.media.mediaText : "";
      if (printOnly(media)) continue;
      if (r instanceof CSSSupportsRule && !CSS.supports(r.conditionText)) continue;
      const body = inner(r);
      if (media) note(media, body);
      walk(body);
    }
  };
  const sheets = (root: Document | ShadowRoot): void => {
    for (const s of [...Array.from(root.styleSheets), ...root.adoptedStyleSheets]) {
      const media = s.media.mediaText;
      if (s.disabled || printOnly(media)) continue;
      const list = rulesOf(s);
      if (media) note(media, list);
      walk(list);
    }
    for (const el of Array.from(root.querySelectorAll("*"))) if (el.shadowRoot) sheets(el.shadowRoot);
  };
  sheets(document);
  return [...weight].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([b]) => b);
}

/**
 * Hai bề rộng sát hai bên mỗi mốc (mốc - 1 và mốc), tăng dần, trong [min, max], bỏ khổ đã đo (`skip`), tối đa AROUND_CAP. Quá
 * mức thì giữ mốc nhiều luật: mốc lặp lại nhiều lần trong `bps` trước, rồi tới thứ tự trong `bps` (probeBreakpoints đã xếp).
 */
export function sweepAround(bps: number[], min: number, max: number, skip: number[]): number[] {
  const times = new Map<number, number>();
  for (const b of bps) times.set(Math.ceil(b), (times.get(Math.ceil(b)) ?? 0) + 1);
  const known = new Set(skip);
  const out = new Set<number>();
  for (const [b] of [...times].sort((a, c) => c[1] - a[1])) {
    for (const w of [b - 1, b]) {
      if (out.size >= AROUND_CAP) break;
      // `!(…)`: NaN không lọt vào danh sách khổ.
      if (!(w >= min && w <= max) || known.has(w)) continue;
      out.add(w);
    }
  }
  return [...out].sort((a, b) => a - b);
}
