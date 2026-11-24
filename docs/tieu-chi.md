# Bộ tiêu chí kiểm được

Mỗi ngưỡng có ghi nguồn và loại:

- **chuẩn**: W3C, Google.
- **nghiên cứu**: nghiên cứu có kiểm chứng.
- **quy ước**: ngưỡng của công cụ hoặc của chính design-kit.

Cổng có ba mức:

- **cứng**: trượt thì chưa được báo xong.
- **mềm**: phải sửa, hoặc ghi lý do không sửa.
- **người**: chủ duyệt trên ảnh chụp.

Mã nguồn `s…` và luận điểm `c…` tra trong [`docs/nguon.md`](nguon.md): bản xuất có URL và câu trích. Bản gốc nằm trong kho tri thức, chủ đề `tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun` (đợt 1, 09/11/2026: s1–s28, c1–c36; đợt 2, 14–15/11/2026: s29–s73, c37–c78). Mã `N…` là nguồn đợt 24/11/2026: cùng tệp, mục cuối. Mọi trích dẫn đã được kiểm lại bằng
`research-axi kb verify` (đợt 2: 77 trên 78 khớp khi tải lại; câu trích của ReDeCheck, c40, nằm trong PDF nên kiểm tay).

| Tiêu chí | Ngưỡng | Đo bằng (`design-kit check`) | Cổng | Loại, nguồn |
| --- | --- | --- | --- | --- |
| Trang hiện được | Có chữ, ảnh hoặc đồ hoạ nhìn thấy, chậm nhất 5 s sau khi mạng rảnh (cổng đợi nội dung đến muộn rồi mới đo) | `render` (probe đi xuyên shadow root mở, tính cả opacity 0 của khung cha; host của shadow root đóng, từ 8×8 px, được tính là có hình vì probe không vào được; vỏ light DOM chưa vẽ gì thì không tính) | cứng | quy ước: trang trắng làm mọi phép đo khác "đạt" vô nghĩa (gặp 10/11/2026 với lan-topo-card) |
| Không lỗi khi mở | Không có lỗi script chưa bắt; script và stylesheet tải được | `errors` (sự kiện `pageerror`, phản hồi ≥ 400, yêu cầu hỏng trừ `ERR_ABORTED`) | cứng | quy ước: người dùng gặp tính năng hỏng; console.error không tính (favicon 404 gây nhiễu) |
| Custom element | Mọi custom element rỗng đều được định nghĩa | `render` (`:not(:defined)`, không có con hay chữ trong light DOM) | mềm | quy ước: script của thành phần hỏng hoặc chưa tải; trang chứa thiếu phần của app chủ (vd `ha-card`). Thẻ chưa đăng ký mà có con (`app-root` của Angular, thẻ chỉ để gắn style) chỉ được ghi chú `not registered as custom elements` |
| Viewport điện thoại | Điện thoại dàn trang đúng bề rộng màn: có `<meta name="viewport" content="width=device-width, initial-scale=1">` | `viewport` (mở trang một lần với `isMobile`, ở khổ lớn nhất ≤ 480 trong `--viewports`, đọc bề rộng dàn trang; các lượt render khác chỉ đặt bề rộng cửa sổ nên Playwright bỏ qua thẻ này) | cứng | nghiên cứu: nguyên nhân gốc đứng đầu ở trang do AI sinh, 46% (c37, c38); hành vi Playwright (c39). Trang mẫu thiếu thẻ từng qua cổng với 0 phát hiện, trên máy thật chữ 16px hiện 6,4px (14/11/2026) |
| Tương phản chữ | ≥ 4,5:1, chữ lớn ≥ 3:1, cả theme sáng lẫn tối | axe `color-contrast`, Impeccable `low-contrast` | cứng | chuẩn: WCAG 1.4.3 (s5) |
| Tương phản phi chữ | ≥ 3:1 (viền ô nhập, icon, vòng focus) | `scripts/kiem-cap-mau.mjs` trên token | cứng với token của kit (CI); trên trang đã dựng: chưa đo, agent tự kiểm | chuẩn: WCAG 1.4.11 (s6) |
| APCA | Thân chữ \|Lc\| ≥ 75 (nên 90); chữ phụ, nhãn ≥ 60 | `palette-axi` | mềm | quy ước, chưa thành chuẩn (WCAG 3). Mức theo tài liệu APCA: "L c 90 is preferred and L c 75 is the minimum for body text" (git.apcacontrast.com, đọc lại 24/11/2026). Trước 24/11/2026 bảng ghi 60 cho thân chữ: sai |
| Vùng bấm | ≥ 24×24 px | axe `target-size` | cứng | chuẩn: WCAG 2.5.8 AA (s1). Số 44 là dòng "Đích chạm" |
| Đích chạm | ≥ 44×44 px trên thiết bị chạm (`--touch` đổi mức). Liên kết trong dòng văn được miễn; vùng bấm nới bằng `::after` hay nhãn được tính | `touch` (mở với `hasTouch` ở khổ điện thoại và khổ máy tính bảng 481–1024 có đo; hộp nhỏ thì thử bấm bốn điểm cách tâm gần nửa mức) | mềm | chuẩn nền tảng: Apple mặc định 44 pt, tối thiểu 28 pt (N40), Android 48 dp (N51); NN/g 1 cm (N101); WCAG 2.5.5 là AAA (N32), không phải AA. Khối mẫu của kit: 31 phát hiện đều thật (nút phụ 40 px, thẻ lọc 36 px, liên kết mục lục), 0 báo oan (24/11/2026) |
| Reflow | 320px không cuộn ngang. Từ 15/11/2026 khổ 320 được đo đủ mọi tiêu chí khác (probe, axe, Impeccable, ảnh chụp), không chỉ tràn ngang: khổ hẹp nhất là nơi bố cục gãy trước. `--sweep` đo thêm 16 khổ từ 344 tới 2560, gồm 640×360 (1280×720 phóng 200%) và 844×390 (điện thoại xoay ngang) | `overflow` | cứng | chuẩn: WCAG 1.4.10 (s8, c41; mốc chiều cao 256 px N35); nghiên cứu: kiểm ở vài khổ gợi ý chỉ thấy 66–81% lỗi bố cục (c40) |
| Nhãn và tên | Ô nhập có nhãn; tên truy cập chứa chữ đang hiện | axe `label`, `label-content-name-mismatch` | cứng | chuẩn: WCAG 1.3.1, 2.5.3 |
| Autocomplete | `username`, `current-password`, `new-password` đúng chỗ | axe `autocomplete-valid` + khối mẫu | cứng | chuẩn (s14) |
| Vùng cuộn | Vùng `overflow:auto` focus được bằng bàn phím | axe `scrollable-region-focusable` | cứng | chuẩn: WCAG 2.1.1 |
| Giảm chuyển động | Không hiệu ứng dịch, phóng, xoay hay đổi kích thước nào còn chạy khi `reduce`. Mờ dần, đổi màu được phép | `motion` (chỉ cho qua thuộc tính độ mờ và màu; hiệu ứng không đọc được thuộc tính thì coi là có chuyển động) | cứng | chuẩn: cơ sở là WCAG 2.2.2 mức A; 2.3.3 (s11, s15) là mức AAA. Trước 24/11/2026 mọi hiệu ứng còn chạy đều là lỗi, chặt hơn chuẩn |
| Dừng chuyển động | Hiệu ứng tự chạy quá 5 s (vô hạn hoặc dài) hay video tự phát lặp, đứng cạnh nội dung khác, có nút dừng, tạm dừng hay ẩn | `pause` (Web Animations cả trong shadow root mở, `video`; bỏ chỉ báo đang tải: nhỏ hơn 64×64 px, trong `aria-busy`, `status`, `progressbar`, `alert`) | mềm | chuẩn: WCAG 2.2.2 mức A; hướng dẫn giao diện của Vercel (18/08/2026). 0/105 trang của kit (19/11/2026) |
| Chữ hiện dần khi cuộn | Sau khi cuộn hết trang với giảm chuyển động, không chữ nào còn trong suốt | `reveal` (cuộn từng màn, chữ có opacity < 0,05 ở chính nó hay tổ tiên; bỏ phần tử absolute/fixed, aria-hidden, details/dialog đóng) | mềm | quy ước: taste-skill `hiddenWalk` (2.5.1, 07/11/2026); người bật giảm chuyển động thấy dải trống, ảnh chụp toàn trang đánh lừa người duyệt. 0/105 trang của kit |
| Thực hành tốt của axe | Thứ tự tiêu đề, một `h1`, vùng `main`, nội dung nằm trong vùng mốc… | `axe-bp` (nhóm `best-practice` của axe, cùng một lượt `axe.run`) | mềm | công cụ: axe-core. Bắt được khối `bai-viet` thiếu vùng `main` (đã sửa, 19/11/2026) |
| Focus | Thấy được, ≥ 2px, không bị che, không rơi vào phần tử vô hình (bị cắt về 1px, mờ hẳn, ngoài màn). Vẫn còn trong chế độ màu ép buộc (Windows High Contrast bỏ box-shadow; viền, kể cả viền trong suốt, được tô lại bằng màu hệ thống): vòng chỉ bằng bóng thì thêm `outline: 2px solid transparent`, Tailwind v4 là `outline-hidden` | `focus` (Tab 15 lần ở khổ 1280 **và** 390; phần tử có vòng chỉ bằng box-shadow được đo lại với `forcedColors: active` ngay khi đang focus) | mềm | chuẩn: 2.4.7, 2.4.11 AA, 2.4.13 AAA (s9, s10). Mất hẳn chỉ báo là trượt 2.4.7 (AA), mỏng hơn 2px chỉ dưới 2.4.13 (AAA): hai lời báo tách nhau; cả hai còn mềm vì phép đo chỉ đọc outline và box-shadow, chưa thấy chỉ báo bằng viền hay nền. Vòng mặc định của trình duyệt được tính là thấy (24/11/2026); hành vi forced-colors (c44); khối React của kit dính lỗi này (15/11/2026) |
| CWV | LCP ≤ 2,5 s, CLS ≤ 0,1 (lab); INP ≤ 200 ms (thực địa) | `lcp`, `cls` (lần nạp đầu, khổ rộng nhất, chế độ màu đầu, đọc trước khi đổi khổ) | mềm | chuẩn: p75 thực địa (s2). Nạp từ máy cục bộ, không điều tiết CPU hay mạng, nên LCP gần như luôn đạt: số này chỉ bắt trang hỏng nặng. Ghi nhớ cũ nói CLS cộng dồn qua các khổ: không tái hiện trên bản này (24/11/2026, 0,000 ở cả bốn cách chạy) |
| Tiếng Việt | `lang="vi"`; giãn dòng tiêu đề ≥ 1,2; font có bộ ký tự vietnamese | `lang`, `heading-lh`, `font` | cứng / mềm | quy ước (s18). Giãn dòng tiêu đề 1,2 đang cứng: thứ cần chặn là dấu bị cắt, `text-clip` đã đo; hạ xuống mềm hay không **chờ chủ quyết** |
| Mở được không cần máy chủ | Mở dạng `data:` URL (như trình duyệt trong app Claude mở tệp) vẫn còn mọi stylesheet trừ font, token không rỗng; chữ có dấu cùng font với chữ quanh nó; tệp ≤ 400 KB (pane chỉ mở tệp tối đa 512 KiB) | `standalone` (render thêm một lần dạng `data:text/html;charset=utf-8,…`, so với bản http; CDP `CSS.getPlatformFontsForNode` trên chữ có dấu tách riêng) | mềm | quy ước: gặp 10/11/2026, trang báo cáo hướng Giấy hiện toàn chữ Times trong pane mà cổng vẫn đạt; đo 11/11/2026: pane mở tệp 524 288 byte, từ chối 524 289 byte; giới hạn tính theo byte tệp, không theo độ dài URL |
| Cỡ chữ | Không chữ nào < 12px, tính theo cỡ đã co: chữ SVG (viewBox) và chữ trong khối `transform: scale()`, `scale`, `zoom` | `text-min`, Impeccable `tiny-text` | cứng | quy ước (Impeccable) |
| Thân chữ | ≥ 16px; giãn dòng ≥ 1,5 | `body-size`, `body-lh` | mềm | quy ước. WCAG 1.4.12 không bắt đặt 1,5 mà bắt chữ không mất khi người đọc ép 1,5 (c47): đó là dòng "Giãn chữ" |
| Độ dài dòng | ≤ 75–80 ký tự. Đặt `--measure: 32em`, **không dùng `ch`** | `measure`, Impeccable `line-length` | mềm | quy ước, suy từ Baymard 50–75 ký tự (s17): số đo trên tiếng Anh, chưa có nguồn cho tiếng Việt |
| Chữ không bị cắt | Không chữ nào bị giấu trong hộp của nó: dấu ba chấm hay `-webkit-line-clamp` đang giấu chữ, `overflow: hidden`/`clip` cắt ngang chữ hay cắt mất dòng, mực chữ (dấu chồng "Ổ", dấu nặng "ị", chân "g") vượt ra ngoài hộp khi line-height chặt. Không tính: chữ nằm hẳn ngoài hộp (ngăn kéo đóng, `text-indent` âm, slide khác), sr-only và `clip-path`, phần tử absolute/fixed thoát hộp cắt nằm dưới khối chứa của nó, chữ tới được bằng cách cuộn (đã qua một hộp `auto`/`scroll` ở trục đó). Phần tử có `title` hay `aria-label` chứa đủ chữ **vẫn bị báo**: tooltip không tới được người dùng cảm ứng hay bàn phím, cắt có chủ ý thì ghi lý do (cổng mềm); cổng chạy trên 105 trang khối mẫu không gặp ca nào như vậy | `text-clip` (đi từ nút chữ lên hộp cắt theo cây phẳng, xuyên shadow root và slot; mực chữ đo bằng canvas `actualBoundingBox`; báo chữ còn hiện và khổ bị cắt) | mềm | quy ước: lan-topo-card v0.8.3 cắt dòng phụ còn "5 phía s…" ở 1280, mọi phép đo khác đạt, chỉ ảnh chụp thấy (10/11/2026) |
| Chữ không bị che | Không dòng chữ nào bị phần tử khác vẽ đè: chữ tràn khỏi hộp của nó (ô lưới hẹp, từ dài không ngắt được) và hộp bên cạnh có nền nằm trên. Không tính: lớp phủ có chủ ý (chữ hay vật che trong phần tử fixed/sticky/absolute, dialog, popover), vật che không vẽ gì (liên kết phủ trong suốt), điểm nằm ngoài hộp cắt (việc của `text-clip`), chữ `pointer-events: none` | `text-covered` (9 điểm mỗi dòng chữ, `elementFromPoint` của chính cây chứa chữ nên đi được vào shadow root; cuộn từng nửa màn rồi trả về chỗ cũ) | mềm | quy ước; WCAG 1.4.10 coi chữ không còn xem được là mất thông tin (c41); taste-skill có phép đo tương tự `collide` (c42). Khối hero của kit hiện "Camer", "23/2" ở 320–360px mà cổng vẫn đạt (09–15/11/2026); thử trên 51 trang: 2 lỗi thật, 0 báo nhầm |
| Chữ không mang dấu "AI viết, chưa ai đọc" | Thế hệ 1: không cụm sáo, câu mở đầu rập khuôn, cặn hội thoại ("Chắc chắn rồi!"), chỗ trống (`[Tên công ty]`, `{{...}}`, lorem ipsum, TODO, cả trong `alt`/`aria-label`/`title`/tiêu đề tab), dấu markdown hiện thành chữ; từ sáo đơn lẻ chỉ báo khi một trang có từ 3 từ khác nhau. Thế hệ 2: không dải 3–4 con số ngắn trong hoặc ngay dưới hero có nút hành động (trừ bảng, `<figure>`, nút lọc), không tiêu đề 2–3 mảnh cụt ≤ 4 chữ ("Nhanh. Gọn."), không nút/liên kết chỉ ghi "Xem thêm"/"Learn more" ("Tiếp" thuộc `guide`). Bỏ qua `code`/`pre`/`kbd`, chữ ẩn, vùng `data-copy-ok` | `copy` (danh sách ở `data/copy-tells.json`; khối chữ = tổ tiên gần nhất không inline, xuyên shadow root) | mềm | quy ước: khung hai thế hệ mượn ý taste-skill 2.5.1 `references/copy-tells.md` (MIT); từ tiếng Việt theo skill viet-tu-nhien (báo cáo round98, 12/11/2026) |
| Dữ kiện tự điền được chủ duyệt | Giờ, giá, số điện thoại, số liệu, lời khách mà agent tự điền mang `data-assumed="<lý do>"`; cổng liệt kê ở mục `assumed`, chủ duyệt rồi gỡ thuộc tính | mục `assumed` của `design-kit check` (không phải phát hiện) | người | quy ước: viet-tu-nhien mục 0 "không bịa số liệu cho chủ" |
| Dấu hiệu UI do AI làm | 0 luật "slop" của Impeccable, trừ `cream-palette` (mềm: thuộc khẩu vị, chủ chấm A/B chọn bản nền kem) | `impeccable` | cứng | nghiên cứu (s4); A/B 09/11/2026. Danh sách luật đổi theo phiên bản engine: mỗi lần nâng engine, luật slop mới vào mềm trước (`IMP_SOFT_SLOP` trong `check.ts`), lên cứng khi chủ duyệt |
| Màu hợp thương hiệu | Sắc nhấn theo lĩnh vực hoặc thương hiệu, không mặc định theo loại màn hình | `scripts/doi-mau.mjs` + ảnh chụp | người | A/B đợt 2: thua ở đề tiệm bánh vì màu xanh ngọc lạnh |
| Quy trình có dẫn đường | Có bản đồ tác vụ. Tác vụ trên 3 bước có trình tự từng bước, ghi tên bước kế tiếp. Lần đầu dùng có danh sách "Bắt đầu". Chỗ dễ lúng túng có mẹo đúng lúc. Không có tour mở đầu bắt buộc | ảnh chụp các trạng thái `?lan-dau=1`, `?buoc=N` và trạng thái trong `<trang>.steps.json` | người | nghiên cứu: NN/g (s25–s27), Gee (s28) |
| Dẫn đường đo được | Nút đi tiếp không chỉ ghi "Tiếp"/"Next" (phân trang trong `<nav>` thì được). Câu báo rỗng ("Không có … nào", "No results") có nút hoặc liên kết gỡ ngay cạnh. Không có thư viện tour (intro.js, Shepherd, driver.js…) hay hộp "Chào mừng" mở sẵn khi vào trang | `guide` | mềm | nghiên cứu: NN/g (s25–s27); quy ước design-kit |
| Trạng thái sau tương tác | Mỗi trạng thái người dùng tới bằng thao tác (lỗi form, bước 3, menu mở, sắp xếp, không có kết quả) đạt mọi tiêu chí trên. Thao tác nào không làm được ở một khổ là lỗi | `<trang>.steps.json` hoặc `--steps`: mỗi trạng thái một dòng phán quyết; `steps` khi bấm hỏng | cứng khi có tệp steps; trang có form mà không có tệp steps vẫn qua cổng với 0 trạng thái: báo cáo phải nói rõ | quy ước design-kit; A/B: agent kiểm theo trạng thái tìm thêm lỗi |
| Form dài một màn | Không quá 12 ô nhập đang hiện cùng lúc (ô trong `<details>` đóng hay bước chưa tới không tính). Nếu nhiều hơn, chia bước hoặc ẩn bớt phần nâng cao | `long-form` | mềm | nghiên cứu: NN/g (s25, s27) |
| Ô gõ chữ ở điện thoại | Ô nhập chữ, ô chọn, vùng nhập có chữ ≥ 16px ở khổ điện thoại, để iOS không phóng to cả trang khi chạm vào. Ô `disabled` không tính (không nhận focus); ô `readonly` vẫn tính (chạm vào vẫn nhận focus). Quy tắc ở `src/zoom.ts` | `input-zoom` (khổ ≤ 480; cỡ chữ đã hiển thị) | mềm | mã nguồn WebKit: tỉ lệ phóng = 16 / cỡ chữ (c43). Quy tắc bỏ qua khi đổi dưới 10% (ô 15px không còn bị phóng) chỉ có trên nhánh main từ 13/11/2026, chưa lên bản iOS nào (c78), nên ngưỡng vẫn là 16px. 3/12 trang A/B dính (14/11/2026) |
| Màn nhìn nhanh | Dashboard: số liệu hôm nay và việc cần làm ngay nằm ở màn đầu 1280px, không nằm dưới bảng dài | ảnh chụp 1280px | người | A/B đợt 2 |
| Phân cấp, cá tính | Trả lời có/không trên ảnh 390 và 1280: (1) nhìn 5 giây, thứ thấy đầu tiên có phải việc chính; (2) có đúng một nút chính; (3) che tiêu đề, còn biết đây là màn gì; (4) hai thứ khác loại có trông khác nhau; (5) có chỗ nào phải đọc hai lần; (6) ảnh thang xám còn phân cấp. Khớp DESIGN.md | ảnh chụp × sáng/tối, thêm một ảnh thang xám | người | nghiên cứu: LLM tự chấm chưa bằng người (s20, s21, c26, c59); sáu câu là quy ước (24/11/2026), thay cho "phân cấp và khẩu vị" không có câu hỏi |
| Ma trận khổ theo thiết bị | `--profile devices`: 320×568, 390×844, 768×1024, 1280×720, 1920×1080 (điểm ảnh CSS) kèm `--sweep`; mặc định 320/390/1280 không đổi. Chạy trước khi nói "chạy trên mọi máy" | `--profile`, `--viewports RxC` | như từng phép đo | chuẩn nền tảng: mốc 600, 840, 1200, 1600 dp và lớp cao < 480 dp của Android (N50); nghiên cứu: c40. Khối mẫu: 105 trang đạt, chậm hơn mặc định 1,3 lần (24/11/2026) |
| Phần dính | Thanh dính (fixed, sticky đang dính, rộng ≥ 60% màn) chiếm ≤ 30% chiều cao khung nhìn, ≤ 40% khi khung thấp dưới 480 px | `sticky` (cuộn một khung rồi đo, gộp phần chồng nhau; bỏ phần tử cao từ 70% màn như vỏ app và lớp nền, lớp phủ, vùng thông báo, nền trang trí; chỉ trạng thái đầu) | mềm | chuẩn nền tảng: Android xếp cao < 480 dp là compact (N50); số 30% và 40% là quy ước |
| Không khoá hướng màn | Manifest không đặt `orientation` portrait hay landscape | `orientation` | mềm | chuẩn: WCAG 1.3.4 AA (N02) |
| Không chặn phóng to | Không `user-scalable=no`, không `maximum-scale` nhỏ | axe `meta-viewport` (axe xếp mức vừa, nên mềm) | mềm | chuẩn: WCAG 1.4.4 AA (N01), MDN (N61) |
| Chữ theo cỡ người đọc chọn | Đặt cỡ chữ trình duyệt 200%: thân chữ to lên từ 1,5 lần; không chữ nào mới bị cắt, bị che; trang không tràn ngang | `text-zoom` (CDP `Page.setFontSizes` 32 px ở khổ rộng nhất, đợi hiệu ứng; `data-zoom-ok` cho nhãn cố ý) | mềm | chuẩn: phần mất chữ và tràn là WCAG 1.4.4 AA (N01). Phần "chữ px không to lên" là quy ước theo Apple HIG (N40): 1.4.4 cho đạt bằng phóng cả trang |
| Giãn chữ | Ép giãn dòng 1,5, cách đoạn 2 em, giãn chữ 0,12 em, giãn từ 0,16 em: không chữ nào mới bị cắt hay bị che | `text-spacing` (khổ rộng nhất và khổ hẹp có đo focus; tiêm vào cả open shadow root) | mềm | chuẩn: WCAG 1.4.12 AA (c47) |
| Đơn vị cỡ chữ | `font-size` có đơn vị khung nhìn thì phải có phần rem, em hay % | `font-unit` (đọc luật CSS cùng nguồn, lần theo biến) | mềm | chuẩn: WCAG F94 (N38) |
| Chữ dựng sẵn (NFC) | Không chữ Latinh nào gõ kiểu chữ cái + dấu rời, kể cả `alt`, `aria-label`, `title`, `placeholder` | `nfc` | mềm | W3C i18n khuyên NFC (N118): không phải chuẩn bắt buộc, quan trọng là nhất quán |
| Ngôn ngữ từng phần | Chữ Hán nằm trong `lang` zh, ja, ko…; câu tiếng Anh trong trang `lang="vi"` có `lang="en"` | `lang-part` (chữ Hán theo Unicode; tiếng Anh nhận theo hư từ, từ 4 từ; `data-lang-ok` cho chữ cố ý) | mềm | chuẩn: WCAG 3.1.2 AA (N23) |
| Không tự phát tiếng | Trước cú chạm hay phím đầu tiên: không `play()` có tiếng, không `autoplay` thiếu `muted`, không Web Audio `start()`, không đọc máy | `autoplay` (đo ý định: trình duyệt của cổng chặn tự phát nên đọc `paused` thì trang sai cũng đạt; mọi khung con) | mềm | chuẩn: WCAG 1.4.2 A (N12); MDN (N66); Chrome (N88). axe `no-autoplay-audio` đã đo phần thẻ audio, video |
| Xin quyền đúng lúc | Trước cú chạm đầu tiên: không xin micro, camera, thông báo, vị trí | `permission` (bọc `getUserMedia`, `Notification.requestPermission`, `pushManager.subscribe`, `geolocation`) | mềm | chuẩn nền tảng: Apple HIG (N44); MDN (N67) |

