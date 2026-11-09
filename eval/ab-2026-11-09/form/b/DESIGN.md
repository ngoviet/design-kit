---
version: alpha
name: "design-kit · Giấy"
description: "Hướng thẩm mỹ cho tài liệu, báo cáo, bài viết dài, trang hướng dẫn. Sinh từ tokens/core.css + tokens/giay.css — sửa CSS rồi chạy lại scripts/tao-design-md.mjs, không sửa tay tệp này."
colors:
  primary: "oklch(0.480 0.140 258)"
  on-primary: "oklch(0.990 0.004 258)"
  primary-text: "oklch(0.460 0.140 258)"
  primary-soft: "oklch(0.955 0.020 258)"
  background: "oklch(0.990 0.002 240)"
  surface: "oklch(1 0 0)"
  surface-variant: "oklch(0.965 0.004 240)"
  outline: "oklch(0.890 0.006 240)"
  on-surface: "oklch(0.210 0.010 240)"
  on-surface-variant: "oklch(0.440 0.010 240)"
  success: "oklch(0.480 0.110 150)"
  success-soft: "oklch(0.960 0.030 150)"
  warning: "oklch(0.500 0.100 65)"
  warning-soft: "oklch(0.965 0.030 80)"
  error: "oklch(0.510 0.160 25)"
  error-soft: "oklch(0.960 0.018 25)"
  info: "oklch(0.480 0.130 258)"
  info-soft: "oklch(0.955 0.020 258)"
typography:
  display:
    fontFamily: Be Vietnam Pro
    fontSize: 2.45rem
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 2.45rem
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 1.95rem
    fontWeight: 650
    lineHeight: 1.2
  title:
    fontFamily: Be Vietnam Pro
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: Literata
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.7
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Be Vietnam Pro
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.35
  mono:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 999px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 24px
  6: 32px
  7: 48px
  8: 64px
  9: 96px
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
---

# design-kit · Giấy

Dùng cho: tài liệu, báo cáo, bài viết dài, trang hướng dẫn. Token gốc ở `tokens/core.css` và `tokens/giay.css`; gắn `data-dk="giay"` lên `<html>`.

## Overview

Trang để đọc lâu. Sáng là chế độ chính. Nền gần trắng trung hoà (không dùng nền kem), chữ thân có chân Literata 18px, tiêu đề không chân Be Vietnam Pro. Một màu nhấn xanh mực cho liên kết và điểm nhấn hiếm. Phân cấp đến từ thang chữ và khoảng trắng.

## Colors

Mọi cặp chữ/nền đã kiểm bằng `node scripts/kiem-cap-mau.mjs`: chữ ≥ 4.5:1, viền ô nhập và vòng focus ≥ 3:1, ở cả sáng lẫn tối, trong gamut sRGB. Dùng màu theo vai trò, không theo sắc:

- `primary` để tô nền nút chính; chữ màu nhấn dùng `primary-text` (đậm hơn một chút để đạt 4.5:1 trên nền).
- `*-soft` là nền nhạt cho huy hiệu và thông báo; chữ trên đó dùng màu đậm cùng tên.
- Màu trạng thái luôn kèm chữ hoặc icon.

Bản tối (khi `prefers-color-scheme: dark` hoặc `data-theme="dark"`):

