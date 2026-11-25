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
| Engine Impeccable | Không gộp. Ghim bản và sha256 (0.1.19, từ 19/11/2026 là 0.1.27); `design-kit setup` tải khi thiếu. Đã thử tải thật, sha256 khớp. |
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
- **Custom element chưa định nghĩa (mềm, cùng `render`):** chỉ thẳng chỗ hỏng; ở trang preview gốc của lan-topo-card nó báo `ha-card`, đúng thứ trang chứa thiếu khiến card mất nền tối. Chỉ báo thẻ rỗng; thẻ chưa đăng ký mà có con (`app-root` của Angular, thẻ chỉ để gắn style) chỉ được ghi chú, vì trang vẫn hiện đủ.
- **`errors` (cứng):** `pageerror` (lỗi script chưa bắt), script/stylesheet trả ≥ 400 hoặc yêu cầu hỏng. Bỏ `ERR_ABORTED` (yêu cầu bị huỷ khi trang tự điều hướng) và console.error (favicon 404 gây nhiễu, đã thấy trong lúc dò).
- Cách sửa theo "tái hiện trước": fixture `test/fixtures/trong.html` (script 404 + lỗi ném ra, trang trắng) và `cham.html` (chữ 10px đến sau 1,5 s); hai test đỏ trên mã cũ, xanh sau khi sửa.

## 14–15/11/2026: tối ưu đợt 2, chủ chọn gói nền

Chủ yêu cầu "tìm kiếm thêm trên mạng để tối ưu design-kit". Năm agent tìm song song theo bảy câu hỏi con; 44 nguồn mới
và 41 luận điểm vào kho tri thức (s29–s72, c37–c77, xem `docs/nguon.md`). Mỗi ý tưởng được thử trên 51 trang của kit
(39 trang khối mẫu, 12 trang A/B) trước khi đề xuất. Báo cáo 22 đề xuất ở `.folio/toi-uu-dot-2.html`; chủ chọn **gói
nền, 10 mục**.

| Mã | Đã làm | Số đo |
| --- | --- | --- |
| P22 | `long-form` không đếm ô tích, ô chọn đang ẩn | trang báo cáo đợt 2 từng bị báo 23 ô khi danh sách 22 ô tích đang đóng |
| P14 | sàn `axe-core` 4.14.0, `playwright-core` 1.65.1, image CI theo | bản trước 4.14.0 bỏ qua lặng lẽ tương phản với màu OKLCH có `none` |
| P6 | chờ theo tín hiệu thật thay cho `networkidle` + 300 ms | cổng 13 khối × 3 hướng: 144,9 s còn 120,0 s, phát hiện trùng từng dòng; một trang 9,0 s còn 5,85 s |
| P4 | `focus` báo vòng mất trong chế độ màu ép buộc, đo thật bằng `forcedColors: active` | lỗi thật ở cả 4 khối React (shadcn `outline-none`), đã đổi sang `outline-hidden` |
| P2 | `viewport` (cứng): mở trang một lần với `isMobile` | trang thiếu thẻ từng qua cổng với 0 phát hiện; trên máy thật chữ 16px hiện 6,4px |
| P3 | `input-zoom` (mềm): ô gõ chữ nhỏ ở khổ điện thoại | 3/12 trang A/B; quy tắc: dưới 16px thì báo, trừ ô `disabled` (mục dưới) |
| P1 | khổ 320 đo đủ, Impeccable thêm ở 320, `text-covered` (mềm), sửa khối hero | hero hiện "Camer", "23/2" ở 320–360px; nguyên nhân: `<figure>` còn lề mặc định 40px |
| P10 | hook Stop thấy tệp giao diện sửa qua shell, đòi kiểm đúng trang | thử trên transcript thật của phiên: không báo thừa |
| P9 | SKILL.md: mục Rules lên đầu, bẫy sang `skills/design-kit/reference/traps.md` | khoảng 8,2 nghìn còn 5 nghìn token mỗi lần gọi (ước lượng của Claude Code) |
| P15 | `docs/nguon.md`, `docs/tieu-chi.md`, README hai bản, mục này | — |

