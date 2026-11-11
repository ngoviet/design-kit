---
name: design-kit
description: Build web or app UI that is beautiful, modern and usable on the first pass, and prove it with a measured gate before calling it done. Use whenever you create or restyle a page, screen, component, dashboard, landing page, form, report page, Home Assistant card or any HTML/CSS/React UI — pick a design direction (DESIGN.md + tokens), reuse gated blocks, then run `design-kit check` (axe WCAG 2.2 AA, overflow at 320px, text size and line height through shadow DOM, reduced motion, focus, Core Web Vitals, Impeccable, states reached by clicking) and show screenshots. Also use when designing any user workflow, sign-up, booking, setup wizard, onboarding or first-run experience: plan a task map and guide the user step by step, just in time, like a good game tutorial. Vietnamese: làm giao diện, thiết kế trang web, giao diện đẹp, dashboard, landing page, form, kiểm giao diện, chuẩn giao diện, quy trình dễ dùng, hướng dẫn từng bước, làm đến đâu hướng dẫn đến đó, hướng dẫn người dùng mới.
---

# design-kit: chuẩn + cổng cho giao diện do agent làm

Run `design-kit` (no arguments) first: it prints the kit's folder (`kit:`), the directions, the blocks and
the `workflow` checklist. Paths below (`design/`, `tokens/`, `blocks/`) are inside that folder.
Not installed → the release tarball (README, Installation) or
`git clone https://github.com/ngoviet/design-kit && cd design-kit && npm ci && npm install -g .`,
then `design-kit setup` (browser + Impeccable engine).
Pair it with the `impeccable` skill: impeccable gives direction and critique; design-kit gives the numbers,
the tokens, the gated blocks and the gate. Never call a UI task done on "it renders".

## 1. Pick the direction (before any markup)

| Surface | Direction | Files |
| --- | --- | --- |
| app, dashboard, admin, HA card, tool | **dem** (Đêm): dark-first, blue-tinted neutrals, one teal accent | `design/dem/DESIGN.md`, `tokens/dem.css` |
| docs, report, long article, guide | **giay** (Giấy): light-first, serif body Literata 18px, ink-blue accent | `design/giay/DESIGN.md`, `tokens/giay.css` |
| landing, marketing, product intro | **dam** (Đậm): bold Bricolage Grotesque display, vermilion accent | `design/dam/DESIGN.md`, `tokens/dam.css` |

- The project already has a `DESIGN.md` → follow it; the kit's thresholds still apply.
- No `DESIGN.md` → copy `design/<x>/DESIGN.md` to the project root and `tokens/fonts.css`, `tokens/core.css`,
  `tokens/<x>.css` next to the styles; set `<html lang="vi" data-dk="<x>">`. Ask the user only when the
  surface fits two directions.
- Fonts: `tokens/fonts.css` loads Google Fonts. For a page on the home network, a Home Assistant card, an
  offline page or anything that must not call third parties, copy `tokens/fonts-local.css` **and** the
  `tokens/fonts/` folder instead (self-hosted woff2, Latin + Vietnamese, ~410 KB, SIL OFL). Load it first.
