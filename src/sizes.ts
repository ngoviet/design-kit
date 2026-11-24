/**
 * Khổ màn của cổng (phép đo 1, 24/11/2026).
 *
 * Trước đây cổng chỉ có bề rộng; chiều cao lấy theo bảng HEIGHT. Hồ sơ `devices` đặt cả chiều cao thật vì màn thấp là nơi
 * thanh dính nuốt hết chỗ đọc: laptop Full HD ở mức phóng 150% chỉ còn 1280×720 điểm ảnh CSS, điện thoại xoay ngang
 * 844×390. Mặc định (320/390/1280) giữ nguyên để trang đang đạt không đổi kết quả.
 */
export interface Size {
  w: number;
  h: number;
}

/** Chiều cao cũ của ba khổ mặc định; bề rộng khác mà không ghi chiều cao thì 900. */
const DEFAULT_HEIGHT: Record<number, number> = { 320: 720, 390: 844, 1280: 800 };
export const heightFor = (w: number): number => DEFAULT_HEIGHT[w] ?? 900;

export const MIN_WIDTH = 200;
export const MAX_WIDTH = 4000;

/** "390" hoặc "390x844" (nhận cả "×"). Trả undefined nếu sai. */
export function parseSize(s: string): Size | undefined {
  const m = /^(\d{3,4})(?:[x×](\d{3,4}))?$/i.exec(s.trim());
  if (!m) return undefined;
  const w = Number(m[1]);
  const h = m[2] ? Number(m[2]) : heightFor(w);
  if (w < MIN_WIDTH || w > MAX_WIDTH || h < 200 || h > MAX_WIDTH) return undefined;
  return { w, h };
}

/**
 * Hồ sơ `--profile`. `devices`: điểm ảnh CSS, không phải điểm ảnh vật lý. "Màn 4K" thường là 2560 (150%) hoặc 1920
 * (200%); laptop Full HD thường là 1536×864 hoặc 1280×720, nên chiều cao 720 là thứ phải đo.
 */
export const PROFILES: Record<string, { sizes: Size[]; sweep: boolean; about: string }> = {
  devices: {
    sizes: [
      { w: 320, h: 568 },
      { w: 390, h: 844 },
      { w: 768, h: 1024 },
      { w: 1280, h: 720 },
      { w: 1920, h: 1080 },
    ],
    sweep: true,
    about: "320x568, 390x844, 768x1024, 1280x720, 1920x1080 with --sweep",
  },
};

/**
 * Khổ quét của `--sweep`: điện thoại hẹp và rộng, máy gập, máy tính bảng dọc và ngang, laptop ở các mức phóng, tới màn 4K
 * ở 150% (2560). Kèm hai khổ thấp: 640×360 (1280×720 phóng trình duyệt 200%) và 844×390 (điện thoại xoay ngang). Kiểm ở
 * vài khổ gợi ý chỉ thấy 66–81% lỗi bố cục mà quét cả dải tìm ra (ReDeCheck, docs/nguon.md c40); dải này cũng là khổ chọn
 * sẵn, nên không thay được quét đủ từng bước.
 */
export const SWEEP_SIZES: Size[] = [
  { w: 344, h: 882 },
  { w: 360, h: 800 },
  { w: 414, h: 896 },
  { w: 480, h: 900 },
  { w: 600, h: 960 },
  { w: 640, h: 360 },
  { w: 768, h: 1024 },
  { w: 820, h: 1180 },
  { w: 844, h: 390 },
  { w: 900, h: 900 },
  { w: 1024, h: 768 },
  { w: 1180, h: 820 },
  { w: 1366, h: 768 },
  { w: 1536, h: 864 },
  { w: 1920, h: 1080 },
  { w: 2560, h: 1440 },
];

/** Từ bề rộng này trở lên, lượt quét đo thêm độ dài dòng: màn rộng hay kéo giãn chữ (BC-03). */
export const WIDE_FROM = 1536;

/** Khung nhìn thấp hơn mốc này là lớp "compact height" của Android (< 480 dp, N50): phần dính được phép tới 40%. */
export const LOW_HEIGHT = 480;

/**
 * Phép đo `sticky` (mềm): các thanh dính (fixed, sticky đang dính) rộng từ 60% màn chiếm quá 30% chiều cao khung nhìn (40%
 * khi khung thấp dưới 480px). Số 30% và 40% là quy ước. Chạy trong trang, hàm tự chứa.
 *
 * Cuộn xuống một khung rồi mới đo: phần tử sticky ở đầu trang chưa dính thì nằm trong dòng chảy, không chiếm chỗ. Bỏ qua
 * lớp phủ (dialog, popover, role dialog), vùng thông báo (status, alert, aria-live) và phần tử không vẽ gì.
 */