Cổng sau gói nền: 130,4 s cho 13 khối HTML × 3 hướng kèm trạng thái (thêm Impeccable và mọi phép đo ở 320 làm chậm lại
10 s so với sau P6, vẫn nhanh hơn bản đầu 144,9 s). Cổng toàn bộ theo CLAUDE.md (HTML và React, 105 trang và trạng
thái): đạt, 0 lỗi cứng, 193 s; các trạng thái mở bằng URL (`mo=1`, `lan-dau=1`, `buoc=2..5`) cũng đạt. Còn 22 phát
hiện mềm có lý do: 17 `standalone` (khối liên kết token theo đường dẫn) và 5 straggler của Impeccable (3 mới ở 320,
cùng loại với 2 cái đã có; khối đã dùng `text-wrap: pretty`). 53 test đạt hai lượt liền.

Ba việc **không làm**, kèm lý do:

- **Cho mô hình chấm ảnh chụp làm cổng.** VLM chấm "hoàn hảo" 14/15 hình hỏng bố cục (c59), chỉ nhận ra 40,7% thay
  đổi CSS nhỏ (c60). Mô hình hợp với việc xếp hạng các phương án khác nhau rõ trên nhiều ảnh chụp (c61); việc đó
  vẫn để người duyệt.
- **Phép đo định dạng số, ngày kiểu Việt.** 0/12 trang A/B viết sai (dấu chấm nhóm nghìn, dấu phẩy thập phân, ngày
  trước tháng đều đúng sẵn).
- **Tự viết lại luật dấu khuôn mẫu của chữ.** Nhãn viết hoa trên tiêu đề đã có luật Impeccable; mũi tên cuối nút gặp 0
  trang. Việc đúng là nâng ghim Impeccable (P13, ngoài gói nền, cần chủ đồng ý tải tệp chạy).

**Quy tắc ngưỡng `input-zoom` (15/11/2026, chủ giao em viết).** Dưới 16px thì báo; ô `disabled` bỏ qua vì không nhận
focus; ô `readonly` vẫn tính vì chạm vào vẫn nhận focus và WebKit vẫn đi tới bước phóng to (WKContentViewInteraction.mm,
chưa thử trên máy thật). Đính chính báo cáo đợt 2: câu "WebKit phóng to từ khoảng 14,5px trở xuống" chỉ đúng cho bản
iOS tương lai. Blame dòng mã cho thấy quy tắc bỏ qua khi đổi dưới 10% mới vào nhánh main ngày 13/11/2026 (commit
b2bcd4fa11, lỗi của bsky.app; c78), chưa có trong bản iOS nào đã phát hành, nên mọi iPhone đang dùng đều phóng to ô
dưới 16px.

Còn mở: các mục P5, P7, P8, P11–P13, P16–P21 trong báo cáo chưa làm.

## 18/11/2026: chấm điểm logo, icon, ký hiệu và hình minh hoạ (`check-image`)

Chủ yêu cầu thêm tính năng "chấm điểm được logo, ảnh vẽ, các biểu tượng, các ký hiệu". Một agent tìm nguồn song song
(43 nguồn, 51 luận điểm: s74–s116, c79–c129); bộ tiêu chí ở `docs/tieu-chi.md`, mục "Hình".

- **Điểm từ số đo, không từ mô hình nhìn ảnh.** Giữ quyết định đợt 2 (VLM chấm perfect hình hỏng, c59–c61). Phần
  máy không đo được (ý nghĩa, độ dễ nhận ra, hợp thương hiệu) để người xem trên tờ soát.
- **Lệnh riêng, không gộp vào `check`.** Đầu vào là tệp hình chứ không phải trang; kết quả là điểm 0–100 theo tiêu
  chí kèm phát hiện cứng/mềm như cổng. Lỗi cứng giữ điểm ≤ 49 để "hỏng" không thể là "khá".
- **Không thêm gói phụ thuộc.** Trình duyệt sẵn có giải mã và vẽ mọi định dạng (kể cả SVG ở đúng cỡ); mọi phép đo là
  hàm thuần trên điểm ảnh (`src/image/`), test được không cần trình duyệt.
- **Chi tiết mất đo theo đường viền, không theo diện tích.** Đo theo diện tích, hai vòng nét 0,6 của logo mẫu chỉ là
  7% dù biến mất hẳn ở 32 px. Đo theo viền thì mép hình tròn bị "bào" một lớp do rời rạc hoá (icon Lucide báo 17%),
  nên bỏ mảnh mỏng hơn 2 điểm tham chiếu; mũi nhọn (cánh sao, đầu lá) chỉ bị tròn đi nên bỏ theo hình học: diện tích /
  (cạnh nối)² < 2. Sau đó Lucide về 99% dưới 1%, nét 0,5 px vẫn 100%.