- A page the user opens from disk in the Claude app's browser pane (a report or review page): link the tokens
  while you build, then run `design-kit inline <page.html>` so the CSS lives in the page (traps below).
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
  design-kit doi-mau --huong dem --nhan 45 --trung-tinh 60 --ra ./dem.css
  ```
  Link that file instead of `tokens/dem.css`. Status colors (ok/warn/bad/info) keep their meaning hues.
  Re-check any hand-edited token file with `design-kit kiem-mau ./dem.css --huong dem`.
- Keep the default hue only when nothing about the brand points elsewhere.

## 2. Start from a gated block

`blocks/html/` (plain HTML/CSS: works in static pages, Folio, Artifacts, Lit/Home Assistant) and
`blocks/react/src/blocks/` (React + shadcn/ui on the same tokens). Read the closest ones before writing:

| Block | Shows |
| --- | --- |
| `dau-trang` | sticky app bar, nav with `aria-current`, container-query collapse to a Menu button, skip link |
| `form-dang-nhap` (+React) | labels, `autocomplete="username"`/`current-password`, inline errors with `aria-invalid`, show-password, busy button |
| `bang-du-lieu` (+React) | sortable table (`aria-sort`), tabular numbers right-aligned, search + filter, rows become labelled stacks under 40rem with a "Sắp xếp" select (column headers are gone there), no-match state that says why + "Xoá tìm kiếm và bộ lọc" |
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

The rule: however complex the process, the user must never feel lost. Good games teach by
playing, one thing at a time, exactly when it is needed. Plan this before markup, not after.

**First write a task map** in your plan or report, 3–6 lines: the user's main tasks, the steps of each,
and where a first-time user would hesitate (a field they don't understand, a choice with consequences,
an empty screen). Every hesitation point gets one of the patterns below.

| Situation | Pattern | Block |
| --- | --- | --- |
| A task with > 3 steps, or one done only occasionally (sign-up, booking, setup, import) | **Step-by-step flow**: named steps visible, "Bước 2/4", the next button says where it goes ("Tiếp: Chọn giờ khám"), Back keeps what was typed, a draft survives reload, last step = review with "Sửa" links | `trinh-tu` |
| First use of an app | **"Bắt đầu" checklist**, like a quest log: 3–5 real tasks, ticks itself when the task is done, progress bar, can be hidden and reopened from Help | `bat-dau` |
| A control that is new or easy to misread | **Just-in-time tip**: a small bubble next to that control the first time the user reaches it, one tip at a time, "Đã hiểu" + "Tắt mẹo", never blocks the page | `bat-dau` |
| An empty screen, or a search/filter with no match | **Empty state that teaches** the first action, or says why nothing matched and offers "Clear filters" (never a bare "No data") | `trang-thai`, `bang-du-lieu` |
| Many options, few used | **Progressive disclosure**: common options first, "Tuỳ chọn nâng cao" collapsed | — |
| A reversible action | **Undo** in a toast instead of an "Are you sure?" dialog; keep confirm dialogs for the irreversible | `thong-bao`, `hop-thoai` |

Rules backed by research (KB `tieu-chuan-va-cach-huong-dan-ai-…`, claims c29–c36):
- **No up-front tour.** NN/g found swipe-through tutorials did not improve task performance; people don't
  remember them. Teach in context instead, at the moment of use (Gee: information "just in time, on demand").
- Onboarding must be skippable and show progress.
- In flows, never label buttons just "Tiếp"/"Trước": name the next step.
- Also: smart defaults (pre-fill what you can infer), errors that say how to fix, and a "?" beside any
  field whose meaning is not obvious, with the answer inline rather than on another page.

The CLI reminds you too: `design-kit` (no arguments) prints this checklist as `workflow`, and every
`design-kit check` ends with a "Guide like a game" help line. The `guide` soft check flags what can be
measured: a button whose whole name is "Tiếp"/"Next", an empty-state sentence with no button or link
near it, and a tour library or "Chào mừng" modal open on load.

**Measure the guided states, not just the first screen.** Two ways, use both when they fit:
- URL switches, passed with `--query`: `?lan-dau=1` first run, `?buoc=3` a step, `?mo=1` an open dialog.
- A steps file beside the page, `<page>.steps.json`. `check` picks it up, also when checking a folder:
  ```json
  [
    { "name": "loi", "do": [{ "click": "button[type=submit]" }] },
    { "name": "buoc-3", "do": [{ "fill": ["#ten", "Hà"] }, { "click": "#tiep" }, { "click": "#tiep" }] },
    { "name": "menu", "viewports": [320, 390], "do": [{ "click": ".menu-btn" }] }
  ]
  ```
  Actions: `click`, `fill [sel,text]`, `check`, `select [sel,value]`, `press key|[sel,key]`, `hover`, `wait ms`.
  Each state starts from a fresh load, gets every check and its own verdict line (`page.html #loi`).
  A step that cannot be done is **hard**: fix the page, or limit the state with `viewports`.

Your report names the task map and which pattern covers each hesitation point.

## 3. Gate: measure, fix, show

