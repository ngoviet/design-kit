---
name: design-kit
description: Build web or app UI that is beautiful, modern and usable on the first pass, and prove it with a measured gate before calling it done. Use whenever you create or restyle a page, screen, component, dashboard, landing page, form, report page, Home Assistant card or any HTML/CSS/React UI — pick a design direction (DESIGN.md + tokens), reuse gated blocks, then run `design-kit check` (axe WCAG 2.2 AA, overflow at 320px, text size and line height through shadow DOM, reduced motion, focus, Core Web Vitals, Impeccable, states reached by clicking) and show screenshots. Also use when designing any user workflow, sign-up, booking, setup wizard, onboarding or first-run experience: plan a task map and guide the user step by step, just in time, like a good game tutorial. Also use to score or check a logo, icon, symbol or illustration (`design-kit check-image`). Vietnamese: chấm điểm logo, icon, biểu tượng, ký hiệu, hình vẽ, làm giao diện, thiết kế trang web, giao diện đẹp, dashboard, landing page, form, kiểm giao diện, chuẩn giao diện, quy trình dễ dùng, hướng dẫn từng bước, làm đến đâu hướng dẫn đến đó, hướng dẫn người dùng mới.
---

# design-kit: chuẩn + cổng cho giao diện do agent làm

Run `design-kit` (no arguments) first: it prints the kit's folder (`kit:`), the directions, the blocks and the
`workflow` checklist. Paths below (`design/`, `tokens/`, `blocks/`) are inside that folder. Not installed → the release
tarball (README, Installation) or `git clone https://github.com/ngoviet/design-kit && cd design-kit && npm ci && npm
install -g .`, then `design-kit setup`. Pair it with the `impeccable` skill: impeccable gives direction and critique;
design-kit gives the numbers, the tokens, the gated blocks and the gate.

## Rules (they come first so they survive a long session)

1. Before markup: pick a direction (§1) and write a task map (§2b).
2. Build from the closest gated block (§2). Tokens only: no raw hex, no font outside DESIGN.md.
3. Every fact you filled in yourself gets `data-assumed` (§2c).
4. Run `design-kit check <page|folder|url> --strict` (§3). **hard** = not done. **soft** = fix, or write the reason.
   At most 3 fix rounds; fix the finding, not the layout.
5. Open the screenshots yourself (`.design-kit/shots/<page>/`, 320/390/1280 × light/dark) and judge hierarchy before
   showing the user. Never call a UI task done on "it renders".
6. Your report gives the verdict line, the task map with the pattern for each hesitation point, the `assumed` list for
   the user to confirm, and every soft finding you left with its reason.
7. Before you build something a trap covers, read that group in `reference/traps.md`: Vietnamese text and fonts,
   phones and narrow widths, tables, focus, states and tips, pages for the Claude app's browser pane,
   shadcn/Tailwind, web components and host apps.

## 1. Pick the direction (before any markup)

| Surface | Direction | Files |
| --- | --- | --- |
| app, dashboard, admin, HA card, tool | **dem** (Đêm): dark-first, blue-tinted neutrals, one teal accent | `design/dem/DESIGN.md`, `tokens/dem.css` |
| docs, report, long article, guide | **giay** (Giấy): light-first, serif body Literata 18px, ink-blue accent | `design/giay/DESIGN.md`, `tokens/giay.css` |
| landing, marketing, product intro | **dam** (Đậm): bold Bricolage Grotesque display, vermilion accent | `design/dam/DESIGN.md`, `tokens/dam.css` |

- The project has a `DESIGN.md` → follow it; the kit's thresholds still apply. Ask only when the surface fits two
  directions.
