import type { Page } from "playwright-core";

/**
 * Chờ trang yên theo tín hiệu thật thay cho chờ cố định.
 *
 * Trước 15/11/2026 mỗi lần nạp dùng `waitUntil: "networkidle"` (Playwright: mạng im đủ 500 ms, tài liệu của họ ghi
 * không nên dùng để chờ trang sẵn sàng) cộng 300 ms cố định: 0,8 s trong mỗi 1,05 s của một lượt render là chờ, kể cả
 * với trang tĩnh không gọi mạng lần nào sau `load`. Giờ: nạp tới `load`, đợi font, rồi đợi tới khi không còn yêu cầu
 * dở suốt QUIET_MS. Trang tĩnh mất đúng QUIET_MS; trang còn gọi dữ liệu thì đợi tới khi dữ liệu về.
 * Nội dung đến muộn hơn nữa (dựng bằng setTimeout) vẫn do `waitForContent` trong check.ts lo.
 */
export const QUIET_MS = 200;
/** Mạng không chịu im (luồng sự kiện, long polling, video): hết ngần này thì đo luôn và ghi chú. */
export const QUIET_CAP_MS = 10_000;

/** Phần của Page mà bộ theo dõi cần: tách ra để test bằng EventEmitter, không cần trình duyệt. */
interface RequestEvents {
  on(event: "request" | "requestfinished" | "requestfailed", listener: (request: object) => void): unknown;
}

export interface NetWatch {
  /** Số yêu cầu đã gửi mà chưa xong hay hỏng. */
  inflight(): number;
  /** Mốc (ms) của yêu cầu gần nhất được gửi, xong hoặc hỏng; 0 nếu chưa có yêu cầu nào. */
  lastActivity(): number;
  /** Đợi tới khi không còn yêu cầu dở suốt `quietMs`. `capped`: hết `capMs` mà mạng vẫn bận. */
  quiet(quietMs?: number, capMs?: number): Promise<{ waited: number; capped: boolean }>;
}

/** Gắn TRƯỚC `page.goto`, để không sót yêu cầu nào của lần nạp. */
export function watchNetwork(page: RequestEvents): NetWatch {
  const open = new Set<object>();
  let lastActivity = 0;
  const touch = (): void => {
    lastActivity = Date.now();
  };
  page.on("request", (q) => {
    open.add(q);
    touch();
  });
  const done = (q: object): void => {
    open.delete(q);
    touch();
  };
  page.on("requestfinished", done);
  page.on("requestfailed", done);
  return {
    inflight: () => open.size,
    lastActivity: () => lastActivity,
    async quiet(quietMs = QUIET_MS, capMs = QUIET_CAP_MS) {
      const start = Date.now();
      // Cửa sổ im tính từ lúc gọi: yêu cầu xong ngay trước đó không được tính là "đã im từ lâu".
      lastActivity = Math.max(lastActivity, start);
      for (;;) {
        const now = Date.now();
        if (open.size === 0 && now - lastActivity >= quietMs) return { waited: now - start, capped: false };
        if (now - start >= capMs) return { waited: now - start, capped: true };
        await new Promise((ok) => setTimeout(ok, 20));
      }
    },
  };
}

/** Hai khung hình: bố cục và kiểu vừa đổi kịp được tính và vẽ. */
export const twoFrames = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok()))));

/**
 * Sau `load` hoặc sau một loạt thao tác: font xong, mạng im, hai khung hình cho bố cục kịp chạy. Script chạy trong
 * hai khung hình đó mà gọi mạng tiếp thì đợi im thêm một lần; trang tĩnh thì không mất thêm gì.
 * Trả `capped` khi mạng không im trước QUIET_CAP_MS.
 */
export async function settlePage(page: Page, net: NetWatch): Promise<{ capped: boolean }> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const first = await net.quiet();
  if (first.capped) return { capped: true };
  const mark = Date.now();
  await twoFrames(page);
  if (net.inflight() === 0 && net.lastActivity() < mark) return { capped: false };
  return { capped: (await net.quiet()).capped };
}

/**
 * Sau khi đổi khổ hay chế độ màu ngay trên trang đang mở (không nạp lại): hai khung hình cho bố cục mới; trang có gọi
 * mạng vì thay đổi đó (ảnh `srcset`, ảnh lười tải vừa lọt vào màn) thì đợi như sau một lần nạp.
 */
export async function settleAfterChange(page: Page, net: NetWatch): Promise<{ capped: boolean }> {
  const mark = Date.now();
  await twoFrames(page);
  if (net.inflight() === 0 && net.lastActivity() < mark) return { capped: false };
  return settlePage(page, net);
}
