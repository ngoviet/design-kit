// Sinh design/<huong>/DESIGN.md từ tokens/core.css + tokens/<huong>.css (nguồn duy nhất là CSS).
// Dùng: node scripts/tao-design-md.mjs   rồi   npx @google/design.md lint design/<huong>/DESIGN.md
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = readFileSync(join(root, "tokens/core.css"), "utf8");

const HUONG = {
  dem: {
    name: "design-kit · Đêm",
    dung: "ứng dụng, dashboard, công cụ quản trị, card Home Assistant",
    overview:
      "Giao diện làm việc, đọc nhanh và dày thông tin. Tối là chế độ chính, sáng là bản phụ có cùng cấu trúc. Trung tính nhuốm lam rất nhẹ (h 250) để nền tối không chết, một màu nhấn xanh ngọc duy nhất dành cho hành động chính và trạng thái chọn. Không trang trí: phân cấp bằng cỡ chữ, độ đậm và khoảng cách, không bằng gradient hay bóng đổ lớn.",
    type: "Be Vietnam Pro cho mọi chữ (thiết kế cho tiếng Việt, dấu chồng không bị cắt). Số liệu và mã dùng JetBrains Mono với `font-variant-numeric: tabular-nums`. Thân 16px, chữ phụ 14px, nhãn nhỏ nhất 12px.",
    layout: "Lưới 12 cột, khoảng cách bậc 4px. Mật độ cao nhưng mỗi nhóm cách nhau ít nhất `--sp-5` (24px). Thành phần tự co theo khung chứa bằng container queries, không theo bề rộng màn hình.",
    dos: [
      "Một hành động chính mỗi vùng, dùng `--accent`; hành động phụ dùng nút viền.",
      "Màu trạng thái luôn đi kèm chữ hoặc icon, không dùng màu làm tín hiệu duy nhất.",
      "Số liệu dùng mono + tabular-nums để cột thẳng hàng.",
    ],
    donts: [
      "Không đặt thẻ trong thẻ; không dùng viền trái màu làm điểm nhấn.",
      "Không glow, không gradient tím/xanh trên nền tối.",
      "Không chữ dưới 12px, kể cả nhãn biểu đồ.",
    ],
  },
  giay: {
    name: "design-kit · Giấy",
    dung: "tài liệu, báo cáo, bài viết dài, trang hướng dẫn",
    overview:
      "Trang để đọc lâu. Sáng là chế độ chính. Nền gần trắng trung hoà (không dùng nền kem), chữ thân có chân Literata 18px, tiêu đề không chân Be Vietnam Pro. Một màu nhấn xanh mực cho liên kết và điểm nhấn hiếm. Phân cấp đến từ thang chữ và khoảng trắng.",
    type: "Thân Literata 18px, giãn dòng 1.7, độ dài dòng tối đa 66ch. Tiêu đề Be Vietnam Pro 600–650. Giao diện phụ (nút, nhãn, bảng) dùng Be Vietnam Pro qua `--font-ui`.",
    layout: "Một cột đọc chính rộng tối đa 66ch, mục lục bên trái trên màn rộng, thu thành hàng chip trên điện thoại. Khoảng cách giữa các mục lớn (`--sp-8`).",
    dos: [
      "Liên kết có gạch chân, `text-underline-offset: 3px`.",
      "Bảng có viền mảnh, chữ 14px, cột số căn phải.",
      "Trích dẫn và ghi chú dùng nền `--surface-2`, không dùng viền trái màu.",
    ],
    donts: [
      "Không nền kem / be (bị coi là dấu hiệu UI do AI làm).",
      "Không tiêu đề chữ nghiêng có chân cỡ lớn.",
      "Không quá 75 ký tự mỗi dòng ở thân bài.",
    ],
  },
  dam: {
    name: "design-kit · Đậm",
    dung: "landing page, marketing, trang giới thiệu sản phẩm",
    overview:
      "Trang thuyết phục, có cá tính. Tiêu đề Bricolage Grotesque cỡ lớn và đậm, màu nhấn đỏ son dùng mạnh tay cho hành động chính. Trung tính ấm rất nhẹ (h 40). Một khoảnh khắc chuyển động duy nhất mỗi trang, luôn có nhánh giảm chuyển động.",
    type: "Tiêu đề Bricolage Grotesque 700–800, tracking -0.02em, hero tới ~61px. Thân Be Vietnam Pro 17px.",
    layout: "Các mục rộng, nhịp lớn (`--sp-8`, `--sp-9`). Lưới linh hoạt, cho phép bất đối xứng. Hero không dùng số liệu khổng lồ làm điểm nhấn.",
    dos: [
      "Một lời kêu gọi chính, màu `--accent`, cao tối thiểu 44px.",
      "Hình minh hoạ thật (ảnh sản phẩm, ảnh chụp màn hình) thay cho icon trang trí.",
      "Mỗi mục có một ý, tiêu đề nói thẳng ý đó.",
    ],
    donts: [
      "Không eyebrow / kicker viết hoa phía trên tiêu đề.",
      "Không chữ gradient, không nền lưới, không vầng sáng toả tròn.",
      "Không ba thẻ tính năng giống hệt nhau xếp hàng.",
    ],
  },
};

