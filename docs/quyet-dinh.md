# Quyết định

## 09/11/2026: chốt phương án giai đoạn 2

Chủ chọn **phương án C**. Phương án này gồm toàn bộ B, cộng thêm thư viện khối mẫu.

| Câu hỏi | Chủ chọn |
| --- | --- |
| Phương án | C: skill `design-kit`, lệnh kiểm `design-kit check`, thư viện khối mẫu |
| Đặt lệnh kiểm ở đâu | Trong design-kit. `imp-axi` chỉ làm một việc: quét |
| Hướng thẩm mỹ | 2–3 hướng, mỗi hướng một DESIGN.md |
| Khung kỹ thuật của khối mẫu | Cả hai: HTML/CSS thuần làm gốc, có thêm bản React + shadcn/ui |

### Thứ tự làm

1. Token chung, ba hướng thẩm mỹ, mỗi hướng một DESIGN.md. Kiểm bằng `@google/design.md lint`.
2. CLI `design-kit check`, theo chuẩn AXI, làm cổng cứng. Lệnh này gộp:
   - render bằng Playwright, ở các khổ 320/390/1280 px, cả sáng lẫn tối;
   - axe-core với bộ luật WCAG 2.2 AA;
   - chỉ số chữ, có đi vào cả shadow DOM;
   - giảm chuyển động;
   - CLS và LCP;
   - Impeccable;
   - chụp ảnh.
3. Đợt 1 khối mẫu: 6 khối HTML/CSS, trong đó 2 khối có thêm bản React.
4. Chạy cổng trên mọi khối, sửa cho đến khi đạt.
5. Skill `design-kit`. Đề xuất 2 dòng thêm vào `~/.claude/CLAUDE.md`, nhưng chỉ ghi vào khi chủ đồng ý.
6. Đánh giá A/B: làm thử ba trang, mỗi trang hai bản (có skill và không có skill).

## 09/11/2026: thêm quy tắc vào CLAUDE.md toàn cục

Chủ đồng ý. Đã thêm mục "Giao diện: dùng skill design-kit" vào `~/.claude/CLAUDE.md`. Từ nay mọi phiên làm giao diện đều đi qua skill và chạy cổng kiểm.

## 09/11/2026: quy trình dễ dùng, dẫn đường như game

Chủ muốn AI luôn tìm cách làm quy trình đơn giản cho người dùng: có hướng dẫn từng bước, làm đến đâu hướng dẫn đến đấy, giống phần hướng dẫn trong game.

Đã làm:

- Skill thêm mục 2b: viết bản đồ tác vụ, rồi gắn mỗi chỗ người dùng dễ lúng túng với một mẫu dẫn đường.
- Thêm hai khối `trinh-tu` và `bat-dau`.
- Thêm phép đo mềm `long-form`.
- Bộ tiêu chí thêm dòng "Quy trình có dẫn đường" (cổng người duyệt).
- Bằng chứng: NN/g về wizard, onboarding và progressive disclosure; nguyên tắc "đúng lúc, khi cần" của James Paul Gee. Ghi trong kho tri thức, claims c29–c36.