- **Logo không chấm độ phức tạp, số màu chỉ trọng số 5.** Nghiên cứu không cho mức tối ưu (c79–c81) và không có
  chuẩn số màu cho logo; logo được miễn tương phản WCAG (c104), nên "không nổi trên nền" là mềm với logo, cứng với icon.
- **Bộ icon theo thư mục.** Truyền hai thư mục thì thành hai bộ, không trộn. Độ đậm tự nhiên của Lucide dao động 0,46–
  1,37 lần trung vị, nên chỉ báo khi ngoài 0,4–2 lần.

Thử trên hình mẫu (`test/fixtures/hinh/`): logo tốt 95, logo cố ý mắc lỗi 39, ảnh minh hoạ sắc 96, cùng ảnh phóng to
54; 134 icon Lucide chạy thật trung bình 100, độ đồng bộ 99, 0,13 s mỗi icon.

Thử trên 14 logo, icon thật trong `D:\code`: icon thương hiệu Home Assistant 98–100 sau khi thêm chế độ ô gạch; tìm ra
`codex-chatgpt-web/launcher/assets/icon.svg` không hiện logo (vùng `filter` theo `userSpaceOnUse` bị `scale(28)` đẩy ra
ngoài).

Chủ chọn trên trang Folio (18/11/2026): mở PR, sửa icon đó, thêm hook nhắc, commit nguồn vào research-hub. Hook chỉ
xét tên tệp và thư mục chứa nó (logo, icon, favicon, brand, ký hiệu, minh hoạ…), không xét cả đường dẫn, để ảnh chụp
màn hình hay ảnh trong repo tên "brand-site" không bị đòi chấm. Lúc làm hook lộ thêm một lỗi cũ: mẫu `check` kèm ranh
giới từ khớp cả `check-image`, nên một lần chấm hình từng được tính như đã chạy cổng trang; mẫu mới đòi `check` không
có chữ hay dấu gạch theo sau.

## 19/11/2026: rà soát đợt 3, đổi khổ tại chỗ (P7), `--sweep` (P5)

Chủ yêu cầu rà soát, sửa lỗi, test lại, và nghiên cứu thêm chức năng hay đổi cấu trúc để nhanh và chính xác hơn.

- **Rà lỗi bằng hai agent đọc mã độc lập**, mỗi phát hiện phải có test đỏ trên mã cũ rồi xanh trên mã mới. 25 lỗi được
  báo, 20 lỗi đã sửa kèm test (danh sách trong CHANGELOG, mục Unreleased). Lỗi nặng nhất: `check-mod --shots <thư mục>`
  xoá cả thư mục được chỉ định; trên Windows, `claude.cmd` làm `check-mod` báo "pass" mà không test nào chạy; một trang
  hỏng (CSP, 404) làm hỏng cả lượt kiểm nhiều trang.
- **P7, đổi khổ tại chỗ**, kèm tự kiểm như báo cáo đợt 2 đề xuất: trang đầu nạp một lần ở khổ rộng nhất, đổi khổ và
  chế độ màu ngay trên trang; một lần nạp mới ở khổ hẹp có đo focus phải cho đúng dấu vân bố cục và màu, lệch thì đo
  lại kiểu cũ. Trạng thái sau thao tác chỉ đổi chế độ màu (đổi khổ làm con trỏ chuột rơi vào phần tử khác). Cổng toàn
  bộ 105 trang: 132 s, `--fresh` 178 s, phán quyết và mọi phát hiện trùng hệt, 0 trang phải quay về cách cũ.
  Reviewer độc lập (phiên sạch) dựng 4 trang qua mù bản tự kiểm đầu (chỉ so ở 390): lỗi script chỉ khi nạp hẹp, nền
  body chuyển động làm dấu vân gần rỗng, `--viewports 320,1280` không kiểm đổi khổ, trang giữ trạng thái từ khổ hẹp khi
  đo bản tối ở 1280. Bản sửa so ở khổ hẹp nhất, ở khổ focus hẹp (đổi khổ lên từ trang kiểm), và ở khổ rộng nhất sau
  khi đã đi qua các khổ hẹp; báo lỗi script của trang kiểm; dấu vân giữ hình học của phần tử chạy hiệu ứng màu, chỉ
  bỏ cây con của hiệu ứng hình học, và không tin dấu vân khi phần bị bỏ lớn hơn phần còn lại. 4 trang đó thành test.
  Giới hạn còn lại: khổ giữa (khác hẹp nhất, khác khổ focus, khác rộng nhất) không có so riêng.
