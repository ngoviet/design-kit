# Traps already hit (do not repeat)

Every item here broke a real page or passed a broken one through the gate. Read the group that matches what you are
building before you write it, and again when a finding names it.

Contents:

1. [Vietnamese text and fonts](#1-vietnamese-text-and-fonts)
2. [Phones and narrow widths](#2-phones-and-narrow-widths)
3. [Tables and data](#3-tables-and-data)
4. [Focus, keyboard, labels](#4-focus-keyboard-labels)
5. [States, tips and hidden things](#5-states-tips-and-hidden-things)
6. [Pages opened in the Claude app's browser pane](#6-pages-opened-in-the-claude-apps-browser-pane)
7. [Frameworks and tools](#7-frameworks-and-tools)
8. [Web components and host apps](#8-web-components-and-host-apps)

## 1. Vietnamese text and fonts

- **`ch` lies for Vietnamese.** In Be Vietnam Pro, 68ch held ~93 characters per line. Use `em` (`--measure: 32em`).
- **Font `@import` inside a token file vanishes when bundled.** Load `tokens/fonts.css` first (first `<link>` or first
  `@import`).
- **A fallback font without Vietnamese letters breaks words** once the web font is missing: Georgia has no ắ, ế, ữ, so
  the browser borrows each one from Times New Roman and "Ngắn" reads "Ngắ n". Right after the web font, name a fallback
  that has them: `"Times New Roman", "Noto Serif", serif` (Giấy uses this now) or `system-ui, sans-serif`. `standalone`
  names the two fonts when it happens.
- **Truncation cuts Vietnamese accents.** `truncate` or `overflow:hidden` cuts more than words: stacked marks in Be
  Vietnam Pro rise 0.25em above the font's ascent, so even `line-height:1.5` trims the hook of "Ổ" and `leading-none`
  turns "Ổn định" into "Ön đinh". Give the clipped box `padding-block: 0.25em`, or clip only the inline axis
  (`overflow-x: clip; overflow-y: visible`, ellipsis still works). A fixed-width card whose sub line ends in
  "… 5 phía s…" at 1280 px passes every size and contrast check: let it wrap, widen the box, or keep the full text
  reachable (`text-clip`).

## 2. Phones and narrow widths

- **No viewport meta, no phone layout.** Without `<meta name="viewport" content="width=device-width, initial-scale=1">`
  a phone lays the page out 980px wide and shrinks it: 16px text shows at 6.4px. It is the leading root cause of
  broken AI-made pages (46% in a 2026 study). `viewport` (hard) catches it.
- **`<figure>` keeps 40px side margins.** The browser's default margin left the hero block's product view 208px wide at
  320px, and three grid cells too narrow: "Camera" showed as "Camer" and "23/26" as "23/2", hidden under the next
  cell. Every other check passed. Reset `margin: 0` on figures, give cells room, and shrink padding or numbers with a
  container query below the width where text stops fitting. `text-covered` catches text painted over by the next box.
- **Typing fields under 16px zoom the page on iOS.** Tapping an input, select or textarea with small text zooms the
  whole page in and leaves it there. Use 16px on phones (`font-size: max(16px, 1em)`); `input-zoom` reports them.
- **Scaled SVG text**: 13 px in a 900-wide viewBox renders ~5 px at 390 px. Give the figure a `min-width` inside a
  focusable scroll region, or redraw it vertically.
- **Fit-to-width by `transform: scale()`** (also `scale`, `zoom`) shrinks every label inside: a card diagram at
  `scale(0.55)` turns 12 px into 6.6 px. The gate counts the rendered size; keep the scale floor high enough that the
  smallest label stays ≥ 12 px, or switch to a vertical layout / scroll region below that width.
- **The narrowest width breaks first.** Since 15/11/2026 the gate measures 320px fully (before, only overflow). Look at
  the 320 screenshots, not only 390.

## 3. Tables and data

- **Scrollable regions** (`overflow:auto` tables) need `tabindex="0" role="region" aria-label`.
- **A table can pass the gate yet hide columns** inside its own horizontal scroll (`inner-scroll` soft finding): under
  ~40rem turn rows into labelled stacks, as `bang-du-lieu` does.
- **Stacked rows lose the column headers, and with them sorting.** The kit's `bang-du-lieu` hid `thead` sr-only under
  40rem: on a phone nobody could sort, and Tab landed on invisible sort buttons. The steps file caught it ("click …
  failed" at 320/390). Under 40rem: `thead{display:none}` plus a "Sắp xếp" select.
- **A sort state is a promise.** `aria-sort="ascending"` (or a "A → Z" label) on load means the rows must really be in
  that order: sort on load. The gate passes a lying table; only the screenshot shows it.

## 4. Focus, keyboard, labels

- **A focus ring drawn only with box-shadow vanishes in forced-colors mode** (Windows High Contrast removes
  box-shadow). Add `outline: 2px solid transparent` beside it; the system recolors the outline. Tailwind v4:
  `outline-hidden` (it adds that outline only inside `@media (forced-colors: active)`), not `outline-none`. The kit's
  own shadcn blocks had this until 15/11/2026; `focus` reports it.
- **Any control you hide at some width must leave the Tab order too** (`display:none`, not clipping): sr-only elements
  still take focus.
- **Label in name** (WCAG 2.5.3): a button showing "NV" needs "NV" inside its `aria-label`.

## 5. States, tips and hidden things

- **Without a steps file the gate measures the first render only.** Give every state a URL switch
  (`?trang-thai=tai|loi|quyen`, `?mo=1` for open dialogs/toasts) and pass them with `--query`, and put the clicks
  (error → sending → success, open menu, sort) in `<page>.steps.json`. Both A/B agents who scripted states found bugs
  the default run missed; the kit's own table did too.
- **A tip must not cover the next control.** A floating bubble over the settings below hid a switch and failed
  contrast; put tips in the flow right under the control they explain. Watch CSS inheritance too:
  `.setting p { color: var(--text-2) }` also greys the text inside a tip.
- **`[hidden]` loses to `display:grid/flex`** set by a class: hidden panels show anyway. `_base.css` has
  `[hidden]{display:none!important}`; keep it when you write your own CSS.
- **A state shown only after the page's own timer** (a fake "sending…" for 900 ms) needs a `wait` in the steps file:
  the gate waits for the network to go quiet, not for timers.

## 6. Pages opened in the Claude app's browser pane

- **The pane drops every linked stylesheet.** It opens `file:///…/page.html` as `data:text/html,…`, so
  `<link href="core.css">` never resolves: bare Times text, empty `--accent`, while the gate (over http) passed
  (10/11/2026, a Giấy report page). Fix: `design-kit inline <page.html>` puts `core.css`, `<direction>.css` and
  `_base.css` into `<style>` tags in place and keeps the font `<link>` as an extra.
- **Do not embed fonts as base64 for the pane:** it opens a file of at most 512 KiB (524,288 bytes opened, 524,289 did
  not; the encoded URL length does not matter). The `standalone` check catches all of this.

## 7. Frameworks and tools

- **shadcn CLI** once wrote `import { cn } from "cn"` and installed an unrelated npm package `cn`: after `shadcn add`,
  grep for `from "cn"` and fix to `@/lib/utils`; resize inputs/buttons to 44 px (`h-11`); replace `outline-none` with
  `outline-hidden` (section 4).
- **tailwind-merge replaces, not adds**: `className="max-w-md"` on a shadcn dialog drops its `max-w-[calc(100%-2rem)]`
  mobile margin. Use `sm:max-w-md`.
- **`npx @google/design.md lint`** silently does nothing: use `npx -p @google/design.md designmd lint DESIGN.md`.
- **Fix the finding, not the layout.** In the A/B test an agent cleared `nested-cards` by pushing the stock and delivery
  panels below a long table, and lost the dashboard. Compare the 1280 px screenshot before and after each round.

## 8. Web components and host apps

- **Impeccable does not see inside shadow DOM** (missed 9.9 px text and 1.55:1 contrast in an open shadow root). Its
  author confirmed the cause and planned a fix after release 4.9.0 (pbakaus/impeccable#1360). Until then, for Web
  Components trust `design-kit check` and axe, not `imp-axi` alone.
- **A component that lives inside a host app** (a Home Assistant card, a widget) needs a test page that provides what
  the host provides: its custom elements (`ha-card` as a block element, `ha-icon` at `--mdc-icon-size`), the data
  (`hass`), `lang="vi"`, the viewport meta and a width that follows the viewport. Findings caused by the test page are
  not the component's: say which ones you set aside and why.
