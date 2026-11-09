# design-kit

Bộ chuẩn và cổng kiểm để Claude (Opus) làm giao diện web và ứng dụng **đẹp, hiện đại, dễ dùng** ngay từ lần đầu, thay vì dừng ở mức "chạy được".

## Vì sao có dự án này

Khi không có hướng dẫn, mô hình ngôn ngữ chọn lựa chọn phổ biến nhất: font Inter, gradient tím trên nền trắng, bộ thẻ giống nhau, chuyển động tối thiểu. Anthropic gọi hiện tượng này là *hội tụ phân phối*, và ghi nhận rằng chỉ dẫn thẩm mỹ cụ thể, quy được ra mã, làm kết quả tốt lên ngay. Nghiên cứu cũng cho thấy LLM tự chấm giao diện chưa bằng người. Vì vậy design-kit chia việc như sau:

- **Máy đo làm cổng cứng** cho mọi thứ đo được.
- **Người duyệt thẩm mỹ** trên ảnh chụp.

## Gồm những gì

| Phần | Ở đâu | Làm gì |
| --- | --- | --- |
| Token | `tokens/` | Gồm `fonts.css` (Google Fonts) hoặc `fonts-local.css` cùng thư mục `fonts/` (font tự host, chỉ bộ chữ Latin và tiếng Việt, 414 KB, giấy phép OFL). Tệp font nạp đầu tiên. Tiếp theo là `core.css` (khoảng cách bậc 4px, thang chữ 1.25, chuyển động, độ dài dòng 32em), và ba hướng màu cùng font: `dem.css`, `giay.css`, `dam.css`. Mỗi hướng có bản sáng và tối. |
| Ba hướng thẩm mỹ | `design/<huong>/DESIGN.md` | **Đêm**: ứng dụng, dashboard. **Giấy**: tài liệu, báo cáo. **Đậm**: landing, marketing. Theo đặc tả DESIGN.md của Google. Sinh tự động từ token, lint sạch. |
| Khối mẫu HTML/CSS | `blocks/html/` | 13 khối: `dau-trang`, `form-dang-nhap`, `bang-du-lieu`, `trang-thai`, `chi-so`, `hop-thoai`, `hero`, `bai-viet`, `thanh-ben`, `thong-bao`, `bo-loc`, `trinh-tu` (từng bước), `bat-dau` (danh sách bắt đầu + mẹo đúng lúc). Đổi hướng bằng `?dk=dem\|giay\|dam`. |
| Khối mẫu React | `blocks/react/` | Bốn khối `FormDangNhap`, `TrangThai`, `BangDuLieu`, `HopThoai`, viết bằng React + shadcn/ui, dùng chung token. |
| Cổng kiểm | `design-kit check` | Render ở 320/390/1280 px, cả sáng lẫn tối. Chạy axe-core (WCAG 2.2 AA) và probe đo chữ, dòng, tiếng Việt (đi xuyên shadow DOM). Kiểm giảm chuyển động, focus (khổ 1280 và 390), dẫn đường (`guide`), LCP/CLS, chạy Impeccable, rồi chụp ảnh. Đo cả các trạng thái sau thao tác ghi trong `<trang>.steps.json`. |
| Nhắc dẫn đường | `design-kit`, `design-kit check` | Màn không đối số in mục `workflow`. Mỗi lần kiểm kết thúc bằng lời nhắc: lập bản đồ tác vụ, gắn mỗi chỗ dễ lúng túng với một mẫu dẫn đường (như phần hướng dẫn trong game). |
| Đổi màu | `design-kit doi-mau`, `design-kit kiem-mau` | Đổi sắc màu nhấn theo thương hiệu mà vẫn giữ mọi cặp đạt WCAG; kiểm cặp màu của tệp token bất kỳ. |
| Plugin Claude Code | `.claude-plugin/`, `skills/design-kit/`, `hooks/` | Skill (chọn hướng, chọn khối, dẫn đường như game, chạy cổng, các bẫy đã gặp) và hook: nhắc ngay khi AI sửa tệp giao diện, chặn "báo xong" khi chưa chạy `design-kit check`. Repo này cũng là marketplace. |
| Tiêu chí | `docs/tieu-chi.md`, `docs/nguon.md` | Ngưỡng, cách đo, loại cổng của từng tiêu chí; nguồn và câu trích (xuất từ kho tri thức). |