## Quy tắc có nguồn, cổng chưa đo (24/11/2026)

Nguồn đã đối chiếu câu trích, nhưng chưa phép đo nào chạy. Cổng vì thế là **người**: agent tự kiểm theo cột "Đo bằng" rồi
ghi kết quả vào báo cáo; không có phát hiện không có nghĩa là đạt. Con số không kèm nguồn trong cột cuối là quy ước. Mã ở
đầu (BC-…, TT-…) là mã trong bộ quy tắc mở rộng của kho tri thức. Chỉ áp nhóm nào dự án có (âm thanh, PWA, trẻ em…).

| Tiêu chí | Ngưỡng | Đo bằng | Cổng | Loại, nguồn |
| --- | --- | --- | --- | --- |
| BC-06 Khung cao bằng màn | Trên điện thoại không `100vh` cho khối gần bằng màn; dùng `100dvh` hoặc `100svh` | đọc CSS | người | chuẩn: MDN (N62) |
| BC-07 Thanh cuộn | Trang từ ngắn sang dài không làm bố cục nhảy ngang | hai trạng thái steps | người | chuẩn: MDN `scrollbar-gutter` (N81) |
| BC-08 Thứ tự mã = thứ tự nhìn | Tab hết trang không nhảy ngược | Tab tay | người | chuẩn: WCAG 1.3.2 (N30), 2.4.3 (N21) |
| CH-05 Đủ chữ Việt mọi độ đậm | "ẮẰẲẴẶ ỡ ự ĐƯỜNG" ở mỗi độ đậm, kiểu nghiêng đang dùng vẽ từ một font | ảnh chụp, CDP font | người | quy ước (c24, c75) |
| CH-06 Chữ hoa tiếng Việt | `uppercase` chỉ cho nhãn ngắn; nhiều dòng thì giãn dòng ≥ 1,3 | đọc CSS | người | quy ước, vì dấu chồng (c75) |
| CH-07 Ngắt dòng | Chữ Việt không `hyphens: auto`, không `break-all` | đọc CSS | người | chuẩn (c76) |
| CH-10 Phiên âm | Dùng `<ruby>` cho pinyin, furigana; thanh điệu bằng dấu, không bằng số | đọc mã, ảnh chụp | người | chuẩn: MDN (N72) |
| MA-01 Khai báo theme | `color-scheme` liệt kê đúng theme trang có | đọc CSS | người | chuẩn: MDN (N65) |
| MA-02 Người dùng chọn theme | Web và PWA: ba nấc Theo máy, Sáng, Tối; áp trước lần vẽ đầu, nhớ theo người. App của chủ có sẵn nhiều bộ màu (khối `chon-mau`) | mở trang khi máy đặt sáng và đặt tối | người | quyết định của chủ (24/11/2026); nghiên cứu: NN/g (N110). Apple HIG khuyên ngược cho app native (N45) |
| MA-04 Tương phản cao | Với `prefers-contrast: more`: chữ ≥ 7:1, không nền trong mờ sau chữ | giả lập, axe `color-contrast-enhanced` | người | chuẩn: MDN (N63); WCAG 1.4.6 AAA (N37) |
| MA-05 Màu ép buộc cả trang | Với `forced-colors: active`: nút, ô, thẻ còn viền; đang chọn còn phân biệt được | giả lập, ảnh chụp | người | chuẩn: MDN (N64), c44 |
| MA-06 Không chỉ dùng màu | Đúng/sai, lỗi, đang chọn có thêm chữ hoặc hình | ảnh thang xám | người | chuẩn: WCAG 1.4.1 A (N08); HIG (N46) |
| MA-08 Thanh trình duyệt | `theme-color` cho từng theme, khớp nền đầu trang | đọc thẻ | người | chuẩn: MDN (N70) |
| MA-09 Ảnh trong theme tối | Không mảng sáng lớn do ảnh hay biểu đồ nền trắng | ảnh chụp tối | người | chuẩn nền tảng: HIG (N45) |
| TB-06 Theo con trỏ, không theo bề rộng | Kiểu hover trong `@media (hover: hover)`; đích lớn theo `(any-pointer: coarse)` | đọc CSS | người | chuẩn: MDN (N68, N69) |
| TB-08 Ảnh nét | Ảnh điểm ≥ 2 lần cỡ hiển thị | `check-image --display` | người | chuẩn công cụ: c110; MDN (N75) |
| TB-10 Bàn phím ảo | Ô đang gõ và nút gửi nằm trong khung nhìn khi bàn phím mở | máy thật, hoặc hạ chiều cao còn 420 | người | chuẩn: MDN (N80) |
| TB-13 Không đoán thiết bị | Không rẽ nhánh theo user-agent hay "bề rộng = loại máy" | đọc mã | người | chuẩn nền tảng: HIG (N42) |
| NT-01 Vùng an toàn | Có `viewport-fit=cover` thì thanh sát mép có `env(safe-area-inset-*)` | đọc CSS, máy thật | người | chuẩn: WebKit (N85), MDN (N60) |
| NT-03 Kéo để tải lại | Đang làm bài, đang thu: `overscroll-behavior-y: contain`, hoặc bài còn sau khi tải lại | steps tải lại | người | chuẩn: MDN (N74) |
| NT-04 Back đóng lớp phủ trước | Mở hộp, bấm Back: hộp đóng, vẫn ở trang | steps | người | chuẩn: MDN `<dialog>` (N77) |
| NT-05 PWA cài được | Manifest có tên, `start_url`, `display`, icon 192 và 512, icon maskable | đọc manifest | người | chuẩn: web.dev (N89); c98–c102 |
| NT-06 Standalone tự đủ điều hướng | Mọi màn có lối về | giả lập `display-mode` | người | chuẩn: web.dev (N93), MDN (N71) |
| NT-07 Dữ liệu không chỉ ở trình duyệt | Dữ liệu người dùng lưu ở máy chủ hoặc xuất ra được | đọc mã | người | nền tảng: Safari xoá sau 7 ngày không dùng (N87) |
| NT-08 Ngoại tuyến có chủ ý | Mất mạng: trang còn, có chữ báo, form giữ chữ; không tin riêng `navigator.onLine` | tắt mạng | người | chuẩn: MDN (N78); web.dev (N94) |
| NT-09, NT-10 App native | iOS: 44 pt, chữ theo Dynamic Type, ≤ 5 tab. Android: 48 dp, bố cục theo lớp bề rộng, 3–5 đích ở thanh dưới, tràn mép từ Android 15 | công cụ của nền tảng, máy thật | người | chuẩn nền tảng (N40, N41, N43, N50, N51, N52, N53) |
| TT-02 Phản hồi theo mốc | 0,1 s thấy đổi; trên 1 s có chỉ báo; trên 10 s có ước lượng và cho huỷ | steps | người | nghiên cứu: NN/g (N100, N106) |
| TT-05 Khung chờ | Khung chờ cho tải cả trang, đúng hình bố cục sau | steps | người | nghiên cứu: NN/g (N105, N100) |
| TT-06 Lỗi biểu mẫu | Ô lỗi có `aria-invalid` và chữ cạnh ô nói cách sửa; chữ đã gõ còn nguyên | trạng thái `loi` | người | chuẩn: WCAG 3.3.1 A (N18), 3.3.3 AA (N17); NN/g (N103) |
| TT-07 Thời điểm báo lỗi | Sửa đúng thì lỗi mất ngay; chưa báo khi mới gõ ký tự đầu | steps | người | nghiên cứu: Baymard (N111) |
| TT-08 Bàn phím ảo đúng loại | `inputmode` đúng; ô gõ đáp án ngoại ngữ tắt tự sửa, tự viết hoa | đọc mã | người | chuẩn: MDN (N76); phần đáp án là quy ước |
| TT-09 Nhãn luôn hiện | Placeholder không thay nhãn | ảnh chụp | người | nghiên cứu: NN/g (N107); WCAG 3.3.2 A (N19) |
| TT-10 Không hỏi lại, không bắt nhớ | Không hỏi lại điều đã nhập; mật khẩu, mã cho dán; có lối không cần nhớ | steps | người | chuẩn: WCAG 3.3.7 A (N07), 3.3.8 AA (N06) |
| TT-11 Hoàn tác thay hỏi lại | Đảo được: làm ngay kèm Hoàn tác. Không đảo được: hộp nêu cái gì mất | steps | người | nghiên cứu: NN/g (N104); WCAG 3.3.4 (N31). Chỗ đặt nút Hoàn tác (toast hay cạnh chỗ đổi) **chờ chủ quyết**: GitLab bỏ khỏi toast (N138), khối `thong-bao` của kit đặt trong toast |
| TT-12 Thông báo tới trình đọc | Chữ mới sau thao tác nằm trong `role="status"`; lỗi `alert`; không cướp focus | steps, đọc DOM | người | chuẩn: WCAG 4.1.3 AA (N11) |
| TT-13 Giới hạn thời gian | Bài tính giờ có chế độ không giờ hoặc giờ ×10 | người | người | chuẩn: WCAG 2.2.1 A (N05) |
| TT-14 Kéo thả, vuốt có lối chạm | Mọi bài kéo thả làm xong được chỉ bằng chạm | steps chỉ `click` | người | chuẩn: WCAG 2.5.7 AA (N03), 2.5.1 A (N09) |
| TT-15 Chạy khi nhả tay | Hành động ở `click`/`pointerup`; giữ để nói huỷ được | đọc mã | người | chuẩn: WCAG 2.5.2 A (N10) |
| TT-16 Nội dung khi rê chuột | Esc đóng, rê vào được, tới được bằng focus và chạm | steps `hover` | người | chuẩn: WCAG 1.4.13 AA (N04); MDN (N68) |
| TT-17 Bàn phím làm được mọi việc | Không gì bấm được mà Tab không tới; hộp thoại giữ và trả focus, Esc đóng | Tab tay | người | chuẩn: WCAG 2.1.1, 2.1.2 A (N33); MDN (N77) |
| TT-18 Phím tắt một ký tự | Tắt được, không chạy khi đang gõ | steps | người | chuẩn: WCAG 2.1.4 A (N22) |
| TT-19 Chọn không đổi ngữ cảnh | Chọn trong danh sách không tự chuyển trang | steps | người | chuẩn: WCAG 3.2.2 A (N20) |
| TC-04 Tên, vai, trạng thái | Sau khi bấm, `aria-selected`, `-pressed`, `-expanded`, `-checked` đổi theo | steps | người | chuẩn: WCAG 4.1.2 A (N36) |
| TC-05 Chữ là chữ | Từ, câu, nút không phải ảnh chứa chữ | ảnh chụp | người | chuẩn: WCAG 1.4.5 AA (N27) |
| TC-06 Không bắt lắc, nghiêng máy | Mọi việc làm được không cần cảm biến | đọc mã | người | chuẩn: WCAG 2.5.4 A (N29) |
| DH-01 Biết đang ở đâu | `aria-current` ở mục hiện tại; mỗi trang `<title>` riêng | đọc mã | người | chuẩn: WCAG 2.4.2 A (N26), 1.4.1 (N08) |
| DH-02 Điều hướng chính nhìn thấy | Điện thoại ≤ 5 mục cấp một có chữ; màn rộng hiện sẵn | ảnh chụp | người | nghiên cứu: NN/g (N108); nền tảng (N52, N43) |
| DH-03 Icon có nhãn chữ | Nút chỉ có icon chỉ cho việc ai cũng biết (đóng, tìm, phát…) | ảnh chụp | người | nghiên cứu: NN/g (N109) |
| DH-05 Vị trí nhất quán | Điều hướng và trợ giúp cùng chỗ, cùng thứ tự mọi màn | ảnh chụp | người | chuẩn: WCAG 3.2.3 AA (N24), 3.2.6 A (N14) |
| DH-06 Bỏ qua khối lặp | Tab đầu tiên là liên kết tới nội dung chính | Tab một lần | người | chuẩn: WCAG 2.4.1 A (N25) |
| ND-02 Lỗi nói cách sửa | Không trơ trọi "Đã có lỗi xảy ra" | đọc chữ | người | nghiên cứu: NN/g (N103) |
| ND-03 Nút xác nhận mang động từ | Không "OK", "Có", "Không" | đọc chữ | người | nghiên cứu: NN/g (N104) |
| ND-08 Chỉ dẫn không dựa vị trí, màu | Gọi tên nút, không "nút xanh bên phải" | đọc chữ | người | chuẩn: WCAG 1.3.3 A (N28) |
| AT-02 Mở tiếng trong cử chỉ | Bấm nghe là kêu, kể cả Safari; bị chặn thì hiện "Bấm để nghe" | steps, iPhone thật | người | nền tảng: WebKit (N86), MDN (N84) |
| AT-04 Phụ đề chữ sáng theo tiếng | Bài nghe có phụ đề chạy theo tiếng; tiếng gốc và phụ đề là hai công tắc độc lập cạnh trình phát (chỉ gốc, chỉ phụ đề, cả hai), phiên âm bật riêng; chạm một dòng để nghe lại; nhớ theo người; chữ đang đọc khác không chỉ bằng màu | steps phát 2 s, người nghe | người | quy tắc của chủ (23–24/11/2026); chuẩn: WCAG 1.2.2 A (N15), 1.4.1 (N08) |
| AT-05 Video | Điều khiển dùng được bằng bàn phím; có lời thì có phụ đề | đọc mã | người | chuẩn: WCAG 1.2.2 (N15); WebKit (N86) |
| AT-07 Micro bị từ chối | Mỗi trường hợp (từ chối, không có, không HTTPS) nói cách gỡ, bài vẫn làm được | context không cấp quyền | người | chuẩn: MDN (N67) |
| AT-09 Nghe lại trước khi nộp | Bản thu nghe lại, thu lại, xoá được | steps | người | quy ước; tinh thần WCAG 3.3.4 (N31) |
| AT-11 Âm hiệu ứng tắt được | Công tắc riêng, nhớ theo người | steps | người | nền tảng: HIG (N47) |
| AT-12 Giữ màn sáng khi nghe dài | Wake Lock khi đang phát | đọc mã, máy thật | người | chuẩn: MDN (N79) |
| AT-13 Không chớp | Không chớp, hoặc dưới ngưỡng | xem | người | chuẩn: WCAG 2.3.1 A (N13) |
| TE-01 Đích chạm cho trẻ 8–12 | ≥ 52 px (khoảng 1 cm trên máy tính bảng 10 inch): `--touch 52` | `touch` | người | quy ước suy từ NN/g 1 cm cho người lớn (N101). Không có mức riêng cho trẻ 6 tuổi (chủ bỏ 24/11/2026) |
| TE-02 Chỉ chạm và vuốt đơn | Không bài nào CHỈ làm được bằng kéo thả, chạm đúp, giữ lâu, chụm | steps chỉ `click` | người | nghiên cứu: NN/g (N130, N131) |
| TE-03 Không cần đọc | Chỉ dẫn có nút nghe và hình, tắt tiếng vẫn hiểu | tắt tiếng, che chữ | người | nghiên cứu: NN/g (N132, N133) |
| TE-06 Sai không bị phạt | Gợi ý, thử lại, hiện đáp án đúng; không dấu X to, không âm chê | ảnh trạng thái `sai` | người | nghiên cứu: một thí nghiệm ở trẻ khoảng 7,6 tuổi (N135); tổng quan 44 bài thấy lẫn lộn (N134) |
| TE-08, TE-09 Cổng phụ huynh, bên thứ ba | Hồ sơ trẻ: không liên kết ra ngoài, không yêu cầu tới miền khác; cài đặt sau cổng phụ huynh | nhật ký mạng | người | chuẩn nền tảng: Apple (N48, N136) |
| TD-02 Phản hồi khi bấm | INP ≤ 200 ms | đo thực địa | người | chuẩn: web.dev (N90); c73 |
| TD-03 Giữ chỗ ảnh, video | Có `width`, `height` hoặc `aspect-ratio` | đọc mã | người | chuẩn: web.dev (N91) |
| TD-05 Font không làm nhảy chữ | woff2 tự host, `font-display`, dự phòng chỉnh số đo | đọc CSS | người | chuẩn: web.dev (N92) |
| TD-07 Hoạt ảnh rẻ | Chỉ đổi `transform`, `opacity`; không `transition: all` | đọc CSS | người | quy ước (c68) |
| TD-09 Back tức thì | Không nghe `unload`, hạn chế `no-store` | đọc mã | người | web.dev (N95) |
| RT-03 HTTPS | Micro, service worker cần ngữ cảnh an toàn | nhật ký mạng | người | chuẩn: MDN (N67) |
| RT-06 Đăng nhập | Ô mật khẩu cho dán, không chặn trình quản lý mật khẩu | steps | người | chuẩn: WCAG 3.3.8 AA (N06) |
| QT-06 Tám câu kiểm tay | Chỉ bàn phím; trình đọc; phóng 200%; xoay ngang; tắt tiếng; lỗi form đọc lên; thứ tự đọc; không gì chỉ hiện khi rê chuột | người, 15 phút mỗi luồng | người | chuẩn: WCAG 2.2 AA; axe chỉ thấy khoảng 57% (c46) |

