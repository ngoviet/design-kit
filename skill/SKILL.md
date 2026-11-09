---
name: design-kit
description: Build web or app UI that is beautiful, modern and usable on the first pass, and prove it with a measured gate before calling it done. Use whenever you create or restyle a page, screen, component, dashboard, landing page, form, report page, Home Assistant card or any HTML/CSS/React UI — pick a design direction (DESIGN.md + tokens), reuse gated blocks, then run `design-kit check` (axe WCAG 2.2 AA, overflow at 320px, text size and line height through shadow DOM, reduced motion, focus, Core Web Vitals, Impeccable) and show screenshots. Vietnamese: làm giao diện, thiết kế trang web, giao diện đẹp, dashboard, landing page, form, kiểm giao diện, chuẩn giao diện.
---

# design-kit: chuẩn + cổng cho giao diện do agent làm

Kit at `D:\code\design-kit` (run `design-kit` for its path, directions and blocks). Pair it with the
`impeccable` skill: impeccable gives direction and critique; design-kit gives the numbers, the tokens,
the gated blocks and the gate. Never call a UI task done on "it renders".

## 1. Pick the direction (before any markup)

| Surface | Direction | Files |
| --- | --- | --- |
| app, dashboard, admin, HA card, tool | **dem** (Đêm): dark-first, blue-tinted neutrals, one teal accent | `design/dem/DESIGN.md`, `tokens/dem.css` |
| docs, report, long article, guide | **giay** (Giấy): light-first, serif body Literata 18px, ink-blue accent | `design/giay/DESIGN.md`, `tokens/giay.css` |
| landing, marketing, product intro | **dam** (Đậm): bold Bricolage Grotesque display, vermilion accent | `design/dam/DESIGN.md`, `tokens/dam.css` |

- The project already has a `DESIGN.md` → follow it; the kit's thresholds still apply.
- No `DESIGN.md` → copy `design/<x>/DESIGN.md` to the project root and `tokens/fonts.css`, `tokens/core.css`,
  `tokens/<x>.css` next to the styles; set `<html lang="vi" data-dk="<x>">`. Ask the owner only when the
  surface fits two directions.
- Use tokens only: `var(--accent)`, `var(--sp-4)`, `var(--fs-lg)`… no raw hex, no font outside DESIGN.md.
  Text in the accent color uses `--accent-text`; fills use `--accent` with `--on-accent` text.

## 2. Start from a gated block

`blocks/html/` (plain HTML/CSS: works in static pages, Folio, Artifacts, Lit/Home Assistant) and
`blocks/react/src/blocks/` (React + shadcn/ui on the same tokens). Read the closest ones before writing:

| Block | Shows |
| --- | --- |
| `dau-trang` | sticky app bar, nav with `aria-current`, container-query collapse to a Menu button, skip link |
| `form-dang-nhap` (+React) | labels, `autocomplete="username"`/`current-password`, inline errors with `aria-invalid`, show-password, busy button |
| `bang-du-lieu` | sortable table (`aria-sort`), tabular numbers right-aligned, search + filter, rows become labelled stacks under 40rem |
| `trang-thai` (+React) | the four states of any data region: empty, loading skeleton, error with cause + retry + code, no permission |
| `chi-so` | KPI strip in one surface (not identical cards), deltas with arrow + words, sparkline |
| `hop-thoai` | native `<dialog>` confirm: safe button focused first, says what is lost |

Every data region you build needs all four states from `trang-thai`.

## 3. Gate: measure, fix, show

```bash
design-kit check <file.html|folder|http://localhost:port> --strict
```

- Renders 320/390/1280 px × light/dark through a local http server (so `../tokens` resolve), runs axe-core
  (WCAG 2.2 AA), the shadow-DOM-aware probe, reduced-motion, Tab focus, LCP/CLS, and Impeccable.
- **hard** = not done. **soft** = fix, or write the reason in your report. **human** = screenshots in
  `.design-kit/shots/<page>/`: open them yourself (Read the PNGs) and judge hierarchy before showing the owner.
- At most 3 fix rounds; still failing → report the remaining findings instead of looping.
- A Vite/React app: build it and check `dist/*.html`, or check the dev-server URL.
- Show the result per the owner's rules (Folio page on PC1, Artifact when remote) with the verdict line.

## Thresholds (sources in `docs/tieu-chi.md`)

Text contrast ≥ 4.5:1 (large 3:1), non-text ≥ 3:1, both themes · targets ≥ 24×24 px, primary buttons 44 ·
no horizontal scroll at 320 px · body ≥ 16 px, nothing under 12 px (SVG text counts at its rendered size) ·
body line-height ≥ 1.5, Vietnamese headings ≥ 1.2 · lines ≤ 75 chars (`max-width: var(--measure)` = 32em) ·
`lang="vi"` · every animation has a reduced-motion branch · visible focus ≥ 2 px not covered by sticky bars ·
LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 · 0 Impeccable slop findings.

## Traps already hit (do not repeat)

- **`ch` lies for Vietnamese.** In Be Vietnam Pro, 68ch held ~93 characters per line. Use `em` (`--measure: 32em`).
- **Font `@import` inside a token file vanishes when bundled.** Load `tokens/fonts.css` first (first `<link>` or first `@import`).
- **Impeccable does not see inside shadow DOM** (tested: missed 9.9 px text and 1.55:1 contrast in an open
  shadow root). `design-kit check` and axe do; for Web Components trust them, not `imp-axi` alone.
- **Scaled SVG text**: 13 px in a 900-wide viewBox renders ~5 px at 390 px. Give the figure a `min-width`
  inside a focusable scroll region, or redraw it vertically.
- **Scrollable regions** (`overflow:auto` tables) need `tabindex="0" role="region" aria-label`.
- **Label in name** (WCAG 2.5.3): a button showing "NV" needs "NV" inside its `aria-label`.
- **shadcn CLI** once wrote `import { cn } from "cn"` and installed an unrelated npm package `cn`: after
  `shadcn add`, grep for `from "cn"` and fix to `@/lib/utils`; resize inputs/buttons to 44 px (`h-11`).
- `npx @google/design.md lint` silently does nothing: use `npx -p @google/design.md designmd lint DESIGN.md`.
