# Nguồn của bộ tiêu chí

Bản xuất từ kho tri thức (`research-hub/kb/tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun`) ngày 2026-11-09, bằng `node scripts/xuat-nguon.mjs`. **Không sửa tay**: sửa ở kho rồi xuất lại.

Mã `s…` là nguồn, `c…` là luận điểm. `docs/tieu-chi.md` trích các mã này. Câu trích đã được kiểm lại bằng `research-axi kb verify` (so với trang gốc).

## Kết luận của chủ đề

Chuẩn công năng kiểm được bằng số đã rõ và ổn định: WCAG 2.2 AA (chữ 4,5:1, phi chữ 3:1, vùng bấm 24px, reflow 320px, focus không bị che), CWV p75 (LCP≤2,5s, INP≤200ms, CLS≤0,1), dòng 50–75 ký tự. Thẩm mỹ thì máy chỉ đo được phần 'sàn' (thang chữ, khoảng cách, màu OKLCH/APCA, dấu hiệu AI) — Anthropic xác nhận Claude rơi về Inter/gradient tím khi thiếu chỉ dẫn và cải thiện ngay khi có chỉ dẫn cụ thể quy ra mã. Cách nạp cho AI: DESIGN.md (đặc tả Google Labs, còn alpha, có lint tương phản và xuất Tailwind/DTCG) + rubric số + vòng render→đo→chụp→sửa; nhưng nghiên cứu cho thấy LLM tự chấm UI chưa bằng người và khó cải thiện đều qua nhiều vòng, nên máy đo làm cổng cứng, người duyệt phần thẩm mỹ. Sẽ đổi nếu WCAG 3/APCA thành chuẩn hoặc CWV đổi chỉ số.

**Độ tin cậy:** high · 2026-11-09 18:21

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

## Nguồn

| Mã | Loại | Tiêu đề | Ghi chú |
| --- | --- | --- | --- |
| s1 | web | [Understanding Target Size (Minimum)](https://raw.githubusercontent.com/w3c/wcag/main/understanding/22/target-size-minimum.html) | W3C WCAG Understanding 2.5.8 (repo chính thức w3c/wcag) |
| s2 | web | [vitals](https://web.dev/articles/vitals) | Google web.dev, Philip Walton — định nghĩa chính thức CWV |
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