const lightBlock = (css, t) => css.match(new RegExp(`\\[data-dk="${t}"\\]\\s*\\{([^}]*)\\}`))[1];
const darkBlock = (css, t) => css.match(new RegExp(`\\[data-dk="${t}"\\]\\[data-theme="dark"\\]\\s*\\{([^}]*)\\}`))[1];
const vars = (s) => Object.fromEntries([...s.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const fam = (s) => s.split(",")[0].replace(/"/g, "").trim();
const coreVars = vars(core.match(/:root\s*\{([\s\S]*?)\n\}/)[1]);

for (const [t, h] of Object.entries(HUONG)) {
  const css = readFileSync(join(root, `tokens/${t}.css`), "utf8");
  const L = vars(lightBlock(css, t));
  const D = vars(darkBlock(css, t));
  const body = L["fs-body"] === "var(--fs-base)" ? "1rem" : L["fs-body"];
  const lhBody = L["lh-body"] ?? coreVars["lh-body"];
  const displayFam = fam(L["font-display"]);
  const bodyFam = fam(L["font-body"]);
  const uiFam = fam(L["font-ui"] ?? L["font-body"]);
  const monoFam = fam(L["font-mono"]);
  const heroSize = t === "dam" ? "3.8rem" : "2.45rem";

  const colorMap = {
    primary: "accent", "on-primary": "on-accent", "primary-text": "accent-text", "primary-soft": "accent-soft",
    background: "bg", surface: "surface", "surface-variant": "surface-2", outline: "border",
    "on-surface": "text", "on-surface-variant": "text-2",
    success: "ok", "success-soft": "ok-soft", warning: "warn", "warning-soft": "warn-soft",
    error: "bad", "error-soft": "bad-soft", info: "info", "info-soft": "info-soft",
  };
  // Token phi chữ (ngưỡng 3:1, WCAG 1.4.11): lint DESIGN.md chỉ biết 4.5:1 cho chữ nên chỉ ghi ở bảng.
  const nonText = { "outline-strong (viền ô nhập)": "border-strong", "focus (vòng focus)": "focus" };
  const colors = Object.entries(colorMap).map(([k, v]) => `  ${k}: "${L[v]}"`).join("\n");
  const darkRows = Object.entries({ ...colorMap, ...nonText }).map(([k, v]) => `| \`${k}\` | \`--${v}\` | \`${L[v]}\` | \`${D[v]}\` |`).join("\n");

  const yaml = `---
version: alpha
name: "${h.name}"
description: "Hướng thẩm mỹ cho ${h.dung}. Sinh từ tokens/core.css + tokens/${t}.css — sửa CSS rồi chạy lại scripts/tao-design-md.mjs, không sửa tay tệp này."
colors:
${colors}
typography:
  display:
    fontFamily: ${displayFam}
    fontSize: ${heroSize}
    fontWeight: ${L["weight-display"]}
    lineHeight: 1.1
    letterSpacing: ${L["tracking-display"]}
  headline-lg:
    fontFamily: ${displayFam}
    fontSize: 2.45rem
    fontWeight: ${L["weight-display"]}
    lineHeight: 1.2
    letterSpacing: ${L["tracking-display"]}
  headline-md:
    fontFamily: ${displayFam}
    fontSize: 1.95rem
    fontWeight: 650
    lineHeight: 1.2
  title:
    fontFamily: ${displayFam}
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: ${bodyFam}
    fontSize: ${body}
    fontWeight: 400
    lineHeight: ${lhBody}
  body-sm:
    fontFamily: ${uiFam}
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: ${uiFam}
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.35
  mono:
    fontFamily: ${monoFam}
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: ${coreVars["r-sm"]}
  md: ${coreVars["r-md"]}
  lg: ${coreVars["r-lg"]}
  full: ${coreVars["r-full"]}
spacing:
${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `  ${i}: ${coreVars[`sp-${i}`]}`).join("\n")}
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 20px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 20px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 0 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 24px
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-surface}"
  muted-panel:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface-variant}"
  link:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary-text}"
  badge-primary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  badge-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  badge-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  divider:
    backgroundColor: "{colors.outline}"
---`;

  const md = `${yaml}

# ${h.name}

Dùng cho: ${h.dung}. Token gốc ở \`tokens/core.css\` và \`tokens/${t}.css\`; gắn \`data-dk="${t}"\` lên \`<html>\`.

## Overview

${h.overview}

## Colors

Mọi cặp chữ/nền đã kiểm bằng \`node scripts/kiem-cap-mau.mjs\`: chữ ≥ 4.5:1, viền ô nhập và vòng focus ≥ 3:1, ở cả sáng lẫn tối, trong gamut sRGB. Dùng màu theo vai trò, không theo sắc:

- \`primary\` để tô nền nút chính; chữ màu nhấn dùng \`primary-text\` (đậm hơn một chút để đạt 4.5:1 trên nền).
- \`*-soft\` là nền nhạt cho huy hiệu và thông báo; chữ trên đó dùng màu đậm cùng tên.
- Màu trạng thái luôn kèm chữ hoặc icon.

Bản tối (khi \`prefers-color-scheme: dark\` hoặc \`data-theme="dark"\`):

| Token | Biến CSS | Sáng | Tối |
| --- | --- | --- | --- |
${darkRows}

## Typography

${h.type}

Thang tỉ lệ 1.25: 12 · 14 · 16 · 20 · 25 · 31 · 39${t === "dam" ? " · 61" : ""} px, các bậc lớn co giãn bằng \`clamp()\` (xem \`--fs-*\` trong \`tokens/core.css\`). Tiêu đề giãn dòng ≥ 1.2 để dấu tiếng Việt không chạm dòng trên. Luôn đặt \`lang="vi"\`.

## Layout

${h.layout}

Bề rộng tối thiểu phải chạy được: 320px, không cuộn ngang. Vùng bấm ≥ 24×24px, nút chính ≥ 44px.

## Elevation & Depth

Hai mức bóng: \`--shadow-1\` (tách nhẹ, thẻ nằm yên) và \`--shadow-2\` (lớp nổi: menu, hộp thoại). Ở chế độ tối, độ sâu đến từ nền sáng dần (\`background\` → \`surface\` → \`surface-variant\`), bóng chỉ phụ.

## Shapes

Bo góc 6px (ô nhập, nút nhỏ), 10px (nút, thẻ nhỏ), 16px (thẻ lớn, hộp thoại), tròn hẳn cho huy hiệu. Không trộn quá hai mức bo trong một thành phần.

## Components

Khối mẫu đã qua cổng nằm ở \`blocks/html/\` (HTML/CSS thuần) và \`blocks/react/\` (React + shadcn/ui). Mỗi vùng dữ liệu có đủ bốn trạng thái: rỗng, đang tải, lỗi (kèm cách khắc phục), không có quyền.

## Do's and Don'ts

Nên:
${h.dos.map((d) => `- ${d}`).join("\n")}
- Tôn trọng \`prefers-reduced-motion\`; chuyển động 120–320ms, easing ra, không nảy.

Không nên:
${h.donts.map((d) => `- ${d}`).join("\n")}
- Không dùng Inter / Roboto làm font mặc định.
`;
  mkdirSync(join(root, "design", t), { recursive: true });
  writeFileSync(join(root, "design", t, "DESIGN.md"), md);
  console.log(`design/${t}/DESIGN.md`);
}
