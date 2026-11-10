# Quyết định

## 09/11/2026: chốt phương án giai đoạn 2

Chủ chọn **phương án C**. Phương án này gồm toàn bộ B, cộng thêm thư viện khối mẫu.

| Câu hỏi | Chủ chọn |
| --- | --- |
| Phương án | C: skill `design-kit`, lệnh kiểm `design-kit check`, thư viện khối mẫu |
| Đặt lệnh kiểm ở đâu | Trong design-kit. `imp-axi` chỉ làm một việc: quét |
| Hướng thẩm mỹ | 2–3 hướng, mỗi hướng một DESIGN.md |
| Khung kỹ thuật của khối mẫu | Cả hai: HTML/CSS thuần làm gốc, có thêm bản React + shadcn/ui |

### Thứ tự làm

1. Token chung, ba hướng thẩm mỹ, mỗi hướng một DESIGN.md. Kiểm bằng `@google/design.md lint`.
2. CLI `design-kit check`, theo chuẩn AXI, làm cổng cứng. Lệnh này gộp:
   - render bằng Playwright, ở các khổ 320/390/1280 px, cả sáng lẫn tối;
   - axe-core với bộ luật WCAG 2.2 AA;
   - chỉ số chữ, có đi vào cả shadow DOM;
   - giảm chuyển động;
   - CLS và LCP;
   - Impeccable;
   - chụp ảnh.
3. Đợt 1 khối mẫu: 6 khối HTML/CSS, trong đó 2 khối có thêm bản React.
4. Chạy cổng trên mọi khối, sửa cho đến khi đạt.
5. Skill `design-kit`. Đề xuất 2 dòng thêm vào `~/.claude/CLAUDE.md`, nhưng chỉ ghi vào khi chủ đồng ý.
6. Đánh giá A/B: làm thử ba trang, mỗi trang hai bản (có skill và không có skill).

## 09/11/2026: thêm quy tắc vào CLAUDE.md toàn cục

Chủ đồng ý. Đã thêm mục "Giao diện: dùng skill design-kit" vào `~/.claude/CLAUDE.md`. Từ nay mọi phiên làm giao diện đều đi qua skill và chạy cổng kiểm.

## 09/11/2026: quy trình dễ dùng, dẫn đường như game

Chủ muốn AI luôn tìm cách làm quy trình đơn giản cho người dùng: có hướng dẫn từng bước, làm đến đâu hướng dẫn đến đấy, giống phần hướng dẫn trong game.

Đã làm:

- Skill thêm mục 2b: viết bản đồ tác vụ, rồi gắn mỗi chỗ người dùng dễ lúng túng với một mẫu dẫn đường.
- Thêm hai khối `trinh-tu` và `bat-dau`.
- Thêm phép đo mềm `long-form`.
- Bộ tiêu chí thêm dòng "Quy trình có dẫn đường" (cổng người duyệt).
- Bằng chứng: NN/g về wizard, onboarding và progressive disclosure; nguyên tắc "đúng lúc, khi cần" của James Paul Gee. Ghi trong kho tri thức, claims c29–c36.

## 09/11/2026: công cụ tự nhắc AI dẫn đường, và cổng đo trạng thái sau thao tác

Chủ nhắc lại yêu cầu: khi chạy design-kit, chính công cụ phải nhắc AI tìm cách làm quy trình tiện cho người dùng, có hướng dẫn từng bước, làm đến đâu hướng dẫn đến đấy, như phần hướng dẫn trong game. Trước đó chỉ skill nhắc việc này; còn CLI thì không.

Đã làm:

- **CLI tự nhắc.**
  - `design-kit` (không đối số) in mục `workflow`: lập bản đồ tác vụ, rồi gắn từng chỗ dễ lúng túng với một mẫu dẫn đường.
  - Mỗi lần chạy `design-kit check` đều kết thúc bằng dòng nhắc "Guide like a game".
- **Phép đo mềm `guide`.** Báo ba trường hợp:
  - nút đi tiếp chỉ ghi "Tiếp"/"Next";
  - câu báo rỗng mà không có nút gỡ;
  - tour hoặc hộp "Chào mừng" tự bật khi mở trang.
- **Đo trạng thái sau thao tác** (`--steps`, `<trang>.steps.json`), việc còn lại từ giai đoạn 2:
  - Mỗi trạng thái nạp trang mới, chạy thao tác rồi được đo đủ mọi tiêu chí.
  - Bước nào không làm được thì báo lỗi cứng.
  - Đã viết tệp steps cho 9 khối HTML và 3 khối React.
- **Focus kiểm ở cả khổ 390**, kèm phát hiện focus rơi vào phần tử vô hình.
- **Lỗi thật mà cách đo mới tìm ra, đã sửa:**
  - Bảng dữ liệu ở khổ điện thoại không sắp xếp được, và Tab rơi vào nút vô hình.
  - Tìm không ra kết quả thì bảng trống trơn, không có nút gỡ lọc.
  - Bộ lọc tắt hết mức độ thì chỉ hiện số 0, không nói lý do.
