# Many color themes, chosen by each person

The owner's apps ship several themes and let each person pick one, with light, dark or follow-the-device (24/11/2026). Start
from the nine solved themes, or solve your own palette with the same solver.

## Use the nine themes

| File | What |
| --- | --- |
| `tokens/themes.css` | 9 themes × light/dark, generated; load it **after** `tokens/<direction>.css` |
| `blocks/html/chon-mau.html` | the picker: swatches, Theo máy/Sáng/Tối, live preview, Undo, applied before first paint |
| `data/themes.json` | seeds (edit these, never the CSS) |
| `tokens/NOTICE-themes.txt` | MIT notices of Flexoki, Rosé Pine, Kanagawa, Everforest: ship it with the CSS |

```html
<html lang="vi" data-dk="dem" data-chu-de="gomlam" data-theme="dark">   <!-- no data-chu-de: the direction's own colors -->
<body style="background-image: var(--nen-trang, none)">                  <!-- optional gradient and pattern -->
```

`neon` `flexoki` (Giấy và mực) `gomlam` (Gốm lam) `rosepine` (Hồng thông) `sanchoi` (Sân chơi, the suggestion for children) `sonmai`
(Sơn mài) `hoian` (Phố Hội) `kanagawa` (Sóng lừng) `everforest` (Rừng thông). Neon dark is the owner's fixed palette: do not re-solve it.

## Rules for the picker

1. **Before first paint**: a short script in `<head>`, before any stylesheet, reads `localStorage` and sets `data-chu-de` and
   `data-theme`; unknown values are ignored. Later means a flash of the wrong theme.
2. **Per person**: the server stores theme and mode per user, null = default; `localStorage` is only a copy for the next first paint.
   Write only the field that was sent, so two open windows do not overwrite each other. Adding themes never changes anyone's current one.
3. **Three modes**, follow-the-device first. Native apps follow the system instead (Apple HIG).
4. **Undo returns to the theme at the start of the visit**, not to the one passed through, and stays on screen.
5. Swatches show **their own** theme's colors in the mode now applied (`[data-mau]`, `--m-*`), not the current theme's.
6. `theme-color` follows the page background; `color-scheme` is set by each theme.
7. The list lives in several places (server, seeds, CSS, head script, picker): one test compares them all.
8. Gate every theme, not only the default: `design-kit check page.html --query "chu-de=neon,chu-de=flexoki,…"`.

## Solve your own palette

Seeds per mode: `bg surface surface2 border text text2 accent ok warn bad info` (`edge`, `border2`, `tren`, `pattern` optional), all `#rrggbb`.
Same shape as `data/themes.json`.

```bash
node <kit>/scripts/sinh-themes.mjs my-themes.json --ra themes.css     # exit 1 lists the pairs that fail
```

How it works: OKLCH; each role keeps hue and chroma and moves only in lightness, away from **every** background it is used on, until
both measures pass.

| Role | WCAG 2 | APCA Lc |
| --- | --- | --- |
| text on bg, edge, surface, surface-2, accent-soft | 7:1 | 75 |
| text-2, accent-text, status text on their backgrounds, on-accent on accent | 4.5:1 | 60 |
| border-strong, focus, accent as a shape | 3:1 | — |
| karaoke: read vs unread text ≥ 0.12 OKLab; current-word background vs its panel ≥ 0.05 | | |

- Famous palettes usually need 0.04–0.13 of lightness before their accents pass; that is why the values differ from the originals.
- Reduce chroma to stay inside sRGB; tint neutrals slightly with one hue; keep accents in one lightness band per mode.
- Serif headings fall back to Times New Roman, never Georgia (no stacked Vietnamese accents).
- Light cream backgrounds trigger Impeccable's `cream-palette` (soft): with a palette the person chose, write that as the reason.
