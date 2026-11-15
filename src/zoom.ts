import type { TypingField } from "./probe.js";

/**
 * Phép đo `input-zoom` (mềm, chỉ ở khổ điện thoại ≤ 480px).
 *
 * iOS Safari phóng to cả trang khi người dùng chạm vào ô gõ chữ có chữ nhỏ, và không tự thu về khi rời ô: trang
 * responsive bị tràn ngang, người dùng phải chụm hai ngón để xem lại. WebKit tính tỉ lệ phóng = 16 / cỡ chữ của ô
 * (WKWebViewIOS.mm), nên mọi bản iOS đã phát hành phóng to khi chữ dưới 16px. Ngày 13/11/2026 nhánh main của WebKit
 * thêm quy tắc bỏ qua khi tỉ lệ đổi dưới 10% (commit b2bcd4fa11, lỗi của bsky.app), tức chỉ ô ≤ ~14,5px còn bị phóng;
 * quy tắc đó chưa có trên máy nào, và người dùng giữ bản iOS cũ nhiều năm, nên ngưỡng ở đây vẫn là 16px.
 * Gặp ở 3 trên 12 trang A/B (14/11/2026).
 *
 * Trả về lời báo cho ô này, hoặc undefined nếu chạm vào ô không làm trang phóng to.
 */
export function inputZoomFinding(f: TypingField): string | undefined {
  // Ô bị khoá không nhận focus nên không bao giờ phóng to. Ô chỉ đọc vẫn tính: chạm vào thì WebKit vẫn mở phiên nhập
  // liệu và đi tới bước phóng to để lộ ô (WKContentViewInteraction.mm, _elementDidFocus), chỉ không hiện bàn phím.
  if (f.disabled || f.size >= 16) return undefined;
  return `${f.size}px text: iOS zooms the whole page in when this field is tapped and leaves it zoomed; use 16px (font-size: max(16px, 1em))`;
}
