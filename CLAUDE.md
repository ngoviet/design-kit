# CLAUDE.md: design-kit

Chuẩn và cổng cho giao diện do agent làm.

- Phần chuẩn: token, ba hướng DESIGN.md, khối mẫu.
- Phần cổng: CLI `design-kit check`, TypeScript, chuẩn AXI, khuôn theo `D:\code\imp-axi`.
- Đóng gói:
  - Plugin Claude Code: `.claude-plugin/` (plugin và marketplace), `skills/design-kit/SKILL.md`, `hooks/`.
  - CLI: clone, `npm ci` (prepare build `dist/`), `npm install -g .`. Trường `files` quyết định gói npm gồm những gì (cài từ tarball).
  - Trên PC1 plugin cài từ marketplace thư mục `D:\code\design-kit` (`claude plugin marketplace add D:/code/design-kit`, `claude plugin install design-kit@design-kit`). Claude Code đọc thẳng repo, nên sửa skill hay hook là có hiệu lực ở phiên mới. Không còn junction trong `~/.claude/skills/`, đừng tạo lại, vì skill sẽ bị nạp hai lần.
- Lý do và quyết định: `docs/quyet-dinh.md`. Ngưỡng: `docs/tieu-chi.md`. Nguồn: `docs/nguon.md`, sinh bằng `npm run nguon` từ kho research-hub, không sửa tay.
- CI: `.github/workflows/ci.yml` (GitHub Actions, container Playwright, Linux sạch). Đây cũng là phép thử chạy độc lập. Repo **public** từ 10/11/2026 nên không dùng Woodpecker nữa (đã tắt, đã gỡ `.woodpecker/`); đừng bật lại.
- README theo chuẩn readme-axi (`ngoviet/.github`): `README.md` tiếng Anh, `README.vi.md` tiếng Việt, cùng số mục và thứ tự. Sửa một bản thì sửa bản kia trong cùng commit; `.github/workflows/readme.yml` kiểm khung và độ lệch. Kiểm tại chỗ: tải `readme_axi.py` từ `ngoviet/.github` rồi `python readme_axi.py check .`.
- Phát hành: tăng `version` ở `package.json`, `.claude-plugin/plugin.json`, `src/version.ts`; thêm mục vào `CHANGELOG.md`; `npm pack` ra `design-kit-<ver>.tgz` kèm `.sha256`; tag `v<ver>`; `gh release create` đính hai tệp đó. Đường dẫn tarball trong README phải đổi theo phiên bản.
- Nhật ký các giai đoạn trước khi public: `docs/nhat-ky.md`.

## Cấu trúc

- `tokens/`
  - `fonts.css` (Google Fonts) hoặc `fonts-local.css` + `fonts/` (tự host, sinh bằng `npm run fonts`): nạp font, **luôn nạp đầu tiên**. Khối mẫu và fixture dùng bản tự host.
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
  - `browser.ts`: Edge, rồi Chrome, rồi Chromium của Playwright (đường lùi cho CI). Kèm máy chủ tĩnh.
  - `impeccable.ts`: engine Impeccable. Phiên bản và sha256 được ghim; `design-kit setup` tải engine khi thiếu.
  - `commands/mau.ts`: `doi-mau` và `kiem-mau`. Hai lệnh nạp `scripts/doi-mau-lib.mjs` lúc chạy (không bundle), nên chỉ có một nguồn thuật toán.
  - `commands/setup.ts`: kiểm trình duyệt, tải engine.
- `hooks/nhac-giao-dien.mjs`: hook của plugin, không phụ thuộc gói nào.
  - PostToolUse: nhắc khi có sửa tệp giao diện, tối đa 15 phút một lần.
  - Stop: đọc transcript, chặn đúng một lần nếu sau lần sửa giao diện cuối chưa chạy `design-kit check`.

## Lệnh

- Đổi màu: sửa `tokens/<huong>.css`, rồi chạy `node scripts/kiem-cap-mau.mjs` (126 cặp, mọi cặp phải đạt) và `node scripts/tao-design-md.mjs`. Lint bằng `npm run lint:design`.
- CLI: `npm run check` (tsc, eslint, vitest; test chạy Edge thật), sau đó `npx tsup`. Lệnh toàn cục đi qua `npm link`.
- Plugin: `claude plugin validate .`. Kiểm gói npm: `npm pack --dry-run --json --ignore-scripts`. Thêm thư mục mới mà gói cần thì phải ghi vào `files`.
- Cổng cho mọi khối:
  - `design-kit check blocks/html blocks/react/dist --query dk=dem,dk=giay,dk=dam --strict --jobs 6`: gồm cả trạng thái trong các tệp `.steps.json`, tốn khoảng 10 phút.
  - Trạng thái mở bằng URL: `design-kit check blocks/html/hop-thoai.html blocks/html/thong-bao.html --no-steps --query "dk=dem&mo=1,dk=giay&mo=1,dk=dam&mo=1"`. Làm tương tự với `bat-dau` (`lan-dau=1`) và `trinh-tu` (`buoc=2..5`).

- Đổi màu nhấn theo thương hiệu: `design-kit doi-mau --huong dem --nhan 45 --trung-tinh 60 --ra <tệp>`. Lệnh giữ cấu trúc, chỉ đổi sắc rồi dò lại độ sáng để 42 cặp vẫn đạt. Muốn kiểm riêng một tệp: `design-kit kiem-mau <tệp> --huong <hướng>`. Các script trong `scripts/` vẫn chạy tay được.

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

## Bẫy khi đóng gói (09/11/2026)

- **`npm pack` bỏ những gì `.gitignore` liệt kê**, kể cả `dist/` vừa build ở bước `prepare`. Cài từ git mà không có trường `files` thì gói không có lệnh `design-kit`. Đã thêm `files`.
- **`npm pack` chạy `prepare` (tsup) và in lẫn vào stdout.** Muốn đọc `--json` thì thêm `--ignore-scripts`.
- **npm mới chặn install script mặc định** (cảnh báo `allow-scripts`). Cài từ tarball thì không sao. Cài từ git cần `prepare` để build: nếu bị chặn, thêm `--allow-scripts=design-kit`.
- **Công cụ PowerShell chặn `cmd /c rmdir`**, vì hiểu `/c` là đường dẫn hệ thống. Gỡ junction bằng `(Get-Item $j -Force).Delete()`: lệnh này chỉ gỡ liên kết, không xoá thư mục đích.
- **Không gộp engine Impeccable vào git.** Mỗi bản ~20 MB, và mỗi lần nâng cấp lại đẩy thêm 20 MB vào lịch sử. Ghim phiên bản và sha256 trong `src/impeccable.ts`, tải khi cần. Khi nâng: chép dòng mới từ `engine-checksums.txt` của Impeccable.
- **`npm install -g github:…` (hay `git+file://`) không build được gói có `prepare`**: lệnh `npm install` mà npm chạy bên trong bản clone thừa hưởng chế độ global, nên cài chính bản clone ra thư mục toàn cục thay vì cài devDependencies, và báo `tsup is not recognized`. Cách cài: clone, `npm ci`, `npm install -g .`.
