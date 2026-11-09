# design-kit

Bộ chuẩn và cổng kiểm để Claude (Opus) làm giao diện web và ứng dụng **đẹp, hiện đại, dễ dùng** ngay từ lần đầu, thay vì dừng ở mức "chạy được".

## Vì sao có dự án này

Khi không có hướng dẫn, mô hình ngôn ngữ chọn lựa chọn phổ biến nhất: font Inter, gradient tím trên nền trắng, bộ thẻ giống nhau, chuyển động tối thiểu. Anthropic gọi hiện tượng này là *hội tụ phân phối*, và ghi nhận rằng chỉ dẫn thẩm mỹ cụ thể, quy được ra mã, làm kết quả tốt lên ngay. Nghiên cứu cũng cho thấy LLM tự chấm giao diện chưa bằng người. Vì vậy design-kit chia việc như sau:

- **Máy đo làm cổng cứng** cho mọi thứ đo được.
- **Người duyệt thẩm mỹ** trên ảnh chụp.

## Gồm những gì

| Phần | Ở đâu | Làm gì |
| --- | --- | --- |
| Token | `tokens/` | Gồm `fonts.css` (nạp đầu tiên), `core.css` (khoảng cách bậc 4px, thang chữ 1.25, chuyển động, độ dài dòng 32em), và ba hướng màu cùng font: `dem.css`, `giay.css`, `dam.css`. Mỗi hướng có bản sáng và tối. |
| Ba hướng thẩm mỹ | `design/<huong>/DESIGN.md` | **Đêm**: ứng dụng, dashboard. **Giấy**: tài liệu, báo cáo. **Đậm**: landing, marketing. Theo đặc tả DESIGN.md của Google. Sinh tự động từ token, lint sạch. |
| Khối mẫu HTML/CSS | `blocks/html/` | 11 khối: `dau-trang`, `form-dang-nhap`, `bang-du-lieu`, `trang-thai`, `chi-so`, `hop-thoai`, `hero`, `bai-viet`, `thanh-ben`, `thong-bao`, `bo-loc`. Đổi hướng bằng `?dk=dem\|giay\|dam`. |
| Khối mẫu React | `blocks/react/` | Bốn khối `FormDangNhap`, `TrangThai`, `BangDuLieu`, `HopThoai`, viết bằng React + shadcn/ui, dùng chung token. |
| Cổng kiểm | `design-kit check` | Render ở 320/390/1280 px, cả sáng lẫn tối. Chạy axe-core (WCAG 2.2 AA) và probe đo chữ, dòng, tiếng Việt (đi xuyên shadow DOM). Kiểm giảm chuyển động, focus, LCP/CLS, chạy Impeccable, rồi chụp ảnh. |
| Skill | `skill/SKILL.md` | Cài ở `~/.claude/skills/design-kit` (junction). Gồm quy trình chọn hướng, chọn khối, chạy cổng, và các bẫy đã gặp. |
| Tiêu chí | `docs/tieu-chi.md` | Ngưỡng, cách đo, loại cổng và nguồn của từng tiêu chí. |

## Dùng

```bash
design-kit                                   # trạng thái: hướng, khối, công cụ
design-kit check index.html --strict         # cổng cho một trang; thoát 1 nếu có lỗi cứng
design-kit check http://localhost:5173       # trang đang chạy trên dev server
design-kit check blocks/html --query dk=dem,dk=giay,dk=dam
```

Kết quả in dạng TOON: mỗi trang có một dòng phán quyết, kèm bảng kiểm tra và danh sách phát hiện (cứng hoặc mềm). Ảnh chụp lưu trong `.design-kit/shots/`.

## Trạng thái (09/11/2026)

- **Giai đoạn 1** (nghiên cứu và đề xuất) đã xong. Báo cáo ở [`.folio/bao-cao-giai-doan-1.html`](.folio/bao-cao-giai-doan-1.html). Bằng chứng nằm trong kho tri thức, chủ đề `tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun`.
- **Giai đoạn 2, phương án C** do chủ chốt (xem `docs/quyet-dinh.md`):
  - Đã có:
    - token và ba hướng thẩm mỹ;
    - CLI cổng kiểm (chạy song song);
    - 11 khối HTML và 4 khối React;
    - skill, kèm quy tắc trong `~/.claude/CLAUDE.md`.
  - **Đánh giá A/B** (`eval/ab-2026-11-09/`, trang `.folio/danh-gia-ab.html`):
    - Bản Opus mặc định: 12 lỗi cứng, 48 lỗi mềm. Bản design-kit: 0 lỗi cứng, 7 lỗi mềm.
    - Chủ chấm mù, chọn bản design-kit ở cả 3/3 đề. Giới hạn: bản design-kit luôn nằm ở cột phải.
  - Còn lại:
    - lặp lại A/B với vị trí đảo;
    - tuỳ chọn `--steps` để cổng tự bấm qua các trạng thái;
    - báo lỗi shadow DOM cho Impeccable.

## Nguyên tắc

- Ngưỡng nào cũng ghi nguồn và loại: **chuẩn** (W3C, Google), **nghiên cứu**, hoặc **quy ước**.
- Chỉ thêm khối mới khi khối đó đã qua cổng ở cả 3 hướng × sáng/tối, và đã được xem ảnh chụp.
- Không ghi công Claude trong commit hay tài liệu.
