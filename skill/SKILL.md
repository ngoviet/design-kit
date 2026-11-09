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

### 1b. Color comes from the brand, not from the surface type

The direction gives structure (rhythm, type, density, light/dark). The **hue** must fit the brand and domain:
a bakery dashboard in the default teal reads like generic SaaS. In the A/B test (09/11/2026) that was
the one brief the kit lost to plain Opus, whose warm brown fit a bakery.

- Ask: what does this brand or domain feel like? Food and craft → warm (accent 25–70, neutrals 50–70).
  Health → green/teal (145–185). Finance, tools → blue (240–260). Kids, play → warm or vivid (25–45, 300–330).
  Use a hue the brand already has when there is one.
- Generate the swapped tokens, which re-solve lightness so every pair stays ≥ 4.5:1:
  ```bash
  node D:/code/design-kit/scripts/doi-mau.mjs --huong dem --nhan 45 --trung-tinh 60 --ra ./dem.css
  ```
  Link that file instead of `tokens/dem.css`. Status colors (ok/warn/bad/info) keep their meaning hues.
- Keep the default hue only when nothing about the brand points elsewhere.

## 2. Start from a gated block

`blocks/html/` (plain HTML/CSS: works in static pages, Folio, Artifacts, Lit/Home Assistant) and
`blocks/react/src/blocks/` (React + shadcn/ui on the same tokens). Read the closest ones before writing:

| Block | Shows |
| --- | --- |
| `dau-trang` | sticky app bar, nav with `aria-current`, container-query collapse to a Menu button, skip link |
| `form-dang-nhap` (+React) | labels, `autocomplete="username"`/`current-password`, inline errors with `aria-invalid`, show-password, busy button |
| `bang-du-lieu` (+React) | sortable table (`aria-sort`), tabular numbers right-aligned, search + filter, rows become labelled stacks under 40rem |
| `trang-thai` (+React) | the four states of any data region: empty, loading skeleton, error with cause + retry + code, no permission |
| `chi-so` | KPI strip in one surface (not identical cards), deltas with arrow + words, sparkline |
| `hop-thoai` (+React) | native `<dialog>` confirm: safe button focused first, says what is lost |
| `hero` | landing hero: one idea, one primary CTA, a real product view built in HTML (not SVG text), reasons as a list not 3 cards |
| `bai-viet` | long article: breadcrumb, meta, lead, sticky TOC on wide screens, quote, table in a focusable scroll region, note |
| `thanh-ben` | app shell: sticky sidebar ≥ 60rem, `<dialog>` drawer below, grouped nav with `aria-current` |
| `thong-bao` | toasts in an `aria-live` region, pause on hover/focus, errors stay, Undo on delete |
| `trinh-tu` | step-by-step flow: named steps, "Bước 2/4" + time left, next button names the next step, Back keeps input, draft in sessionStorage, review step with "Sửa", `?buoc=N` |
| `bat-dau` | first-run "Bắt đầu" checklist that ticks itself, hide/reopen from Help; just-in-time tip inline under the control (never overlapping), "Đã hiểu" / "Tắt mẹo", `?lan-dau=1` |
| `bo-loc` | filter chips (`aria-pressed`), result count via `aria-live`, pagination with `aria-current` and "21–40 of 312" |

Every data region you build needs all four states from `trang-thai`.

**Dashboards: keep the glance.** Before writing, list what the user must see without scrolling (today's
numbers, what needs action now: low stock, next deliveries, alerts) and put it in the first screen at
1280 px, beside or above the long table, never below it. A long table goes last or gets its own column.

## 2b. Make every workflow easy: guide like a good game

The owner's rule: however complex the process, the user must never feel lost. Good games teach by
playing, one thing at a time, exactly when it is needed. Plan this before markup, not after.

**First write a task map** in your plan or report, 3–6 lines: the user's main tasks, the steps of each,
and where a first-time user would hesitate (a field they don't understand, a choice with consequences,
an empty screen). Every hesitation point gets one of the patterns below.

