# design-kit

Bộ chuẩn để Claude (Opus) làm giao diện web và ứng dụng **đẹp, hiện đại, dễ dùng** ngay từ lần đầu, thay vì dừng ở mức "chạy được".

## Vì sao có dự án này

Khi không có hướng dẫn, mô hình ngôn ngữ chọn lựa chọn phổ biến nhất: font Inter, gradient tím trên nền trắng, bộ thẻ giống nhau, chuyển động tối thiểu. Anthropic gọi hiện tượng này là *hội tụ phân phối*. Họ cũng ghi nhận rằng chỉ dẫn thẩm mỹ cụ thể, quy được ra mã, làm kết quả tốt lên ngay.

Dự án này giữ phần **chuẩn** dùng chung cho mọi dự án sau:

- **Ngưỡng số kiểm được**: tương phản, vùng bấm, độ dài dòng, cỡ chữ, Core Web Vitals…
- **Token và DESIGN.md mẫu**: màu OKLCH, thang chữ, nhịp khoảng cách, chữ tiếng Việt.
- **Khối mẫu** đã qua kiểm, dùng làm ví dụ cho mô hình.
- **Vòng tự kiểm**: dựng trang → đo trên trang đã render → chụp màn hình → sửa.

Phần **quét** do công cụ khác đảm nhiệm, design-kit không làm lại:

| Công cụ | Vai trò |
| --- | --- |
| [`imp-axi`](../imp-axi) | Bọc bộ dò Impeccable, tìm lỗi giao diện và các dấu hiệu "UI do AI làm" |
| [`palette-axi`](../palette-axi) | Kiểm bảng màu OKLCH, APCA/WCAG, gamut |
| skill `impeccable` | Hướng dẫn thiết kế, chấm critique/audit |

Hai bên nối với nhau qua **DESIGN.md**: engine Impeccable tự đọc tệp này khi quét.

## Trạng thái

**Giai đoạn 1 (nghiên cứu và đề xuất) đã xong.** Chưa xây bộ mẫu.

- Báo cáo: [`.folio/bao-cao-giai-doan-1.html`](.folio/bao-cao-giai-doan-1.html). Trang gồm kiểm kê công cụ, các tiêu chuẩn kèm nguồn, bộ tiêu chí có ngưỡng, ba phương án kiến trúc và kế hoạch giai đoạn 2.
- Bằng chứng: kho tri thức `D:\code\research-hub\kb\tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun`. Mọi trích dẫn đã kiểm lại bằng `research-axi kb verify`.

Giai đoạn 2 chỉ bắt đầu khi chủ đã chốt phương án.

### Trang báo cáo tự áp bộ tiêu chí (09/11/2026)

- `imp-axi detect` ở khổ 1280×800 và 390×844: lần đầu báo 5 lỗi `cramped-padding` ở khung bảng. Đã sửa bằng cách chuyển viền sang thẻ `table`. Quét lại: **0 lỗi** ở cả hai khổ.
- Playwright (Edge) ở 320, 390, 1280 px, theme sáng và tối: không tràn ngang, không có chữ dưới 12px, `lang="vi"`, chữ thân 17px với giãn dòng 1,65, đã nạp font Be Vietnam Pro.
- Duyệt ảnh chụp bằng mắt phát hiện thêm hai lỗi mà máy không bắt được, đã sửa cả hai:
  - Ở khổ điện thoại, mục lục chiếm hết màn hình đầu.
  - Trong sơ đồ, một nhãn đè lên đường nối.

  Đây chính là lý do bộ tiêu chí giữ một cổng "người duyệt".

## Nguyên tắc

- Ngưỡng nào cũng phải ghi nguồn. Phân biệt rõ ba loại: **chuẩn** (W3C, Google), **nghiên cứu** (Baymard, bài báo), **quy ước** (của công cụ hoặc của ngành).
- Máy đo là **cổng cứng**. Thẩm mỹ thì người duyệt, vì nghiên cứu cho thấy LLM tự chấm UI chưa bằng người.
- Không ghi công Claude trong commit hay tài liệu.
