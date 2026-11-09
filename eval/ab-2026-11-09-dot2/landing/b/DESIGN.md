---
version: alpha
name: "design-kit · Đậm"
description: "Hướng thẩm mỹ cho landing page, marketing, trang giới thiệu sản phẩm. Sinh từ tokens/core.css + tokens/dam.css — sửa CSS rồi chạy lại scripts/tao-design-md.mjs, không sửa tay tệp này."
colors:
  primary: "oklch(0.530 0.190 32)"
  on-primary: "oklch(0.990 0.004 32)"
  primary-text: "oklch(0.510 0.180 32)"
  primary-soft: "oklch(0.955 0.022 32)"
  background: "oklch(0.985 0.003 40)"
  surface: "oklch(0.997 0.001 40)"
  surface-variant: "oklch(0.950 0.008 40)"
  outline: "oklch(0.880 0.012 40)"
  on-surface: "oklch(0.200 0.015 40)"
  on-surface-variant: "oklch(0.440 0.015 40)"
  success: "oklch(0.480 0.120 150)"
  success-soft: "oklch(0.955 0.035 150)"
  warning: "oklch(0.500 0.100 65)"
  warning-soft: "oklch(0.960 0.034 80)"
  error: "oklch(0.500 0.170 20)"
  error-soft: "oklch(0.955 0.020 20)"
  info: "oklch(0.490 0.120 250)"
  info-soft: "oklch(0.955 0.020 250)"
typography:
  display:
    fontFamily: Bricolage Grotesque
    fontSize: 3.8rem
    fontWeight: 750
    lineHeight: 1.1
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 2.45rem
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Bricolage Grotesque
    fontSize: 1.95rem
    fontWeight: 650
    lineHeight: 1.2
  title:
    fontFamily: Bricolage Grotesque
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: Be Vietnam Pro
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.6
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

# design-kit · Đậm

Dùng cho: landing page, marketing, trang giới thiệu sản phẩm. Token gốc ở `tokens/core.css` và `tokens/dam.css`; gắn `data-dk="dam"` lên `<html>`.

## Overview

Trang thuyết phục, có cá tính. Tiêu đề Bricolage Grotesque cỡ lớn và đậm, màu nhấn đỏ son dùng mạnh tay cho hành động chính. Trung tính ấm rất nhẹ (h 40). Một khoảnh khắc chuyển động duy nhất mỗi trang, luôn có nhánh giảm chuyển động.

## Colors

Mọi cặp chữ/nền đã kiểm bằng `node scripts/kiem-cap-mau.mjs`: chữ ≥ 4.5:1, viền ô nhập và vòng focus ≥ 3:1, ở cả sáng lẫn tối, trong gamut sRGB. Dùng màu theo vai trò, không theo sắc:

- `primary` để tô nền nút chính; chữ màu nhấn dùng `primary-text` (đậm hơn một chút để đạt 4.5:1 trên nền).
- `*-soft` là nền nhạt cho huy hiệu và thông báo; chữ trên đó dùng màu đậm cùng tên.
- Màu trạng thái luôn kèm chữ hoặc icon.

Bản tối (khi `prefers-color-scheme: dark` hoặc `data-theme="dark"`):