- **P5, `--sweep`**, tắt mặc định: đo tràn ngang ở 8 khổ trung gian trên trang đang mở, khoảng 0,1 giây mỗi khổ.
- **Không làm trong đợt này, để chủ chọn** (báo cáo `.folio/toi-uu-dot-3.html`): nâng axe-core 4.14.1 và engine
  Impeccable 0.1.27 (tải tệp chạy mới), các phép đo mềm mới từ nghiên cứu (nút dừng cho hiệu ứng trên 5 giây theo WCAG
  2.2.2, chữ hiện dần khi cuộn mà không bao giờ hiện, thẻ `best-practice` của axe ở mức mềm), lỗi hook còn lại (mẫu
  `SKIP` so đường dẫn tuyệt đối, chữ nhắc lệnh trong `grep` tính như đã chạy cổng), bản `data:` URL chưa đợi nội dung
  đến muộn, cờ `--fields` không lệnh nào dùng.

## 24/11/2026: nhập nghiên cứu (149 quy tắc mở rộng, bộ UX, kiểm đa màn hình, bộ màu)

Chủ hỏi "các tri thức từ nghiên cứu có được cập nhật vào design-kit không". Làm trong worktree riêng, từ `origin/main`.

- **Bảng tiêu chí chỉ ghi thứ cổng đo thật.** 159 dòng của bộ mở rộng được xét từng dòng: có nguồn đã đối chiếu mà chưa có phép đo thì
  vào mục riêng với cổng "người"; chỉ là quy ước hay nguồn từ trí nhớ thì không nhập (danh sách mã ở cuối mục đó). Lý do: bảng cũ có
  những ngưỡng không ai đo (44 px, tương phản phi chữ trên trang) mà vẫn ghi cứng.
- **Mười tám nguồn "từ trí nhớ":** 12 đọc thật (câu trích khớp trang gốc), 1 đã có trong kho (c47), 5 để ngoài (N112–N116).
- **Phép đo mới đều mềm**, kể cả thứ nghiên cứu đề nghị cứng (NFC, chữ Hán, tự phát tiếng, xin quyền): qua hai đợt 0 báo oan mới xét lên cứng.
- **Khổ thiết bị là hồ sơ, không đổi mặc định**, để trang đang đạt không đổi kết quả. Cổng toàn bộ 105 trang trước và sau: phán quyết và mọi
  phát hiện cũ trùng hệt. Thời gian đo xen kẽ hai vòng trên cùng máy (117 trang, máy đang bận): bản cũ 202 và 209 s, bản mới 208 và 212 s
  (chậm hơn 1–3%); `--profile devices` bằng 1,3 lần mặc định (279 so với 215 s).
- **Ba báo oan tìm thấy khi chạy trên khối mẫu, đã sửa trong phép đo:** `text-zoom` đo giữa `transition: all` (11 phát hiện giả), `sticky`
  đo menu vừa mở (6), `touch` bỏ sót nhãn của nút `role="checkbox"`. Thêm một lỗi do test cũ bắt: vòng `auto` của ô tích trong suốt.
- **Người soát độc lập** (phiên sạch): 13 phát hiện, 0 cứng, sửa hết; 36 đột biến thì 17 còn xanh. Sau khi thêm test, chạy lại 21 đột biến: 20 đỏ,
  1 xanh là đột biến tương đương (bỏ trả cỡ chữ: `cdp.detach()` tự trả). Chạy từng trang một thì chậm hơn khoảng một phần ba (33,6 → 45,1 s cho 26
  trang nhỏ); cổng toàn bộ chạy 6 việc song song chỉ chậm 1–3%.
- **Trùng một phần với công cụ có sẵn** (thấy khi khảo sát, sau khi đã viết): axe `no-autoplay-audio`, `css-orientation-lock`; Lighthouse
  `geolocation-on-start`, `notification-on-start`. Phần thêm của kit: `play()` từ script, Web Audio, đọc máy, micro, push, manifest.
- **`motion` nới theo chuẩn:** chỉ cho qua độ mờ và màu; mọi thứ khác vẫn cứng (2.3.3 là AAA, cơ sở AA là 2.2.2). Bản đầu dùng danh sách cấm
  và sót background-size, stroke-dashoffset: hai trang có chuyển động thật từ trượt thành đạt, người soát bắt được.
