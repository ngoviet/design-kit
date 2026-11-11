import { readFileSync } from "node:fs";
import type { Browser } from "playwright-core";
import { markVietnameseText, probeStandalone, probeVisible, STANDALONE_TOKENS, type StandaloneProbe } from "./probe.js";

/**
 * Trang mở thẳng từ tệp, không qua máy chủ. Trình duyệt trong app Claude đổi `file:///…/trang.html` thành
 * `data:text/html;charset=utf-8,<nội dung đã mã hoá>` (thử 10/11/2026): href tương đối không phân giải được,
 * nên trang mất mọi CSS liên kết, còn cổng (chạy qua http) vẫn báo đạt. Ở đây mở lại trang đúng như vậy rồi so.
 */

/**
 * Pane mở tệp tối đa 512 KiB, tính theo byte của tệp (đo 11/11/2026: 524 288 byte mở được, 524 289 byte báo
 * "couldn't open"; tệp 300 KB nhiều chữ Việt, URL 753 nghìn ký tự, vẫn mở). Từ PANE_WARN_KB đã báo để còn chỗ sửa.
 */
export const PANE_MAX_BYTES = 512 * 1024;
export const PANE_WARN_KB = 400;
/** Giới hạn độ dài URL của Chromium (2 MiB): data: URL dài hơn thì không mở được ở đâu cả. */
const URL_MAX = 2 * 1024 * 1024;
const FONT_DATA = /data:(?:font\/[\w.+-]+|application\/(?:x-)?font[\w.+-]*)[^"')\s]*/g;

export interface StandaloneFinding {
  where: string;
  detail: string;
}

const kb = (n: number): number => Math.round(n / 1024);
const list = (xs: string[], max = 4): string => `${xs.slice(0, max).join(", ")}${xs.length > max ? ` +${xs.length - max} more` : ""}`;

/** Kích thước tệp và phần font nhúng base64 trong đó. */
export function pageWeight(html: string): { bytes: number; fontBytes: number } {
  let fontBytes = 0;
  for (const m of html.matchAll(FONT_DATA)) fontBytes += m[0].length;
  return { bytes: Buffer.byteLength(html, "utf8"), fontBytes };
}

/** Câu báo về kích thước tệp, hoặc undefined khi tệp còn xa ngưỡng của pane. */
export function weightDetail(bytes: number, fontBytes: number): string | undefined {
  if (bytes <= PANE_WARN_KB * 1024) return undefined;
  const fonts = fontBytes > 10 * 1024 ? `, ${kb(fontBytes)} KB of it base64 fonts` : "";
  const fix = "link fonts instead of embedding them, shrink images";
  return bytes > PANE_MAX_BYTES
    ? `${kb(bytes)} KB${fonts}: over 512 KiB (524,288 bytes) the Claude app's browser pane does not open the file at all ("couldn't open"); ${fix}`
    : `${kb(bytes)} KB${fonts}: close to the 512 KiB limit of the Claude app's browser pane (larger files do not open); ${fix}`;
}

/** Đúng dạng URL pane tạo ra (đọc từ `location.href` trong pane): percent-encoding, không base64. */
export function paneUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * So bản mở qua http (`a`, đo sẵn trên trang đang mở) với bản mở dạng data: URL như pane.
 * Trả về phát hiện mềm và ghi chú. `visibleA`: bản http có nội dung hay không.
 */
export async function runStandalone(
  browser: Browser,
  file: string,
  a: StandaloneProbe,
  visibleA: boolean,
  viewport: { width: number; height: number },
  scheme: "light" | "dark",
): Promise<{ findings: StandaloneFinding[]; notes: string[] }> {
  const findings: StandaloneFinding[] = [];
  const notes: string[] = [];
  const html = readFileSync(file, "utf8");
  const { bytes, fontBytes } = pageWeight(html);
  const weight = weightDetail(bytes, fontBytes);
  if (weight) findings.push({ where: "file", detail: weight });
  const url = paneUrl(html);
  if (url.length > URL_MAX) {
    findings.push({ where: "data: URL", detail: `${kb(url.length)} KB once encoded, over Chromium's 2 MB URL limit: the page cannot be opened as a file in the pane at all` });
    return { findings, notes };
  }

  const ctx = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: "no-preference" });
  try {
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    } catch (e) {
      findings.push({ where: "data: URL", detail: `does not open as a data: URL: ${(e as Error).message.split("\n")[0]}` });
      return { findings, notes };
    }
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(300);
    const b = await page.evaluate(probeStandalone, STANDALONE_TOKENS);
    const visB = await page.evaluate(probeVisible);

    const loadedB = new Set(b.sheets.filter((s) => s.loaded).map((s) => s.href));
    const lost = a.sheets.filter((s) => s.loaded && !loadedB.has(s.href));
    const lostStyles = lost.filter((s) => !s.fonts).map((s) => s.href);
    const lostFonts = lost.filter((s) => s.fonts).map((s) => s.href);
    const lostTokens = STANDALONE_TOKENS.filter((t) => a.tokens[t] && !b.tokens[t]);
    const blank = visibleA && !visB.text && !visB.media;
    if (lostStyles.length || lostTokens.length || blank) {
      const parts: string[] = [];
      if (blank) parts.push("shows nothing");
      if (lostStyles.length) parts.push(`loses ${lostStyles.length} stylesheet${lostStyles.length > 1 ? "s" : ""} (${list(lostStyles)})`);
      if (lostTokens.length) parts.push(`tokens ${lostTokens.join(", ")} are empty`);
      if (a.scripts.length) parts.push(`scripts by path do not run (${list(a.scripts, 3)})`);
      findings.push({
        where: "data: URL",
        detail: `opened as a file (the Claude app's browser pane loads it as a data: URL) the page ${parts.join("; ")}: put the CSS in the page (design-kit inline <page>), keep font links as an extra`,
      });
    } else if (a.scripts.length) {
      notes.push(`opened as a file, scripts by path do not run: ${list(a.scripts, 3)}`);
    }
    if (lostFonts.length) notes.push(`opened as a file, font stylesheets do not load (${list(lostFonts, 3)}): the font stack's fallback shows, so it must have Vietnamese letters`);

    // Dấu tiếng Việt vẽ bằng font thứ hai: font dự phòng thiếu chữ (Georgia không có ắ, ế, ữ…), trình duyệt
    // mượn từng chữ của font khác, nên "Ngắn" thành "Ngắ n". Chỉ CDP của Chromium nói được font nào đã vẽ.
    // Mỗi nút chữ được tách thành phần có dấu (vi) và phần chữ thường (base), cùng font khai báo: hai phần vẽ
    // bằng hai font khác nhau nghĩa là font đang dùng thiếu chữ Việt.
    const labels = await page.evaluate(markVietnameseText, 30);
    if (labels.length) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("DOM.enable");
      await cdp.send("CSS.enable");
      const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
      const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "dk-vi[data-dk-vi]" });
      const glyphs = new Map<string, Map<string, number>>();
      for (const nodeId of nodeIds.slice(0, 200)) {
        const [{ attributes }, { fonts }] = await Promise.all([
          cdp.send("DOM.getAttributes", { nodeId }),
          cdp.send("CSS.getPlatformFontsForNode", { nodeId }),
        ]);
        const key = attributes[attributes.indexOf("data-dk-vi") + 1] ?? "";
        const m = glyphs.get(key) ?? new Map<string, number>();
        for (const f of fonts) if (!/emoji|symbol/i.test(f.familyName)) m.set(f.familyName, (m.get(f.familyName) ?? 0) + f.glyphCount);
        glyphs.set(key, m);
      }
      await cdp.detach();
      const seen = new Set<string>();
      for (let i = 0; i < labels.length && seen.size < 3; i++) {
        const base = [...(glyphs.get(`${i}:base`) ?? new Map<string, number>())].sort((x, y) => y[1] - x[1])[0]?.[0];
        if (!base) continue;
        const foreign = [...(glyphs.get(`${i}:vi`) ?? new Map<string, number>())].filter(([f]) => f !== base);
        if (!foreign.length) continue;
        const key = `${base}>${foreign.map(([f]) => f).join("+")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          where: labels[i]!,
          detail: `opened as a file, Vietnamese letters (ắ, ế, ữ…) come from ${foreign.map(([f]) => f).join(", ")} while the letters around them use ${base}, which lacks them: diacritics look broken ("Ngắ n"). Right after the web font, name a fallback that has them (serif: "Times New Roman", "Noto Serif"; sans: system-ui, Arial)`,
        });
      }
    }
  } finally {
    await ctx.close();
  }
  return { findings, notes };
}
