import type { TypingField } from "./probe.js";

/**
 * Phép đo `input-zoom` (mềm, chỉ ở khổ điện thoại ≤ 480px).
 *
 * iOS Safari phóng to cả trang khi người dùng chạm vào ô gõ chữ có chữ nhỏ, và không tự thu về khi rời ô: trang
 * responsive bị tràn ngang, người dùng phải chụm hai ngón để xem lại. Mã WebKit hiện tại (WKWebViewIOS.mm, kho tri thức
 * c43): tỉ lệ phóng = 16 / cỡ chữ của ô, bỏ qua nếu tỉ lệ đổi dưới 10%. Gặp ở 3 trên 12 trang A/B (14/11/2026).
 *
 * Trả về lời báo cho ô này, hoặc undefined nếu chạm vào ô không làm trang phóng to.
 */
export function inputZoomFinding(f: TypingField): string | undefined {
  return f.size < 16 ? `${f.size}px text: iOS zooms the whole page in when this field is tapped; use 16px (font-size: max(16px, 1em))` : undefined;
}
