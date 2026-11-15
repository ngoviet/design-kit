# Nguồn của bộ tiêu chí

Bản xuất từ kho tri thức (`research-hub/kb/tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun`) ngày 2026-11-15, bằng `node scripts/xuat-nguon.mjs`. **Không sửa tay**: sửa ở kho rồi xuất lại.

Mã `s…` là nguồn, `c…` là luận điểm. `docs/tieu-chi.md` trích các mã này. Câu trích đã được kiểm lại bằng `research-axi kb verify` (so với trang gốc).

## Kết luận của chủ đề

Đợt 1 (09/11) giữ nguyên: chuẩn công năng kiểm được bằng số đã rõ (WCAG 2.2 AA, CWV p75, dòng 50–75 ký tự); thẩm mỹ thì máy chỉ đo được phần sàn, người duyệt phần còn lại; nạp cho AI bằng DESIGN.md + rubric số + vòng render, đo, chụp, sửa. Đợt 2 (14/11, tối ưu design-kit 0.2.1, thử trên 51 trang của kit): (1) Phủ lỗi: cổng chỉ đo tràn ngang ở 320px nên bỏ sót chữ bị hộp bên cạnh che (khối hero của kit hiện 'Camer', '23/2'; Impeccable chạy ở 320px bắt được ô số tràn, không bắt được chữ bị che); trang thiếu meta viewport qua cổng với 0 phát hiện vì context không bật isMobile (c37–c39); ô nhập dưới 16px (3/12 trang A/B, c43) và vòng focus chỉ bằng box-shadow (2/6 trang mặc định, c44) là hai phép đo rẻ có lỗi thật. Quét khổ trung gian, text spacing, axe incomplete, định dạng số kiểu Việt, dấu khuôn mẫu chữ: ít hoặc không có lỗi thật trên kho này. (2) Tốc độ: 0,8 s trong 1,05 s mỗi lượt render là chờ cố định (c48); đổi khổ và đổi chế độ màu tại chỗ trùng hệt nạp mới trên 51/51 trang; Impeccable không phải nút cổ chai. (3) Skill và hook: SKILL.md sát ngưỡng 5.000 token giữ lại sau khi nén ngữ cảnh (c52), hook chỉ thấy Write/Edit nên sót tệp sửa qua shell hay MCP (c57). (4) Không thêm LLM chấm ảnh chụp làm cổng: VLM chấm perfect 14/15 hình hỏng (c59), chỉ nhận ra 40,7% thay đổi CSS nhỏ (c60); nó chỉ đáng dùng để xếp hạng phương án khác nhau rõ (c61). Sẽ đổi nếu: Impeccable phát hành bản sửa shadow DOM (issue 1360), kho thử có app nhiều màn hoặc trang có ảnh, WCAG 3 chốt thuật toán tương phản, hoặc CWV đổi chỉ số.

**Độ tin cậy:** medium · 2026-11-14 23:55

## Luận điểm

