---
version: alpha
name: "design-kit · Đêm"
description: "Hướng thẩm mỹ cho ứng dụng, dashboard, công cụ quản trị, card Home Assistant. Sinh từ tokens/core.css + tokens/dem.css — sửa CSS rồi chạy lại scripts/tao-design-md.mjs, không sửa tay tệp này."
colors:
  primary: "oklch(0.500 0.088 182)"
  on-primary: "oklch(0.990 0.005 182)"
  primary-text: "oklch(0.470 0.082 182)"
  primary-soft: "oklch(0.950 0.030 182)"
  background: "oklch(0.985 0.004 250)"
  surface: "oklch(0.997 0.001 250)"
  surface-variant: "oklch(0.955 0.008 250)"
  outline: "oklch(0.885 0.012 250)"
  on-surface: "oklch(0.230 0.020 250)"
  on-surface-variant: "oklch(0.450 0.020 250)"
  success: "oklch(0.480 0.120 150)"
  success-soft: "oklch(0.955 0.035 150)"
  warning: "oklch(0.500 0.100 65)"
  warning-soft: "oklch(0.960 0.034 80)"
  error: "oklch(0.520 0.170 25)"
  error-soft: "oklch(0.955 0.020 25)"
  info: "oklch(0.490 0.120 250)"
  info-soft: "oklch(0.955 0.020 250)"
typography:
  display:
    fontFamily: Be Vietnam Pro
    fontSize: 2.45rem
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: -0.012em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 2.45rem
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: -0.012em
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
    fontFamily: Be Vietnam Pro
    fontSize: 1rem
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

# design-kit · Đêm

Dùng cho: ứng dụng, dashboard, công cụ quản trị, card Home Assistant. Token gốc ở `tokens/core.css` và `tokens/dem.css`; gắn `data-dk="dem"` lên `<html>`.

## Overview

Giao diện làm việc, đọc nhanh và dày thông tin. Tối là chế độ chính, sáng là bản phụ có cùng cấu trúc. Trung tính nhuốm lam rất nhẹ (h 250) để nền tối không chết, một màu nhấn xanh ngọc duy nhất dành cho hành động chính và trạng thái chọn. Không trang trí: phân cấp bằng cỡ chữ, độ đậm và khoảng cách, không bằng gradient hay bóng đổ lớn.

## Colors

Mọi cặp chữ/nền đã kiểm bằng `node scripts/kiem-cap-mau.mjs`: chữ ≥ 4.5:1, viền ô nhập và vòng focus ≥ 3:1, ở cả sáng lẫn tối, trong gamut sRGB. Dùng màu theo vai trò, không theo sắc:

- `primary` để tô nền nút chính; chữ màu nhấn dùng `primary-text` (đậm hơn một chút để đạt 4.5:1 trên nền).
- `*-soft` là nền nhạt cho huy hiệu và thông báo; chữ trên đó dùng màu đậm cùng tên.
- Màu trạng thái luôn kèm chữ hoặc icon.

Bản tối (khi `prefers-color-scheme: dark` hoặc `data-theme="dark"`):

