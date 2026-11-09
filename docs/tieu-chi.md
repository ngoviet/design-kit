# Bộ tiêu chí kiểm được

Mỗi ngưỡng có ghi nguồn và loại:

- **chuẩn**: W3C, Google.
- **nghiên cứu**: nghiên cứu có kiểm chứng.
- **quy ước**: ngưỡng của công cụ hoặc của chính design-kit.

Cổng có ba mức:

- **cứng**: trượt thì chưa được báo xong.
- **mềm**: phải sửa, hoặc ghi lý do không sửa.
- **người**: chủ duyệt trên ảnh chụp.

Bằng chứng nằm trong kho tri thức, chủ đề `tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun` (s1–s22). Mọi trích dẫn đã được kiểm lại bằng `research-axi kb verify`.

| Tiêu chí | Ngưỡng | Đo bằng (`design-kit check`) | Cổng | Loại, nguồn |
| --- | --- | --- | --- | --- |
| Tương phản chữ | ≥ 4,5:1, chữ lớn ≥ 3:1, cả theme sáng lẫn tối | axe `color-contrast`, Impeccable `low-contrast` | cứng | chuẩn: WCAG 1.4.3 (s5) |
| Tương phản phi chữ | ≥ 3:1 (viền ô nhập, icon, vòng focus) | `scripts/kiem-cap-mau.mjs` trên token | cứng | chuẩn: WCAG 1.4.11 (s6) |
| APCA | Thân chữ \|Lc\| ≥ 60 | `palette-axi` | mềm | quy ước, chưa thành chuẩn (WCAG 3) |
| Vùng bấm | ≥ 24×24 px; nút chính 44px | axe `target-size` | cứng | chuẩn: WCAG 2.5.8 (s1) |
| Reflow | 320px không cuộn ngang | `overflow` | cứng | chuẩn: WCAG 1.4.10 (s8) |
| Nhãn và tên | Ô nhập có nhãn; tên truy cập chứa chữ đang hiện | axe `label`, `label-content-name-mismatch` | cứng | chuẩn: WCAG 1.3.1, 2.5.3 |
| Autocomplete | `username`, `current-password`, `new-password` đúng chỗ | axe `autocomplete-valid` + khối mẫu | cứng | chuẩn (s14) |
| Vùng cuộn | Vùng `overflow:auto` focus được bằng bàn phím | axe `scrollable-region-focusable` | cứng | chuẩn: WCAG 2.1.1 |
| Giảm chuyển động | Không animation nào còn chạy khi `reduce` | `motion` | cứng | chuẩn: WCAG 2.3.3 (s11, s15) |
| Focus | Thấy được, ≥ 2px, không bị che | `focus` (Tab 15 lần) | mềm | chuẩn: 2.4.11 AA, 2.4.13 AAA (s9, s10) |
| CWV | LCP ≤ 2,5 s, CLS ≤ 0,1 (lab); INP ≤ 200 ms (thực địa) | `lcp`, `cls` | mềm | chuẩn: p75 thực địa (s2) |
| Tiếng Việt | `lang="vi"`; giãn dòng tiêu đề ≥ 1,2; font có bộ ký tự vietnamese | `lang`, `heading-lh`, `font` | cứng / mềm | quy ước (s18) |
| Cỡ chữ | Không chữ nào < 12px, kể cả chữ SVG tính theo cỡ đã co | `text-min`, Impeccable `tiny-text` | cứng | quy ước (Impeccable) |
| Thân chữ | ≥ 16px; giãn dòng ≥ 1,5 | `body-size`, `body-lh` | mềm | quy ước, WCAG 1.4.12 |
| Độ dài dòng | ≤ 75–80 ký tự. Đặt `--measure: 32em`, **không dùng `ch`** | `measure`, Impeccable `line-length` | mềm | nghiên cứu: Baymard 50–75 (s17) |
| Dấu hiệu UI do AI làm | 0 luật "slop" của Impeccable, trừ `cream-palette` (mềm: thuộc khẩu vị, chủ chấm A/B chọn bản nền kem) | `impeccable` | cứng | nghiên cứu (s4); A/B 09/11/2026 |
| Màu hợp thương hiệu | Sắc nhấn theo lĩnh vực hoặc thương hiệu, không mặc định theo loại màn hình | `scripts/doi-mau.mjs` + ảnh chụp | người | A/B đợt 2: thua ở đề tiệm bánh vì màu xanh ngọc lạnh |
| Quy trình có dẫn đường | Có bản đồ tác vụ. Tác vụ trên 3 bước có trình tự từng bước, ghi tên bước kế tiếp. Lần đầu dùng có danh sách "Bắt đầu". Chỗ dễ lúng túng có mẹo đúng lúc. Không có tour mở đầu bắt buộc | ảnh chụp các trạng thái `?lan-dau=1`, `?buoc=N` | người | nghiên cứu: NN/g (s25–s27), Gee (s28) |
| Form dài một màn | Không quá 12 ô nhập hiện cùng lúc. Nếu nhiều hơn, chia bước hoặc ẩn bớt phần nâng cao | `long-form` | mềm | nghiên cứu: NN/g (s25, s27) |
| Màn nhìn nhanh | Dashboard: số liệu hôm nay và việc cần làm ngay nằm ở màn đầu 1280px, không nằm dưới bảng dài | ảnh chụp 1280px | người | A/B đợt 2 |
| Phân cấp, cá tính | Mỗi màn có một điểm nhấn chính, khớp DESIGN.md | ảnh chụp 3 khổ × sáng/tối | người | nghiên cứu: LLM tự chấm chưa bằng người (s20, s21) |

## Đã đo được trong lúc xây (09/11/2026)

- **`ch` đo sai với chữ Việt.** Trong Be Vietnam Pro, `max-width: 68ch` chứa khoảng 93 ký tự mỗi dòng: chữ Việt trung bình hẹp hơn chữ số "0" khoảng 37%. Vì vậy token dùng `32em`.
- **Impeccable không nhìn vào shadow DOM.** Engine 0.1.19, quét qua URL, bỏ sót chữ 9,9px và tương phản 1,55:1 nằm trong một open shadow root. Probe của design-kit và axe-core đều bắt được. Chi tiết ở `test/fixtures/loi.html`.
- **Chữ SVG co theo viewBox.** Khai báo 13px trong viewBox rộng 900, khi hiển thị ở khổ 390px chỉ còn khoảng 5px.