**Không nhập** từ bộ 149 quy tắc mở rộng, vì chỉ là quy ước chưa có nguồn hoặc nguồn còn viết từ trí nhớ: BC-02, BC-04, BC-09,
BC-10, CH-09, CH-11, CH-12, MA-07, MA-10, MA-11, MA-13, TB-07, TB-09, TB-11, TB-12, NT-11, NT-12, TT-03, TT-20, DH-04, DH-07 đến
DH-11, ND-01, ND-04 đến ND-07, AT-03, AT-08, AT-10, TE-04, TE-05, TE-07, TE-10 đến TE-12, TD-04, TD-06, TD-08, TD-10, RT-02, RT-04,
RT-05, RT-07 đến RT-09, QT-01 đến QT-04, QT-07 đến QT-10. Chờ chủ quyết: NT-02 (engine WebKit trong cổng). Đã nằm trong dòng
khác: BC-01, BC-03, BC-05, CH-01 đến CH-04, CH-08, MA-03, MA-12, TB-01 đến TB-05, TT-01, TT-04, AT-01, AT-06, RT-01, TC-01 đến
TC-03, TD-01, QT-05.

**Đừng biến thành luật** (hay bị gọi nhầm là chuẩn): "mọi thứ trong 3 cú nhấp" (không có số liệu đỡ, N120); "44 px hay 48 px là
AA" (AA là 24, c1); "giãn dòng 1,5 là AA" (AA đòi chịu được khi người đọc ép, c47); "768 là máy tính bảng, 1024 là desktop"
(bề rộng không cho biết loại máy, N42); "theme tối tốt cho mắt hơn" (người thị lực thường đọc tốt hơn ở nền sáng, N110);
"khung chờ ở mọi nơi" (dành cho tải cả trang, N105); "APCA thay WCAG 2" (chưa là chuẩn).