- **Focus mất hẳn vẫn mềm**, dù là trượt 2.4.7 AA: phép đo chỉ đọc outline và box-shadow. Muốn lên cứng phải so kiểu trước và sau khi focus.
- **CLS "cộng dồn qua các khổ" không tái hiện** trên bản này (đọc ở lượt render đầu, trước khi đổi khổ): giữ phép đo, ghi rõ cách đo.
- **Bộ màu:** chủ muốn tích hợp vào kit vì mọi app có nhiều bộ cho người dùng chọn. Chín bộ sinh từ hạt giống; bản Node cho đúng 391/391 mã màu
  của bản Python đang chạy thật. Neon tối chép nguyên văn. Bảng gốc MIT giữ thông báo bản quyền.
- **Không có mức kích thước riêng cho trẻ 6 tuổi:** chủ bỏ ngày 24/11/2026.
- **Công cụ có sẵn:** chủ muốn khảo sát trước khi viết thêm phép đo, và chốt học để bổ sung chứ không thay design-kit. Năm nhóm phép đo này viết
  xong trước lời dặn đó; từ đây dừng viết phép đo mới tới khi có bảng khảo sát.

Chủ quyết cùng ngày (trang khảo sát 56 công cụ, và trong phiên): giãn dòng tiêu đề xuống mềm; WebKit là cờ tuỳ chọn; Hoàn tác đặt cạnh chỗ vừa đổi,
khối `thong-bao` giữ cho việc xoá; nâng đích chạm khối mẫu lên 44 px khi máy có chạm; so kiểu trước và sau focus rồi mới xét lên cứng; giữ `motion`
đã sửa; lấy mười mục K1–K6, K8, K9, K14, K16.

### Đợt hai cùng ngày: học từ công cụ khác để bổ sung

Chủ chốt: học để bổ sung, không thay design-kit. Nguồn học chính là renderlint (MIT): nội dung kéo dài, tương phản từ điểm ảnh, lái bàn phím, cách báo.

- **Bốn agent dựng song song, mỗi agent một bộ tệp; một người nối vào `check.ts`.** Mỗi mô-đun có trang sai, trang đúng và đột biến riêng.
- **Phép đo mới tìm ra năm lỗi thật trong chính khối mẫu**, đã sửa: `thanh-ben` thiếu liên kết bỏ qua; mục đang chọn mất dấu trong màu ép buộc ở
  `dau-trang`, `thanh-ben`, `bo-loc`; tên dài bị cắt ở `bang-du-lieu` (390 px); nút React dùng `transition: all`. Đó cũng là một nguồn của 11 báo oan
  `text-zoom` hồi chiều.
- **Một báo oan của phép đo mới, đã sửa:** `contrast-more` coi khối `@media` của bộ màu không được chọn là lời hứa của trang.
- **Kết quả trên khối mẫu:** 117 trang và trạng thái, mọi phép đo mới 0 phát hiện (mặc định và `--profile devices`). Thời gian đo xen kẽ: bản cũ 146
  và 159 s, bản mới 165 và 170 s (chậm hơn khoảng 10%).
- **Bộ màu:** màu nhấn sáng (vàng, chanh, bạc hà) giữ nguyên với chữ đậm thay vì bị kéo tối; cam vẫn chữ trắng vì chữ đậm chỉ đạt Lc 50. Bản tương phản
  cao cho chín bộ; ba hướng chưa có vì token của hướng giữ nguyên.
- **Mã phát hiện bỏ số trước khi băm**, nên "14,2px" thành "14,4px" vẫn là một lỗi; riêng bộ chọn axe ghi ở đầu chi tiết thì giữ nguyên, vì đó là chỗ
  bị lỗi chứ không phải số đo. Lượt so chỉ tính trang có ở cả hai lượt, cùng bộ khổ, chế độ màu và cùng lựa chọn (quét khổ, số điểm dừng Tab, mức chạm, engine).
- **Người soát độc lập lượt hai:** 11 phát hiện, 0 cứng, nhưng năm chỗ của phần so với lượt trước và `--recheck` có thể nói "đã sửa" khi chưa đo lại:
  hai lỗi axe chung một mã, đo lại khổ quét mà không quét, đổi cờ giữa hai lượt, trang hay phép đo không chạy, và trang có service worker được lấy từ
  bộ đệm. Đã sửa hết; nay đo lại ra "not measured" khi không đo, và từ chối khi cờ khác lượt trước. Ảnh đánh số chụp sau mọi phép đo và xoá ảnh cũ.
  Chạy lại chín đột biến còn xanh của lượt soát cùng mười bảy đột biến cho phần vừa sửa: 25 đỏ, 1 xanh tương đương (gỡ lớp phủ ảnh đánh số, vì ảnh
  chụp cuối và trang được nạp lại ngay sau).