- **Duyệt ảnh chụp bắt thêm, đã sửa:**
  - Bảng ghi "A → Z" mà hàng không được xếp.
  - Ở khổ hẹp: tiêu đề bảng bị bóp thành cột hẹp, số tách xa đơn vị, nhãn dùng sai font.
  - Mẹo của `bat-dau` leo lên cạnh công tắc khi bị thu hẹp. Đã chuyển sang grid.
- **Hai báo nhầm của phép đo focus mới, đã sửa trong cổng:**
  - Công tắc tuỳ biến: nay nhìn vào `span` hoặc nhãn thay thế.
  - Hiệu ứng đang chạy: nay đợi hiệu ứng xong, tối đa 600ms.
- **Báo lỗi shadow DOM cho Impeccable**, việc còn lại thứ hai:
  - Đã tái hiện với bản 4.8.1 và soạn issue ở `docs/bao-loi-impeccable-shadow-dom.md`.
  - **Chưa gửi**, vì gửi lên GitHub là việc công khai, cần chủ duyệt.

## 09/11/2026: chủ đồng ý gửi báo lỗi và thêm quy tắc dẫn đường vào CLAUDE.md toàn cục

- `~/.claude/CLAUDE.md`, mục "Giao diện", có thêm đoạn: quy trình phức tạp đến mấy cũng phải dễ như phần hướng dẫn trong game. Trước khi dựng, lập bản đồ tác vụ và gắn mỗi chỗ dễ lúng túng với một mẫu dẫn đường; không dùng tour mở đầu; báo cáo phải nêu bản đồ này.
- Báo lỗi Impeccable: lệnh `gh issue create` bị bộ phân loại của chế độ tự động chặn (tạo nội dung công khai). Chủ tự chạy lệnh trong `docs/bao-loi-impeccable-shadow-dom.md`.

## 09/11/2026: gộp phụ thuộc để chạy độc lập, đóng gói thành plugin (0.2.0)

Chủ hỏi có nên đóng gói và gộp các phụ thuộc vào dự án để nó chạy độc lập không. Trả lời: **có, nhưng chọn lọc**. Gộp những gì design-kit tự sở hữu, hoặc nhỏ và ít thay đổi. Những thứ là sản phẩm riêng, nặng, hoặc đổi thường xuyên thì ghim phiên bản và tải khi cần. Chủ bấm "Làm ở đây".

| Thành phần | Đã làm |
| --- | --- |
| Script màu | `colorjs.io` chuyển sang dependencies. Thêm lệnh `design-kit doi-mau` và `kiem-mau`, cả hai dùng chung lõi `scripts/doi-mau-lib.mjs`. Đầu ra trùng khớp từng byte với bản cũ ở 3 phép thử. |
| Đường dẫn cứng | Skill không còn ghi `D:\code`. Muốn biết đường dẫn thì hỏi `design-kit`. |
| Font | `tokens/fonts-local.css` cùng 16 tệp woff2 (414 KB, giấy phép OFL), sinh bằng `npm run fonts`. Khối mẫu và fixture chuyển sang bản tự host. |
| Bằng chứng | `docs/nguon.md` xuất từ kho tri thức: 28 nguồn, 36 luận điểm. |
| Lint DESIGN.md | `@google/design.md` thành devDependency, chạy bằng `npm run lint:design`. |
| Trình duyệt | Không gộp. Thêm đường lùi: Chromium của Playwright. |
| Engine Impeccable | Không gộp. Ghim bản 0.1.19 và sha256; `design-kit setup` tải khi thiếu. Đã thử tải thật, sha256 khớp. |
| Skill khác | Không gộp. |
| Plugin | `.claude-plugin/` gồm plugin và marketplace. Có `skills/design-kit/` và hook `hooks/nhac-giao-dien.mjs`: nhắc khi sửa tệp giao diện, chặn "báo xong" một lần nếu chưa chạy cổng. `claude plugin validate` đạt. |
| Gói npm | Thêm trường `files`, vì `.gitignore` sẽ làm rơi `dist/`. Đã thử cài từ gói ra một thư mục tạm: `design-kit`, `doi-mau` và `check` đều chạy. |
| CI | `.woodpecker/ci.yaml` dùng image Playwright 1.65.0, gồm check, token, lint, setup và cổng ba hướng. **Chưa chạy lần nào**: chủ phải Enable repo trong Woodpecker. |

Đã thử thêm cách cài toàn cục từ git (`npm install -g git+file://…`): **hỏng**. Lệnh `npm install` mà npm chạy bên trong bản clone thừa hưởng chế độ global, nên `prepare` không có `tsup`. Đổi hướng dẫn cài sang: clone, `npm ci`, `npm install -g .`. Đã thử trên một bản clone sạch: `--version`, `setup`, `kiem-mau` đều chạy.