| Token | Biến CSS | Sáng | Tối |
| --- | --- | --- | --- |
| `primary` | `--accent` | `oklch(0.480 0.140 258)` | `oklch(0.760 0.110 258)` |
| `on-primary` | `--on-accent` | `oklch(0.990 0.004 258)` | `oklch(0.180 0.030 258)` |
| `primary-text` | `--accent-text` | `oklch(0.460 0.140 258)` | `oklch(0.790 0.100 258)` |
| `primary-soft` | `--accent-soft` | `oklch(0.955 0.020 258)` | `oklch(0.290 0.050 258)` |
| `background` | `--bg` | `oklch(0.990 0.002 240)` | `oklch(0.190 0.006 240)` |
| `surface` | `--surface` | `oklch(1 0 0)` | `oklch(0.220 0.007 240)` |
| `surface-variant` | `--surface-2` | `oklch(0.965 0.004 240)` | `oklch(0.260 0.008 240)` |
| `outline` | `--border` | `oklch(0.890 0.006 240)` | `oklch(0.350 0.010 240)` |
| `on-surface` | `--text` | `oklch(0.210 0.010 240)` | `oklch(0.920 0.005 240)` |
| `on-surface-variant` | `--text-2` | `oklch(0.440 0.010 240)` | `oklch(0.750 0.010 240)` |
| `success` | `--ok` | `oklch(0.480 0.110 150)` | `oklch(0.790 0.120 150)` |
| `success-soft` | `--ok-soft` | `oklch(0.960 0.030 150)` | `oklch(0.280 0.040 150)` |
| `warning` | `--warn` | `oklch(0.500 0.100 65)` | `oklch(0.830 0.110 80)` |
| `warning-soft` | `--warn-soft` | `oklch(0.965 0.030 80)` | `oklch(0.290 0.040 80)` |
| `error` | `--bad` | `oklch(0.510 0.160 25)` | `oklch(0.770 0.120 25)` |
| `error-soft` | `--bad-soft` | `oklch(0.960 0.018 25)` | `oklch(0.290 0.045 25)` |
| `info` | `--info` | `oklch(0.480 0.130 258)` | `oklch(0.790 0.100 258)` |
| `info-soft` | `--info-soft` | `oklch(0.955 0.020 258)` | `oklch(0.290 0.050 258)` |
| `outline-strong (viền ô nhập)` | `--border-strong` | `oklch(0.60 0.01 240)` | `oklch(0.56 0.01 240)` |
| `focus (vòng focus)` | `--focus` | `oklch(0.480 0.140 258)` | `oklch(0.760 0.110 258)` |

## Typography

Thân Literata 18px, giãn dòng 1.7, độ dài dòng tối đa 66ch. Tiêu đề Be Vietnam Pro 600–650. Giao diện phụ (nút, nhãn, bảng) dùng Be Vietnam Pro qua `--font-ui`.

Thang tỉ lệ 1.25: 12 · 14 · 16 · 20 · 25 · 31 · 39 px, các bậc lớn co giãn bằng `clamp()` (xem `--fs-*` trong `tokens/core.css`). Tiêu đề giãn dòng ≥ 1.2 để dấu tiếng Việt không chạm dòng trên. Luôn đặt `lang="vi"`.

## Layout

Một cột đọc chính rộng tối đa 66ch, mục lục bên trái trên màn rộng, thu thành hàng chip trên điện thoại. Khoảng cách giữa các mục lớn (`--sp-8`).

Bề rộng tối thiểu phải chạy được: 320px, không cuộn ngang. Vùng bấm ≥ 24×24px, nút chính ≥ 44px.

## Elevation & Depth

Hai mức bóng: `--shadow-1` (tách nhẹ, thẻ nằm yên) và `--shadow-2` (lớp nổi: menu, hộp thoại). Ở chế độ tối, độ sâu đến từ nền sáng dần (`background` → `surface` → `surface-variant`), bóng chỉ phụ.

## Shapes

Bo góc 6px (ô nhập, nút nhỏ), 10px (nút, thẻ nhỏ), 16px (thẻ lớn, hộp thoại), tròn hẳn cho huy hiệu. Không trộn quá hai mức bo trong một thành phần.

## Components

Khối mẫu đã qua cổng nằm ở `blocks/html/` (HTML/CSS thuần) và `blocks/react/` (React + shadcn/ui). Mỗi vùng dữ liệu có đủ bốn trạng thái: rỗng, đang tải, lỗi (kèm cách khắc phục), không có quyền.

## Do's and Don'ts

Nên:
- Liên kết có gạch chân, `text-underline-offset: 3px`.
- Bảng có viền mảnh, chữ 14px, cột số căn phải.
- Trích dẫn và ghi chú dùng nền `--surface-2`, không dùng viền trái màu.
- Tôn trọng `prefers-reduced-motion`; chuyển động 120–320ms, easing ra, không nảy.

Không nên:
- Không nền kem / be (bị coi là dấu hiệu UI do AI làm).
- Không tiêu đề chữ nghiêng có chân cỡ lớn.
- Không quá 75 ký tự mỗi dòng ở thân bài.
- Không dùng Inter / Roboto làm font mặc định.