| Mã | Luận điểm | Nguồn | Câu trích |
| --- | --- | --- | --- |
| c1 | WCAG 2.2 SC 2.5.8 (AA): vùng bấm tối thiểu 24×24 CSS px (hoặc đủ khoảng cách); 44×44 là mức AAA 2.5.5 | s1 | “The requirement is for targets to be at least 24 by 24 CSS pixels in size.” |
| c2 | Core Web Vitals hiện hành: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1; đánh giá đạt khi cả ba đạt ở phân vị 75 | s2 | “Tools that assess Core Web Vitals compliance should consider a page passing if it meets the recommended targets at the 75th percentile for all three of the Core Web Vitals metrics.” |
| c3 | INP đã thay FID thành Core Web Vital ổn định từ 2024 | s2 | “INP became a stable Core Web Vital metric in 2024” |
| c4 | Container queries dùng container-type (inline-size/size) để tạo ngữ cảnh chứa, có đơn vị cq* | s3 | “You can create a containment context using the container-type property” |
| c5 | Không có hướng dẫn, LLM gần như luôn làm landing page với font Inter, gradient tím trên nền trắng, chuyển động tối thiểu (hội tụ phân phối) | s4 | “it will almost always conform to Inter fonts, purple gradients on white backgrounds, and minimal animations.” |
| c6 | Claude nhạy với chỉ dẫn thẩm mỹ cụ thể: nói tránh Inter/Roboto, dùng nền có không khí thì kết quả tốt lên ngay | s4 | “results improve immediately.” |
| c7 | Anthropic khuyên quy chỉ dẫn thẩm mỹ thành mã frontend cụ thể (chữ, màu, chuyển động, nền) | s4 | “The more you can map aesthetic improvements to implementable frontend code, the better Claude can execute.” |
| c8 | Tương phản chữ AA: 4,5:1 (chữ lớn 3:1), là ngưỡng cứng, không làm tròn | s5 | “4.499:1 would not meet the 4.5:1 threshold” |
| c9 | Tương phản thành phần không phải chữ (viền ô nhập, icon, trạng thái) ≥ 3:1 | s6 | “Ensure meaningful visual cues achieve 3:1 against the background.” |
| c10 | Reflow: nội dung phải dàn lại ở bề rộng 320 CSS px không cuộn ngang | s8 | “reflow when narrowed to a width equivalent to 320 CSS pixels” |
| c11 | WCAG 2.2 SC 2.4.11 (AA): phần tử đang focus không được bị che hoàn toàn (sticky header, banner) | s9 | “the component is not entirely hidden” |
| c12 | Focus Appearance (2.4.13, AAA): chỉ báo focus ít nhất bằng viền dày 2 CSS px | s10 | “solid 2 CSS pixel thick perimeter.” |
| c13 | Nên tận dụng tuỳ chọn giảm chuyển động của hệ điều hành (prefers-reduced-motion) | s11 | “Take advantage of the reduce motion feature in the user agent or operating system.” |
| c14 | DESIGN.md (Google Labs) = token YAML máy đọc + lý do bằng markdown; token là giá trị chuẩn | s12 | “The tokens are the normative values.” |
| c15 | CLI @google/design.md lint bắt tham chiếu token hỏng và kiểm tương phản WCAG, xuất JSON cho agent | s12 | “check WCAG contrast ratios” |
| c16 | DESIGN.md xuất được sang Tailwind v4 @theme và W3C DTCG | s12 | “W3C Design Tokens Format Module” |
| c17 | Đặc tả DESIGN.md còn ở phiên bản alpha | s12 | “current: "alpha"” |
| c18 | Anthropic khuyên đòi Claude đưa bằng chứng (lệnh + output hoặc ảnh chụp) khi báo xong | s13 | “ask Claude for *evidence*: the command it ran and its output, or the screenshot.” |
| c19 | Form: autocomplete=current-password cho đăng nhập, new-password cho đăng ký/đổi mật khẩu | s14 | “for a sign-in password input.” |
| c20 | Form: ô email đăng nhập dùng autocomplete=username | s14 | “For email inputs use” |
| c21 | Người rối loạn tiền đình có thể bật giảm chuyển động; CSS đọc qua prefers-reduced-motion | s15 | “Readers with vestibular motion disorders may wish to enable the reduce motion feature” |
| c22 | light-dark() là Baseline 2024, chọn màu theo color-scheme không cần media query | s16 | “Baseline 2024” |
| c23 | Độ dài dòng tối ưu cho thân bài 50–75 ký tự; WCAG 1.4.8 (AAA) ≤ 80 ký tự | s17 | “lines of text should be 80 or fewer characters” |
| c24 | Nhiều web không hỗ trợ dấu tiếng Việt; cần font có đủ dấu và chịu được dãn dòng chặt | s18 | “We often encountered websites that failed to support Vietnamese diacritics” |
| c25 | Thang chữ co giãn: định nghĩa thang cho màn nhỏ và màn lớn rồi nội suy | s19 | “Define a type scale for a small screen” |
| c26 | Bộ đánh giá UI bằng LLM hiện chưa bằng người chấm; ví dụ mẫu few-shot + nhắc bằng hình tăng 55% chất lượng phản hồi | s20 | “current LLM-based techniques do not yet match the performance of human evaluators.” |
| c27 | Ngay cả VLM mạnh nhất cũng khó tự cải thiện đều qua nhiều vòng; chuyên gia thích agent chủ động hỏi hơn nhận phản hồi thụ động | s21 | “even the most capable models struggle to accurately interpret sketches and formulate effective questions that lead to steady improvement.” |
| c28 | Phản hồi tự động (trình biên dịch + mô hình đa phương thức) giúp LLM sinh mã UI tốt hơn | s22 | “we explore the use of automated feedback (compilers and multi-modal models) to guide LLMs to generate high-quality UI code.” |
| c29 | Wizard (từng bước) hợp với quy trình người dùng chỉ làm thỉnh thoảng | s25 | “wizards work well for processes that are performed only occasionally.” |
| c30 | Rủi ro của wizard: người dùng mất ngữ cảnh, không biết còn bao nhiêu bước; nên hiện danh sách các bước với nhãn ngắn mô tả | s25 | “there is danger that users will miss the context, get confused, or not realize how long the progression will be.” |
| c31 | Nút 'Tiếp'/'Trước' chung chung có ít thông tin; nên ghi rõ bước kế tiếp | s25 | “Generic labels such as Next and Previous have weak information scent” |
| c32 | Hướng dẫn kiểu lật thẻ ở đầu app không cải thiện hiệu quả làm việc | s26 | “tutorials didn’t improve task performance” |
| c33 | Hiện mẹo đúng ngữ cảnh hiệu quả hơn hướng dẫn giải thích giao diện từ đầu, vì người dùng không nhớ nhiều thông tin | s26 | “it’s often more effective to train users by showing them tips in context” |
| c34 | Bỏ qua hướng dẫn mở đầu khi có thể; nếu có thì cho phép bỏ qua và có chỉ báo tiến độ | s26 | “Skip Onboarding Whenever Possible” |
| c35 | Progressive disclosure: dời tính năng nâng cao hoặc ít dùng sang lớp thứ hai, giúp dễ học và ít lỗi | s27 | “Progressive disclosure defers advanced or rarely used features to a secondary screen, making applications easier to learn and less error-prone.” |
| c36 | Game tốt cho thông tin 'đúng lúc' và 'khi cần' (just in time, on demand) thay vì sách hướng dẫn đọc trước (Gee) | s28 | “information ‘on demand’ and ‘just in time,’” |
| c37 | Trang web do MLLM sinh: 68% có ít nhất một lỗi tương thích giữa trình duyệt và thiết bị (WebCompat: 2.032 mẫu, 8 công cụ AI, 9 tổ hợp) | s62 | “68% of generated webpages exhibit at least one compatibility issue” |
| c38 | Nguyên nhân mã hàng đầu của lỗi tương thích ở trang do AI sinh là thiếu thẻ meta viewport (46%), kế đến thiếu flex-wrap (29,5%) | s69 | “The dominant causes are missing viewport meta (46%) and missing flexible wrapping (29.5%)” |
| c39 | Playwright chỉ tính đến thẻ meta viewport khi context bật isMobile | s49 | “Whether the `meta viewport` tag is taken into account and touch events are enabled.” |
| c40 | Kiểm tay ở các khổ do công cụ gợi ý chỉ thấy 66–81% lỗi bố cục responsive mà quét cả dải bề rộng tìm ra (ReDeCheck, 26 trang thật) | s70 | “detects only between 66 and 81% of the RLFs” |
| c41 | WCAG 1.4.10: dàn lại nội dung không bị coi là mất thông tin chừng nào người dùng còn xem được nội dung | s8 | “Neither adjusting or relocating content is considered a loss of information or functionality, so long as users are still able to access the content.” |
| c42 | taste-skill 2.5.1 thêm phép đo collide (chữ đè chữ, đè ảnh, nút hay thẻ của mục khác) và tap-size | s30 | “The checker gains `collide` (words over words, over another section's picture, button or card” |
| c43 | WebKit iOS phóng to khi focus ô nhập theo tỉ lệ 16 chia cỡ chữ và bỏ qua khi thay đổi dưới 10%: ô nhập từ khoảng 14,5px trở xuống bị phóng, gây tràn ngang trên trang responsive | s66 | “since even a slight zoom causes horizontal overflow on responsive pages.” |
| c44 | Ở chế độ forced-colors (Windows High Contrast), box-shadow bị ép về none: vòng focus chỉ làm bằng box-shadow sẽ biến mất | s65 | “box-shadow is forced to 'none'” |
| c45 | axe-core trả incomplete (cần người xem) cho color-contrast khi nền là ảnh hoặc gradient | s64 | “Element's background color could not be determined due to a background gradient” |
| c46 | Theo Deque, axe-core tự động tìm được trung bình 57% vấn đề WCAG | s71 | “on average 57% of WCAG issues automatically” |
| c47 | WCAG 1.4.12: khi người dùng tăng giãn dòng, giãn chữ, giãn từ, giãn đoạn thì nội dung không được mất | s7 | “without loss of content or functionality” |
| c48 | Playwright khuyên không dùng networkidle để chờ trang sẵn sàng | s49 | “Don't use this method for testing, rely on web assertions to assess readiness instead.” |
| c49 | Playwright cảnh báo nhiều trang không tính đến việc đổi kích thước, nên đặt viewport trước khi nạp trang | s50 | “A lot of websites don't expect phones to change size, so you should set the viewport size before navigating to the page.” |
| c50 | axe-core trước 4.14.0 bỏ qua lặng lẽ phép đo color-contrast khi màu tính toán có thành phần none (CSS Color 4) | s53 | “the color parser fails and the color-contrast check is silently skipped for those nodes” |
| c51 | Chromatic TurboSnap chỉ kiểm lại story bị ảnh hưởng, xác định bằng đồ thị phụ thuộc của bundler cộng thay đổi git | s54 | “Using the dependency graph generated by Webpack or Vite, TurboSnap identifies the individual story files affected by those git-identified changes.” |
| c52 | Sau khi nén ngữ cảnh, Claude Code chỉ gắn lại 5.000 token đầu của mỗi skill đã gọi | s44 | “keeping the first 5,000 tokens of each” |
| c53 | Trong danh sách skill của Claude Code, description cộng when_to_use bị cắt ở 1.536 ký tự | s44 | “truncated at 1,536 characters in the skill listing” |
| c54 | Anthropic khuyên viết bài đánh giá skill trước khi viết tài liệu dài, và giữ thân SKILL.md dưới 500 dòng | s43 | “Create evaluations BEFORE writing extensive documentation.” |
| c55 | Trong đánh giá agent của Vercel, 56% ca skill không hề được gọi | s46 | “In 56% of eval cases, the skill was never invoked.” |
| c56 | SkillsBench: skill tập trung tối đa ba mô-đun cho kết quả tốt hơn gói lớn hay gói đầy đủ | s47 | “Focused Skills with at most three modules outperform larger or exhaustive bundles” |
| c57 | Hook thiết kế của Impeccable từng không quét gì trong khoảng nửa số phiên Codex vì tệp được ghi qua shell; bản 4.9.0 chuyển sang kiểm mọi tệp UI đổi từ đầu phiên | s33 | “used to scan nothing in about half of sessions” |
| c58 | taste-skill ghi báo nhầm vào tệp miễn trừ kèm lý do, tối đa năm mục | s30 | “A FAIL judged false is waived in `.taste-skill/waivers.json` with its reason (five at most)” |
| c59 | VLM đọc ảnh chụp chấm perfect cho 14 trên 15 hình hỏng bố cục nhìn thấy được, vì ảnh chụp che mất lỗi | s40 | “rates 14 of 15 visibly broken figures” |
| c60 | DiffSpot: VLM tốt nhất chỉ nhận ra 40,7% thay đổi CSS thật giữa hai ảnh trang web (13 mô hình, 4.400 cặp) | s41 | “even the best model identifies only” |
| c61 | ArtifactsBench: MLLM chấm theo checklist trên nhiều ảnh chụp đạt 94,4% nhất quán thứ hạng với WebDev Arena | s38 | “94.4% ranking consistency with WebDev Arena” |
| c62 | Vòng render, VLM phê bình, sửa mã tăng chất lượng trang tới 17,8% qua ba vòng | s42 | “achieving up to 17.8% increase in performance over three refinement cycles” |
| c63 | MLLM (GPT-4o, Claude, Llama, 30 giao diện) gần với sở thích của người ở vài chiều nhưng lệch ở chiều khác | s39 | “MLLMs approximate human preferences on some dimensions but diverge on others” |
| c64 | Tác giả Impeccable xác nhận bước chạy luật chỉ đi qua light DOM; bản sửa shadow DOM ra sau bản 4.9.0 | s29, s72 | “the rule pass walks only the light document” “the rule pass walks only the light document” |
| c65 | Engine Impeccable hiện hành trên nhánh main là 0.1.24 | s34 | “0.1.24” |
| c66 | Anthropic: phong cách mặc định của Opus 4.8 (nền kem, chữ serif, điểm nhấn đất nung) rất bền, lệnh cấm chung chung chỉ đổi sang một bảng màu cố định khác | s35 | “This default is persistent.” |
| c67 | Skill frontend-design của Anthropic liệt kê dấu hiệu khuôn mẫu: nhãn viết hoa giãn chữ trên mọi tiêu đề, chuỗi nối bằng dấu chấm giữa | s32 | “a tracked-out ALL-CAPS eyebrow label above every heading; meta strings joined with middle dots” |
| c68 | Vercel Web Interface Guidelines có luật đo được trên trang, ví dụ không dùng transition: all | s31 | “Never `transition: all`—list properties explicitly” |
| c69 | @google/design.md 0.4.0 thêm khoá omitted để tắt cảnh báo lint cho hạng mục cố ý bỏ | s36 | “Optional omitted frontmatter key suppresses linter warnings.” |
| c70 | @shadcn/lint là linter hướng tới agent: luật design system mà agent tự kiểm được | s37 | “Write design system rules that agents can verify.” |
| c71 | CLDR locale vi: dấu thập phân là dấu phẩy | s55 | “"decimal": ","” |
| c72 | Điểm Core Web Vitals ổn định không đổi khi CrUX thêm số liệu soft navigation thử nghiệm | s57 | “stable Core Web Vitals scores remain unchanged” |
| c73 | Total Blocking Time đo được trong lab và là chỉ số thay thế cho INP | s2 | “the Total Blocking Time (TBT) metric is lab-measurable and is a proxy for INP” |
| c74 | :user-invalid đã là Baseline Widely available | s60 | “Widely available” |
| c75 | Google Fonts yêu cầu ascender của font bằng chiều cao chữ Ắ (U+1EAE), tức chỉ số dọc phải chứa được dấu chồng tiếng Việt | s58 | “(typo/hhea)Ascender be equal to Abreveacute U+1EAE” |
| c76 | Tiếng Việt ngắt dòng giữa các âm tiết: dấu cách ngăn âm tiết chứ không ngăn từ | s59 | “Line breaking can occur between syllables.” |
| c77 | Tệp ngữ cảnh kiểu AGENTS.md: chỉ dẫn được agent làm theo tốt, còn phần tổng quan repo thì không giúp | s48 | “repository overviews, although popular and recommended by model providers, are not helpful” |
| c78 | Quy tắc bỏ qua phóng to khi tỉ lệ đổi dưới 10% được thêm vào nhánh main của WebKit ngày 13/11/2026, để sửa lỗi phóng to thừa ở ô mật khẩu của bsky.app; test kèm theo: ô 15px không còn bị phóng, ô 14px vẫn bị | s73 | “bsky.app: Unnecessary subtle zoom in when focusing login password field” |

## Nguồn

| Mã | Loại | Tiêu đề | Ghi chú |
| --- | --- | --- | --- |
| s1 | web | [Understanding Target Size (Minimum)](https://raw.githubusercontent.com/w3c/wcag/main/understanding/22/target-size-minimum.html) | W3C WCAG Understanding 2.5.8 (repo chính thức w3c/wcag) |
| s2 | web | [vitals](https://web.dev/articles/vitals) | Google web.dev, Philip Walton — định nghĩa chính thức CWV \| Google web.dev, định nghĩa chính thức CWV (đã có là s2; lưu lại để trích câu về TBT) |
| s3 | doc | [CSS container queries - CSS \| MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) | MDN, tài liệu chuẩn |
| s4 | web | [Improving frontend design through Skills](https://www.claude.com/blog/improving-frontend-design-through-skills) | Anthropic — blog chính thức về skill frontend-design |
| s5 | web | [Understanding Contrast (Minimum)](https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/contrast-minimum.html) | W3C WCAG Understanding 1.4.3 |
| s6 | web | [Understanding Non-text Contrast](https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/non-text-contrast.html) | W3C WCAG Understanding 1.4.11 |
| s7 | web | [Understanding Text Spacing](https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/text-spacing.html) | W3C WCAG Understanding 1.4.12 |
| s8 | web | [Understanding Reflow](https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/reflow.html) | W3C WCAG Understanding 1.4.10 |
| s9 | web | [Understanding Focus Not Obscured (Minimum)](https://raw.githubusercontent.com/w3c/wcag/main/understanding/22/focus-not-obscured-minimum.html) | W3C WCAG Understanding 2.4.11 (mới ở 2.2) |
| s10 | web | [Understanding Focus Appearance](https://raw.githubusercontent.com/w3c/wcag/main/understanding/22/focus-appearance.html) | W3C WCAG Understanding 2.4.13 (AAA) |
| s11 | web | [Understanding Animation from Interactions](https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/animation-from-interactions.html) | W3C WCAG Understanding 2.3.3 (AAA) |
| s12 | repo | [GitHub - google-labs-code/design.md: A format specification for describing a visual identity to coding agents. DESIGN.md gives agents a persistent, structured understanding of a design system.](https://github.com/google-labs-code/design.md) | Google Labs, repo đặc tả chính thức DESIGN.md (bên tạo chuẩn) |
| s13 | doc | [best-practices](https://code.claude.com/docs/en/best-practices) | Anthropic, tài liệu chính thức Claude Code |
| s14 | web | [sign-in-form-best-practices](https://web.dev/articles/sign-in-form-best-practices) | Google web.dev, Sam Dutton — hướng dẫn chính thức form đăng nhập |
| s15 | doc | [prefers-reduced-motion CSS media feature - CSS \| MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) | MDN |
| s16 | doc | [light-dark() CSS function - CSS \| MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) | MDN |
| s17 | web | [Readability: The Optimal Line Length – Baymard](https://baymard.com/blog/line-length-readability) | Baymard Institute — viện nghiên cứu UX, có test người dùng |
| s18 | web | [Home \| Vietnamese Typography](https://vietnamesetypography.com/) | Donny Trương — sách điện tử Vietnamese Typography (chuyên gia chữ Việt) |
| s19 | web | [Designing with fluid type scales](https://utopia.fyi/blog/designing-with-fluid-type-scales) | Utopia (Clearleft) — phương pháp thang chữ co giãn |
| s20 | paper | [UICrit: Enhancing Automated Design Evaluation with a UICritique Dataset](https://arxiv.org/abs/2407.08850) | Duan et al. 2024 (Google/Berkeley), UIST — bộ dữ liệu phê bình UI |
| s21 | paper | [Sketch2Code: Evaluating Vision-Language Models for Interactive Web Design Prototyping](https://arxiv.org/abs/2410.16232) | Li, Zhang, Yang (Stanford) 2024 — benchmark VLM làm web |
| s22 | paper | [UICoder: Finetuning Large Language Models to Generate User Interface Code through Automated Feedback](https://arxiv.org/abs/2406.07739) | Wu et al. (Apple) 2024 — tinh chỉnh LLM bằng phản hồi tự động |
| s23 | doc | [Page Not Found - Apple Developer](https://developer.apple.com/support/terms/apple-design-resources/) | Apple — điều khoản Apple Design Resources (văn bản pháp lý gốc) |
| s24 | web | [Grids & spacing – Material Design 3](https://m3.material.io/foundations/layout/understanding-layout/spacing) | Google Material 3 — tài liệu chính thức |
| s25 | web | [Wizards: Definition and Design Recommendations](https://www.nngroup.com/articles/wizards/) | Nielsen Norman Group — nghiên cứu UX, tài liệu hướng dẫn |
| s26 | web | [Mobile-App Onboarding: An Analysis of Components and Techniques](https://www.nngroup.com/articles/mobile-app-onboarding/) | Nielsen Norman Group |
| s27 | web | [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Nielsen Norman Group, Jakob Nielsen 2006 |
| s28 | web | [James Paul Gee - Wikipedia](https://en.wikipedia.org/wiki/James_Paul_Gee) | Wikipedia — nguồn thứ cấp tóm tắt nguyên tắc học qua game của James Paul Gee (bài gốc 2005 không truy cập được: sagepub timeout, researchgate 403) |
| s29 | repo | [[Bug] detect: findings inside open shadow roots are never reported (Lit / Home Assistant cards look clean) · Issue #1360 · pbakaus/impeccable](https://github.com/pbakaus/impeccable/issues/1360) | Issue do chủ design-kit (ngoviet) báo; tác giả Impeccable (pbakaus) trả lời xác nhận. Nguồn sơ cấp về trạng thái lỗi shadow DOM |
| s30 | web | [Changelog](https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/CHANGELOG.md) | taste-skill (MIT), nhật ký thay đổi của chính tác giả; số đo do họ tự báo, chưa tự chạy |
| s31 | web | [command.md](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) | Vercel Web Interface Guidelines, bản lệnh cho agent (MIT); là quy ước của một công ty, không phải chuẩn |
| s32 | web | [SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md) | Anthropic, skill frontend-design chính thức (bản viết lại 09/2026) |
| s33 | repo | [Release Skill 4.9.0 · pbakaus/impeccable](https://github.com/pbakaus/impeccable/releases/tag/skill-v4.9.0) | Impeccable, ghi chú phát hành skill 4.9.0 (tác giả pbakaus) |
| s34 | web | [ENGINE_VERSION](https://raw.githubusercontent.com/pbakaus/impeccable/main/ENGINE_VERSION) | Impeccable, tệp ghim phiên bản engine hiện hành trên nhánh main |
| s35 | doc | [Prompting Claude Opus 4.8](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8.md) | Anthropic, hướng dẫn prompt chính thức cho Opus 4.8 (mục thiết kế và frontend) |
| s36 | repo | [Release 0.4.0 · google-labs-code/design.md](https://github.com/google-labs-code/design.md/releases/tag/0.4.0) | Google Labs, ghi chú phát hành @google/design.md 0.4.0 |
| s37 | repo | [GitHub - shadcn-ui/lint: An agent-first linter for Tailwind design systems. Write design system rules that agents can verify.](https://github.com/shadcn-ui/lint) | shadcn, README của @shadcn/lint (lint tĩnh cho design system, hướng tới agent) |
| s38 | paper | [ArtifactsBench: Bridging the Visual-Interactive Gap in LLM Code Generation Evaluation](https://arxiv.org/abs/2507.04952) | ArtifactsBench, Tencent, preprint 2025; tác giả là bên làm benchmark |
| s39 | paper | [MLLM as a UI Judge: Benchmarking Multimodal LLMs for Predicting Human Perception of User Interfaces](https://arxiv.org/abs/2510.08783) | MLLM as a UI Judge, preprint 10/2025, 30 giao diện |
| s40 | paper | [Interaction Scaling: Grounding the Third Axis of Test-Time Compute](https://arxiv.org/abs/2607.11598) | Preprint 07/2026 về VLM chấm hình bị lỗi bố cục; mẫu nhỏ |
| s41 | paper | [DiffSpot: Can VLMs Spot Fine-Grained Visual Differences in Web Interfaces?](https://arxiv.org/abs/2605.29615) | DiffSpot, preprint 05/2026: VLM phát hiện thay đổi CSS nhỏ giữa hai ảnh trang web |
| s42 | paper | [Vision-Guided Iterative Refinement for Frontend Code Generation](https://arxiv.org/abs/2604.05839) | Preprint 04/2026 (workshop ICLR 2026): vòng render, VLM phê bình, sửa mã cho trang web |
| s43 | doc | [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | Anthropic, tài liệu chính thức: cách viết skill |
| s44 | doc | [skills](https://code.claude.com/docs/en/skills) | Anthropic, tài liệu Claude Code về skill (giới hạn mô tả, sau khi nén ngữ cảnh) |
| s45 | doc | [hooks](https://code.claude.com/docs/en/hooks) | Anthropic, tài liệu tham chiếu hook của Claude Code |
| s46 | web | [agents-md-outperforms-skills-in-our-agent-evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) | Vercel, blog 27/01/2026; một nhà cung cấp, bộ tác vụ Next.js, không bình duyệt |
| s47 | paper | [SkillsBench: Benchmarking How Well Agent Skills Work Across Diverse Tasks](https://arxiv.org/abs/2602.12670) | SkillsBench, preprint 02/2026 |
| s48 | paper | [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/abs/2602.11988) | Đánh giá tệp ngữ cảnh kiểu AGENTS.md, ICLR 2026; đo trên tác vụ Python, không phải giao diện |
| s49 | doc | [Matches <span>](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/api/params.md) | Playwright, tài liệu tham số API (nhánh main), mục waitUntil |
| s50 | doc | [class: Page](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/api/class-page.md) | Playwright, tài liệu lớp Page (emulateMedia, setViewportSize) |
| s51 | web | [Axe JavaScript Accessibility API](https://raw.githubusercontent.com/dequelabs/axe-core/develop/doc/API.md) | Deque, tài liệu API của axe-core (nhánh develop), mục hiệu năng |
| s52 | web | [Changelog](https://raw.githubusercontent.com/dequelabs/axe-core/develop/CHANGELOG.md) | Deque, nhật ký thay đổi axe-core |
| s53 | repo | [color-contrast silently skipped when computed colors contain CSS Color 4 `none` components · Issue #5309 · dequelabs/axe-core](https://github.com/dequelabs/axe-core/issues/5309) | Issue axe-core về màu OKLCH có thành phần none làm color-contrast bị bỏ qua lặng lẽ |
| s54 | doc | [Introduction to TurboSnap • Chromatic docs](https://www.chromatic.com/docs/turbosnap/) | Chromatic, tài liệu TurboSnap: chỉ kiểm lại story bị ảnh hưởng |
| s55 | web | [numbers.json](https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-numbers-full/main/vi/numbers.json) | Unicode CLDR, dữ liệu định dạng số của locale vi (nguồn sơ cấp) |
| s56 | web | [ca-gregorian.json](https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-dates-full/main/vi/ca-gregorian.json) | Unicode CLDR, dữ liệu ngày giờ của locale vi (nguồn sơ cấp) |
| s57 | web | [crux-experimental-soft-navs](https://web.dev/blog/crux-experimental-soft-navs) | Google web.dev, 13/10/2026: số liệu soft navigation thử nghiệm trong CrUX |
| s58 | web | [Google Fonts](https://googlefonts.github.io/gf-guide/metrics.html) | Google Fonts, hướng dẫn chỉ số dọc cho font (chính sách nhận font, có nói về dấu tiếng Việt) |
| s59 | web | [Line and word breaking - Globalization \| Microsoft Learn](https://learn.microsoft.com/en-us/globalization/fonts-layout/line-and-word-breaking) | Microsoft Learn, tài liệu toàn cầu hoá: ngắt dòng, có nói tiếng Việt |
| s60 | doc | [:user-invalid CSS pseudo-class - CSS \| MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid) | MDN, :user-invalid (trạng thái Baseline) |
| s61 | doc | [@starting-style CSS at-rule - CSS \| MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style) | MDN, @starting-style (trạng thái Baseline) |
| s62 | paper | [Does It Render Everywhere? A Study of Cross-Environment Compatibility in MLLM-Generated Webpages](https://arxiv.org/abs/2608.12518) | Preprint 08/2026: lỗi tương thích trình duyệt và thiết bị của trang web do công cụ AI sinh |
| s63 | doc | [Emulation \| Playwright](https://playwright.dev/docs/emulation) | Playwright, tài liệu mô phỏng thiết bị (isMobile, hasTouch, forcedColors) |
| s64 | web | [_template.json](https://raw.githubusercontent.com/dequelabs/axe-core/develop/locales/_template.json) | Deque, bảng thông điệp của axe-core: các lý do trả incomplete |
| s65 | doc | [forced-colors CSS media feature - CSS \| MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors) | MDN, forced-colors |
| s66 | web | [WKWebViewIOS.mm](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebKit/UIProcess/API/ios/WKWebViewIOS.mm) | Mã nguồn WebKit iOS: phóng to khi focus ô nhập chữ nhỏ |
| s67 | paper | [Accessibility Metatesting: Comparing Nine Testing Tools](https://arxiv.org/abs/2304.07591) | Pool 2023, so 9 công cụ kiểm accessibility trên 121 trang |
| s68 | web | [unsized-images.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/unsized-images.js) | Lighthouse, mã audit ảnh thiếu kích thước |
| s69 | paper | [Does It Render Everywhere? A Study of Cross-Environment Compatibility in MLLM-Generated Webpages](https://arxiv.org/html/2608.12518v1) | Bản HTML toàn văn của bài WebCompat (s62), dùng để trích câu trong thân bài |
| s70 | paper | [Automated Layout Failure Detection for Responsive Web Pages without an Explicit Oracle (ReDeCheck)](https://philmcminn.com/publications/walsh2017.pdf) | Walsh, Kapfhammer, McMinn, ISSTA 2017, bản PDF của tác giả. research-axi không đọc PDF: câu trích đã kiểm tay bằng pdftotext ngày 14/11/2026 (chữ fi, Th mất do ligature) |
| s71 | web | [axe-core](https://raw.githubusercontent.com/dequelabs/axe-core/develop/README.md) | Deque, README của axe-core (bên bán công cụ tự nêu độ phủ) |
| s72 | repo | [comments](https://api.github.com/repos/pbakaus/impeccable/issues/1360/comments) | GitHub API: các bình luận của issue #1360 (trang HTML của issue không trả phần bình luận cho trình đọc) |
| s73 | repo | [bsky.app: Unnecessary subtle zoom in when focusing login password field · WebKit/WebKit@b2bcd4f](https://github.com/WebKit/WebKit/commit/b2bcd4fa11f8985f68b5cb54bc14c38bac357c5d) | Commit WebKit 13/11/2026 thêm quy tắc bỏ qua phóng to khi tỉ lệ đổi dưới 10% (WKWebViewIOS.mm); chưa có trong bản iOS nào đã phát hành |
