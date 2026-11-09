# Nhật ký dự án

Phần "Trạng thái" của README cũ, chuyển sang đây khi repo chuyển public (10/11/2026) và README được viết lại theo
chuẩn readme-axi. Quyết định và lý do chi tiết: [`quyet-dinh.md`](quyet-dinh.md).

## Trạng thái (09/11/2026)

- **Giai đoạn 1** (nghiên cứu và đề xuất) đã xong. Báo cáo ở [`.folio/bao-cao-giai-doan-1.html`](../.folio/bao-cao-giai-doan-1.html). Bằng chứng nằm trong kho tri thức, chủ đề `tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun`.
- **Giai đoạn 2, phương án C** do chủ chốt (xem `docs/quyet-dinh.md`):
  - Đã có:
    - token và ba hướng thẩm mỹ;
    - CLI cổng kiểm (chạy song song, đo cả trạng thái sau thao tác);
    - 13 khối HTML và 4 khối React;
    - skill, kèm quy tắc trong `~/.claude/CLAUDE.md`.
  - **Đánh giá A/B** (`eval/ab-2026-11-09/`, trang `.folio/danh-gia-ab.html`):
    - Bản Opus mặc định: 12 lỗi cứng, 48 lỗi mềm. Bản design-kit: 0 lỗi cứng, 7 lỗi mềm.
    - Chủ chấm mù, chọn bản design-kit ở cả 3/3 đề. Giới hạn: bản design-kit luôn nằm ở cột phải.
  - **Đánh giá A/B đợt 2** (`eval/ab-2026-11-09-dot2/`, trang `.folio/danh-gia-ab-dot2.html`). Lần này bản design-kit đặt ở cột trái, thêm 3 đề mới:
    - Máy đo: bản mặc định 33 lỗi cứng, bản design-kit 0.
    - Chủ chấm: landing chọn design-kit, dashboard tiệm bánh chọn bản mặc định, trang cài đặt hoà.
    - **Gộp 6 đề:** design-kit thắng 4, mặc định thắng 1, hoà 1.
    - Ở đề thua, nguyên nhân có thể là:
      - kit chọn hướng theo loại màn hình mà bỏ qua thương hiệu (tiệm bánh lại ra màu xanh ngọc lạnh);
      - khi sửa lỗi cứng, bố cục mất khả năng nhìn một lần thấy hết;
      - luật `cream-palette` chặn cứng một lựa chọn thuộc về khẩu vị.
  - **Đã sửa sau A/B đợt 2:**
    - `scripts/doi-mau.mjs` đổi màu nhấn và trung tính theo thương hiệu mà vẫn giữ tương phản;
    - skill buộc chọn màu theo thương hiệu, giữ màn nhìn nhanh cho dashboard, và sửa lỗi tại chỗ chứ không dời bố cục;
    - `cream-palette` hạ xuống mềm.
  - **Quy trình dễ dùng, dẫn đường như game** (chủ yêu cầu 09/11/2026):
    - Skill có mục 2b. Trước khi dựng, AI phải viết bản đồ tác vụ, rồi gắn mỗi chỗ người dùng dễ lúng túng với một mẫu:
      - trình tự từng bước;
      - danh sách "Bắt đầu";
      - mẹo đúng lúc;
      - trạng thái rỗng biết hướng dẫn;
      - ẩn bớt phần nâng cao;
      - Hoàn tác thay vì hỏi xác nhận.
    - Không dùng tour hướng dẫn mở đầu, vì NN/g đo được tour không giúp người dùng làm việc tốt hơn.
    - Có thêm hai khối `trinh-tu` và `bat-dau`, và phép đo mềm `long-form` (cảnh báo khi một màn có hơn 12 ô nhập).
  - **Công cụ tự nhắc dẫn đường, và cổng đo trạng thái** (chủ nhắc lại yêu cầu 09/11/2026):
    - `design-kit` in mục `workflow`, `design-kit check` luôn kết thúc bằng lời nhắc "Guide like a game".
    - Phép đo mềm `guide` báo nút chỉ ghi "Tiếp", câu báo rỗng không kèm nút gỡ, tour tự bật khi mở trang.
    - `--steps` và tệp `<trang>.steps.json`. Đã viết cho 9 khối HTML và 3 khối React.
    - Focus được kiểm ở cả khổ 390, và báo khi focus rơi vào phần tử vô hình.
    - Cách đo mới tìm ra ba lỗi thật, đã sửa: bảng không sắp xếp được trên điện thoại, kết quả tìm rỗng không có nút gỡ, bộ lọc về 0 mà không nói lý do.
  - `~/.claude/CLAUDE.md` có thêm quy tắc dẫn đường như game (chủ đồng ý 09/11/2026).
  - **Chạy độc lập và đóng gói (0.2.0):**
    - lệnh `doi-mau`, `kiem-mau`, `setup`;
    - font tự host;
    - bằng chứng xuất ra `docs/nguon.md`;
    - đường lùi Chromium;
    - engine Impeccable ghim phiên bản, có kiểm sha256;
    - plugin Claude Code gồm skill và hook;
    - Woodpecker CI;
    - trường `files` để cài từ git.

    Đã thử cài từ gói ra một thư mục tạm, tách khỏi repo: cả ba lệnh chạy được.
  - **Plugin đã cài trên PC1 (10/11/2026)** từ marketplace thư mục `D:\code\design-kit` (Claude Code đọc thẳng repo). Junction cũ đã gỡ. Đã thử bằng một phiên Claude chạy nền: ghi một tệp HTML thì nhận lời nhắc, định dừng thì hook Stop chặn để chạy cổng.

## 10/11/2026

- Repo lên GitHub (`ngoviet/design-kit`), PR #1 qua no-mistakes và Woodpecker CI, đã gộp.
- Chuyển public, Woodpecker tắt, CI chuyển sang GitHub Actions, README viết lại theo readme-axi, phát hành 0.2.0.
- Báo lỗi shadow DOM cho Impeccable: vẫn chờ chủ tự chạy lệnh trong `docs/bao-loi-impeccable-shadow-dom.md`.