## Hình: logo, icon, minh hoạ (`design-kit check-image`, 18/11/2026)

Mỗi tiêu chí cho một điểm 0–100; điểm chung là trung bình có trọng số theo loại hình (logo, icon, minh hoạ; ký hiệu
và biểu tượng tính là icon). Phát hiện cứng giữ điểm không quá 49. Nguồn đợt 3: s74–s116, c79–c129. Các mốc "Lucide"
là hiệu chỉnh của chính design-kit trên 272 icon Lucide 0.550 (nét 2 px ở 24): bộ icon chuẩn được 100 điểm trung bình
khi chạy thật trên 134 icon, độ đồng bộ 99.

| Tiêu chí | Ngưỡng | Đo bằng | Cổng | Loại, nguồn |
| --- | --- | --- | --- | --- |
| Tách hình khỏi nền | Nền trong suốt: alpha. Ô gạch (phủ ≥ 90% khung, đặc ≥ 75% hộp; icon ứng dụng, favicon, icon thương hiệu Home Assistant): khớp mặt phẳng màu trên dải vòng trong cách mép 8%, sai số trung bình < 0,03 OKLab, hình là phần lệch > 0,04–0,12. Nền đặc: màu viền. Còn lại: ảnh tràn viền, không đo hình | `inkOf` | — | quy ước: 12 icon thương hiệu thật bị báo "chạm mép" và bản một màu thành ô đen trước khi có chế độ này (18/11/2026) |
| Không chấm bằng mô hình nhìn ảnh | Điểm chỉ từ số đo; ý nghĩa, độ dễ nhận ra, độ hợp thương hiệu do người xem trên tờ soát | tờ soát `.design-kit/shots/images/` | người | nghiên cứu: VLM chấm perfect hình hỏng (c59–c61) |
| Chi tiết khi thu nhỏ (`small`) | Phần đường viền (viền ngoài và ranh giới màu bên trong) thuộc nét, chấm, khe mảnh hơn 1 px. Icon: cứng nếu ≥ 50% ở cỡ gốc, mềm nếu ≥ 5% ở cỡ gốc hoặc ≥ 15% ở 16 px. Logo: mềm nếu ≥ 10% khi cao (hay ngang) 32 px; 16 px chỉ ghi chú (favicon nên có bản giản lược). Mũi nhọn không tính | mở hình bằng đĩa rộng 1 px hiển thị trên ảnh tham chiếu cạnh ngắn 512 px (biến đổi khoảng cách Euclid); mảnh mỏng hơn 2 điểm tham chiếu bỏ qua; mảnh có diện tích / (cạnh nối)² < 2 là mũi nhọn | cứng / mềm | chuẩn: Material nét 2 dp, tránh nét mảnh (c90); Fluent giảm chi tiết dưới 48 px (c94); NHS logo tối thiểu 30 px (c106). Quy ước: Lucide 99% dưới 1% ở 24 và 16 px, nét 0,5 px mất 100% |
| Tương phản trên nền (`contrast`) | Dải viền ngoài của hình (3 điểm tham chiếu) đạt 3:1 trên nền sáng `#ffffff` và nền tối `#121212`; điểm 0 ở 1,5:1, đủ ở 3:1. Icon gần như vô hình là cứng; logo thì mềm (được miễn WCAG). Icon `currentColor` theo màu chữ nên đạt sẵn | `contrastOn`; ảnh điểm nhỏ bị phóng thì dải viền bắt đầu sau nửa dải pha màu ở mép (rộng chừng số điểm tham chiếu ứng với một điểm gốc) | cứng (icon) / mềm (logo) | chuẩn: WCAG 1.4.11, icon một màu là đối tượng đồ hoạ (c103); logo được miễn (c104, c105). Quy ước: icon PNG 64 px đỏ trên trắng, tỉ số thật 6:1, từng bị đo 1,66:1 (18/11/2026) |
| Thang xám (`mono`) | Các cặp màu chạm nhau còn tách được chỉ bằng độ sáng: điểm 0 ở 1,5:1, đủ ở 3:1, cân theo độ dài ranh giới; mềm khi điểm < 50 hoặc một cặp chính dưới 1,25:1 | bảng màu phẳng + đi ngang/dọc qua dải màu pha | mềm | nghiên cứu: logo không được dựa vào màu, phải còn rõ khi đen trắng (c107); WCAG 1.4.1 |
| Bảng màu (`palette`, `color`) | Logo: 1–3 màu đủ điểm, trên 4 màu hay trên 30% chuyển sắc là mềm. Icon giao diện: một màu, `currentColor`; tô cứng một màu là mềm (không theo màu chữ, chế độ tối). Icon ứng dụng có nền riêng giữ màu thương hiệu | màu phẳng gom trong OKLab (cách nhau < 0,06), chuyển sắc nhận ra khi độ khác ở 8 điểm > 3 lần ở 1 điểm | mềm | chuẩn: Fluent, Carbon một màu (c94, c96). Số màu của logo: quy ước, không có chuẩn |
| Lưới điểm (`pixel`) | Ở cỡ gốc của icon, cạnh ngang/dọc không nằm giữa hai điểm ảnh; mềm khi > 30% cạnh thẳng nhoè | đoạn ≥ 3 điểm cùng độ phủ 20–80% giữa rỗng và đầy | mềm | chuẩn: Carbon toạ độ nguyên điểm ảnh (c95) |
| Khung icon (`frame`) | Lề ≥ 2% (không chạm mép), hình đầy ≥ 50% khung, lệch tâm ≤ 1,5 px ở 24, khung vuông. Icon maskable: ≤ 1% hình ra ngoài vòng tròn bán kính 40% | hộp bao mực; vòng an toàn với tệp tên có `maskable` | mềm | chuẩn: Material vùng sống 20/24, đệm 2 dp (c89); W3C maskable (c98, c99) |
| Độ đơn giản icon (`simplicity`) | Độ phức tạp chu vi (chu vi² / diện tích, không chia 4π) ≤ 230 đủ điểm, 0 ở 600; mềm khi > 400 | marching squares ở mức phủ 0,5, cộng ranh giới màu bên trong | mềm | nghiên cứu: Pelli 2006, hiệu suất nhận dạng tỉ lệ nghịch (c126), mốc Helvetica 67, chữ Hán 199, Künstler 451 (c83); icon phức tạp không hơn hình chữ nhật trơn (c88), tác động kéo dài (c129). Quy ước: Lucide trung vị 158 |
| Độ phức tạp logo | Không chấm, chỉ ghi | như trên | người | nghiên cứu: "vừa phải" nhưng không có con số (c79, c80); đơn giản thắng ngắn hạn, phức tạp thắng dài hạn (c81) |
| Cân bằng, đối xứng, độ rực màu | Chỉ ghi chú | DCM, gương trái phải, M của Hasler & Süsstrunk | người | nghiên cứu: DCM dự đoán độ cân, không dự đoán độ thích (c87); độ rực không tương quan với độ đẹp (c108, c109) |
| Độ sắc minh hoạ (`sharpness`) | Bề rộng các cạnh mạnh nhất ≤ 2,5 px đủ điểm, 0 ở 6 px; mềm khi > 3 px | Marziliano 2002, theo hàng và cột, ảnh lớn lấy vùng giữa 1024 px ở cỡ thật | mềm | quy ước, hiệu chỉnh 18/11/2026: cùng cảnh xuất thẳng 2,0 px, phóng ×1,5 5,6, ×2 5,8, ×3 10,4, ×4 12,3. Phương sai Laplacian không có ngưỡng tuyệt đối (c113) |
| Độ phân giải (`resolution`) | Với `--display`: ảnh điểm ≥ 2× cỡ hiển thị tới 64 px, ≥ 1,5× trên đó; nhỏ hơn cỡ hiển thị là cứng | cỡ thật so với `--display` | cứng / mềm | chuẩn công cụ: Lighthouse (c110) |
| Định dạng, dung lượng (`vector`, `format`, `weight`) | Logo, icon nên là SVG; hình phẳng không lưu JPEG; ảnh kiểu chụp không lưu PNG nặng; ảnh điểm ≤ 500 KB và ≤ 1 byte mỗi điểm khi trên 100 KB; SVG icon ≤ 5 KB, logo ≤ 50 KB | kích thước tệp, bảng màu | mềm | chuẩn công cụ: Chrome DevTools nhắm ~1/6 byte mỗi điểm (c111); ngân sách là quy ước |
| Vệ sinh SVG (`svg-*`) | Không `<script>`, thuộc tính `on*`, liên kết `javascript:` (cứng); có viewBox; không `<text>` sống, không ảnh điểm nhúng, không tham chiếu ra tệp khác, không `preserveAspectRatio="none"` (mềm) | `DOMParser` trong trình duyệt | cứng / mềm | chuẩn: viewBox để co giãn (c114); SVG làm ảnh không nạp tài nguyên ngoài, chữ rơi về font dự phòng (c115); SVG chứa script gây XSS (c119) |
| Bộ icon (`set`) | Trong một thư mục từ 3 icon: nét lệch trung vị quá 25% (tối thiểu 0,3 px ở 24), độ đậm ngoài 0,4–2 lần trung vị, độ đầy khung lệch quá 0,2, lưới khác bộ | độ dày theo diện tích (4 × khoảng cách trung bình tới mép), độ phủ, hộp bao | mềm | chuẩn: Apple nét đều giữa các icon (c92), Material nét 2 dp (c90). Quy ước: Lucide độ đậm 0,46–1,37 lần trung vị ở phân vị 5–95 |

