# CLAUDE.md: design-kit

Chuẩn và cổng cho giao diện do agent làm.

- Phần chuẩn: token, ba hướng DESIGN.md, khối mẫu.
- Phần cổng: CLI `design-kit check`, TypeScript, chuẩn AXI, khuôn theo `D:\code\imp-axi`.
- Skill: `skill/SKILL.md`, cài bằng junction `~/.claude/skills/design-kit`.
- Lý do và quyết định: `docs/quyet-dinh.md`. Ngưỡng và nguồn: `docs/tieu-chi.md`.

## Cấu trúc

- `tokens/`
  - `fonts.css`: nạp font, **luôn nạp đầu tiên**.
  - `core.css`: khoảng cách, thang chữ, chuyển động.
  - `dem.css`, `giay.css`, `dam.css`: màu và font, mỗi hướng gắn với một `[data-dk]`, có sáng và tối.
- `design/<huong>/DESIGN.md`: **sinh** bằng `node scripts/tao-design-md.mjs`, không sửa tay.
- `blocks/html/*.html`: khối HTML/CSS thuần. Chọn hướng bằng `?dk=dem|giay|dam` và `&theme=light|dark`.
  - `<khoi>.steps.json` cạnh khối: các trạng thái sau thao tác (lỗi form, menu mở, sắp xếp…), cổng tự nhận.
- `blocks/react/`: Vite + React + shadcn/ui trên cùng token. Build ra `dist/` rồi mới kiểm. Tệp steps của React nằm trong `public/`, Vite chép sang `dist/`.
- `src/`: CLI. Các tệp chính:
  - `commands/check.ts`: cổng.
  - `commands/home.ts`: màn không đối số, in danh sách nhắc `workflow` (dẫn đường như game).
  - `probe.ts`: đo trong trang, đi xuyên shadow DOM. Có cả phép đo `guide` và focus lạc.
  - `steps.ts`: đọc tệp steps, chạy thao tác trước khi đo.
  - `browser.ts`: Edge/Chrome qua playwright-core, kèm máy chủ tĩnh.
  - `impeccable.ts`: engine Impeccable.

## Lệnh

- Đổi màu: sửa `tokens/<huong>.css`, rồi chạy `node scripts/kiem-cap-mau.mjs` (126 cặp, mọi cặp phải đạt) và `node scripts/tao-design-md.mjs`. Lint bằng `npx -p @google/design.md designmd lint design/<huong>/DESIGN.md`.
- CLI: `npm run check` (tsc, eslint, vitest; test chạy Edge thật), sau đó `npx tsup`. Lệnh toàn cục đi qua `npm link`.
- Cổng cho mọi khối:
  - `design-kit check blocks/html blocks/react/dist --query dk=dem,dk=giay,dk=dam --strict --jobs 6`: gồm cả trạng thái trong các tệp `.steps.json`, tốn khoảng 10 phút.
  - Trạng thái mở bằng URL: `design-kit check blocks/html/hop-thoai.html blocks/html/thong-bao.html --no-steps --query "dk=dem&mo=1,dk=giay&mo=1,dk=dam&mo=1"`. Làm tương tự với `bat-dau` (`lan-dau=1`) và `trinh-tu` (`buoc=2..5`).

- Đổi màu nhấn theo thương hiệu: `node scripts/doi-mau.mjs --huong dem --nhan 45 --trung-tinh 60 --ra <tệp>`. Lệnh giữ cấu trúc, chỉ đổi sắc rồi dò lại độ sáng để 42 cặp vẫn đạt. Muốn kiểm riêng một tệp: `node scripts/kiem-cap-mau.mjs <tệp> <hướng>`.

## Bẫy đã gặp