- No `DESIGN.md` → copy `design/<x>/DESIGN.md` to the project root and `tokens/fonts.css`, `tokens/core.css`,
  `tokens/<x>.css` next to the styles; `<html lang="vi" data-dk="<x>">` and
  `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Home network, Home Assistant card, offline page, no third parties: `tokens/fonts-local.css` **and** `tokens/fonts/`
  (self-hosted woff2, ~410 KB, SIL OFL) instead of `fonts.css`. Load fonts first.
- A page the user opens from disk in the Claude app's browser pane: link the tokens while you build, then
  `design-kit inline <page.html>`.
- Text in the accent color uses `--accent-text`; fills use `--accent` with `--on-accent` text.

**Color comes from the brand, not the surface type.** The direction gives structure; the hue must fit the domain. A
bakery dashboard in the default teal lost the A/B test to plain Opus's warm brown. Food and craft → warm (accent
25–70, neutrals 50–70); health → 145–185; finance, tools → 240–260; kids → 25–45 or 300–330; a brand hue wins. Re-hue
while every pair keeps ≥ 4.5:1: `design-kit doi-mau --huong dem --nhan 45 --trung-tinh 60 --ra ./dem.css`, link that
file, check hand edits with `design-kit kiem-mau ./dem.css --huong dem`. Status colors keep their hues.

## 2. Start from a gated block

`blocks/html/` (plain HTML/CSS: static pages, Folio, Artifacts, Lit/Home Assistant) and `blocks/react/src/blocks/`
(React + shadcn/ui on the same tokens). Read the closest ones before writing:

| Block | Shows |
| --- | --- |
| `dau-trang` | sticky app bar, `aria-current` nav, container-query collapse to a Menu button, skip link |
| `form-dang-nhap` (+React) | labels, `autocomplete`, inline errors with `aria-invalid`, show-password, busy button |
| `bang-du-lieu` (+React) | sortable table, search + filter, labelled stacks with a "Sắp xếp" select under 40rem, no-match state |
| `trang-thai` (+React) | the four states of a data region: empty, loading skeleton, error with retry, no permission |
| `chi-so` | KPI strip in one surface, deltas with arrow + words, sparkline |
| `hop-thoai` (+React) | native `<dialog>` confirm: safe button first, says what is lost |
| `hero` | one idea, one primary CTA, a real product view built in HTML, reasons as a list not 3 cards |
| `bai-viet` | long article: breadcrumb, lead, sticky TOC, quote, scrollable table, note |
| `thanh-ben` | app shell: sticky sidebar ≥ 60rem, `<dialog>` drawer below |
| `thong-bao` | toasts in `aria-live`, pause on hover/focus, errors stay, Undo on delete |
| `trinh-tu` | step-by-step flow: named steps, "Bước 2/4", next button names the next step, draft survives reload, review step |
| `bat-dau` | first-run "Bắt đầu" checklist that ticks itself; just-in-time tip under the control |
| `bo-loc` | filter chips (`aria-pressed`), live result count, pagination "21–40 of 312" |

Every data region needs all four states from `trang-thai`. **Dashboards keep the glance:** list what the user must see
without scrolling (today's numbers, what needs action now) and put it in the first screen at 1280 px, beside or above
the long table, never below it.

## 2b. Make every workflow easy: guide like a good game

However complex the process, the user must never feel lost: good games teach by playing, one thing at a time, when it
is needed. **Write a task map first** (3–6 lines: the main tasks, their steps, where a first-time user hesitates: a
field they don't understand, a choice with consequences, an empty screen). Every hesitation point gets a pattern:

| Situation | Pattern | Block |
| --- | --- | --- |
| > 3 steps, or done only occasionally (sign-up, booking, setup, import) | **Step-by-step flow**: named steps, "Bước 2/4", next button says where it goes ("Tiếp: Chọn giờ khám"), Back keeps input, draft survives reload, review with "Sửa" | `trinh-tu` |
| First use of an app | **"Bắt đầu" checklist**: 3–5 real tasks, ticks itself, progress, hide and reopen from Help | `bat-dau` |
| A control that is new or easy to misread | **Just-in-time tip** next to it the first time, one at a time, "Đã hiểu" + "Tắt mẹo", never blocking | `bat-dau` |
| Empty screen, or no match | **Empty state that teaches** the first action, or says why nothing matched + "Clear filters" | `trang-thai`, `bang-du-lieu` |
| Many options, few used | **Progressive disclosure**: common first, "Tuỳ chọn nâng cao" collapsed | — |
| A reversible action | **Undo** in a toast instead of "Are you sure?"; confirm only the irreversible | `thong-bao`, `hop-thoai` |

Backed by research (NN/g, Gee): **no up-front tour** (swipe-through tutorials did not improve task performance);
onboarding is skippable and shows progress; never label a button just "Tiếp"/"Trước"; smart defaults; errors say how
to fix; a "?" beside an unclear field answers inline. The `guide` soft check flags a bare "Tiếp"/"Next", an empty state
with no next action, and a tour or "Chào mừng" modal on load.

**Measure the guided states, not just the first screen.** URL switches with `--query` (`?lan-dau=1`, `?buoc=3`,
`?mo=1`), and a steps file beside the page, `<page>.steps.json`, picked up also when checking a folder:

```json
[
  { "name": "loi", "do": [{ "click": "button[type=submit]" }] },
  { "name": "buoc-3", "do": [{ "fill": ["#ten", "Hà"] }, { "click": "#tiep" }, { "click": "#tiep" }] },
  { "name": "menu", "viewports": [320, 390], "do": [{ "click": ".menu-btn" }] }
]
```

Actions: `click`, `fill [sel,text]`, `check`, `select [sel,value]`, `press key|[sel,key]`, `hover`, `wait ms`. Each
state starts from a fresh load and gets every check and its own verdict line (`page.html #loi`). A step that cannot be
done is **hard**: fix the page, or limit the state with `viewports`.

## 2c. Words on the page: real details, and mark what you made up

