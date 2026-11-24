# Nguồn của bộ tiêu chí

Bản xuất từ kho tri thức (`research-hub/kb/tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun`) ngày 2026-11-24, bằng `node scripts/xuat-nguon.mjs`. **Không sửa tay**: sửa ở kho rồi xuất lại.

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
| c79 | Logo dễ được nhận lại đúng nên rất tự nhiên, rất hài hoà và phức tạp vừa phải (195 logo, 13 đặc điểm thiết kế) | s74 | “should be very natural, very harmonious, and moderately elaborate” |
| c80 | Logo tạo ấn tượng chuyên nghiệp, tích cực phải phức tạp vừa phải và tự nhiên; logo quá đơn giản hay quá rườm đều kém | s74 | “must be moderately elaborate and natural” |
| c81 | Logo đơn giản lợi về nhận biết ngắn hạn, logo phức tạp được lợi hơn khi tiếp xúc lặp lại (dài hạn) | s75 |  |
| c82 | Mẫu trừu tượng: nén GIF của ảnh tương phản RMS tương quan r = .634 với độ phức tạp, đối xứng gương r = −.578; gộp hai yếu tố đạt r = .823 | s76 | “RMSGIF exhibits the highest correlation with visual complexity of r = .634” |
| c83 | Độ phức tạp chu vi (p²/a, chưa chia 4π) theo Pelli 2006: 2×3 Checkers 28, Bold Bookman 57, Sloan 65, Helvetica 67, Hebrew 90, Devanagari 99, Courier 100, Armenian 106, Bookman 107, Arabic 137, Bookman hoa 139, Chinese 199, Künstler 451; hiệu suất ≈ 9 / độ phức tạp (R² = 0,95) | s77 |  |
| c84 | Watson 2012 chuẩn hoá độ phức tạp chu vi bằng cách chia thêm 4π (hình tròn = 1) | s78 | “It is defined as the sum of inside and outside perimeters of the foreground, squared, divided by the foreground area, divided by” |
| c85 | Độ phức tạp chu vi tính trên ảnh điểm ảnh bị thổi phồng do viền răng cưa (ví dụ hình tròn lấy mẫu cao hơn 62%), nên phải làm mờ theo thị lực trước khi đo | s78 | “we find that it is 62% too large relative to the continuous shape” |
| c86 | Không thể so độ phức tạp tương đối giữa hai hình nếu không chỉ định khoảng cách nhìn (mặc định Watson: 48 điểm ảnh/độ) | s78 | “even the relative complexity of different shapes cannot be known without specifying the viewing distance” |
| c87 | Độ lệch tâm khối (DCM, trọng tâm điểm ảnh tối so với tâm hình) dự đoán điểm cân bằng tốt hơn APB (r = −0,822 so với −0,784), nhưng dự đoán độ thích chỉ yếu (khoảng −0,3) | s79 | “DCM scores accounted better for balance ratings than APB scores” |
| c88 | Khi tìm tệp, icon phức tạp không hơn gì hình chữ nhật trơn; icon đơn giản (phân biệt được bằng vài đặc điểm) giúp người dùng | s80 | “complex icons are no better than simple rectangles” |
| c89 | Material: icon hệ thống 24×24 dp, nội dung trong vùng sống 20×20 dp, đệm 2 dp; vùng chạm 48 dp | s81 | “Icon content is limited to the 20dp x 20dp live area, with 2dp of padding around the perimeter.” |
| c90 | Material: nét icon hệ thống dày đều 2 dp, góc bo 2 dp mặc định; tránh nét mảnh | s81 | “System icons use a consistent stroke width of 2dp, including curves, angles, and both interior and exterior strokes.” |
| c91 | Material 3: icon chuẩn 24 dp, hỗ trợ thêm 20, 40, 48 dp | s82 | “Supported icon sizes: 20dp, 24dp, 40dp, and 48dp” |
| c92 | Apple HIG: icon giao diện phải đơn giản hoá cao, nét dày đều giữa các icon, dùng vector PDF hoặc SVG | s83 | “Create a recognizable, highly simplified design.” |
| c93 | Apple HIG: icon ứng dụng 1024×1024 px; chỉ đưa chữ vào icon khi thật cần, vì chữ nhỏ khó đọc và làm rối | s84 | “Include text only when it's essential to your experience or brand.” |
| c94 | Fluent 2: dưới 48 px icon phải giảm chi tiết; dùng đúng cỡ đã vẽ thay vì co giãn; icon có màu chỉ dùng một màu | s85 | “As the product icons scale below 48 pixels, they simplify in detail in favor of readability.” |
| c95 | Carbon v10: icon vẽ trên khung 32 px, đệm 2 px, toạ độ nguyên điểm ảnh, nét phải expand | s86 | “32 px icons should have 2 px padding.” |
| c96 | Carbon: icon luôn một màu đặc và phải đạt tương phản như chữ 4,5:1; vùng chạm icon ≥ 44 px; cỡ 16/20/24/32 px | s87 | “Icons are always a solid, monochromatic color and need to pass the same color contrast ratio as typography (4.5:1).” |
| c97 | Android adaptive icon: lớp 108×108 dp, vùng an toàn 66×66 dp không bao giờ bị cắt; logo ≥ 48×48 dp và ≤ 66×66 dp | s88 | “Use a logo that's at least 48x48 dp. It must not exceed 66x66 dp” |
| c98 | Icon maskable (W3C): vùng an toàn là hình tròn ở giữa, bán kính 2/5 (40%) cạnh ngắn của icon | s90 | “with radius 2/5 (40%) of the minimum of the icon's width and height” |
| c99 | web.dev: phần quan trọng của icon maskable nằm trong hình tròn bán kính 40% bề rộng; 10% mép ngoài có thể bị cắt | s89 | “The outer 10% edge might be cropped on some platforms.” |
| c100 | Chromium cần manifest có ít nhất icon 192×192 và 512×512 px | s92 | “you must provide at least a 192x192 pixel icon and a 512x512 pixel icon” |
| c101 | Google Search: favicon phải vuông, tối thiểu 8×8 px, nên lớn hơn 48×48 px | s91 | “Your favicon must be a square (1:1 aspect ratio) that's at least 8x8px.” |
| c102 | Apple (tài liệu Safari cũ): apple-touch-icon cho iPhone retina là 180×180 px | s93 | “180x180” |
| c103 | WCAG 1.4.11: icon một màu là một đối tượng đồ hoạ, phải đạt 3:1 nếu cần để hiểu nội dung | s6 | “For simple graphics such as single-color icons the entire image is a graphical object.” |
| c104 | WCAG 1.4.11: logo được miễn yêu cầu tương phản (nhưng khi logo là nút/liên kết nên chọn bản đủ tương phản) | s6 | “Logos are exempted from contrast requirements” |
| c105 | WCAG 1.4.3: chữ nằm trong logo hay logotype được miễn yêu cầu tương phản | s5 | “Text used as part of a logo or logotype is exempted from contrast requirements” |
| c106 | NHS: logo trên màn hình tối thiểu cao 30 px; vùng trống quanh logo bằng nửa chiều cao logo; có bản đảo trắng trên nền xanh | s94 | “The minimum size that the NHS logo can appear in digital applications is 30px high.” |
| c107 | Logo không được dựa vào màu để tạo thứ bậc; phải còn rõ khi chuyển đen trắng và khi thu nhỏ | s95 | “A logo shouldn't rely on color alone to create hierarchy.” |
| c108 | Thước độ màu Hasler–Süsstrunk M(3) tương quan trên 90% (95,3%) với điểm người chấm; mốc 0/15/33/45/59/82/109 = không màu → cực nhiều màu | s96 |  |
| c109 | Thước Hasler–Süsstrunk gần người chấm nhất trong các thước độ màu; độ đẹp không tương quan trực tiếp với độ màu | s97 |  |
| c110 | Lighthouse: ảnh > 64 px cần mật độ ≥ 0,75 × DPR (DPR làm tròn xuống 1, 1,5 hoặc 2); ảnh nhỏ ≤ 64 px (icon) cần đủ 1 × DPR | s98 | “const LARGE_IMAGE_FACTOR = 0.75;” |
| c111 | Chrome DevTools ImageDelivery: mục tiêu khoảng 1/6 byte mỗi điểm ảnh (AVIF ~12:1), GIF > 100 KiB bị gắn cờ, tiết kiệm < 4096 byte bỏ qua | s99 | “const GIF_SIZE_THRESHOLD = 100 * 1024;” |
| c112 | Lỗi khối JPEG là gián đoạn ở biên khối 8×8, đo được không cần ảnh gốc | s100 |  |
| c113 | Độ nét theo toán tử Laplacian (phương sai Laplacian) là thước lấy nét tin cậy nhưng không có ngưỡng tuyệt đối; phụ thuộc nội dung và độ phân giải | s101 |  |
| c114 | viewBox (kèm preserveAspectRatio) cho SVG co giãn khớp khung chứa | s102 | “a transform stretches or resizes the SVG viewport to fit a particular container element” |
| c115 | SVG dùng làm ảnh (img, CSS background) bị tắt JavaScript và không nạp tài nguyên ngoài trừ khi nhúng data: URL; vì vậy chữ dựa vào web font ngoài sẽ rơi về font dự phòng | s103 | “External resources (e.g., images, stylesheets) cannot be loaded, though they can be used if inlined through data: URLs” |
| c116 | SVG nhúng nên có role=img và nhãn để trình đọc màn hình đọc như một ảnh | s104 | “This will cause screen readers to just consider it as a single entity and describe it using the label” |
| c117 | Phần tử title của SVG cho tên truy cập ngắn | s105 | “provides an accessible, short-text description of any SVG container element or graphics element” |
| c118 | Icon thuần trang trí nên ẩn khỏi cây truy cập bằng aria-hidden | s106 | “Purely decorative content, such as icons or images” |
| c119 | SVG tải lên có thể chứa thẻ script và gây XSS lưu trữ khi hiện cho người khác | s107 | “if you can upload HTML files or SVG images, you can potentially use” |
| c120 | Mật độ cạnh và sai số nén là hai thước máy dự đoán độ phức tạp người cảm nhận tốt nhất (800 ảnh; tương quan đơn lẻ tới rs = .771, kết hợp ML rs = .832) | s108 | “edge density and compression error were the strongest predictors of human complexity ratings” |
| c121 | Machado 2015: tương quan đơn lẻ của thước máy với độ phức tạp người chấm đạt tới rs = .771 | s108 | “obtaining correlations up to rs = .771” |
| c122 | Với tranh nghệ thuật, kích thước nén GIF là thước dự đoán độ phức tạp cảm nhận tốt nhất | s109 | “the most successful predictor of visual complexity was Gif compression” |
| c123 | Độ phức tạp icon đo tự động: biến thiên cấu trúc (rs = .65) và thông tin cạnh (rs = .64) tương quan tốt nhất với điểm người chấm của McDougall 1999 | s110 | “edge information (r(s) = .64)” |
| c124 | Không có một thước độ phức tạp dùng chung cho mọi loại hình: chữ tượng hình hợp thước tần số không gian, hình viền vật thể hợp số khúc ngoặt; dung lượng JPEG cho tương quan thấp hơn | s111 | “for different classes of images different measures of complexity may be required” |
| c125 | Dung lượng nén tương quan tốt nhất với độ phức tạp cảm nhận ở ảnh cảnh vật, nhưng với tranh vẽ chỉ cạnh theo phase congruency đạt tương đương | s112 | “measures of compressed file size correlated best with subjective complexity” |
| c126 | Hiệu suất nhận dạng chữ tỉ lệ nghịch với độ phức tạp chu vi (chu vi trong + ngoài, bình phương, chia diện tích mực) | s113 | “efficiency is inversely proportional to perimetric complexity” |
| c127 | Với mẫu đồ hoạ mới, đối xứng tương quan mạnh nhất với đánh giá đẹp, độ phức tạp đứng thứ hai; có khác biệt cá nhân | s114 | “symmetry had the highest correlations with aesthetic judgments of beauty” |
| c128 | Năm đặc tính đo cho icon theo McDougall 1999: cụ thể, phức tạp, có nghĩa, quen thuộc, khoảng cách ngữ nghĩa (chuẩn cho 239 ký hiệu) | s115 | “include concreteness, complexity, meaningfulness, familiarity, and semantic distance” |
| c129 | Tác động của độ phức tạp icon kéo dài lâu hơn tác động của độ cụ thể và gắn với hiệu quả tìm kiếm | s116 | “complexity effects were found to persist longer and to be associated with search efficacy” |

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
| s74 | web | [002224299806200202](https://api.crossref.org/works/10.1177/002224299806200202) | Henderson & Cote 1998, Journal of Marketing 62(2):14-30; tóm tắt qua Crossref (SAGE lưu). 195 logo, 13 đặc điểm thiết kế |
| s75 | web | [van Grinsven & Das 2014, Logo design in marketing communications (J. Marketing Communications)](https://api.openalex.org/works/W1993445589) | Tóm tắt dựng lại từ abstract_inverted_index của OpenAlex (T&F chặn Cloudflare, kho Radboud 403). Thí nghiệm N=68 và N=164. |
| s76 | web | [Predicting perceived visual complexity of abstract patterns using computational measures: The influence of mirror symmetry on complexity perception](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0185276) | Gartus & Leder 2017, PLoS One (mở). 912 mẫu trừu tượng; GIF nén + đối xứng gương dự đoán độ phức tạp |
| s77 | paper | [Pelli et al. 2006 full text (author copy, PDF)](https://denispelli.com/pubs/pelli2006letters.pdf) | Bản PDF của tác giả; đọc bằng pdftotext ngày 18/11/2026. Định nghĩa mục 2 và chú thích 9; bảng A có độ phức tạp chu vi từng bảng chữ (không chuẩn hoá 4π). |
| s78 | web | [Perimetric Complexity of Binary Digital Images « The Mathematica Journal](https://www.mathematica-journal.com/2012/02/17/perimetric-complexity-of-binary-digital-images/) | Watson 2012 (NASA Ames), Perimetric complexity of binary digital images, The Mathematica Journal 14. Bản PDF NASA: ntrs.nasa.gov 20110013429 ghi rõ chia cho 4π |
| s79 | web | [fullTextXML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4786554/fullTextXML) | Hübner & Fillinger 2016, Comparison of objective measures for predicting perceptual balance and visual aesthetic preference, Front Psychol (toàn văn XML Europe PMC). Bảng 2: tương quan điểm DCM, APB, MS, HG với điểm cân bằng |
| s80 | paper | [Byrne 1993, Using icons to find documents: simplicity is critical (INTERCHI 93), PDF](https://acs.ist.psu.edu/misc/dirk-files/Papers/HCI-GUI_Icons/Byrne_interchi93.pdf) | PDF bản sao ở phòng lab Penn State; câu trích nằm trong tóm tắt, kiểm bằng pdftotext 18/11/2026 (verify không đọc PDF) |
| s81 | web | [Material Design 2: System icons](https://m2.material.io/design/iconography/system-icons.html) | Trang SPA, research-axi read trả rỗng; đã render bằng Edge headless 18/11/2026 và thấy nguyên văn câu trích |
| s82 | web | [Material Design 3: Designing icons](https://m3.material.io/styles/icons/designing-icons) | Trang SPA; đã render bằng Edge headless 18/11/2026 |
| s83 | doc | [icons.json](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/icons.json) | Apple HIG Icons (dữ liệu JSON của trang chính thức) |
| s84 | doc | [app-icons.json](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/app-icons.json) | Apple HIG App icons (dữ liệu JSON của trang chính thức) |
| s85 | web | [Fluent 2 Design System](https://fluent2.microsoft.design/iconography) | Microsoft Fluent 2 Iconography (chính thức). Không ghi độ dày nét |
| s86 | web | [Icons – Carbon Design System](https://v10.carbondesignsystem.com/guidelines/icons/contribute/) | IBM Carbon v10: Icons, design and production guidelines |
| s87 | web | [Icons \| Carbon Design System](https://www.carbondesignsystem.com/building-blocks/foundations/icons/guidelines) | IBM Carbon (hiện hành): Icons usage — cỡ, vùng chạm, màu |
| s88 | doc | [icon_design_adaptive](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive) | Android Developers: Adaptive icons (chính thức) |
| s89 | web | [maskable-icon](https://web.dev/articles/maskable-icon) | web.dev (Google): Adaptive icon support in PWAs with maskable icons |
| s90 | web | [Web Application Manifest](https://w3c.github.io/manifest/) | W3C Web Application Manifest (Editor's Draft), mục Icon masks and safe zone |
| s91 | doc | [Define a favicon to show in search results](https://developers.google.com/search/docs/appearance/favicon-in-search) | Google Search Central: Define a favicon to show in search results |
| s92 | web | [add-manifest](https://web.dev/articles/add-manifest) | web.dev (Google): Add a web app manifest — cỡ icon tối thiểu cho Chromium |
| s93 | doc | [Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) | Apple Safari Web Content Guide (lưu trữ, cũ): apple-touch-icon kèm sizes 152x152, 167x167, 180x180 |
| s94 | web | [NHS Identity Guidelines: NHS logo](https://www.england.nhs.uk/nhsidentity/identity-guidelines/nhs-logo/) | Hướng dẫn nhận diện chính thức của NHS England; trang dựng bằng JS, research-axi read trả rỗng; đã render bằng Edge headless 18/11/2026 |
| s95 | web | [Logo design principles explained \| Adobe](https://www.adobe.com/express/learn/blog/logo-design-principles) | Adobe Express blog: Logo design principles explained — nguồn giáo dục của hãng phần mềm thiết kế, có động cơ bán Adobe Express; không có số |
| s96 | paper | [Hasler & Süsstrunk 2003, Measuring colourfulness in natural images (Proc. SPIE 5007), PDF EPFL](https://infoscience.epfl.ch/record/33994/files/HaslerS03.pdf) | PDF EPFL đọc bằng pdftotext 18/11/2026: M(3) = σ_rgyb + 0.3·μ_rgyb, rg = R−G, yb = ½(R+G)−B; tương quan 95,3% với thí nghiệm (20 người, 84 ảnh); bảng 2 mốc M(3): 0 không màu, 15 hơi, 33 vừa, 45 trung bình, 59 khá, 82 nhiều, 109 cực nhiều màu |
| s97 | paper | [Amati, Mitra & Weyrich 2014, A study of image colourfulness (PDF)](https://reality.tf.fau.de/projects/image-colourfulness/image-colourfulness.pdf) | Đánh giá độc lập: thước Hasler–Süsstrunk gần với người chấm nhất; độ đẹp không tương quan trực tiếp với độ màu |
| s98 | web | [image-size-responsive.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/image-size-responsive.js) | Lighthouse (Google), audit image-size-responsive: mật độ điểm ảnh đòi hỏi theo DPR |
| s99 | web | [ImageDelivery.ts](https://raw.githubusercontent.com/ChromeDevTools/devtools-frontend/main/front_end/models/trace/insights/ImageDelivery.ts) | Chrome DevTools trace insight ImageDelivery (thay audit byte-efficiency cũ của Lighthouse) |
| s100 | paper | [Wang, Sheikh & Bovik 2002, No-reference perceptual quality assessment of JPEG compressed images (ICIP), PDF](https://live.ece.utexas.edu/publications/2002/zw_icip_2002_norefjpeg.pdf) | PDF phòng LIVE (UT Austin); đọc bằng pdftotext 18/11/2026 |
| s101 | web | [Pech-Pacheco et al. 2000, Diatom autofocusing in brightfield microscopy: a comparative study (ICPR)](https://api.openalex.org/works/W2099601760) | Tóm tắt qua OpenAlex: so phương pháp lấy nét Tenengrad và Laplacian cải tiến; không có ngưỡng tuyệt đối dùng cho ảnh web |
| s102 | doc | [viewBox - SVG \| MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox) | MDN: viewBox |
| s103 | doc | [SVG as an image - SVG \| MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image) | MDN: SVG as an image (giới hạn khi SVG làm ảnh) |
| s104 | doc | [ARIA: img role - ARIA \| MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/img_role) | MDN: ARIA img role |
| s105 | doc | [<title> — the SVG accessible name element - SVG \| MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/title) | MDN: SVG <title> accessible name element |
| s106 | doc | [ARIA: aria-hidden attribute - ARIA \| MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden) | MDN: aria-hidden |
| s107 | web | [File uploads \| Web Security Academy](https://portswigger.net/web-security/file-upload) | PortSwigger Web Security Academy: File upload vulnerabilities |
| s108 | web | [j.actpsy.2015.06.005&format=json&resultType=core](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1016/j.actpsy.2015.06.005&format=json&resultType=core) | Machado et al. 2015, Computerized measures of visual complexity, Acta Psychologica 160; tóm tắt qua Europe PMC. 800 ảnh, 30 người chấm mỗi ảnh |
| s109 | web | [000712610X498958&format=json&resultType=core](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1348/000712610X498958&format=json&resultType=core) | Forsythe et al. 2011, Predicting beauty: fractal dimension and visual complexity in art, Br J Psychol; tóm tắt Europe PMC (không có số r trong tóm tắt) |
| s110 | web | [BF03202562&format=json&resultType=core](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.3758/BF03202562&format=json&resultType=core) | Forsythe, Sheehy & Sawey 2003, Measuring icon complexity: an automated analysis, Behav Res Methods; tóm tắt Europe PMC |
| s111 | web | [p6987&format=json&resultType=core](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1068/p6987&format=json&resultType=core) | Chikhman et al. 2012, Complexity of images: experimental and computational estimates compared, Perception 41; tóm tắt Europe PMC |
| s112 | web | [journal.pone.0072412&format=json&resultType=core](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1371/journal.pone.0072412&format=json&resultType=core) | Marin & Leder 2013, Examining complexity across domains, PLoS One; tóm tắt Europe PMC |
| s113 | web | [j.visres.2006.04.023&format=json&resultType=core](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1016/j.visres.2006.04.023&format=json&resultType=core) | Pelli, Burns, Farell & Moore-Page 2006, Feature detection and letter identification, Vision Research 46; tóm tắt Europe PMC |
| s114 | web | [pms.2002.95.3.755&format=json&resultType=core](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.2466/pms.2002.95.3.755&format=json&resultType=core) | Jacobsen & Höfel 2002, Aesthetic judgments of novel graphic patterns, Percept Mot Skills; tóm tắt Europe PMC |
| s115 | web | [BF03200730&format=json&resultType=core](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.3758/BF03200730&format=json&resultType=core) | McDougall, Curry & de Bruijn 1999, norms for 239 symbols, Behav Res Methods; tóm tắt Europe PMC |
| s116 | web | [search?query=PMID:11218339&format=json&resultType=core](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:11218339&format=json&resultType=core) | McDougall, de Bruijn & Curry 2000, J Exp Psychol Appl 6(4); tóm tắt Europe PMC |

## Nguồn mã N (bộ quy tắc mở rộng, 24/11/2026)

Câu trích đã đối chiếu nguyên văn với trang gốc khi tải lại ngày 24/11/2026. Trang WCAG "Understanding" là bản gốc trên GitHub của W3C.

| Mã | Nguồn | Câu trích |
| --- | --- | --- |
| N01 | WCAG 1.4.4 Resize Text · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/resize-text.html> | "Content satisfies the success criterion if it can be scaled up to 200%" |
| N02 | WCAG 1.3.4 Orientation · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/orientation.html> | "Don't lock content to either portrait or landscape presentation." |
| N03 | WCAG 2.5.7 Dragging Movements · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/22/dragging-movements.html> | "For any action that involves dragging, provide a simple pointer alternative." |
| N04 | WCAG 1.4.13 Content on Hover or Focus · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/content-on-hover-or-focus.html> | "this success criterion specifies three conditions that must be met" (dismissible, hoverable, persistent) |
| N05 | WCAG 2.2.1 Timing Adjustable · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/timing-adjustable.html> | "Ten times the default was chosen based on clinical experience and other guidelines." |
| N06 | WCAG 3.3.8 Accessible Authentication · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/22/accessible-authentication-minimum.html> | "at least one other authentication method must be available which is not a cognitive function test." |
| N07 | WCAG 3.3.7 Redundant Entry · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/22/redundant-entry.html> | "Don't ask for the same information twice in the same activity." |
| N08 | WCAG 1.4.1 Use of Color · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/use-of-color.html> | "Use information in addition to color, such as shape or text, to convey meaning." |
| N09 | WCAG 2.5.1 Pointer Gestures · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/pointer-gestures.html> | "Authors must ensure that their content can be operated without multipoint or path-based gestures." |
| N10 | WCAG 2.5.2 Pointer Cancellation · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/pointer-cancellation.html> | "The most accessible way to incorporate pointer cancellation is to make activation occur on the up-event." |
| N11 | WCAG 4.1.3 Status Messages · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/status-messages.html> | "Let assistive technology notify users about status changes that don't take focus." |
| N12 | WCAG 1.4.2 Audio Control · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/audio-control.html> | "we discourage the practice of automatically starting sounds (especially if they last more than 3 seconds)" |
| N13 | WCAG 2.3.1 Three Flashes · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/three-flashes-or-below-threshold.html> | "Avoid content that flashes, or keep it under thresholds." |
| N14 | WCAG 3.2.6 Consistent Help · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/22/consistent-help.html> | "the mechanism must be located in the same relative order on each page within the set of pages." |
| N15 | WCAG 1.2.2 Captions (Prerecorded) · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/captions-prerecorded.html> | "Provide synchronized text for audio content in existing videos." |
| N17 | WCAG 3.3.3 Error Suggestion · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/error-suggestion.html> | "Where errors are detected, suggest known ways to correct them." |
| N18 | WCAG 3.3.1 Error Identification · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/error-identification.html> | "Provide descriptive notification of errors." |
| N19 | WCAG 3.3.2 Labels or Instructions · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/labels-or-instructions.html> | "Provide labels or instructions for inputs." |
| N20 | WCAG 3.2.2 On Input · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/on-input.html> | "Forewarn users if their context will change based on their input." |
| N21 | WCAG 2.4.3 Focus Order · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/focus-order.html> | "Elements receive focus in an order that preserves meaning." |
| N22 | WCAG 2.1.4 Character Key Shortcuts · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/character-key-shortcuts.html> | "Ensure character-only shortcut keys can be turned off or modified." |
| N23 | WCAG 3.1.2 Language of Parts · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/language-of-parts.html> | "Indicate when words are in a different language." |
| N24 | WCAG 3.2.3 Consistent Navigation · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/consistent-navigation.html> | "Consistently order navigation that repeats across multiple pages." |
| N25 | WCAG 2.4.1 Bypass Blocks · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/bypass-blocks.html> | "Provide a means of skipping repeating content." |
| N26 | WCAG 2.4.2 Page Titled · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/page-titled.html> | "Provide a descriptive page title using appropriate technology." |
| N27 | WCAG 1.4.5 Images of Text · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/images-of-text.html> | "Use text instead of pictures of text." |
| N28 | WCAG 1.3.3 Sensory Characteristics · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/sensory-characteristics.html> | "Describe controls by name, not just by appearance or location." |
| N29 | WCAG 2.5.4 Motion Actuation · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/motion-actuation.html> | "Don't rely solely on device motion to control page content." |
| N30 | WCAG 1.3.2 Meaningful Sequence · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/meaningful-sequence.html> | "Use code to preserve meaningful content order." |
| N31 | WCAG 3.3.4 Error Prevention · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/error-prevention-legal-financial-data.html> | "Provide ways for users to confirm, correct, or reverse important submissions." |
| N32 | WCAG 2.5.5 Target Size (Enhanced) · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/target-size-enhanced.html> | "Make custom targets at least 44 by 44 pixels." |
| N33 | WCAG 2.1.1 Keyboard, 2.1.2 No Keyboard Trap · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/keyboard.html>, <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/no-keyboard-trap.html> | "Everything can be done with a keyboard except freehand movements."; "Keyboard users don't get stuck." |
| N35 | WCAG 1.4.10 Reflow, mốc chiều cao 256 px · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/21/reflow.html> | "need to be able to reflow when rendered at a height equivalent to 256 CSS pixels" |
| N36 | WCAG 4.1.2 Name, Role, Value · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/name-role-value.html> | "Give components appropriate names, roles, states, and values." |
| N37 | WCAG 1.4.6 Contrast (Enhanced) 7:1 · <https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/contrast-enhanced.html> | "The contrast ratio of 7:1 was chosen for level AAA" |
| N38 | WCAG Failure F94 · <https://raw.githubusercontent.com/w3c/wcag/main/techniques/failures/F94.html> | "viewport units applied to text (generally via font-size in CSS) prevent most available methods." |
| N40 | HIG Accessibility · <https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json> | "the option to enlarge text by at least 200 percent"; bảng cỡ điều khiển iOS, iPadOS: mặc định "44x44 pt", tối thiểu "28x28 pt" |
| N41 | HIG Typography · <https://developer.apple.com/tutorials/data/design/human-interface-guidelines/typography.json> | Bảng iOS, iPadOS: mặc định "17 pt", tối thiểu "11 pt" |
| N42 | HIG Layout · <https://developer.apple.com/tutorials/data/design/human-interface-guidelines/layout.json> | "Size classes describe the actual space available, regardless of whether an app is in portrait or landscape." |
| N43 | HIG Tab bars · <https://developer.apple.com/tutorials/data/design/human-interface-guidelines/tab-bars.json> | "aim for a default list of five or fewer" (ngữ cảnh: khi cho người dùng tự chọn tab) |
| N44 | HIG Privacy · <https://developer.apple.com/tutorials/data/design/human-interface-guidelines/privacy.json> | "Request permission only when your app clearly needs access to the data or resource." |
| N45 | HIG Dark Mode · <https://developer.apple.com/tutorials/data/design/human-interface-guidelines/dark-mode.json> | "Avoid offering an app-specific appearance setting."; "Make sure full-color images and icons look good in both appearances." |
| N46 | HIG Color · <https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.json> | "Avoid relying solely on color to differentiate between objects, indicate interactivity, or communicate essential information." |
| N47 | HIG Playing audio · <https://developer.apple.com/tutorials/data/design/human-interface-guidelines/playing-audio.json> | "People switch a device to silent when they want to avoid being interrupted by unexpected sounds" |
| N48 | App Store Review Guidelines 1.3 Kids Category · <https://developer.apple.com/app-store/review/guidelines/> | "Apps in the Kids Category should not include third-party analytics or third-party advertising." |
| N50 | Android: window size classes · <https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes> | "Compact width \\| width < 600dp \\| 99.96% of phones in portrait"; medium 600–840, expanded 840–1200, large 1200–1600; "Compact height \\| height < 480dp" |
| N51 | Android: accessibility defaults · <https://developer.android.com/develop/ui/compose/accessibility/api-defaults> | "make sure to set the minimum size to 48dp" |
| N52 | Android: navigation bar · <https://developer.android.com/develop/ui/compose/components/navigation-bar> | "Three to five destinations of equal importance" |
| N53 | Android: window insets, edge-to-edge · <https://developer.android.com/develop/ui/compose/system/insets> | "Edge-to-edge is enforced on Android 15 and higher once your app targets SDK 35." |
| N60 | MDN `env()` · <https://developer.mozilla.org/en-US/docs/Web/CSS/env> | "The safe distance from the top, right, bottom, or left inset edge of the viewport" |
| N61 | MDN Viewport meta · <https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag> | "Disabling zooming capabilities by setting user-scalable to a value of no prevents people experiencing low vision conditions from being able to read" |
| N62 | MDN `<length>`, đơn vị khung nhìn · <https://developer.mozilla.org/en-US/docs/Web/CSS/length> | "When you want the smallest possible viewport in response to browser interfaces expanding dynamically, you should use the small viewport size." |
| N63 | MDN `prefers-contrast` · <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast> | "detect whether the user has requested the web content to be presented with a lower or higher contrast" |
| N64 | MDN `forced-colors` · <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors> | "it enforces a user-chosen limited color palette on the page" |
| N65 | MDN `color-scheme` · <https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme> | "Forbids the user agent from overriding the color scheme for the element." (giá trị `only`) |
| N66 | MDN Autoplay guide · <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay> | "The user has interacted with the site (by clicking, tapping, pressing keys, etc.)" |
| N67 | MDN `getUserMedia()` · <https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia> | "This feature is available only in secure contexts (HTTPS)" |
| N68 | MDN `hover` · <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover> | "The primary input mechanism cannot hover at all or cannot conveniently hover" |
| N69 | MDN `any-pointer` · <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/any-pointer> | "At least one input mechanism includes a pointing device of limited accuracy." |
| N70 | MDN `theme-color` · <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name/theme-color> | "a suggested color that user agents should use to customize the display of the page or of the surrounding user interface" |
| N71 | MDN `display-mode` · <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode> | "test whether a web app is being displayed in a normal browser tab or in some alternative way" |
| N72 | MDN `<ruby>` · <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ruby> | "usually used for showing the pronunciation of East Asian characters" |
| N74 | MDN `overscroll-behavior` · <https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior> | "get rid of unwanted scroll chaining and the browser's \"pull to refresh\"-type behavior" |
| N75 | MDN `devicePixelRatio` · <https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio> | "the ratio of the resolution in physical pixels to the resolution in CSS pixels" |
| N76 | MDN `inputmode` · <https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode> | "This allows a browser to display an appropriate virtual keyboard." |
| N77 | MDN `<dialog>` · <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog> | "pressing the Esc key on desktop platforms, or a \"back\" or \"dismiss\" gesture on mobile platforms" |
| N78 | MDN `Navigator.onLine` · <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine> | "connection to LAN is considered online, even though the LAN may not have Internet access" |
| N79 | MDN Screen Wake Lock · <https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API> | "prevent devices from dimming or locking the screen when an application needs to keep running" |
| N80 | MDN Visual Viewport · <https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API> | "the on-screen keyboard (OSK) can shrink the visual viewport without affecting the layout viewport" |
| N81 | MDN `scrollbar-gutter` · <https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter> | "reserve space for the scrollbar, preventing unwanted layout changes as the content grows" |
| N84 | MDN Web Audio best practices · <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices> | "Create or resume context from inside a user gesture" |
| N85 | WebKit: Designing Websites for iPhone X · <https://webkit.org/blog/7929/designing-websites-for-iphone-x/> | "it is important to respect the system’s safe area insets" |
| N86 | WebKit: New video policies for iOS · <https://webkit.org/blog/6784/new-video-policies-for-ios/> | "Safari on iOS has required a user gesture to play media in a <video> or <audio> element" |
| N87 | WebKit: Full Third-Party Cookie Blocking and More · <https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/> | "deleting all of a website’s script-writable storage after seven days of Safari use without user interaction on the site" |
| N88 | Chrome: Autoplay policy · <https://developer.chrome.com/blog/autoplay> | "Muted autoplay is always allowed." |
| N89 | web.dev: install criteria · <https://web.dev/articles/install-criteria> | "`icons` - must include a 192px and a 512px icon" |
| N90 | web.dev: INP · <https://web.dev/articles/inp> | "An INP below or at **200 milliseconds** means a page has **good responsiveness**." |
| N91 | web.dev: Optimize CLS · <https://web.dev/articles/optimize-cls> | "Always include `width` and `height` size attributes on your images and video elements." |
| N92 | web.dev: Font best practices · <https://web.dev/articles/font-best-practices> | "The practice of font swapping has the potential to [cause layout shifts]" |
| N93 | web.dev: Learn PWA, App design · <https://web.dev/learn/pwa/app-design> | "standalone mode displays your PWA in an OS-standard window without any browser navigation UI" |
| N94 | web.dev: Offline UX design guidelines · <https://web.dev/articles/offline-ux-design-guidelines> | "Tell the user both the application's state and the actions they can still take when they have a network failure." |
| N95 | web.dev: bfcache · <https://web.dev/articles/bfcache> | "The most important way to optimize for bfcache in all browsers is to never use the unload event." |
| N100 | NN/g: Response Times, 3 Important Limits · <https://www.nngroup.com/articles/response-times-3-important-limits/> | "0.1 second is about the limit for having the user feel that the system is reacting instantaneously" |
| N101 | NN/g: Touch Target Size · <https://www.nngroup.com/articles/touch-target-size/> | "Interactive elements must be at least 1cm × 1cm (0.4in × 0.4in)" |
| N103 | NN/g: Error-Message Guidelines · <https://www.nngroup.com/articles/error-message-guidelines/> | "Display the error message close to the error's source." |
| N104 | NN/g: Confirmation Dialogs · <https://www.nngroup.com/articles/confirmation-dialog/> | "consider a confirmation dialog before actions that cannot be undone" |
| N105 | NN/g: Skeleton Screens · <https://www.nngroup.com/articles/skeleton-screens/> | "This progress indicator is used for full-page loads and reduces the perceived loading time." |
| N106 | NN/g: Progress Indicators · <https://www.nngroup.com/articles/progress-indicators/> | "If the result will take more than 10 seconds to appear, you should also show users an estimate" |
| N107 | NN/g: Placeholders in Form Fields · <https://www.nngroup.com/articles/form-design-placeholders/> | "Disappearing placeholder text strains users’ short-term memory" |
| N108 | NN/g: Hamburger Menus and Hidden Navigation · <https://www.nngroup.com/articles/hamburger-menus/> | "Discoverability is cut almost in half by hiding a website’s main navigation." |
| N109 | NN/g: Icon Usability · <https://www.nngroup.com/articles/icon-usability/> | "text labels are necessary to communicate the meaning and reduce ambiguity" |
| N110 | NN/g: Dark Mode vs. Light Mode · <https://www.nngroup.com/articles/dark-mode/> | "visual performance tends to be better with light mode" |
| N111 | Baymard: Inline Form Validation · <https://baymard.com/blog/inline-form-validation> | "Remove error messages as soon as the field is corrected" |
| N118 | W3C i18n: Normalization in HTML and CSS · <https://www.w3.org/International/questions/qa-html-css-normalization.en> (thay charmod-norm) | "NFC is, however, a good recommendation because this is what many (but not all) keyboards tend to produce." |
| N120 | NN/g: The 3-Click Rule for Navigation Is False · <https://www.nngroup.com/articles/3-click-rule/> | "it has not been supported by data in any published studies to date" |
| N130 | Design for Kids Based on Their Stage of Physical Development · <https://www.nngroup.com/articles/children-ux-physical-development/> | "Precise dragging of target through a tunnel or to a specific spot was hard for kids, because it required relatively high motor dexterity." |
| N131 | Design for Kids Based on Their Stage of Physical Development · <https://www.nngroup.com/articles/children-ux-physical-development/> | "When kids want to move a target on a touchscreen, there are two options: dragging the target to the destination or tapping the destination." |
| N132 | Design for Kids Based on Their Stage of Cognitive Development · <https://www.nngroup.com/articles/kids-cognition/> | "the sound was blocked by the browser, so our participants never heard that explanation" |
| N133 | Design for Kids Based on Their Stage of Cognitive Development · <https://www.nngroup.com/articles/kids-cognition/> | "The visuals were clear enough even without the simultaneous audio instructions." |
| N134 | A developmental perspective on feedback: How corrective feedback influences children's literacy, mathematics, and problem solving · <https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1080/00461520.2022.2108426&resultType=core&format=json> | "we review 44 empirical papers published between 1990 and 2022 examining the effects of corrective feedback on children's performance" |
| N135 | Right or wrong? How feedback content and source influence children's mathematics performance and persistence · <https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1016/j.jecp.2024.105865&resultType=core&format=json> | "feedback with verification cues led to decreased persistence, decreased strategy variability, and higher reliance on entrenched strategies relative to feedback that contained the correct answer alone" |
| N136 | Design safe and age-appropriate experiences for your apps and games · <https://developer.apple.com/app-store/kids-apps/> | "These are adult-level tasks that must be completed in order to continue using your app or game." |
| N138 | Saving and feedback · <https://design.gitlab.com/patterns/saving-and-feedback/> | "provide a persistent inline control next to the change, not an action inside a toast, which cannot be reached accessibly before the toast dismisses" |