- **Chưa làm:** logo quá to trong ngăn kéo của `thanh-ben` (lỗi có sẵn, đổi giao diện máy chuột nên để riêng); WebKit chưa cài trên PC1 nên chưa chạy thật.

## 25/11/2026: soát toàn dự án, sửa lỗi

Chủ yêu cầu "kiểm tra lại toàn bộ dự án, fix bugs, fix lint". Lúc nhận: tsc, eslint sạch, 435 test đạt, cổng 117 trang 0 cứng; nên phần lint không có gì phải sửa
ngoài một tham số thừa, phần lỗi đến từ sáu lượt soát độc lập theo vùng (khoảng 55 phát hiện đã tái hiện). Danh sách đã sửa: `CHANGELOG.md`.

- **Mỗi lỗi có test đỏ trước khi sửa**; không thêm phép đo, không đổi ngưỡng. Cổng trên khối mẫu trước và sau: cùng 23 phát hiện mềm, 0 cứng.
- **Hai chỗ cứng chặt hơn, theo đúng luật đã có:** `text-min` đo chữ SVG theo bề dày dòng chữ trên màn (47 trang thật trong D:\code: 0 đổi, đo trước khi chỉnh thêm cho chữ nghiêng), và `check-mod`
  coi mod có `ui.render` mà không vẽ được cây nào là lỗi `mount` (trước là "pass" với 0 cây).
- **Để lại có lý do:** phím Tab của chính cổng làm `autoplay`/`permission` ngừng ghi từ lúc đó (sửa theo gợi ý thì báo oan trang mở khoá tiếng ở phím đầu);
  `vh-full` khi `100dvh` bị `100vh` đè ở cùng số px (phải tính cascade); `offline` với worker đăng ký sau khi trang chính đã đo xong (chờ thì chậm mọi trang);
  hình dưới 50% độ mờ vẫn là `empty`, chỉ sửa câu báo; hook không tính lệnh nằm trong chuỗi (`bash -lc "…"`).
- **Người soát độc lập bản sửa:** 0 chặn, 1 nên sửa (hook Stop quá 10 s ở phiên nặng, đã sửa), mấy mục nhẹ đã sửa; 50 đột biến, 42 đỏ, 2 tương đương, 6 sống;
  đã thêm test, chạy lại cả 6 đều đỏ.
- **`hookTimeout` của vitest 60 s:** 18 tệp cùng mở trình duyệt thì đóng trình duyệt có lúc quá 10 s mặc định (chạy riêng 9 s cả hai tệp, 3/3 lượt xanh).

### Soát nốt cùng ngày

Chủ bảo làm tiếp: xử lý các nghi ngờ chưa ai tái hiện và các mục để lại ở trên. Cụm cổng: 9/9 mục tái hiện được và đã sửa; cụm lệnh: phần còn lại bác
kèm phép thử. Cổng khối mẫu trước và sau: cùng 23 phát hiện mềm, 0 cứng.

- **`vh-full` ở cùng số px (trước để lại) nay làm được** mà không tự tính cascade: đổi tạm khai báo dvh sang `auto`/`none`, xem giá trị đã tính có đổi không,
  trả lại ngay. Không thử với thuộc tính `style`, `allow-discrete`, `interpolate-size`.
- **Bác:** `fetch` tải engine không hạn giờ (undici tự ngắt sau 305 s im lặng, đo trên Node 24); `test.skip`, `test.only`, `beforeEach` trong bộ test mod (Claude
  Code 2.1.332 chỉ có `describe`, `expect`, `mock`, `test`, `tier`); `borderTop`, `overflowY`, tra prototype ở khoảng cách (engine từ chối cây trước).
- **Vẫn để lại:** phím Tab của cổng và `offline` muộn (lý do ở trên); lượt test mod hết giờ chỉ ra ghi chú, status vẫn có thể "pass"; Linux: tiến trình cháu giữ
  ống khi hết giờ (suy luận từ mã); `theme-color` với body gradient, `@media` lồng trong luật ở `contrast-more` (đọc mã, chưa tái hiện).
- **Phát hiện `steps` chập chờn:** một lượt cổng lúc máy bận có 2 lỗi cứng ở `thanh-ben #ngan-keo` khổ 320 (hết 5 s chờ bấm), các lượt sau sạch; chưa chứng minh là do tải.
