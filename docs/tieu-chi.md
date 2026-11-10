# Bộ tiêu chí kiểm được

Mỗi ngưỡng có ghi nguồn và loại:

- **chuẩn**: W3C, Google.
- **nghiên cứu**: nghiên cứu có kiểm chứng.
- **quy ước**: ngưỡng của công cụ hoặc của chính design-kit.

Cổng có ba mức:

- **cứng**: trượt thì chưa được báo xong.
- **mềm**: phải sửa, hoặc ghi lý do không sửa.
- **người**: chủ duyệt trên ảnh chụp.

Mã nguồn `s…` và luận điểm `c…` tra trong [`docs/nguon.md`](nguon.md): bản xuất có URL và câu trích. Bản gốc nằm trong kho tri thức, chủ đề `tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun` (s1–s28, c1–c36). Mọi trích dẫn đã được kiểm lại bằng `research-axi kb verify`.

| Tiêu chí | Ngưỡng | Đo bằng (`design-kit check`) | Cổng | Loại, nguồn |
| --- | --- | --- | --- | --- |
| Trang hiện được | Có chữ, ảnh hoặc đồ hoạ nhìn thấy, chậm nhất 5 s sau khi mạng rảnh (cổng đợi nội dung đến muộn rồi mới đo) | `render` (probe đi xuyên shadow root mở, tính cả opacity 0 của khung cha; host của shadow root đóng, từ 8×8 px, được tính là có hình vì probe không vào được; vỏ light DOM chưa vẽ gì thì không tính) | cứng | quy ước: trang trắng làm mọi phép đo khác "đạt" vô nghĩa (gặp 10/11/2026 với lan-topo-card) |
| Không lỗi khi mở | Không có lỗi script chưa bắt; script và stylesheet tải được | `errors` (sự kiện `pageerror`, phản hồi ≥ 400, yêu cầu hỏng trừ `ERR_ABORTED`) | cứng | quy ước: người dùng gặp tính năng hỏng; console.error không tính (favicon 404 gây nhiễu) |
| Custom element | Mọi custom element rỗng đều được định nghĩa | `render` (`:not(:defined)`, không có con hay chữ trong light DOM) | mềm | quy ước: script của thành phần hỏng hoặc chưa tải; trang chứa thiếu phần của app chủ (vd `ha-card`). Thẻ chưa đăng ký mà có con (`app-root` của Angular, thẻ chỉ để gắn style) chỉ được ghi chú `not registered as custom elements` |
| Tương phản chữ | ≥ 4,5:1, chữ lớn ≥ 3:1, cả theme sáng lẫn tối | axe `color-contrast`, Impeccable `low-contrast` | cứng | chuẩn: WCAG 1.4.3 (s5) |
| Tương phản phi chữ | ≥ 3:1 (viền ô nhập, icon, vòng focus) | `scripts/kiem-cap-mau.mjs` trên token | cứng | chuẩn: WCAG 1.4.11 (s6) |
| APCA | Thân chữ \|Lc\| ≥ 60 | `palette-axi` | mềm | quy ước, chưa thành chuẩn (WCAG 3) |
| Vùng bấm | ≥ 24×24 px; nút chính 44px | axe `target-size` | cứng | chuẩn: WCAG 2.5.8 (s1) |
| Reflow | 320px không cuộn ngang | `overflow` | cứng | chuẩn: WCAG 1.4.10 (s8) |
| Nhãn và tên | Ô nhập có nhãn; tên truy cập chứa chữ đang hiện | axe `label`, `label-content-name-mismatch` | cứng | chuẩn: WCAG 1.3.1, 2.5.3 |
| Autocomplete | `username`, `current-password`, `new-password` đúng chỗ | axe `autocomplete-valid` + khối mẫu | cứng | chuẩn (s14) |
| Vùng cuộn | Vùng `overflow:auto` focus được bằng bàn phím | axe `scrollable-region-focusable` | cứng | chuẩn: WCAG 2.1.1 |
| Giảm chuyển động | Không animation nào còn chạy khi `reduce` | `motion` | cứng | chuẩn: WCAG 2.3.3 (s11, s15) |
| Focus | Thấy được, ≥ 2px, không bị che, không rơi vào phần tử vô hình (bị cắt về 1px, mờ hẳn, ngoài màn) | `focus` (Tab 15 lần ở khổ 1280 **và** 390) | mềm | chuẩn: 2.4.7, 2.4.11 AA, 2.4.13 AAA (s9, s10) |
| CWV | LCP ≤ 2,5 s, CLS ≤ 0,1 (lab); INP ≤ 200 ms (thực địa) | `lcp`, `cls` | mềm | chuẩn: p75 thực địa (s2) |
| Tiếng Việt | `lang="vi"`; giãn dòng tiêu đề ≥ 1,2; font có bộ ký tự vietnamese | `lang`, `heading-lh`, `font` | cứng / mềm | quy ước (s18) |
| Cỡ chữ | Không chữ nào < 12px, tính theo cỡ đã co: chữ SVG (viewBox) và chữ trong khối `transform: scale()`, `scale`, `zoom` | `text-min`, Impeccable `tiny-text` | cứng | quy ước (Impeccable) |
| Thân chữ | ≥ 16px; giãn dòng ≥ 1,5 | `body-size`, `body-lh` | mềm | quy ước, WCAG 1.4.12 |
| Độ dài dòng | ≤ 75–80 ký tự. Đặt `--measure: 32em`, **không dùng `ch`** | `measure`, Impeccable `line-length` | mềm | nghiên cứu: Baymard 50–75 (s17) |
| Chữ không bị cắt | Không chữ nào bị giấu trong hộp của nó: dấu ba chấm hay `-webkit-line-clamp` đang giấu chữ, `overflow: hidden`/`clip` cắt ngang chữ hay cắt mất dòng, mực chữ (dấu chồng "Ổ", dấu nặng "ị", chân "g") vượt ra ngoài hộp khi line-height chặt. Không tính: chữ nằm hẳn ngoài hộp (ngăn kéo đóng, `text-indent` âm, slide khác), sr-only và `clip-path`, phần tử absolute/fixed thoát hộp cắt nằm dưới khối chứa của nó, chữ tới được bằng cách cuộn (đã qua một hộp `auto`/`scroll` ở trục đó). Phần tử có `title` hay `aria-label` chứa đủ chữ **vẫn bị báo**: tooltip không tới được người dùng cảm ứng hay bàn phím, cắt có chủ ý thì ghi lý do (cổng mềm); cổng chạy trên 105 trang khối mẫu không gặp ca nào như vậy | `text-clip` (đi từ nút chữ lên hộp cắt theo cây phẳng, xuyên shadow root và slot; mực chữ đo bằng canvas `actualBoundingBox`; báo chữ còn hiện và khổ bị cắt) | mềm | quy ước: lan-topo-card v0.8.3 cắt dòng phụ còn "5 phía s…" ở 1280, mọi phép đo khác đạt, chỉ ảnh chụp thấy (10/11/2026) |
| Dấu hiệu UI do AI làm | 0 luật "slop" của Impeccable, trừ `cream-palette` (mềm: thuộc khẩu vị, chủ chấm A/B chọn bản nền kem) | `impeccable` | cứng | nghiên cứu (s4); A/B 09/11/2026 |
| Màu hợp thương hiệu | Sắc nhấn theo lĩnh vực hoặc thương hiệu, không mặc định theo loại màn hình | `scripts/doi-mau.mjs` + ảnh chụp | người | A/B đợt 2: thua ở đề tiệm bánh vì màu xanh ngọc lạnh |
| Quy trình có dẫn đường | Có bản đồ tác vụ. Tác vụ trên 3 bước có trình tự từng bước, ghi tên bước kế tiếp. Lần đầu dùng có danh sách "Bắt đầu". Chỗ dễ lúng túng có mẹo đúng lúc. Không có tour mở đầu bắt buộc | ảnh chụp các trạng thái `?lan-dau=1`, `?buoc=N` và trạng thái trong `<trang>.steps.json` | người | nghiên cứu: NN/g (s25–s27), Gee (s28) |
| Dẫn đường đo được | Nút đi tiếp không chỉ ghi "Tiếp"/"Next" (phân trang trong `<nav>` thì được). Câu báo rỗng ("Không có … nào", "No results") có nút hoặc liên kết gỡ ngay cạnh. Không có thư viện tour (intro.js, Shepherd, driver.js…) hay hộp "Chào mừng" mở sẵn khi vào trang | `guide` | mềm | nghiên cứu: NN/g (s25–s27); quy ước design-kit |
| Trạng thái sau tương tác | Mỗi trạng thái người dùng tới bằng thao tác (lỗi form, bước 3, menu mở, sắp xếp, không có kết quả) đạt mọi tiêu chí trên. Thao tác nào không làm được ở một khổ là lỗi | `<trang>.steps.json` hoặc `--steps`: mỗi trạng thái một dòng phán quyết; `steps` khi bấm hỏng | cứng | quy ước design-kit; A/B: agent kiểm theo trạng thái tìm thêm lỗi |
| Form dài một màn | Không quá 12 ô nhập hiện cùng lúc. Nếu nhiều hơn, chia bước hoặc ẩn bớt phần nâng cao | `long-form` | mềm | nghiên cứu: NN/g (s25, s27) |
| Màn nhìn nhanh | Dashboard: số liệu hôm nay và việc cần làm ngay nằm ở màn đầu 1280px, không nằm dưới bảng dài | ảnh chụp 1280px | người | A/B đợt 2 |
| Phân cấp, cá tính | Mỗi màn có một điểm nhấn chính, khớp DESIGN.md | ảnh chụp 3 khổ × sáng/tối | người | nghiên cứu: LLM tự chấm chưa bằng người (s20, s21) |