export function probeSticky(): { share: number; parts: Array<{ where: string; height: number }> } {
  const W = innerWidth;
  const H = innerHeight;
  const de = document.documentElement;
  const sx = scrollX;
  const sy = scrollY;
  const max = Math.max(0, de.scrollHeight - H);
  window.scrollTo({ top: Math.min(max, H), left: 0, behavior: "instant" });
  const label = (el: Element): string =>
    el.tagName.toLowerCase() + (el.id ? `#${el.id}` : typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "");
  const up = (e: Element): Element | null => e.assignedSlot ?? e.parentElement ?? ((e.getRootNode() as ShadowRoot).host || null);
  const exempt = (el: Element): boolean => {
    for (let a: Element | null = el; a && a !== de; a = up(a)) {
      if (a.tagName === "DIALOG" || a.hasAttribute("popover") || a.hasAttribute("inert")) return true;
      if (/^(dialog|alertdialog|status|alert|log)$/.test(a.getAttribute("role") ?? "") || a.hasAttribute("aria-live") || a.getAttribute("aria-hidden") === "true") return true;
    }
    return false;
  };
  const alpha = (c: string): number => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return c && c !== "transparent" ? 1 : 0;
    const p = m[1]!.split(/[,/\s]+/).filter(Boolean);
    return p.length >= 4 ? parseFloat(p[3]!) : 1;
  };
  const bars: Array<{ el: Element; top: number; bottom: number }> = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width < W * 0.6 || r.height < 1 || r.bottom <= 0 || r.top >= H) continue;
      // Cao gần cả màn thì không phải thanh: vỏ app tự cuộn (`fixed; inset: 0; overflow: auto`) hay lớp nền. Thanh bên trong vỏ
      // vẫn được xét vì vẫn đi tiếp xuống cây con.
      if (r.height >= H * 0.7) continue;
      if (cs.position === "sticky") {
        const stuckTop = cs.top !== "auto" && Math.abs(r.top - parseFloat(cs.top)) <= 1.5;
        const stuckBottom = cs.bottom !== "auto" && Math.abs(H - r.bottom - parseFloat(cs.bottom)) <= 1.5;
        if (!stuckTop && !stuckBottom) continue;
      }
      if (alpha(cs.backgroundColor) < 0.05 && cs.backgroundImage === "none" && !(el.textContent ?? "").trim()) continue;
      // Nền trang trí trải hết màn, nằm sau nội dung hoặc không bấm được, không chiếm chỗ đọc.
      if (cs.pointerEvents === "none" || Number(cs.zIndex) < 0) continue;
      if (exempt(el)) continue;
      bars.push({ el, top: Math.max(0, r.top), bottom: Math.min(H, r.bottom) });
    }
  };
  walk(document);
  window.scrollTo({ top: sy, left: sx, behavior: "instant" });
  // Gộp các đoạn chồng nhau (thanh dính nằm trong thanh dính) để không tính hai lần.
  const spans = bars.map((b) => [b.top, b.bottom] as [number, number]).sort((a, b) => a[0] - b[0]);
  let used = 0;
  let end = -1;
  for (const [t, b] of spans) {
    used += Math.max(0, b - Math.max(t, end));
    end = Math.max(end, b);
  }
  const outer = bars.filter((b) => !bars.some((o) => o !== b && o.el.contains(b.el)));
  return { share: H ? used / H : 0, parts: outer.map((b) => ({ where: label(b.el), height: Math.round(b.bottom - b.top) })) };
}

/** Lời báo của `sticky`, hoặc undefined khi phần dính còn trong mức. */
export function stickyFinding(s: { share: number; parts: Array<{ where: string; height: number }> }, w: number, h: number): string | undefined {
  const limit = h < LOW_HEIGHT ? 0.4 : 0.3;
  if (s.share <= limit + 0.005) return undefined;
  return `stuck bars take ${Math.round(s.share * 100)}% of a ${w}x${h} screen (limit ${limit * 100}%): ${s.parts.map((p) => `${p.where} ${p.height}px`).join(", ")}; unstick some below that height`;
}

/** Địa chỉ manifest của trang. Chạy trong trang. */
export function manifestHref(): string | undefined {
  return document.querySelector<HTMLLinkElement>('link[rel~="manifest"]')?.href || undefined;
}

/** Hướng màn bị khoá trong manifest (WCAG 1.3.4, N02): giá trị `orientation`, hoặc undefined. */
export function lockedOrientation(manifest: string): string | undefined {
  try {
    const m = JSON.parse(manifest) as { orientation?: unknown };
    return typeof m.orientation === "string" && /^(portrait|landscape)/.test(m.orientation) ? m.orientation : undefined;
  } catch {
    return undefined;
  }
}
