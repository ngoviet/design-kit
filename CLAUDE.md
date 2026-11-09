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
- `blocks/react/`: Vite + React + shadcn/ui trên cùng token. Build ra `dist/` rồi mới kiểm.
- `src/`: CLI. Các tệp chính:
  - `commands/check.ts`: cổng.
  - `probe.ts`: đo trong trang, đi xuyên shadow DOM.
  - `browser.ts`: Edge/Chrome qua playwright-core, kèm máy chủ tĩnh.
  - `impeccable.ts`: engine Impeccable.

## Lệnh

- Đổi màu: sửa `tokens/<huong>.css`, rồi chạy `node scripts/kiem-cap-mau.mjs` (126 cặp, mọi cặp phải đạt) và `node scripts/tao-design-md.mjs`. Lint bằng `npx -p @google/design.md designmd lint design/<huong>/DESIGN.md`.
- CLI: `npm run check` (tsc, eslint, vitest; test chạy Edge thật), sau đó `npx tsup`. Lệnh toàn cục đi qua `npm link`.
- Cổng cho mọi khối:
  - `design-kit check blocks/html blocks/react/dist --query dk=dem,dk=giay,dk=dam --strict`
  - Hộp thoại ở trạng thái mở: `design-kit check blocks/html/hop-thoai.html --query "dk=dem&mo=1,dk=giay&mo=1,dk=dam&mo=1"`

## Bẫy đã gặp

- **`ch` đo sai với chữ Việt.** Với Be Vietnam Pro, 68ch chứa khoảng 93 ký tự. Độ dài dòng dùng `em`. Probe đo độ dài dòng theo bề rộng trung bình của chính chữ trong đoạn.
- **`@import url(...)` nằm trong tệp token** bị bundler đẩy xuống giữa tệp và bỏ đi, nên mất font. Vì vậy mới tách ra `fonts.css`.
- **Engine Impeccable 0.1.19 bỏ sót lỗi trong shadow DOM.** Đã tái hiện bằng `test/fixtures/loi.html`. Probe và axe thì bắt được.
- **Chữ SVG co theo viewBox.** Probe tính cỡ chữ đã hiển thị.
- **`palette-axi analyze`** gộp sáng với tối trong cùng tệp và coi nền nhạt của màu trạng thái là trung tính, nên báo nhầm tint/band. Tiêu chí quyết định là `kiem-cap-mau.mjs`.
- **`shadcn add`** đã ghi `import { cn } from "cn"` và cài gói npm lạ `cn`. Sau mỗi lần add: grep, sửa về `@/lib/utils`, rồi `npm uninstall cn`.
- **`npx @google/design.md lint`** không làm gì mà vẫn thoát 0. Phải dùng `npx -p @google/design.md designmd lint`.
- **Playwright Python** có Chromium lệch phiên bản. CLI dùng `channel: msedge`, không tải trình duyệt riêng.
- **Heredoc Git Bash** làm mất `\\`. Tệp có backslash thì viết bằng Write/Edit.

## Quy tắc

- Không ghi công Claude trong commit hay tài liệu.
- Khối mới chỉ được thêm khi đã qua cổng ở cả 3 hướng × sáng/tối, và đã xem ảnh chụp.