| Token | Biến CSS | Sáng | Tối |
| --- | --- | --- | --- |
| `primary` | `--accent` | `oklch(0.500 0.088 182)` | `oklch(0.780 0.115 178)` |
| `on-primary` | `--on-accent` | `oklch(0.990 0.005 182)` | `oklch(0.180 0.030 178)` |
| `primary-text` | `--accent-text` | `oklch(0.470 0.082 182)` | `oklch(0.800 0.105 178)` |
| `primary-soft` | `--accent-soft` | `oklch(0.950 0.030 182)` | `oklch(0.270 0.040 178)` |
| `background` | `--bg` | `oklch(0.985 0.004 250)` | `oklch(0.170 0.012 250)` |
| `surface` | `--surface` | `oklch(0.997 0.001 250)` | `oklch(0.205 0.014 250)` |
| `surface-variant` | `--surface-2` | `oklch(0.955 0.008 250)` | `oklch(0.245 0.016 250)` |
| `outline` | `--border` | `oklch(0.885 0.012 250)` | `oklch(0.330 0.018 250)` |
| `on-surface` | `--text` | `oklch(0.230 0.020 250)` | `oklch(0.930 0.010 250)` |
| `on-surface-variant` | `--text-2` | `oklch(0.450 0.020 250)` | `oklch(0.760 0.015 250)` |
| `success` | `--ok` | `oklch(0.480 0.120 150)` | `oklch(0.790 0.140 150)` |
| `success-soft` | `--ok-soft` | `oklch(0.955 0.035 150)` | `oklch(0.270 0.045 150)` |
| `warning` | `--warn` | `oklch(0.500 0.100 65)` | `oklch(0.830 0.120 80)` |
| `warning-soft` | `--warn-soft` | `oklch(0.960 0.034 80)` | `oklch(0.280 0.045 80)` |
| `error` | `--bad` | `oklch(0.520 0.170 25)` | `oklch(0.770 0.130 25)` |
| `error-soft` | `--bad-soft` | `oklch(0.955 0.020 25)` | `oklch(0.270 0.050 25)` |
| `info` | `--info` | `oklch(0.490 0.120 250)` | `oklch(0.780 0.100 250)` |
| `info-soft` | `--info-soft` | `oklch(0.955 0.020 250)` | `oklch(0.270 0.045 250)` |
| `outline-strong (viền ô nhập)` | `--border-strong` | `oklch(0.62 0.02 250)` | `oklch(0.55 0.02 250)` |
| `focus (vòng focus)` | `--focus` | `oklch(0.500 0.088 182)` | `oklch(0.780 0.115 178)` |

## Typography

Be Vietnam Pro cho mọi chữ (thiết kế cho tiếng Việt, dấu chồng không bị cắt). Số liệu và mã dùng JetBrains Mono với `font-variant-numeric: tabular-nums`. Thân 16px, chữ phụ 14px, nhãn nhỏ nhất 12px.

Thang tỉ lệ 1.25: 12 · 14 · 16 · 20 · 25 · 31 · 39 px, các bậc lớn co giãn bằng `clamp()` (xem `--fs-*` trong `tokens/core.css`). Tiêu đề giãn dòng ≥ 1.2 để dấu tiếng Việt không chạm dòng trên. Luôn đặt `lang="vi"`.

## Layout

Lưới 12 cột, khoảng cách bậc 4px. Mật độ cao nhưng mỗi nhóm cách nhau ít nhất `--sp-5` (24px). Thành phần tự co theo khung chứa bằng container queries, không theo bề rộng màn hình.

Bề rộng tối thiểu phải chạy được: 320px, không cuộn ngang. Vùng bấm ≥ 24×24px, nút chính ≥ 44px.

## Elevation & Depth

Hai mức bóng: `--shadow-1` (tách nhẹ, thẻ nằm yên) và `--shadow-2` (lớp nổi: menu, hộp thoại). Ở chế độ tối, độ sâu đến từ nền sáng dần (`background` → `surface` → `surface-variant`), bóng chỉ phụ.

## Shapes

Bo góc 6px (ô nhập, nút nhỏ), 10px (nút, thẻ nhỏ), 16px (thẻ lớn, hộp thoại), tròn hẳn cho huy hiệu. Không trộn quá hai mức bo trong một thành phần.

## Components

Khối mẫu đã qua cổng nằm ở `blocks/html/` (HTML/CSS thuần) và `blocks/react/` (React + shadcn/ui). Mỗi vùng dữ liệu có đủ bốn trạng thái: rỗng, đang tải, lỗi (kèm cách khắc phục), không có quyền.

## Do's and Don'ts

Nên:
- Một hành động chính mỗi vùng, dùng `--accent`; hành động phụ dùng nút viền.
- Màu trạng thái luôn đi kèm chữ hoặc icon, không dùng màu làm tín hiệu duy nhất.
- Số liệu dùng mono + tabular-nums để cột thẳng hàng.
- Tôn trọng `prefers-reduced-motion`; chuyển động 120–320ms, easing ra, không nảy.

Không nên:
- Không đặt thẻ trong thẻ; không dùng viền trái màu làm điểm nhấn.
- Không glow, không gradient tím/xanh trên nền tối.
- Không chữ dưới 12px, kể cả nhãn biểu đồ.
- Không dùng Inter / Roboto làm font mặc định.