```bash
design-kit check <file.html|folder|http://localhost:port> --strict
```

- Renders 320/390/1280 px × light/dark through a local http server (so `../tokens` resolve), runs axe-core
  (WCAG 2.2 AA), the shadow-DOM-aware probe, reduced-motion, Tab focus at 1280 and 390, LCP/CLS, the
  `guide` check, and Impeccable; then the same for every state in `<page>.steps.json` (section 2b).
- **hard** = not done. **soft** = fix, or write the reason in your report. **human** = screenshots in
  `.design-kit/shots/<page>/`: open them yourself (Read the PNGs) and judge hierarchy before showing the user.
- A blank page fails (`render`), and so do uncaught script errors and scripts/stylesheets that fail to load
  (`errors`). A component that lives inside a host app (a Home Assistant card, a widget) needs a test page that
  provides what the host provides: its custom elements (`ha-card` as a block element, `ha-icon` at
  `--mdc-icon-size`), the data (`hass`), `lang="vi"` and a width that follows the viewport. A `render` soft
  row "custom element never defined" (an empty one) or the note "not registered as custom elements" (one with
  children) names what the test page is missing. Findings caused by the test page
  are not the component's: say which ones you set aside and why.
- Each local file is also opened the way the Claude app's browser pane opens it (`data:text/html,…`, no
  server). `standalone` (soft) reports what the page loses there: linked stylesheets, empty tokens, a
  fallback font without Vietnamese letters, or a file over 400 KB (the pane opens at most 512 KiB). A page only
  ever served over http (an app
  build, a dev server) can say so in the report, or pass `--no-standalone`.
- At most 3 fix rounds; still failing → report the remaining findings instead of looping.
- **Fix the finding, not the layout.** A hard failure is fixed in place (drop an inner border, change a
  color, add a label). Never move sections to silence a finding: in the A/B test an agent cleared
  `nested-cards` by pushing the stock and delivery panels below a long table, and lost the dashboard.
  Compare the 1280 px screenshot before and after each round; the information order must not change.
- A Vite/React app: build it and check `dist/*.html`, or check the dev-server URL.
- Show the result the way the user prefers (a review page, an artifact or chat), with the verdict line and
  the screenshots that matter.

## Thresholds (sources in `docs/tieu-chi.md`)

Text contrast ≥ 4.5:1 (large 3:1), non-text ≥ 3:1, both themes · targets ≥ 24×24 px, primary buttons 44 ·
no horizontal scroll at 320 px · body ≥ 16 px, nothing under 12 px (SVG text and text under `transform`/`scale`/`zoom` count at rendered size) ·
body line-height ≥ 1.5, Vietnamese headings ≥ 1.2 · lines ≤ 75 chars (`max-width: var(--measure)` = 32em) ·
`lang="vi"` · every animation has a reduced-motion branch · visible focus ≥ 2 px not covered by sticky bars ·
LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 · 0 Impeccable slop findings · a page for the app's browser pane
keeps its CSS in the page and stays ≤ 400 KB (the pane refuses files over 512 KiB).

## Traps already hit (do not repeat)

- **`ch` lies for Vietnamese.** In Be Vietnam Pro, 68ch held ~93 characters per line. Use `em` (`--measure: 32em`).
- **Font `@import` inside a token file vanishes when bundled.** Load `tokens/fonts.css` first (first `<link>` or first `@import`).
- **The Claude app's browser pane drops every linked stylesheet.** It opens `file:///…/page.html` as
  `data:text/html,…`, so `<link href="core.css">` never resolves: bare Times text, empty `--accent`, while the
  gate (over http) passed (10/11/2026, a Giấy report page). Fix: `design-kit inline <page.html>` puts
  `core.css`, `<direction>.css` and `_base.css` into `<style>` tags in place and keeps the font `<link>` as an
  extra (it loads when a server is there). Do not embed fonts as base64 for the pane: it opens a file of at most
  512 KiB (524,288 bytes opened, 524,289 did not; the encoded URL length does not matter). The `standalone` check
  catches all of this.
