# design-kit

<!-- readme-axi type=tool -->

[![CI](https://github.com/ngoviet/design-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/ngoviet/design-kit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ngoviet/design-kit)](https://github.com/ngoviet/design-kit/releases)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[English](README.md) · **Tiếng Việt**

Bộ chuẩn và cổng đo giúp agent lập trình (trước hết là Claude Code) làm giao diện web và ứng dụng **đẹp, hiện đại,
dễ dùng** ngay từ lần đầu, thay vì dừng ở mức "chạy được". design-kit đưa cho agent ba hướng thẩm mỹ dưới dạng token
và tệp [DESIGN.md](https://github.com/google-labs-code/design.md), các khối mẫu đã qua cổng, và một CLI theo chuẩn
[AXI](https://axi.md): `design-kit check` render mọi trang ở khổ 320/390/1280 px, cả sáng lẫn tối, rồi đánh trượt
những gì người dùng thật sự vấp phải: WCAG 2.2 AA, tràn ngang, chữ quá nhỏ, vòng focus vô hình, chuyển động bỏ qua
chế độ giảm chuyển động, nút "Tiếp" không nói đi đâu. Làm cho giao diện tiếng Việt (font, chiều cao dòng,
`lang="vi"`), và dùng được với mọi trang.

> 🇻🇳 Một người ở Việt Nam làm và duy trì — nếu công cụ giúp bạn tiết kiệm thời gian, mong bạn
> [ủng hộ dự án](#ủng-hộ-dự-án).

## Mục lục

- [Tính năng](#tính-năng)
- [Cài đặt](#cài-đặt)
- [Cách dùng](#cách-dùng)
- [Lệnh](#lệnh)
- [Cách hoạt động](#cách-hoạt-động)
- [Tích hợp với agent](#tích-hợp-với-agent)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Phát triển](#phát-triển)

## Tính năng

- **Cổng đo, không phải cảm tính.** Không có hướng dẫn thì mô hình chọn lựa chọn phổ biến nhất (font Inter, gradient
  tím, các thẻ giống hệt nhau), và mô hình tự chấm giao diện thì lệch nhiều so với người. Vì vậy design-kit chia việc:
  gì đo được thì thành phép đo trong CLI, còn thẩm mỹ để người xem trên ảnh chụp mà công cụ lưu lại.
- **26 phép đo, 6 lần render mỗi trang cộng một lần mở như điện thoại thật.** Lỗi *cứng* chặn "báo xong": trang
  trắng (cổng đợi tối đa 5 giây cho nội dung đến muộn), lỗi script chưa bắt hoặc script/stylesheet không tải được,
  trang mà điện thoại dàn rộng hơn màn hình (thiếu thẻ meta viewport), tràn ngang ở 320 px, axe-core mức
  serious/critical, chữ dưới 12 px, tiêu đề tiếng Việt có chiều cao dòng dưới 1,2, chữ tiếng Việt mà thiếu
  `lang="vi"`, hiệu ứng bỏ qua `prefers-reduced-motion`, bước thao tác không làm được, các luật slop và chất lượng của
  Impeccable. Lỗi *mềm* phải sửa hoặc ghi lý do: cỡ và chiều cao dòng chữ thân bài, độ dài dòng, font web đã nạp,
  vòng focus thiếu, bị che hoặc mất trong chế độ màu ép buộc, khung cuộn giấu nội dung, chữ bị cắt (dấu ba chấm hay
  line-clamp giấu chữ, overflow cắt ngang chữ hoặc cắt mất dấu tiếng Việt), chữ bị hộp bên cạnh vẽ đè, ô gõ chữ dưới
  16 px trên điện thoại, hơn 12 ô nhập trên một màn, dẫn đường, chữ trên trang, LCP, CLS, và trang mất CSS (hoặc vỡ
  dấu tiếng Việt) khi mở trong trình duyệt của app Claude. Khổ nào cũng được đo đủ, kể cả 320 px.
- **Nhìn được vào shadow DOM.** Card Lit và Home Assistant được đo bên trong shadow root mở, nơi engine Impeccable
  hiện không báo gì.
- **Kiểm cả mod Claude Code.** Mod vẽ bằng `ui.render` (thanh trên ô nhập, khung bên, dòng dưới một lệnh gọi
  công cụ) nên không có trang để mở. `design-kit check-mod <thư mục mod>` chạy chính test của mod qua bộ test của
  Claude Code, với một lớp chặn vẽ lại mỗi lần mount trên terminal và desktop, ở 40 tới 200 cột và mọi ngôn ngữ của
  mod. Cây terminal được dàn bằng Ink và đo trên terminal tối lẫn sáng; cây desktop thành trang cho axe và phép đo
  chữ; luật của engine được kiểm thẳng trên cây.
- **Chấm điểm logo, icon và hình minh hoạ.** `design-kit check-image <tệp|thư mục>` vẽ từng tệp SVG, PNG, JPEG,
  WebP, AVIF, GIF, ICO hay BMP trong trình duyệt ở đúng các cỡ nó được dùng, rồi chấm 0–100 kèm lý do cho từng tiêu chí: chi tiết
  mảnh hơn 1 px ở 32 và 16 px (không tính mũi nhọn), tương phản của đường viền trên nền sáng lẫn nền tối, các màu
  hoà vào nhau khi chuyển thang xám, bảng màu và chuyển sắc, cạnh thẳng lệch lưới điểm ảnh, lề và độ cân giữa trong
  khung icon, độ sắc (ảnh bị phóng to), định dạng và dung lượng tệp, vệ sinh SVG (script, chữ sống, ảnh điểm nhúng,
  tham chiếu ra ngoài, viewBox). Icon cùng thư mục được so với nhau như một bộ (nét, độ đậm, kích cỡ). Mỗi hình có
  một tờ soát: mọi cỡ, nền sáng và tối, thang xám, một màu, và chỗ chi tiết mất ở 16 px. Ngưỡng được hiệu chỉnh trên
  272 icon Lucide và có nguồn (Pelli 2006, WCAG 1.4.11, Material, Lighthouse).
- **Đo cả trạng thái sau một cú bấm.** Tệp `<trang>.steps.json` đặt cạnh trang liệt kê các trạng thái như lỗi form,
  bước 3 của trình hướng dẫn hay menu đang mở. Mỗi trạng thái là một lần nạp trang mới cộng các thao tác, rồi được đo
  đủ mọi tiêu chí.
- **Dẫn đường như phần hướng dẫn trong game.** CLI nhắc agent viết bản đồ tác vụ trước, rồi phủ mọi chỗ người dùng
  lần đầu dễ lúng túng: trình tự từng bước có tên bước kế, danh sách "Bắt đầu", mẹo đúng lúc, màn trống chỉ việc làm
  tiếp, Hoàn tác thay cho "Bạn có chắc không?". Phép đo `guide` báo nút chỉ ghi "Tiếp", màn trống không có lối đi
  tiếp, và tour tự bật khi mở trang.
- **Đọc cả chữ, và liệt kê thứ agent tự bịa.** Phép đo `copy` báo chữ đọc như AI viết mà chưa ai sửa, tiếng Việt là
  chính: cụm sáo, câu mở đầu rập khuôn, cặn hội thoại ("Chắc chắn rồi!"), chỗ trống (`[Tên công ty]`, `{{name}}`,
  lorem ipsum), dấu markdown lọt ra trang, dải 3–4 con số khoe dưới hero, tiêu đề mảnh cụt ("Nhanh. Gọn.") và liên
  kết chỉ ghi "Xem thêm". Danh sách nằm ở `data/copy-tells.json`. Dữ kiện agent tự điền (giờ mở cửa, giá, số liệu)
  gắn `data-assumed="<lý do>"` và hiện ở mục `assumed` để chủ duyệt.
- **Ba hướng, chép là dùng.** *Đêm* (ứng dụng, dashboard), *Giấy* (tài liệu, báo cáo) và *Đậm* (landing,
  marketing). Mỗi hướng là một tệp token có bản sáng và tối, kèm DESIGN.md sinh tự động. Cả 126 cặp màu đạt WCAG;
  `design-kit doi-mau` đổi sắc một hướng theo thương hiệu rồi dò lại độ sáng để mọi cặp vẫn đạt.
- **Khối mẫu đã qua cổng.** 13 khối HTML/CSS và 4 khối React + shadcn/ui, mỗi khối đã qua cổng ở 3 hướng × sáng/tối,
  và đã được xem ảnh chụp.
- **Plugin cho Claude Code.** Một skill, cùng hook nhắc agent khi sửa tệp giao diện và chặn một lần nếu agent định
  báo xong mà chưa chạy cổng.
- **Output hợp với agent.** [TOON](https://toonformat.dev/), tổng trước, mỗi trang và trạng thái một dòng phán quyết,
  `help[]` gợi ý lệnh kế, mã thoát ổn định.

## Cài đặt

Yêu cầu:

- **Node.js ≥ 20**
- **Microsoft Edge hoặc Google Chrome.** Không có cả hai thì cổng dùng Chromium của Playwright:
  `npx playwright install chromium`.
- **Engine Impeccable** (bật mặc định, bỏ qua bằng `--no-impeccable`). `design-kit setup` dùng engine đi kèm skill
  Impeccable nếu máy đã có, nếu không thì tải bản ghim (0.1.19) và kiểm sha256.

Từ bản phát hành mới nhất (không cần clone):

```bash
npm install -g https://github.com/ngoviet/design-kit/releases/download/v0.3.0/design-kit-0.3.0.tgz
design-kit setup
```

Từ mã nguồn:

```bash
git clone https://github.com/ngoviet/design-kit.git
cd design-kit
npm ci             # cài phụ thuộc và build dist/ (script prepare)
npm install -g .   # lệnh design-kit toàn cục, trỏ vào thư mục này
design-kit setup
```

`npm install -g github:ngoviet/design-kit` không chạy được: npm chạy lệnh cài bên trong ở chế độ global, nên công
cụ build không bao giờ được cài. design-kit không phát hành lên npm registry.

Plugin Claude Code (skill và hook) cài từ chính repo này, vì repo cũng là marketplace của nó. Plugin gọi CLI, nên cài
CLI trước:

```text
/plugin marketplace add ngoviet/design-kit
/plugin install design-kit@design-kit
```

## Cách dùng

```bash
design-kit                                   # kit, hướng, khối, trình duyệt, engine, lời nhắc workflow
design-kit check index.html --strict         # cổng cho một trang; thoát 1 nếu có lỗi cứng
design-kit check http://localhost:5173       # trang đang chạy trên dev server
design-kit check dist --jobs 6               # mọi tệp .html trong thư mục, 6 trang một lúc
design-kit check signup.html --steps '[{"name":"loi","do":[{"click":"button[type=submit]"}]}]'
design-kit inline bao-cao.html              # gộp stylesheet liên kết vào trang (mở được khi không có máy chủ)
design-kit check-mod plugins/session-band  # kiểm một mod Claude Code (cần cài Claude Code)
design-kit check-image brand/logo.svg icons/ # chấm một logo và một bộ icon, lưu tờ soát
```

Bắt đầu một dự án: chép DESIGN.md của hướng gần nhất vào dự án (dòng `kit:` của lệnh `design-kit` cho biết kit nằm
ở đâu), nạp `tokens/fonts-local.css`, `tokens/core.css` và tệp token của hướng đó, rồi dựng từ khối gần nhất. Mỗi
khối đổi hướng bằng `?dk=dem|giay|dam` và đổi giao diện sáng tối bằng `&theme=light|dark`.

Một trang có lỗi (rút gọn: bỏ các dòng phép đo đạt):

```text
$ design-kit check test/fixtures/loi.html --limit 4
status: "fail: 1 of 1 pages have hard failures"
renders: "light+dark × 320/390/1280 px via msedge, impeccable on"
pages[1]{page,verdict,hard,soft}:
  test/fixtures/loi.html,fail,11,10
checks[26]{check,gate,result}:
  overflow,hard,2 hard
  axe,hard,2 hard
  text-min,hard,1 hard
  …
  guide,soft,3 soft
count: 4 of 21 total
findings[4]{gate,check,where,detail,renders}:
  hard,overflow,320px,"page is 480px wide, viewport 320px",light/320 dark/320
  hard,text-min,"topo-card::shadow span.lbl \"Cổng 1 ↓ 12 Mb/s\"",font-size 9.9px,light/320 light/390 light/1280 dark/320 dark/390 dark/1280
  hard,heading-lh,"h1 \"Bảng điều khiển mạng\"",line-height 1.00,light/320 light/390 light/1280 dark/320 dark/390 dark/1280
  hard,lang,<html>,"Vietnamese text but lang=\"en\"",light/320 light/390 light/1280 dark/320 dark/390 dark/1280
help[4]: "17 more findings: add --full","Fix hard failures, then rerun the same command; soft ones need a fix or a written reason",…
```

Một khối có tệp steps (hai phán quyết: trang lúc vừa nạp, và trạng thái sau khi tắt hết bộ lọc; phát hiện mềm duy
nhất là `standalone`, vì khối liên kết tệp token theo đường dẫn):

```text
$ design-kit check blocks/html/bo-loc.html --query dk=dem
status: "pass: 2 pages (1 of them states after steps), 0 hard failures"
pages[2]{page,verdict,hard,soft}:
  blocks/html/bo-loc.html?dk=dem,pass,0,1
  blocks/html/bo-loc.html?dk=dem #tat-het,pass,0,0
```

Ảnh chụp lưu trong `.design-kit/shots/`. Hãy mở ra xem: qua cổng chưa có nghĩa là trang đã đẹp.

Trang mở thẳng từ ổ đĩa trong trình duyệt của app Claude (báo cáo, trang review) không có máy chủ phía sau: pane nạp
trang dưới dạng `data:text/html,…`, nên mọi `<link rel="stylesheet">` theo đường dẫn tương đối đều bị bỏ, trang hiện
toàn chữ Times. Phép đo `standalone` mở từng tệp cục bộ đúng như vậy và báo trang mất gì. Dựng xong thì chạy
`design-kit inline <trang.html>`: lệnh đưa `core.css`, tệp của hướng và `_base.css` vào các thẻ `<style>` ngay tại chỗ
và giữ `<link>` font làm phần bổ sung. Đừng nhúng font base64 cho trang mở trong pane: pane chỉ mở tệp tối đa 512 KiB
(524 288 byte), lớn hơn là báo "couldn't open". Font dự phòng phải có chữ Việt (hướng Giấy dùng
`"Literata", "Times New Roman", "Noto Serif", serif`): Georgia thiếu chữ Việt nên tách chữ ("Ngắ n").

Một mod Claude Code cố ý mắc lỗi (fixture `test/fixtures/mods/xau`, rút gọn):

```text
$ design-kit check-mod test/fixtures/mods/xau --widths 40,120 --limit 6
status: "fail: 9 hard finding(s) across 4 distinct drawings"
mod: xau 0.0.1 (test/fixtures/mods/xau)
renders: "terminal: Ink 6.8.0 at 40,120 columns on dark #1e1e1e and light #ffffff; desktop: HTML approximation (8px a cell) via msedge, light #faf9f5 and dark #262624"
runs[3]{run,tests,drawings,seconds}:
  default,"1 pass, 0 fail",8,1.1
  en,1 ran (expect made soft),8,0.9
  vi,1 ran (expect made soft),8,1.4
checks[15]{check,gate,result}:
  svg-source,hard,1 hard
  overflow,hard,2 hard
  contrast,hard,2 hard
  …
  svg-terminal,soft,2 soft
findings[6]{gate,check,surface,where,detail,renders}:
  hard,svg-source,desktop,"AbovePrompt › Svg alt=\"\"","no alt: a reader that cannot see it, and a surface without Svg, get nothing",40–120
  hard,motion,desktop,"AbovePrompt › Svg alt=\"\"",CSS animation with no prefers-reduced-motion rule,40–120
  hard,contrast,terminal,"AbovePrompt › \"$0.50\"","#4caf6e on #ffffff: 2.74:1, needs 4.5:1 (text); APCA Lc 52.7",light/40–120
  hard,overflow,terminal,AbovePrompt,"a line runs up to 3 cell(s) past the columns: …",40
  …
```

`runs` có một dòng cho mỗi lượt chạy: `default` giữ tuỳ chọn riêng của từng test và báo qua/hỏng; mỗi lượt ngôn ngữ
ép tuỳ chọn `language` của mod và làm `expect` mềm, vì test so chữ tiếng Anh sẽ dừng ở đó. Ảnh chụp nằm ở
`.design-kit/shots/mod-<tên>/`: mỗi ảnh terminal có khung tối và khung sáng, vạch đứt là mép phải.

Một logo cố ý mắc lỗi (`test/fixtures/hinh/logo-xau.svg`: chữ sống, thiếu viewBox, hai vòng nét 0,6 đơn vị, chuyển
sắc, đỏ cạnh xanh lá cùng độ sáng; đã rút gọn):

```text
$ design-kit check-image test/fixtures/hinh/logo-xau.svg --limit 3
status: "pass: 1 image, 0 hard failures, score 39 (poor)"
images[1]{file,kind,score,grade,hard,soft}:
  test/fixtures/hinh/logo-xau.svg,logo (file name),39,poor,0,7
scores[5]{criterion,score,weight,measured}:
  file,50,25,"SVG 1 KB: live text, no viewBox"
  small,0,30,"outline in detail finer than 1 px: 58% at 32 px, 67% at 16 px tall"
  contrast,69,20,"76% of the outline ≥ 3:1 on #ffffff (median 7.40:1); 47% of the outline ≥ 3:1 on #121212 (median 1.14:1)"
  mono,63,20,"6 touching color pair(s), weakest #d63031/#1f8a2f at 1.09:1 in grayscale"
  palette,0,5,"6 color(s) (#e17055 #d63031 #1f8a2f #6c5ce7 #1d1d35), 61% gradient/texture"
findings[3]{gate,check,detail}:
  soft,svg-text,"1 <text> element(s) (\"Công ty ABC\"): drawn with whatever font the viewer has; …"
  soft,svg-viewbox,"no viewBox (width=\"480\" height=\"160\"): as <img> it scales, but inlined as <svg> … cropped"
  soft,small-size,"58% of the outline belongs to detail finer than 1 px when the logo is 32 px tall …"
  …
```

Điểm cho biết hình chịu được việc dùng thật tới đâu; lỗi *cứng* (tệp trình duyệt không vẽ được, SVG có script, icon
gần hết mảnh hơn 1 px ở chính cỡ của nó, ảnh điểm nhỏ hơn cỡ hiển thị) chặn "báo xong" và giữ điểm không quá 49. Tờ
soát nằm ở `.design-kit/shots/images/`, mỗi hình một tờ, mỗi bộ icon một tờ `set-<thư mục>.png`: độ dễ nhận ra, ý
nghĩa và độ hợp thương hiệu được chấm bằng mắt ở đó, không chấm bằng máy.

## Lệnh

| Lệnh | Làm gì |
| --- | --- |
| `design-kit` (hoặc `home`) | Vị trí kit, các hướng, khối, trình duyệt và engine, cùng lời nhắc `workflow` |
| `design-kit check <tệp\|thư mục\|url>...` | Cổng. Thoát 0 khi đã kiểm xong (đọc `status`); `--strict` thoát 1 nếu có lỗi cứng |
| `design-kit check-mod <thư mục mod>` | Kiểm các hình mod vẽ bằng `ui.render`: test của mod được quét trên terminal và desktop, mọi bề rộng và ngôn ngữ. Cần Claude Code (`claude`, hoặc `CLAUDE_BIN`) |
| `design-kit check-image <tệp\|thư mục>...` | Chấm logo, icon và minh hoạ 0–100 từ số đo, so icon cùng thư mục như một bộ, lưu tờ soát. `--strict` thoát 1 nếu có lỗi cứng, `--min-score <n>` nếu điểm thấp |
| `design-kit inline <trang.html> [--ra <tệp-ra.html>] [--dry-run]` | Đưa stylesheet liên kết tương đối vào các thẻ `<style>` ngay tại chỗ, giữ link font, để trang mở được khi không có máy chủ |
| `design-kit setup [--download] [--no-browser]` | Tìm trình duyệt và engine Impeccable; tải engine ghim khi máy chưa có |
| `design-kit doi-mau --huong <dem\|giay\|dam> --nhan <0-360> [--trung-tinh <0-360>] --ra <tệp.css>` | Đổi sắc màu nhấn (và trung tính) theo thương hiệu; mọi cặp màu vẫn đạt WCAG |
| `design-kit kiem-mau [<tệp.css> --huong <h>]` | Kiểm mọi cặp màu theo vai trò: tương phản WCAG và gamut sRGB, cả sáng lẫn tối |

Cờ của `check`:

| Cờ | Ý nghĩa |
| --- | --- |
| `--query <q,q>` | Chạy mỗi trang một lần cho mỗi chuỗi truy vấn, ví dụ `dk=dem,dk=giay,dk=dam` |
| `--steps <tệp.json\|json>` / `--no-steps` | Các trạng thái cần bấm hay gõ để tới (thay cho `<trang>.steps.json`) / bỏ qua tệp steps |
| `--viewports <w,w>` | Bề rộng tính bằng px (mặc định `320,390,1280`; mọi khổ được đo đủ) |
| `--schemes <light,dark>` | Chế độ màu cần render (mặc định cả hai) |
| `--shots <thư mục>` / `--no-shots` | Thư mục ảnh chụp (mặc định `.design-kit/shots`) / không chụp |
| `--no-impeccable` | Bỏ qua Impeccable (nhanh hơn) |
| `--no-standalone` | Không mở tệp cục bộ dưới dạng URL `data:` (cho trang chỉ phục vụ qua http) |
| `--focus <n>` | Số điểm dừng Tab cần xem (mặc định 15) |
| `--strict` | Thoát 1 khi có trang bị lỗi cứng |
| `--jobs <n>` | Số trang kiểm cùng lúc (mặc định 3, tối đa 8) |
| `--sweep` | Đo thêm tràn ngang ở các khổ trung gian (360, 414, 480, 600, 768, 900, 1024, 1180 trong dải `--viewports`), khoảng 0,1 giây mỗi khổ |
| `--waivers <tệp>` / `--no-waivers` | Phát hiện mềm đã xét là ổn, mỗi mục kèm lý do (mặc định `.design-kit/waivers.json`, tối đa 5 mục mỗi trang; liệt kê ở mục `waived`) / hiện mọi phát hiện |
| `--no-cache` | Đo lại mọi trang. Mặc định trang cục bộ mà mọi tệp nó nạp chưa đổi kể từ lần kiểm trước (cùng cờ) dùng lại kết quả cũ |
| `--fresh` | Nạp lại trang cho mỗi khổ và mỗi chế độ màu. Mặc định trang được nạp một lần rồi đổi khổ, đổi sang tối ngay tại chỗ; một lần nạp mới mỗi trang phải cho cùng bố cục, trang nào lệch thì đo lại bằng cách nạp mới |
| `--limit <n>` / `--full` | Số phát hiện hiển thị (mặc định 25) / hiện hết |

Tệp steps là danh sách trạng thái. Mỗi trạng thái bắt đầu từ một lần nạp trang mới và chạy thao tác của riêng nó:
`click`, `fill`, `check`, `select`, `press`, `hover`, `wait`. Nút chỉ có ở một số khổ thì giới hạn trạng thái ở các
khổ đó:

```json
[
  { "name": "sap-xep", "viewports": [1280], "do": [{ "click": "button.sort[data-k='3']" }] },
  { "name": "sap-xep-hep", "viewports": [320, 390], "do": [{ "select": ["#xep", "3:descending"] }] },
  { "name": "khong-thay", "do": [{ "fill": ["#tim", "zzz"] }] }
]
```

Mã thoát: 0 đã kiểm xong các trang, 1 có lỗi cứng khi dùng `--strict` hoặc công cụ gặp lỗi (không có trình duyệt,
không thấy trang), 2 gọi sai cú pháp.

Cờ của `check-mod`:

| Cờ | Ý nghĩa |
| --- | --- |
| `--widths <n,n>` | Số cột cần quét (mặc định `40,52,64,78,100,120,160,200`): `bodyColumns` của AbovePrompt và Pane, `viewport.columns` của mọi component |
| `--surfaces <terminal,desktop>` | Surface cần vẽ (mặc định cả hai) |
| `--languages <a,b\|none>` | Các lượt ngôn ngữ ngoài lượt mặc định (mặc định: mọi giá trị của tuỳ chọn `language` trừ `auto`) |
| `--no-tests` | Bỏ test của mod: chỉ mount mỗi component với props mặc định (thường là màn trống) |
| `--pane-id <id>` | `requestId` cho Pane mà mod khớp bằng id tính lúc chạy (mặc định: tên mod) |
| `--term-bg <dark=#hex,light=#hex>` | Nền terminal để đo (mặc định `#1e1e1e` và `#ffffff`) |
| `--shots <thư mục>` / `--no-shots` | Thư mục ảnh (mặc định `.design-kit/shots/mod-<tên>`) / không chụp |
| `--strict` | Thoát 1 khi có lỗi cứng |
| `--keep` | Giữ các bản sao tạm của mod (đường dẫn ở `notes`) |

Các phép kiểm: *cứng* gồm `mount` (surface từ chối cây, nên engine vẽ bản của nó), `render`, `svg-source` (quá
131.072 ký tự hoặc thiếu `alt`), `raster-size`, `ask-rows` (cây cho AskUserQuestion quá 12 hàng terminal hay 48
hàng desktop ở 40 cột), `overflow`, `contrast` (4,5:1 cho chữ, 3:1 cho một ký hiệu đơn hay một dải ký tự khối, trên
cả hai terminal và desktop; trên desktop thành mềm khi cả hai màu là của app hay của khoá theme, thứ trang desktop chỉ
đoán được), `text-min` (desktop, chữ SVG đo theo cỡ đã vẽ), `motion` và axe; *mềm* gồm `rows` (thanh
cao hơn `maxRows`, hoặc cao lên khi hẹp), `text-cut`, `svg-terminal` (Svg trên desktop thành hộp rỗng trên terminal),
`hard-color` (màu hex không theo theme của người dùng, kèm khoá theme gần nhất) và `tests`.

Cờ của `check-image`:

| Cờ | Ý nghĩa |
| --- | --- |
| `--kind <auto\|logo\|icon\|illustration>` | Hình thuộc loại nào (mặc định: đoán theo tên tệp, rồi theo cỡ và màu; ký hiệu, biểu tượng tính là icon) |
| `--display <px>` | Cỡ hiển thị (logo: chiều cao; icon, minh hoạ: cạnh dài): ảnh điểm cần 2× tới 64 px, 1,5× trên đó (Lighthouse) |
| `--bg <light=#hex,dark=#hex>` | Nền để đo tương phản (mặc định `#ffffff` và `#121212`) |
| `--no-set` | Không so các icon trong một thư mục như một bộ |
| `--min-score <n>` | Thoát 1 khi có hình dưới n điểm |
| `--shots <thư mục>` / `--no-shots` | Thư mục tờ soát (mặc định `.design-kit/shots/images`) / không lưu |
| `--strict` | Thoát 1 nếu có lỗi cứng |

Trọng số theo loại: **logo** thu nhỏ 30, tương phản 20, thang xám 20, bảng màu 5, tệp 25 (độ phức tạp chỉ ghi, không
chấm: nghiên cứu không tìm ra mức tối ưu cho logo); **icon** thu nhỏ 20, lưới điểm 15, khung 15, tương phản 10, màu
10, độ đơn giản 10, tệp 20; **minh hoạ** độ sắc 30, độ phân giải 15 (khi có `--display`), tương phản 15, thang xám
10, tệp 30.

## Cách hoạt động

1. Tệp cục bộ được phục vụ qua `http://127.0.0.1` từ thư mục gần nhất có `.git` hoặc `package.json`, nên liên kết
   tương đối vẫn đúng. URL thì mở nguyên như vậy.
2. Mỗi trang và mỗi trạng thái được render bằng playwright-core trong Edge, rồi Chrome, rồi Chromium của Playwright,
   ở khổ 390 và 1280 px, cả sáng lẫn tối (khổ 320 px để đo tràn ngang).
3. Trong trang, axe-core chạy bộ luật WCAG 2.2 AA, và một probe đi qua DOM cùng mọi shadow root mở để đo: cỡ chữ đã
   hiển thị (chữ SVG co theo viewBox, chữ bị co bằng `transform`, `scale` hay `zoom`), chiều cao dòng, độ dài dòng tính bằng `em` (`ch` đo sai với tiếng Việt: 68ch
   chứa khoảng 93 ký tự Be Vietnam Pro), font đã nạp, focus bàn phím ở khổ rộng nhất và hẹp nhất, các mẫu dẫn đường.
   Trang được nạp lại ở chế độ giảm chuyển động để bắt hiệu ứng bỏ qua nó, còn LCP/CLS lấy từ lần nạp đầu.
4. Engine Impeccable chạy một lần mỗi trang, ở trạng thái ban đầu. Mỗi tệp cục bộ còn được mở một lần dưới dạng URL
   `data:`, đúng cách pane của app Claude mở, rồi so với bản render qua http: stylesheet và token bị mất, kích thước
   tệp, và (qua giao thức DevTools của Chromium) chữ có dấu có bị vẽ bằng font thứ hai không.
5. Mỗi phát hiện thuộc một loại: *cứng* (chặn "báo xong"), *mềm* (sửa hoặc ghi lý do) hoặc *người* (thứ bậc, thẩm mỹ
   và bản đồ tác vụ: mở ảnh chụp ra xem).

`check-mod` làm việc trên cây engine giao cho surface, vì bộ test của Claude Code chạy hook của mod nhưng không
vẽ ra điểm ảnh:

1. `claude plugin validate` cho biết mod hook những component nào; mod được chép sang thư mục tạm, dòng
   `import … from 'claude-code/testing'` trong test được trỏ sang lớp chặn, và một test chung mount mỗi component một lần.
2. `claude plugin test` chạy mỗi ngôn ngữ một lượt. Mỗi lần test gọi `$.ui.mount`, lớp chặn vẽ lại trên cả hai
   surface ở mọi bề rộng rồi in `ui.drawn()`; cây giống nhau chỉ đo một lần.
3. Cây terminal đi qua `renderToString` của Ink ở đúng số cột; khoá theme lấy màu theo theme tối và sáng mặc định của
   Claude Code (`data/claude-themes.json`, sinh lại bằng `node scripts/claude-themes.mjs`), `dimColor` vẽ bằng màu mờ
   của theme.
4. Cây desktop thành trang gần với renderer của app (8 px một ô, caption 12 px tới title 22 px, Svg tới 32 px vẽ thành
   ảnh, hình lớn hơn nhúng trong shadow root riêng), mỗi component, bề rộng và chế độ màu một trang. Trang là bản
   phỏng theo; phán quyết dựa trên thứ mod tự đặt (màu hex, cỡ chữ SVG, độ dài source, hoạt ảnh).

`check-image` đo điểm ảnh, không chấm thẩm mỹ:

1. Trình duyệt giải mã từng hình rồi vẽ lên canvas: SVG với cạnh ngắn 512 px (để nét mảnh của một wordmark 3:1 vẫn
   rộng hơn một điểm ảnh), ảnh điểm ở cỡ thật của nó, thêm cỡ gốc của icon (viewBox, 12–64 px). Mã SVG được đọc bằng
   `DOMParser`.
2. Hình dạng: tách hình khỏi nền (theo alpha; icon dạng ô gạch thì khớp một mặt phẳng màu trên dải vòng trong của ô,
   hình là phần lệch khỏi nền đó; nếu không thì theo màu viền ảnh; nếu không nữa là ảnh tràn viền), rồi
   biến đổi khoảng cách Euclid. Mở hình bằng đĩa rộng một điểm ảnh hiển thị ở 32 và 16 px sẽ xoá mọi nét, chấm, khe
   mảnh hơn thế; phần đường viền thuộc về chúng là "chi tiết mất". Mũi nhọn, vốn chỉ bị tròn đi, được nhận ra qua
   cạnh nối rộng với phần còn lại của hình. Vùng màu bên trong hình cũng được tính, nên vạch mảnh cắt ngang chiếc lá
   trắng trong hình tròn xanh vẫn bị thấy.
3. Màu: màu phẳng được gom cụm trong OKLab, chuyển sắc được nhận ra qua cách màu đổi theo khoảng cách; tương phản đo
   trên dải viền ngoài của hình với từng nền; các cặp màu chạm nhau được so chỉ bằng độ sáng.
4. Các phép đo khác: độ phức tạp chu vi (Pelli 2006), cạnh thẳng nằm giữa hai điểm ảnh ở cỡ gốc, lề và độ cân giữa
   trong khung icon, bề rộng cạnh để đo độ nhoè (Marziliano 2002), vòng an toàn của icon maskable theo W3C.

Ngưỡng, cách đo và nguồn của từng tiêu chí (chuẩn, nghiên cứu hay quy ước) nằm trong
[`docs/tieu-chi.md`](docs/tieu-chi.md); nguồn và câu trích nằm trong [`docs/nguon.md`](docs/nguon.md). Các quyết định
thiết kế và lý do nằm trong [`docs/quyet-dinh.md`](docs/quyet-dinh.md).

Bằng chứng tới nay: qua hai đợt A/B chấm mù (6 đề, cùng một mô hình, có và không có design-kit), bản mặc định có 45
lỗi cứng, bản design-kit có 0. Chủ dự án chọn bản design-kit ở 4 đề, bản mặc định ở 1 đề, và 1 đề hoà. Trang và ảnh
chụp nằm trong [`eval/`](eval/).

## Tích hợp với agent

- **Claude Code**: plugin ở trên. Skill (`skills/design-kit/SKILL.md`) tự bật khi làm giao diện và khi thiết kế quy
  trình, đăng ký, trình hướng dẫn cài đặt hay hướng dẫn người dùng mới. Skill dẫn agent qua các bước chọn hướng, viết
  bản đồ tác vụ, dựng từ khối mẫu và chạy cổng. Hai hook hỗ trợ: sau khi sửa tệp giao diện (tối đa 15 phút một lần)
  agent được nhắc chạy `design-kit check`, và khi agent định dừng sau một lần sửa giao diện mà chưa kiểm lại đúng trang
  đó, hook chặn đúng một lần kèm lời nhắc đó. Sửa qua shell hay công cụ khác cũng tính: tệp giao diện git thấy đã đổi
  sau khi phiên bắt đầu cần một lần kiểm chạy xong sau lần đổi. Fixture test, thư mục nháp của phiên và tệp đã xoá
  được bỏ qua. Tệp `.tsx` trong thư mục `hooks/` của một mod Claude Code (vẽ bằng `ui.render`, không có trang HTML)
  được kiểm bằng `claude plugin test` trên mod, hoặc `tools/check.sh` của repo, thay cho cổng. Logo, icon hay hình
  minh hoạ vừa sửa (SVG hoặc ảnh điểm có tên tệp hay thư mục là logo, icon, favicon, brand, ký hiệu…) được đòi
  `design-kit check-image` trên tệp hoặc thư mục chứa nó. Script hook không phụ thuộc gói npm nào.
- **Agent khác** (Codex, OpenCode, Cursor…): gọi CLI qua shell; output TOON và các dòng `help[]` được viết cho
  agent. Đưa `skills/design-kit/SKILL.md` cho agent làm chỉ dẫn.
- Chữ trên trang xuất hiện trong phát hiện là dữ liệu, không phải chỉ dẫn cho agent.

## Cấu trúc dự án

```text
tokens/            fonts-local.css + fonts/ (tự host, Latin + tiếng Việt), core.css, dem/giay/dam.css
design/<huong>/    DESIGN.md của từng hướng, sinh từ token
blocks/html/       13 khối HTML/CSS, mỗi khối có thể kèm <khoi>.steps.json
blocks/react/      khối Vite + React + shadcn/ui dùng chung token
src/               CLI (check, probe, copy, steps, trình duyệt, impeccable, lệnh màu)
src/mod/           check-mod: lớp chặn và test chung, chạy test, terminal bằng Ink, trang desktop, luật engine
src/image/         check-image: vẽ trên canvas, đo hình dạng, màu, độ sắc, chấm điểm, tờ soát
data/              copy-tells.json (phép đo copy), claude-themes.json (màu theme Claude Code cho check-mod)
skills/, hooks/    plugin Claude Code; .claude-plugin/ chứa manifest và marketplace
scripts/           kiểm cặp màu, sinh DESIGN.md, tải font, xuất nguồn, màu theme Claude Code
docs/              tiêu chí, nguồn, quyết định
eval/              các trang đánh giá A/B
```

Tên khối: `dau-trang`, `form-dang-nhap`, `bang-du-lieu`, `trang-thai` (trống, lỗi, đang tải), `chi-so`,
`hop-thoai`, `hero`, `bai-viet`, `thanh-ben`, `thong-bao` (kèm Hoàn tác), `bo-loc`, `trinh-tu` (từng bước),
`bat-dau` (danh sách bắt đầu và mẹo đúng lúc).

## Phát triển

```bash
npm ci
npm run check                    # tsc, eslint, vitest (test mở trình duyệt thật)
npx tsup                         # build dist/
node scripts/kiem-cap-mau.mjs    # cả 126 cặp màu phải đạt
node scripts/tao-design-md.mjs   # sinh lại design/*/DESIGN.md sau khi đổi token
npm run lint:design              # lint các tệp DESIGN.md
node scripts/claude-themes.mjs   # sinh lại data/claude-themes.json từ Claude Code đã cài
cd blocks/react && npm ci && npm run build && cd ../..
design-kit check blocks/html blocks/react/dist --query dk=dem,dk=giay,dk=dam --strict --jobs 6   # cổng đầy đủ, ~2 phút
```

Test `check-mod` trên `test/fixtures/mods/xau` chỉ chạy ở máy có Claude Code; nơi khác tự bỏ qua, trừ khi đặt
`DK_REQUIRE_CLAUDE=1`: khi ấy thiếu `claude` là test trượt. CI cài Claude Code (ghim đúng bản mà
`data/claude-themes.json` đã đọc màu, và kiểm tệp đó vẫn khớp) rồi đặt biến này. Không cần đăng nhập:
`claude plugin validate` và `claude plugin test` chạy mod ngay trên máy, không gọi model.

CI (GitHub Actions) chạy đúng các bước này trong container Playwright, một máy Linux sạch không có Edge và không có
skill Impeccable, nên cũng là phép thử kit chạy độc lập. Khối mới chỉ được gộp khi đã qua cổng ở cả 3 hướng ×
sáng/tối và đã được xem ảnh chụp. Ghi chú cho agent nằm trong [`CLAUDE.md`](CLAUDE.md).

<!-- support:start -->
## Ủng hộ dự án

<p align="center">
  <img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/banner-v2.svg" width="560" alt="Built and maintained by one person in Việt Nam">
</p>

<p align="center">Một người Việt tự xây dựng và duy trì, miễn phí và mã nguồn mở. Sự ủng hộ của bạn giúp hỗ trợ thêm thiết bị, sửa lỗi nhanh hơn và ra bản mới đều đặn.</p>

<p align="center">
  <a href="https://buymeacoffee.com/ngoviet"><img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/btn-coffee.svg" height="56" alt="Buy me a coffee"></a>
  &nbsp;
  <a href="https://github.com/sponsors/ngoviet"><img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/btn-sponsors.svg" height="56" alt="GitHub Sponsors"></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/vietqr-card.svg" width="300" alt="VietQR — MB Bank — NGO DUC VIET — 911051212">
  &nbsp;
  <img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/crypto-card.svg" width="300" alt="Crypto — BNB Smart Chain (BEP20) — 0xcbf0402b232cb24b4d998f09a4884f87b5f74750">
</p>

<p align="center"><b>Ví tiền mã hoá, chỉ gửi qua mạng BNB Smart Chain (BEP20):</b><br><code>0xcbf0402b232cb24b4d998f09a4884f87b5f74750</code></p>

<p align="center">🇻🇳 VietQR: quét bằng app ngân hàng bất kỳ, nội dung <code>Ung ho design-kit</code>. Cảm ơn bạn đã giúp dự án tiếp tục phát triển!</p>
<!-- support:end -->

## Giấy phép

[MIT](LICENSE) © Ngô Đức Việt. Font trong `tokens/fonts/` (Be Vietnam Pro, Bricolage Grotesque, Literata,
JetBrains Mono) theo [SIL Open Font License](tokens/fonts/OFL.txt). Khối React dùng thành phần của
[shadcn/ui](https://ui.shadcn.com/) (MIT). Không liên kết và không được bảo trợ bởi Impeccable, Deque (axe-core),
Google hay Anthropic; design-kit chỉ gọi công cụ và dùng định dạng của họ.