**Facts you filled in yourself get `data-assumed="<reason>"`** on the smallest element that holds them: opening hours,
prices, phone numbers, addresses, names, counts, ratings, testimonials.

```html
<p>Mở cửa <span data-assumed="giờ mở cửa mẫu, chưa hỏi chủ">7:00–21:00</span> mỗi ngày.</p>
```

`check` lists them under `assumed`. Not a finding, but the page is not ready to publish: ask the user to confirm each,
then remove the attribute. Never invent a number to make a section "look specific".

**The `copy` check (soft)** flags text that reads as unedited AI output: stock phrases, template openers, chatbot
residue ("Chắc chắn rồi!"), placeholders, markdown shown as text, a stat row under the hero, headings in fragments, a
bare "Xem thêm" (lists in `data/copy-tells.json`). Rewrite with the user's real details (skill `viet-tu-nhien`), or
mark deliberate wording with `data-copy-ok="<reason>"` and say so.

## 3. Gate: measure, fix, show

```bash
design-kit check <file.html|folder|http://localhost:port> --strict
```

- Renders 320/390/1280 px × light/dark through a local http server (so `../tokens` resolve); every width gets every
  check. axe-core (WCAG 2.2 AA), the shadow-DOM-aware probe (text size, line height, clipped text, text painted over by
  another box), reduced motion, Tab focus at 1280 and 390 (a ring that vanishes in forced-colors mode is reported),
  LCP/CLS, `guide`, `copy`, typing fields under 16px on phones (`input-zoom`), and Impeccable; then every state in
  `<page>.steps.json`.
- Each page is also opened once as a real phone (`isMobile`): no `width=device-width` viewport meta is **hard**.
- A blank page fails (`render`), and so do uncaught script errors and scripts/stylesheets that fail to load (`errors`).
- A component that lives in a host app (Home Assistant card, widget) needs a test page that provides what the host
  provides (`reference/traps.md` §8).
- Each local file is also opened as the Claude app's browser pane opens it (`data:` URL): `standalone` (soft). A page
  only ever served over http can say so, or pass `--no-standalone`.
- **Fix the finding, not the layout**: the information order in the 1280 screenshot must not change between rounds.
  A Vite/React app: check `dist/*.html` or the dev-server URL.
- A **Claude Code mod** (hooks that draw with `ui.render`: a band, a pane, a row under a tool call) has no page:
  `design-kit check-mod <mod folder> --strict` sweeps the mod's own tests over terminal and desktop, 40–200 columns
  and every language (needs `claude`). Color text with theme keys (`success`, `warning`, `inactive`), not hex: a hex
  has to pass on a dark and a light terminal. Write tests that mount each real state; only mounts get measured.
- **Logos, icons, symbols, illustrations**: `design-kit check-image <file|dir> --strict` scores each 0–100 (detail
  lost at 32/16 px, contrast on light and dark, grayscale, colors, pixel grid, sharpness, SVG hygiene) and compares a
  folder of icons as a set; open the contact sheets in `.design-kit/shots/images/`. UI icons: one color via
  `currentColor`, strokes ≥ 1 px at their size; logos: SVG with text outlined, a reversed version for dark.

## Thresholds (sources in `docs/tieu-chi.md`)

Text contrast ≥ 4.5:1 (large 3:1), non-text ≥ 3:1, both themes · targets ≥ 24×24 px, primary buttons 44 · viewport
meta `width=device-width` · no horizontal scroll at 320 px · body ≥ 16 px, nothing under 12 px at rendered size (SVG
viewBox, `transform`/`scale`/`zoom` count), typing fields 16 px on phones · body line-height ≥ 1.5, Vietnamese headings
≥ 1.2 · lines ≤ 75 chars (`--measure` = 32em) · no text clipped or painted over · `lang="vi"` · every animation has a
reduced-motion branch · visible focus ≥ 2 px, not covered, still there in forced-colors mode · LCP ≤ 2.5 s, INP ≤
200 ms, CLS ≤ 0.1 · 0 Impeccable slop findings · a page for the app's browser pane keeps its CSS in the page and stays
≤ 400 KB.

## The traps that bite most (all of them: `reference/traps.md`)

- **`ch` lies for Vietnamese** (68ch held ~93 characters): use `em`.
- **Phones**: viewport meta, 16px typing fields, no `<figure>` margins, room in narrow grid cells (the kit's own hero
  hid "Camera" under the next cell at 320 px until 15/11/2026).
- **Focus rings** drawn only with box-shadow vanish in forced-colors mode: add `outline: 2px solid transparent`
  (Tailwind v4 `outline-hidden`, not `outline-none`).
- **The Claude app's browser pane drops linked CSS**: `design-kit inline`; never embed fonts (512 KiB cap).
- **Impeccable does not see inside shadow DOM**: for Web Components trust `design-kit check` and axe.