## 10/11/2026: cài plugin trên PC1

Chủ bấm "Cài plugin".

- Thêm marketplace thư mục: `claude plugin marketplace add D:/code/design-kit`. Cài `design-kit@design-kit` ở phạm vi người dùng.
- `claude plugin details` thấy 1 skill và 2 hook (PostToolUse, Stop). Chi phí thường trực khoảng 406 token, bằng phần mô tả skill trước đây.
- Đã gỡ junction `~/.claude/skills/design-kit` để skill không bị nạp hai lần.
- Thử từ đầu đến cuối bằng một phiên `claude -p` (Haiku) trong thư mục tạm, cho nó ghi một tệp HTML:
  - phiên nhận lời nhắc chạy `design-kit check … --strict` và lập bản đồ tác vụ;
  - khi phiên định dừng, hook Stop chặn lại để chạy cổng.
- Khi repo đã lên GitHub, có thể đổi marketplace sang `ngoviet/design-kit` cho máy khác. PC1 giữ marketplace thư mục để sửa là có hiệu lực ngay.

## 10/11/2026: chuyển public, README theo readme-axi, phát hành 0.2.0

Chủ yêu cầu: "chuyển thành repo public đi, viết readme-axi, tạo release".

- **Rà trước khi public.** gitleaks quét cả 20 commit: không có bí mật. Có IP `192.168.1.x` trong khối mẫu: là dữ liệu mẫu, giữ. Trang A/B trong `eval/` có khoảng 30 số điện thoại và vài email do mô hình tự bịa làm dữ liệu mẫu (có thể trùng người thật, như mọi dữ liệu mẫu): giữ nguyên, vì đó là bản ghi đã được chấm, sửa vào là làm sai lệch bằng chứng. Viết lại lịch sử cũng không xoá được, vì PR #1 giữ tham chiếu `refs/pull/1/head` mà GitHub không cho xoá.
- **CI.** Repo public không chạy Woodpecker (PR từ fork lạ sẽ chạy trên máy chủ riêng): đã tắt repo trong Woodpecker (gỡ webhook, giữ lịch sử pipeline) và gỡ `.woodpecker/`. CI chuyển sang GitHub Actions (miễn phí cho repo public), cùng các bước và cùng image Playwright 1.65.0.
- **README.** Theo chuẩn readme-axi của `ngoviet/.github`, loại `tool`: `README.md` tiếng Anh, `README.vi.md` tiếng Việt, khối ủng hộ dùng chung, mục Giấy phép. Phần "Trạng thái" cũ chuyển sang `docs/nhat-ky.md`.
- **Skill.** Bỏ các câu riêng cho máy chủ dự án (Folio trên PC1, "the owner"), vì người khác cũng cài plugin này.
- **Giấy phép.** MIT, như các repo AXI public khác. Font theo SIL OFL, khối React dùng shadcn/ui (MIT).
- **Phát hành.** Không đưa lên npm registry (giống imp-axi): release GitHub kèm `design-kit-0.2.0.tgz` và `.sha256`, cài bằng `npm install -g <url>`.

## 10/11/2026: trang trắng không còn qua cổng (`render`, `errors`)

Gặp khi kiểm lan-topo-card bằng design-kit: lần chạy đầu cổng báo "pass: 3 pages, 0 findings", ảnh chụp là một màn tối. Card đợi `ha-card` 3 s rồi mới tải Lit từ CDN; cổng đo ngay lúc mạng rảnh nên trang chưa có gì, và trang không có gì thì không phép đo nào trượt. Chủ bấm "Sửa ở đây".

- **`render` (cứng):** không có chữ, ảnh hay đồ hoạ nào nhìn thấy (đi xuyên shadow root). Trước khi kết luận, cổng đợi thêm tối đa 5 s cho nội dung đến muộn và ghi `content appeared N ms after the network went idle`. 5 s đủ cho trường hợp gốc (nội dung hiện sau 2,96 s); trang trắng thật mất thêm 5 s mỗi lần render, chấp nhận được.
- **Custom element chưa định nghĩa (mềm, cùng `render`):** chỉ thẳng chỗ hỏng; ở trang preview gốc của lan-topo-card nó báo `ha-card`, đúng thứ trang chứa thiếu khiến card mất nền tối.
- **`errors` (cứng):** `pageerror` (lỗi script chưa bắt), script/stylesheet trả ≥ 400 hoặc yêu cầu hỏng. Bỏ `ERR_ABORTED` (yêu cầu bị huỷ khi trang tự điều hướng) và console.error (favicon 404 gây nhiễu, đã thấy trong lúc dò).
- Cách sửa theo "tái hiện trước": fixture `test/fixtures/trong.html` (script 404 + lỗi ném ra, trang trắng) và `cham.html` (chữ 10px đến sau 1,5 s); hai test đỏ trên mã cũ, xanh sau khi sửa.