## Đã đo được trong lúc xây (09/11/2026)

- **`ch` đo sai với chữ Việt.** Trong Be Vietnam Pro, `max-width: 68ch` chứa khoảng 93 ký tự mỗi dòng: chữ Việt trung bình hẹp hơn chữ số "0" khoảng 37%. Vì vậy token dùng `32em`.
- **Impeccable không nhìn vào shadow DOM.** Engine 0.1.19, quét qua URL, bỏ sót chữ 9,9px và tương phản 1,55:1 nằm trong một open shadow root. Probe của design-kit và axe-core đều bắt được. Chi tiết ở `test/fixtures/loi.html`.
- **Chữ SVG co theo viewBox.** Khai báo 13px trong viewBox rộng 900, khi hiển thị ở khổ 390px chỉ còn khoảng 5px.
- **Chữ HTML co theo `transform: scale()`** (10/11/2026). Sơ đồ của lan-topo-card co để vừa thẻ, mức co thấp nhất mặc định là 0,55. Nhãn 12px vì thế hiện ra chỉ còn 6,6px, vậy mà `text-min` vẫn báo đạt, vì font-size tính toán không đổi. `scale` và `zoom` cũng vậy. Probe giờ nhân hệ số co của mọi tổ tiên vào cỡ chữ (`test/fixtures/co-gian.html`).
- **Chữ bị cắt mà mọi phép đo vẫn đạt** (10/11/2026). Ở khổ 1280, kiểu cây ngang, dòng phụ của nút CRS310 trong lan-topo-card hiện "6/10 cổng có link · 5 phía s…": chữ đủ cỡ, đủ tương phản, không tràn trang. Lúc dựng fixture lại lộ thêm một ca: `line-height: 1` với `overflow: hidden` cắt mất dấu, "Ổn định" hiện thành "Ön đinh" (mất dấu hỏi và dấu nặng, đổi nghĩa) mà `scrollHeight` không tràn, vì cuộn chỉ tính hộp dòng chứ không tính mực chữ. Phép đo `text-clip` đo cả hai (`test/fixtures/cat-chu.html`).
- **Tái hiện lại lỗi shadow DOM của Impeccable** (skill 4.8.1, engine 0.1.19). Trang chỉ có lỗi trong shadow root: Impeccable báo 0 lỗi và thoát 0. Đặt cùng dòng chữ lỗi vào light DOM thì nó báo đủ (`low-contrast`, `undersized-ui-text`). Bản nháp báo lỗi ở `docs/bao-loi-impeccable-shadow-dom.md`, chưa gửi.
- **Cổng theo trạng thái bắt được lỗi mà lần render đầu bỏ qua.** Ở khổ 320/390, khối `bang-du-lieu` giấu `thead` theo kiểu sr-only. Hệ quả: người dùng điện thoại không sắp xếp được bảng, còn phím Tab rơi vào nút vô hình. Tệp `bang-du-lieu.steps.json` báo "click … failed" ở 320/390, và phép đo focus ở 390 báo focus lạc. Bản React cũng không có cách sắp xếp ở khổ hẹp, và câu báo rỗng không kèm nút gỡ. Đã sửa cả hai bản: ẩn hẳn `thead`, thêm ô "Sắp xếp", thêm trạng thái "không thấy" có nút gỡ lọc.