| Token | Biến CSS | Sáng | Tối |
| --- | --- | --- | --- |
| `primary` | `--accent` | `oklch(0.530 0.190 32)` | `oklch(0.720 0.170 38)` |
| `on-primary` | `--on-accent` | `oklch(0.990 0.004 32)` | `oklch(0.160 0.030 38)` |
| `primary-text` | `--accent-text` | `oklch(0.510 0.180 32)` | `oklch(0.760 0.145 38)` |
| `primary-soft` | `--accent-soft` | `oklch(0.955 0.022 32)` | `oklch(0.290 0.060 38)` |
| `background` | `--bg` | `oklch(0.985 0.003 40)` | `oklch(0.160 0.010 40)` |
| `surface` | `--surface` | `oklch(0.997 0.001 40)` | `oklch(0.200 0.012 40)` |
| `surface-variant` | `--surface-2` | `oklch(0.950 0.008 40)` | `oklch(0.240 0.014 40)` |
| `outline` | `--border` | `oklch(0.880 0.012 40)` | `oklch(0.330 0.016 40)` |
| `on-surface` | `--text` | `oklch(0.200 0.015 40)` | `oklch(0.940 0.008 40)` |
| `on-surface-variant` | `--text-2` | `oklch(0.440 0.015 40)` | `oklch(0.770 0.012 40)` |
| `success` | `--ok` | `oklch(0.480 0.120 150)` | `oklch(0.790 0.140 150)` |
| `success-soft` | `--ok-soft` | `oklch(0.955 0.035 150)` | `oklch(0.270 0.045 150)` |
| `warning` | `--warn` | `oklch(0.500 0.100 65)` | `oklch(0.830 0.120 80)` |
| `warning-soft` | `--warn-soft` | `oklch(0.960 0.034 80)` | `oklch(0.280 0.045 80)` |
| `error` | `--bad` | `oklch(0.500 0.170 20)` | `oklch(0.760 0.140 22)` |
| `error-soft` | `--bad-soft` | `oklch(0.955 0.020 20)` | `oklch(0.280 0.055 22)` |
| `info` | `--info` | `oklch(0.490 0.120 250)` | `oklch(0.780 0.100 250)` |
| `info-soft` | `--info-soft` | `oklch(0.955 0.020 250)` | `oklch(0.270 0.045 250)` |
| `outline-strong (viền ô nhập)` | `--border-strong` | `oklch(0.58 0.015 40)` | `oklch(0.55 0.016 40)` |
| `focus (vòng focus)` | `--focus` | `oklch(0.510 0.180 32)` | `oklch(0.720 0.170 38)` |

## Typography

Tiêu đề Bricolage Grotesque 700–800, tracking -0.02em, hero tới ~61px. Thân Be Vietnam Pro 17px.

Thang tỉ lệ 1.25: 12 · 14 · 16 · 20 · 25 · 31 · 39 · 61 px, các bậc lớn co giãn bằng `clamp()` (xem `--fs-*` trong `tokens/core.css`). Tiêu đề giãn dòng ≥ 1.2 để dấu tiếng Việt không chạm dòng trên. Luôn đặt `lang="vi"`.

## Layout

Các mục rộng, nhịp lớn (`--sp-8`, `--sp-9`). Lưới linh hoạt, cho phép bất đối xứng. Hero không dùng số liệu khổng lồ làm điểm nhấn.

Bề rộng tối thiểu phải chạy được: 320px, không cuộn ngang. Vùng bấm ≥ 24×24px, nút chính ≥ 44px.

## Elevation & Depth

Hai mức bóng: `--shadow-1` (tách nhẹ, thẻ nằm yên) và `--shadow-2` (lớp nổi: menu, hộp thoại). Ở chế độ tối, độ sâu đến từ nền sáng dần (`background` → `surface` → `surface-variant`), bóng chỉ phụ.

## Shapes

Bo góc 6px (ô nhập, nút nhỏ), 10px (nút, thẻ nhỏ), 16px (thẻ lớn, hộp thoại), tròn hẳn cho huy hiệu. Không trộn quá hai mức bo trong một thành phần.

## Components

Khối mẫu đã qua cổng nằm ở `blocks/html/` (HTML/CSS thuần) và `blocks/react/` (React + shadcn/ui). Mỗi vùng dữ liệu có đủ bốn trạng thái: rỗng, đang tải, lỗi (kèm cách khắc phục), không có quyền.

## Do's and Don'ts

Nên:
- Một lời kêu gọi chính, màu `--accent`, cao tối thiểu 44px.
- Hình minh hoạ thật (ảnh sản phẩm, ảnh chụp màn hình) thay cho icon trang trí.
- Mỗi mục có một ý, tiêu đề nói thẳng ý đó.
- Tôn trọng `prefers-reduced-motion`; chuyển động 120–320ms, easing ra, không nảy.

Không nên:
- Không eyebrow / kicker viết hoa phía trên tiêu đề.
- Không chữ gradient, không nền lưới, không vầng sáng toả tròn.
- Không ba thẻ tính năng giống hệt nhau xếp hàng.
- Không dùng Inter / Roboto làm font mặc định.