- **A fallback font without Vietnamese letters breaks words** once the web font is missing: Georgia has no
  ắ, ế, ữ, so the browser borrows each one from Times New Roman and "Ngắn" reads "Ngắ n". Right after the web
  font, name a fallback that has them: `"Times New Roman", "Noto Serif", serif` (Giấy uses this now) or
  `system-ui, sans-serif`. `standalone` names the two fonts when it happens.
- **Impeccable does not see inside shadow DOM** (tested: missed 9.9 px text and 1.55:1 contrast in an open
  shadow root). `design-kit check` and axe do; for Web Components trust them, not `imp-axi` alone.
- **Scaled SVG text**: 13 px in a 900-wide viewBox renders ~5 px at 390 px. Give the figure a `min-width`
  inside a focusable scroll region, or redraw it vertically.
- **Fit-to-width by `transform: scale()`** (also `scale`, `zoom`) shrinks every label inside: a card diagram at
  `scale(0.55)` turns 12 px into 6.6 px. The gate counts the rendered size now; keep the scale floor high enough
  that the smallest label stays ≥ 12 px, or switch to a vertical layout / scroll region below that width.
- **Scrollable regions** (`overflow:auto` tables) need `tabindex="0" role="region" aria-label`.
- **Label in name** (WCAG 2.5.3): a button showing "NV" needs "NV" inside its `aria-label`.
- **shadcn CLI** once wrote `import { cn } from "cn"` and installed an unrelated npm package `cn`: after
  `shadcn add`, grep for `from "cn"` and fix to `@/lib/utils`; resize inputs/buttons to 44 px (`h-11`).
- **`[hidden]` loses to `display:grid/flex`** set by a class: hidden panels show anyway. `_base.css` has
  `[hidden]{display:none!important}`; keep it when you write your own CSS.
- **A tip must not cover the next control.** A floating bubble over the settings below hid a switch and
  failed contrast; put tips in the flow right under the control they explain. Watch CSS inheritance too:
  `.setting p { color: var(--text-2) }` also greys the text inside a tip.
- **Without a steps file the gate measures the first render only.** Give every state a URL switch
  (`?trang-thai=tai|loi|quyen`, `?mo=1` for open dialogs/toasts) and pass them with `--query`, and put
  the clicks (error → sending → success, open menu, sort) in `<page>.steps.json`. Both A/B agents who
  scripted states found bugs the default run missed; the kit's own table did too (next item).
- **A table can pass the gate yet hide columns** inside its own horizontal scroll (`inner-scroll` soft
  finding): under ~40rem turn rows into labelled stacks, as `bang-du-lieu` does.
- **Truncation hides content too** (`text-clip` soft finding): a fixed-width card whose sub line ends in
  "… 5 phía s…" at 1280 px passes every size and contrast check. Let the line wrap, widen the box, or keep the
  full text reachable. `truncate` or `overflow:hidden` also cuts Vietnamese accents: stacked marks in Be Vietnam
  Pro rise 0.25em above the font's ascent, so even `line-height:1.5` trims the hook of "Ổ" and `leading-none`
  turns "Ổn định" into "Ön đinh". Give the clipped box `padding-block: 0.25em`, or clip only the inline axis
  (`overflow-x: clip; overflow-y: visible`, ellipsis still works).
- **Stacked rows lose the column headers, and with them sorting.** The kit's `bang-du-lieu` hid `thead`
  sr-only under 40rem: on a phone nobody could sort, and Tab landed on invisible sort buttons. The steps
  file caught it ("click … failed" at 320/390). Under 40rem: `thead{display:none}` plus a "Sắp xếp" select.
  Any control you hide at some width must leave the Tab order too (`display:none`, not clipping).
- **A sort state is a promise.** `aria-sort="ascending"` (or a "A → Z" label) on load means the rows must
  really be in that order: sort on load. The gate passes a lying table; only the screenshot shows it.
- **tailwind-merge replaces, not adds**: `className="max-w-md"` on a shadcn dialog drops its
  `max-w-[calc(100%-2rem)]` mobile margin. Use `sm:max-w-md`.
- `npx @google/design.md lint` silently does nothing: use `npx -p @google/design.md designmd lint DESIGN.md`.