## Đã đo được trong lúc xây (09/11/2026)

- **`ch` đo sai với chữ Việt.** Trong Be Vietnam Pro, `max-width: 68ch` chứa khoảng 93 ký tự mỗi dòng: chữ Việt trung bình hẹp hơn chữ số "0" khoảng 37%. Vì vậy token dùng `32em`.
- **Impeccable không nhìn vào shadow DOM.** Engine 0.1.19, quét qua URL, bỏ sót chữ 9,9px và tương phản 1,55:1 nằm trong một open shadow root. Probe của design-kit và axe-core đều bắt được. Chi tiết ở `test/fixtures/loi.html`.
- **Chữ SVG co theo viewBox.** Khai báo 13px trong viewBox rộng 900, khi hiển thị ở khổ 390px chỉ còn khoảng 5px.
- **Chữ HTML co theo `transform: scale()`** (10/11/2026). Sơ đồ của lan-topo-card co để vừa thẻ, mức co thấp nhất mặc định là 0,55. Nhãn 12px vì thế hiện ra chỉ còn 6,6px, vậy mà `text-min` vẫn báo đạt, vì font-size tính toán không đổi. `scale` và `zoom` cũng vậy. Probe giờ nhân hệ số co của mọi tổ tiên vào cỡ chữ (`test/fixtures/co-gian.html`).
- **Chữ bị cắt mà mọi phép đo vẫn đạt** (10/11/2026). Ở khổ 1280, kiểu cây ngang, dòng phụ của nút CRS310 trong lan-topo-card hiện "6/10 cổng có link · 5 phía s…": chữ đủ cỡ, đủ tương phản, không tràn trang. Lúc dựng fixture lại lộ thêm một ca: `line-height: 1` với `overflow: hidden` cắt mất dấu, "Ổn định" hiện thành "Ön đinh" (mất dấu hỏi và dấu nặng, đổi nghĩa) mà `scrollHeight` không tràn, vì cuộn chỉ tính hộp dòng chứ không tính mực chữ. Phép đo `text-clip` đo cả hai (`test/fixtures/cat-chu.html`).
- **Tái hiện lại lỗi shadow DOM của Impeccable** (skill 4.8.1, engine 0.1.19). Trang chỉ có lỗi trong shadow root: Impeccable báo 0 lỗi và thoát 0. Đặt cùng dòng chữ lỗi vào light DOM thì nó báo đủ (`low-contrast`, `undersized-ui-text`). Bản nháp báo lỗi ở `docs/bao-loi-impeccable-shadow-dom.md`, chưa gửi.
- **Cổng theo trạng thái bắt được lỗi mà lần render đầu bỏ qua.** Ở khổ 320/390, khối `bang-du-lieu` giấu `thead` theo kiểu sr-only. Hệ quả: người dùng điện thoại không sắp xếp được bảng, còn phím Tab rơi vào nút vô hình. Tệp `bang-du-lieu.steps.json` báo "click … failed" ở 320/390, và phép đo focus ở 390 báo focus lạc. Bản React cũng không có cách sắp xếp ở khổ hẹp, và câu báo rỗng không kèm nút gỡ. Đã sửa cả hai bản: ẩn hẳn `thead`, thêm ô "Sắp xếp", thêm trạng thái "không thấy" có nút gỡ lọc.