| Situation | Pattern | Block |
| --- | --- | --- |
| A task with > 3 steps, or one done only occasionally (sign-up, booking, setup, import) | **Step-by-step flow**: named steps visible, "Bước 2/4", the next button says where it goes ("Tiếp: Chọn giờ khám"), Back keeps what was typed, a draft survives reload, last step = review with "Sửa" links | `trinh-tu` |
| First use of an app | **"Bắt đầu" checklist**, like a quest log: 3–5 real tasks, ticks itself when the task is done, progress bar, can be hidden and reopened from Help | `bat-dau` |
| A control that is new or easy to misread | **Just-in-time tip**: a small bubble next to that control the first time the user reaches it, one tip at a time, "Đã hiểu" + "Tắt mẹo", never blocks the page | `bat-dau` |
| An empty screen | **Empty state that teaches** the first action (not "No data") | `trang-thai` |
| Many options, few used | **Progressive disclosure**: common options first, "Tuỳ chọn nâng cao" collapsed | — |
| A reversible action | **Undo** in a toast instead of an "Are you sure?" dialog; keep confirm dialogs for the irreversible | `thong-bao`, `hop-thoai` |

Rules backed by research (KB `tieu-chuan-va-cach-huong-dan-ai-…`, claims c29–c36):
- **No up-front tour.** NN/g found swipe-through tutorials did not improve task performance; people don't
  remember them. Teach in context instead, at the moment of use (Gee: information "just in time, on demand").
- Onboarding must be skippable and show progress.
- In flows, never label buttons just "Tiếp"/"Trước": name the next step.
- Also: smart defaults (pre-fill what you can infer), errors that say how to fix, and a "?" beside any
  field whose meaning is not obvious, with the answer inline rather than on another page.

Make each guidance state reachable by URL for the gate (`?lan-dau=1` first run, `?buoc=3` a step) and
pass them with `--query`. Your report names the task map and which pattern covers each hesitation point.

## 3. Gate: measure, fix, show

```bash
design-kit check <file.html|folder|http://localhost:port> --strict
```

- Renders 320/390/1280 px × light/dark through a local http server (so `../tokens` resolve), runs axe-core
  (WCAG 2.2 AA), the shadow-DOM-aware probe, reduced-motion, Tab focus, LCP/CLS, and Impeccable.
- **hard** = not done. **soft** = fix, or write the reason in your report. **human** = screenshots in
  `.design-kit/shots/<page>/`: open them yourself (Read the PNGs) and judge hierarchy before showing the owner.
- At most 3 fix rounds; still failing → report the remaining findings instead of looping.
- **Fix the finding, not the layout.** A hard failure is fixed in place (drop an inner border, change a
  color, add a label). Never move sections to silence a finding: in the A/B test an agent cleared
  `nested-cards` by pushing the stock and delivery panels below a long table, and lost the dashboard.
  Compare the 1280 px screenshot before and after each round; the information order must not change.
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
- **`[hidden]` loses to `display:grid/flex`** set by a class: hidden panels show anyway. `_base.css` has
  `[hidden]{display:none!important}`; keep it when you write your own CSS.
- **A tip must not cover the next control.** A floating bubble over the settings below hid a switch and
  failed contrast; put tips in the flow right under the control they explain. Watch CSS inheritance too:
  `.setting p { color: var(--text-2) }` also greys the text inside a tip.
- **The gate measures the first render only.** Give every state a URL switch (`?trang-thai=tai|loi|quyen`,
  `?mo=1` for open dialogs/toasts) and pass them with `--query`, or script the clicks (Playwright) for
  error → sending → success. Both A/B agents who did this found bugs the default run missed.
- **A table can pass the gate yet hide columns** inside its own horizontal scroll (`inner-scroll` soft
  finding): under ~40rem turn rows into labelled stacks, as `bang-du-lieu` does.
- **tailwind-merge replaces, not adds**: `className="max-w-md"` on a shadcn dialog drops its
  `max-w-[calc(100%-2rem)]` mobile margin. Use `sm:max-w-md`.
- `npx @google/design.md lint` silently does nothing: use `npx -p @google/design.md designmd lint DESIGN.md`.