## Cài

Cần Node ≥ 20 và Edge hoặc Chrome. Không có hai trình duyệt này thì cổng dùng Chromium của Playwright: `npx playwright install chromium`.

```bash
git clone https://github.com/ngoviet/design-kit && cd design-kit
npm ci              # cài phụ thuộc và build dist/ (script prepare)
npm install -g .    # lệnh design-kit toàn cục, trỏ vào thư mục này
design-kit setup    # tìm trình duyệt; tải engine Impeccable ghim nếu thiếu (sha256)
```

Cập nhật: `git pull && npm ci`. Không dùng `npm install -g github:ngoviet/design-kit`: npm cài toàn cục từ git thì lệnh `npm install` bên trong thừa hưởng chế độ global, nên không cài devDependencies để build (đã thử 09/11/2026).

Trong Claude Code, cài plugin (skill + hook) bằng: `/plugin install design-kit --marketplace ngoviet/design-kit`

Hoặc làm hai bước: `/plugin marketplace add ngoviet/design-kit`, rồi `/plugin install design-kit@design-kit`.

## Dùng

```bash
design-kit                                   # trạng thái: hướng, khối, công cụ
design-kit check index.html --strict         # cổng cho một trang; thoát 1 nếu có lỗi cứng
design-kit check http://localhost:5173       # trang đang chạy trên dev server
design-kit check blocks/html --query dk=dem,dk=giay,dk=dam
design-kit check signup.html --steps '[{"name":"loi","do":[{"click":"button[type=submit]"}]}]'
```

Kết quả in dạng TOON: mỗi trang, và mỗi trạng thái sau thao tác, có một dòng phán quyết. Kèm theo là bảng kiểm tra và danh sách phát hiện (cứng hoặc mềm). Ảnh chụp lưu trong `.design-kit/shots/`.

Các trạng thái sau thao tác ghi trong tệp `<trang>.steps.json` đặt cạnh trang. Cổng tự nhận tệp này, kể cả khi kiểm cả thư mục. Mỗi trạng thái nạp trang mới, chạy thao tác (`click`, `fill`, `check`, `select`, `press`, `hover`, `wait`), rồi được đo đủ mọi tiêu chí. Bước nào không làm được thì báo lỗi cứng. Nút chỉ có ở khổ hẹp thì giới hạn trạng thái bằng `"viewports":[320,390]`.

## Trạng thái (09/11/2026)

- **Giai đoạn 1** (nghiên cứu và đề xuất) đã xong. Báo cáo ở [`.folio/bao-cao-giai-doan-1.html`](.folio/bao-cao-giai-doan-1.html). Bằng chứng nằm trong kho tri thức, chủ đề `tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun`.
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
  - Còn lại:
    - Gửi báo lỗi shadow DOM cho Impeccable. Chủ đã đồng ý, nhưng chế độ tự động chặn lệnh tạo issue; lệnh để chủ tự chạy nằm trong `docs/bao-loi-impeccable-shadow-dom.md`.
    - Bật repo trong Woodpecker (https://ci.bepmamnon.com). Chủ phải làm vì cần đăng nhập GitHub.
  - **Plugin đã cài trên PC1 (10/11/2026)** từ marketplace thư mục `D:\code\design-kit` (Claude Code đọc thẳng repo). Junction cũ đã gỡ. Đã thử bằng một phiên Claude chạy nền: ghi một tệp HTML thì nhận lời nhắc, định dừng thì hook Stop chặn để chạy cổng.

## Nguyên tắc

- Ngưỡng nào cũng ghi nguồn và loại: **chuẩn** (W3C, Google), **nghiên cứu**, hoặc **quy ước**.
- Chỉ thêm khối mới khi khối đó đã qua cổng ở cả 3 hướng × sáng/tối, và đã được xem ảnh chụp.
- Không ghi công Claude trong commit hay tài liệu.