- **`ch` đo sai với chữ Việt.** Với Be Vietnam Pro, 68ch chứa khoảng 93 ký tự. Độ dài dòng dùng `em`. Probe đo độ dài dòng theo bề rộng trung bình của chính chữ trong đoạn.
- **`@import url(...)` nằm trong tệp token** bị bundler đẩy xuống giữa tệp và bỏ đi, nên mất font. Vì vậy mới tách ra `fonts.css`.
- **Engine Impeccable 0.1.19 bỏ sót lỗi trong shadow DOM.** Đã tái hiện bằng `test/fixtures/loi.html`, và tái hiện lại với skill 4.8.1. Probe và axe thì bắt được. Bản nháp báo lỗi ở `docs/bao-loi-impeccable-shadow-dom.md`, chỉ gửi khi chủ duyệt.
- **Chữ SVG co theo viewBox.** Probe tính cỡ chữ đã hiển thị.
- **`palette-axi analyze`** gộp sáng với tối trong cùng tệp và coi nền nhạt của màu trạng thái là trung tính, nên báo nhầm tint/band. Tiêu chí quyết định là `kiem-cap-mau.mjs`.
- **`shadcn add`** đã ghi `import { cn } from "cn"` và cài gói npm lạ `cn`. Sau mỗi lần add: grep, sửa về `@/lib/utils`, rồi `npm uninstall cn`.
- **`npx @google/design.md lint`** không làm gì mà vẫn thoát 0. Phải dùng `npx -p @google/design.md designmd lint`.
- **Playwright Python** có Chromium lệch phiên bản. CLI dùng `channel: msedge`, không tải trình duyệt riêng.
- **Heredoc Git Bash** làm mất `\\`. Tệp có backslash thì viết bằng Write/Edit.

- **Python trên Windows** mở tệp ở chế độ văn bản (`open(p, "w")`) sẽ ghi CRLF. Frontmatter của SKILL.md có CRLF thì harness không đọc được `description` (gặp 09/11/2026). Phải dùng `open(p, "w", newline="\n")` hoặc ghi ở chế độ nhị phân.
- **`shadcn add`** lần nào cũng cài lại gói `cn` (đã lặp 3 lần). Sau mỗi lần add: grep `from "cn"`, rồi `npm uninstall cn`.
- **Thiếu tệp steps thì `design-kit check` chỉ đo lần render đầu.** Trạng thái tương tác phải mở được bằng URL (`?mo=1`, `?trang-thai=loi`) rồi truyền qua `--query`, hoặc ghi thao tác vào `<trang>.steps.json`.
- **Nút chỉ có ở một khổ** (Menu, ngăn kéo) làm bước bấm hỏng ở khổ khác. Giới hạn trạng thái đó bằng `"viewports":[320,390]`.
- **Phần tử bị giấu kiểu sr-only vẫn nhận Tab.** `bang-du-lieu` từng giấu `thead` như vậy ở khổ hẹp, làm mất cả nút sắp xếp. Đã chuyển sang `display:none` và thêm ô chọn "Sắp xếp". Vì thế cổng giờ kiểm focus ở cả khổ 390.
- **Phép đo focus từng báo nhầm** ở công tắc tuỳ biến (input trong suốt) và ở mẹo đang chạy hiệu ứng mở (opacity 0 đúng lúc đo). Đã sửa: probe nhìn vào phần tử thay thế (span bên cạnh hoặc nhãn), và đợi hiệu ứng xong. Có test chặn báo nhầm trong `test/fixtures/buoc.html`.
- **Máy đo đạt chưa phải là đẹp.** Vòng 09/11 máy báo 0 lỗi, nhưng ảnh chụp vẫn lộ bảng "A → Z" mà không xếp, tiêu đề bị bóp, mẹo lệch chỗ. Luôn mở ảnh chụp các trạng thái vừa sửa.
- **Hook `bash-backslash-guard`** chặn lệnh Bash có `\\`. Sửa tệp bằng Edit/Write.

## Quy tắc

- Không ghi công Claude trong commit hay tài liệu.
- Khối mới chỉ được thêm khi đã qua cổng ở cả 3 hướng × sáng/tối, và đã xem ảnh chụp.
