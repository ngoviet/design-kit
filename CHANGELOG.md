# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- axe-core 4.14.1 (fewer false `target-size` and contrast results on absolutely positioned elements). The full gate
  gives the same findings as with 4.14.0.
- `check` loads each page once and resizes it and switches it to dark in place, instead of a fresh load for every
  width and color scheme (7 loads per page become 3). Each page is verified, and measured again with fresh loads (with
  a note saying why) when any check differs: one fresh load at the narrowest width must give the same layout and
  color fingerprint as the resized page, and its script errors are reported; that page resized up to the narrow focus
  width must match the main page there; the main page back at the widest width must match its first load. Elements
  moved by a running animation are left out of the fingerprint, and a page where most of them move is redone fresh.
  A page whose script reads `prefers-color-scheme` once without listening for changes gets one load per color
  scheme. States after steps get one load per width and switch only the color scheme in place (resizing a clicked
  page moves the mouse onto another element). `--fresh` keeps the old way. Full gate on PC1: 105 pages and states,
  same verdicts and findings as `--fresh`.
- A page that does not load (wrong URL, dev server down, HTTP ≥ 400) is a hard `render` finding for that page only;
  the other pages are still checked. The command fails with `LOAD_FAILED` only when no page loads.

### Added

- `check --sweep`: horizontal overflow at in-between widths (360, 414, 480, 600, 768, 900, 1024, 1180 inside the
  `--viewports` range), measured on the open page.

### Fixed

- The `input-zoom` row said `skipped` when 320 was the only phone width, while the check ran there and reported
  findings.
- An unexpected error in one page no longer closes the browser under the pages still being checked.
- `check`: axe is injected through `evaluate`, so a page with `script-src 'self'` is checked instead of aborting the
  run; a line-height of exactly 1.2 (1.5 for body text) no longer fails through float error; animations inside open
  shadow roots count for `motion` and for the entrance wait; `.htm`, `.gif`, `.ttf`, `.otf`, `.wasm`, `.mp4`, `.webm`
  get their MIME types; a page in a drive root is served instead of 403; a failed Impeccable scan leaves a note
  instead of looking clean; Impeccable no longer runs twice at 390; `data-assumed` facts are listed once per page,
  not once per `--query`; a step that fails after the reduced-motion reload leaves a note instead of measuring the
  wrong state; the help names the real browser order.
- `inline`: `url()` inside a nested relative `@import` is rewritten once (was `css/css/sub/img.png`).
- `check-mod`: `--shots <dir>` removes only the files it writes, never the folder; when `claude` is a `.cmd` shim
  the run waits for the shell retry instead of reporting a pass with no test run, and a timeout stops the whole
  process tree; a color that only looks like one (`#12345`, `rgb(nope)`) is unknown instead of aborting the run.
- `doi-mau`: chroma is rounded down, so hues 10–35 and 250–285 of `dem` stay inside sRGB; the status says
  "below WCAG or out of sRGB gamut". `kiem-mau` with the wrong `--huong` says which block is missing.
- `check-image`: a folder named like an image is skipped, one unreadable image no longer aborts the run, an SVG
  thinner than about 600:1 is measured from its viewBox, and `../logo.svg` no longer overwrites the sheet of
  `logo.svg`.
- The global `--fields a,b` flag was accepted but did nothing: every table in the output now keeps only those
  columns (a table with none of them is left whole).
- `standalone`: the `data:` URL copy waits up to 5 s for late content like the http render, instead of reporting
  "shows nothing" for a page that draws after a timer.
- Hook: a check counts only when the command runs it (start of a command, after `;`, `&`, `|`, `(` or `time`,
  through `npx` or `node <path>`), not when `echo`, `grep` or a commit message mentions it; the skip list
  (`build`, `dist`, `fixtures`…) is matched on the path inside the session folder, so a project that lives in a
  folder named `build` is still reminded.
- Hook: a check counts for a file only when an argument points at that file or its folder (a similar name in another
  folder used to count); `design-kit check-mod` counts for a mod like `claude plugin test`.

## [0.3.0] - 2026-11-18

### Added

- `design-kit check-image <file|dir>...`: scores logos, icons (symbols, pictograms) and illustrations 0–100 from
  measurements, with a reason per criterion, and compares the icons of one folder as a set. Each image (SVG, PNG,
  JPEG, WebP, AVIF, GIF, ICO, BMP) is drawn on a canvas in the browser: SVG with its shorter side at 512 px, bitmaps at
  their own size, icons also at their native size. Criteria: detail finer than 1 px at 32 and 16 px (a Euclidean
  distance transform opens the shape with a disk one display pixel wide; the outline length of what vanishes is
  counted, sharp tips are not, and color regions inside the shape count too), contrast of the outline's rim on
  `#ffffff` and `#121212` (WCAG 1.4.11: hard for icons, soft for logos, which are exempt), touching colors that merge
  in grayscale, palette and gradients, straight edges between pixels at native size, margins, fill and centering in an
  icon's box, the maskable safe circle, perimetric complexity for icons (Pelli 2006; reported, not scored, for logos),
  edge width for blur (Marziliano 2002), resolution against `--display` (Lighthouse), file format and weight, and SVG
  hygiene (script and `on*` attributes are hard; live `<text>`, embedded bitmaps, external references, no viewBox,
  `preserveAspectRatio="none"` are soft). Hard findings cap the score at 49; `--min-score <n>` exits 1 below n. A
  contact sheet per image (every size on light and dark, grayscale, one color, reversed, the pixel grid at native
  size, where detail is lost at 16 px, a squint view for illustrations) and one per icon set go to
  `.design-kit/shots/images/`. Calibrated on 272 Lucide icons (99% lose under 1% of their outline at 24 and 16 px; a
  0.5 px stroke loses 100%) and on one scene exported directly (edges 2.0 px) and enlarged ×1.5 to ×4 (5.6–12.3 px).
  134 Lucide icons checked as a set: mean score 100, consistency 99, 0.13 s per icon. 43 new sources (s74–s116) and 51
  claims (c79–c129) in `docs/nguon.md`. No new dependencies.
- Plugin hook: an edited logo, icon or illustration (`.svg`, `.png`, `.jpg`, `.webp`, `.avif`, `.ico` whose file or
  folder name says logo, icon, favicon, brand, symbol, …) gets a reminder to run `design-kit check-image`, and Stop
  blocks once until a `check-image` that names the file or its folder ran after the edit.
- `design-kit check-mod <mod folder>`: a gate for Claude Code mods, whose hooks draw with `ui.render` and have no page
  to open. It copies the mod to a temporary folder, points its tests' `claude-code/testing` import at a shim and runs
  `claude plugin test` once per language of the mod's `language` option. Every `$.ui.mount` a test makes is drawn
  again on the terminal and desktop surfaces at 40–200 columns and the tree the surface is handed (`ui.drawn()`) is
  printed; a generic test mounts each component the mod hooks with default props. Terminal trees are laid out with Ink
  6 at the exact column count and measured on a dark and a light terminal (overflow, cut text, rows, WCAG 2 and APCA
  contrast with theme keys from Claude Code's own themes, fixed hex colors); desktop trees become a page close to the
  app's renderer for axe, the text probe (SVG text as drawn) and reduced motion; the engine's limits (Svg source
  131,072 characters and `alt`, AskUserQuestion rows, terminal Image pixels) are checked on the trees. First run on
  claude-kit-axi: session-band failed 12 hard (five hex colors at 2.1–2.9:1 on a light terminal and desktop),
  agents-panel 1 hard (SVG text at 11px); 29 s and 38 s. `data/claude-themes.json` holds the theme colors, refreshed by `node scripts/claude-themes.mjs`.
  New dependencies: `ink` 6.8 (the last line that runs on Node 20), `react` 19, `string-width`.
- CI installs Claude Code 2.1.311 so the `check-mod` test on the fixture mod runs there instead of being skipped;
  `DK_REQUIRE_CLAUDE=1` makes a missing `claude` fail the test. CI also reads the theme colors again from the
  installed Claude Code and checks they match `data/claude-themes.json`. No sign-in or API key is needed.
- `check-mod`: desktop contrast is soft, not hard, when both colors are the app's or a theme key's (text colored
  `warning` on the app background): the desktop page only guesses those, and the mod followed the advice to use theme
  keys. Text the mod colored with a hex, or set on a background it colored, stays hard. session-band had four such
  hard failures (`warning` at 4.46:1 on the guessed `#faf9f5`); it now passes `--strict` with them as soft.

- `text-covered` check (soft): a line of text that another element paints over, typically a word too long for a
  narrow grid cell spilling under the next cell's background. Every other check passed such text: it is big enough,
  contrasted, inside the page and not clipped. Nine points per line are hit-tested in the text's own tree, so it
  works inside shadow roots; intended overlays (fixed, sticky, absolute, dialog, popover), stretched transparent
  links, clipped points (`text-clip`'s job) and `pointer-events: none` text are not reported. Found in the kit's own
  `hero` block at 320–360px ("Camer", "23/2"); tried on 51 pages: 2 real cases, no false positive.
- `viewport` check (hard): each page is opened once more as a phone (`isMobile`, at the widest `--viewports` width
  ≤ 480) and the layout width read back. The other renders only size the window, and Playwright ignores the viewport
  meta then, so a page without `width=device-width` passed with 0 findings while a phone laid it out 980px wide and
  shrank it: 16px text showed at 6.4px. A 2026 study of AI-generated pages found a missing viewport meta to be the
  leading root cause of their cross-device failures (46%).
- `input-zoom` check (soft): a text input, textarea or select whose text is small at phone width, which makes iOS
  Safari zoom the whole page in when it is tapped and leave it zoomed. WebKit scales by 16 / font size, so every
  shipped iOS zooms below 16px; the rule in `src/zoom.ts` reports anything under 16px. WebKit's main branch began
  skipping changes under 10% on 13/11/2026 (15px no longer zooms there), but no iOS release has it yet. Disabled
  fields are skipped (they cannot take focus); read-only fields still count (a tap focuses them). Checkboxes, radios,
  ranges, colors and file inputs are not typing fields. Found in 3 of 12 A/B pages, one of them built with the kit.
- `focus` reports a focus ring that disappears in forced-colors mode (Windows High Contrast). A ring drawn only with
  box-shadow is measured again with forced colors on while the element still has focus: box-shadow is removed there,
  while an outline, even a transparent one, is redrawn in a system color. Reading the CSS in normal mode is not
  enough: Tailwind v4 `outline-hidden` adds its transparent outline only inside `@media (forced-colors: active)`.
  Found in the kit's own React blocks: shadcn's `outline-none` with `ring-[3px]` left buttons, inputs and checkboxes
  with no focus ring there; they now use `outline-hidden`.
- `copy` check (soft): visible text that reads as unedited AI output, Vietnamese first, common English too.
  Generation 1: stock phrases ("Trong thế giới ngày nay", "unlock the power of"), three or more distinct stock
  words on one page, template openers ("Bạn có biết"), chatbot residue ("Chắc chắn rồi!"), placeholders
  (`[Tên công ty]`, `{{name}}`, lorem ipsum, TODO, also in `alt`, `aria-label`, `title` and the tab title) and
  markdown shown as text. Generation 2: a row of 3–4 short stats in or right under the hero, a heading in clipped
  fragments ("Nhanh. Gọn."), a link or button that only says "Xem thêm"/"Learn more". The lists live in
  `data/copy-tells.json` (now shipped in the package) and are validated on load; `data-copy-ok` opts an element
  out, `--no-copy` skips the check. The two-generation frame is borrowed from taste-skill 2.5.1
  `references/copy-tells.md` (MIT); the Vietnamese lists come from the viet-tu-nhien skill. All 13 HTML blocks
  pass with no `copy` finding.
- `data-assumed`: an element holding a fact the agent filled in itself (opening hours, a price, a number) carries
  `data-assumed="<why>"`. `design-kit check` lists each one under `assumed` (where, text, reason), hidden ones
  included, apart from the findings, with a help line to have the owner confirm them before publishing.

- `text-clip` check (soft): text cut off inside its box, which passed every other check because the letters are
  big enough, contrasted and inside the page. Catches an ellipsis or `-webkit-line-clamp` that hides words, and
  `overflow: hidden` or `clip` that cuts letters or whole lines, including Vietnamese accents and descenders cut by
  a tight line height ("Ổn định" shows as "Ön đinh": the glyph ink is measured, not only the line box). Reports
  the element (through shadow roots and slots), the text still shown and the width, e.g. `at 1280px by ellipsis:
  shows "6/10 cổng có link · 5 phía s…"`. Text moved fully outside its box on purpose (a closed drawer, negative
  `text-indent`, sr-only) and absolutely positioned text that escapes the clipping box are not reported. Found
  while checking a Home Assistant card whose sub line was cut at 1280 px and only the screenshot showed it.
- `standalone` check (soft): each local file is also opened the way the Claude app's browser pane opens it, as
  `data:text/html;charset=utf-8,…` with no server, and compared with the http render. It reports linked stylesheets
  and design tokens the page loses there, scripts by path that will not run, a file over 400 KB (the pane opens a
  file of at most 512 KiB, measured: 524,288 bytes opened, 524,289 did not), and Vietnamese letters drawn from a
  second font because the fallback lacks them (read through the Chromium DevTools protocol). Found on 10/11/2026:
  a Giấy report page showed bare Times text in
  the pane while `design-kit check --strict` passed. `--no-standalone` skips it for pages only served over http.
- `design-kit inline <page.html> [--ra <out.html>] [--dry-run]`: puts each relatively linked stylesheet into a
  `<style>` in the same place (relative `@import`s inlined, `url()`s rebased), keeps font stylesheets linked as an
  extra, never embeds fonts. Running it again changes nothing.

### Changed

- The skill is reordered for long sessions. After context compaction Claude Code keeps only the first 5,000 tokens
  of an invoked skill, and SKILL.md cost about 8.2k with its "traps" list at the end. A short "Rules" section now comes
  first (direction and task map, blocks, `data-assumed`, the gate, screenshots, what the report must hold), the full
  traps list moved to `skills/design-kit/reference/traps.md` in eight groups with a table of contents, and the five
  traps that bite most stay in SKILL.md. About 5k tokens per invocation, by Claude Code's own estimate.
- Every width gets every check. 320px used to be checked for horizontal overflow only, so the narrowest width,
  where layouts break first, had no text, axe, clipping or screenshot checks. Impeccable now also runs at 320px.
  The full gate on 13 blocks × 3 directions with every state takes 130.4 s, against 144.9 s before this release's
  speed-up.
- Giấy body font falls back to `"Times New Roman", "Noto Serif", serif` instead of Georgia. Georgia has no ắ, ế, ữ…,
  so when Literata did not load the browser drew those letters from another font and words split ("Ngắ n"). Đêm and
  Đậm fall back to `system-ui` (Segoe UI on Windows) and `monospace` (Consolas), which have the letters.
- `axe-core` floor raised to `^4.14.0`: earlier 4.x releases skipped the color-contrast check without a word when a
  computed color had a CSS Color 4 `none` component (dequelabs/axe-core#5309), which OKLCH tokens can produce.
  `playwright-core` floor raised to `^1.65.1`, and the CI image to `v1.65.1-noble` to match.
- The gate waits for real signals instead of fixed pauses. Each render used `networkidle` (500 ms of silence, which
  Playwright's docs advise against) plus 300 ms: 0.8 s of every 1.05 s render was waiting. Now: `load`, fonts, no
  request in flight for 200 ms, two frames; a page that keeps the network busy (a stream) is measured after 10 s with
  a note. Entrance animations still get up to 1.5 s to finish before text is measured, and the reduced-motion check
  still reads what runs about 0.9 s after load. 13 blocks × 3 directions with every state: 144.9 s → 120.0 s on one
  Windows machine, same findings line for line.
- The hooks tell Claude Code mods apart from web pages. A `.tsx` or `.jsx` file inside the `hooks/` folder of a plugin
  (the nearest parent with `.claude-plugin/plugin.json` and `hooks/hooks.json`) is drawn with `ui.render` in Claude
  Code's terminal and desktop app, so there is no HTML page for `design-kit check`; the Stop hook blocked almost every
  turn in a mod repo and the agent had to explain it each time. For such a file the reminder now asks for
  `claude plugin validate` and `claude plugin test` on the mod, a look at the drawn tree through `ui.drawn()` in the
  tests, and a task map only for a new screen or panel with controls. The Stop hook counts a `claude plugin test` on
  the mod or a parent folder (a bare one after `cd`, a Git Bash `/d/…` path or a shell variable in a loop too), or the
  repository's `tools/check.sh`, run after the edit. Files outside `hooks/` (a web page a plugin ships, the kit's own
  blocks) still need the gate. Mod and web reminders keep separate 15-minute timers.

### Fixed

- The Stop hook saw only files changed with Write or Edit, so a page edited through Bash, PowerShell or an MCP tool
  never triggered it. It now also takes UI files git sees as changed after the session started, and wants a
  `design-kit check` that finished after the change and names the page, its folder or a URL (a source file such as
  `.tsx` is covered by any check). Every unchecked page is listed, not only the last one. Test fixtures and the
  Claude Code scratchpad are skipped.
- The Stop hook named files that no longer exist: a page edited with Write or Edit and then deleted, or a folder
  renamed later in the session (`plugins/savvy-progress/hooks/*.tsx` kept coming back after the folder became
  `agents-panel`). Such files are skipped.
- `hero` block: at 320–360px the product view showed "Camer" and "23/2". The `<figure>` kept the browser's default
  40px side margins, leaving the three-column diagram 208px wide; it now has `margin: 0`, and below 21rem its cells
  use less padding and 16px numbers.
- `standalone`: the check for Vietnamese letters drawn from a second font could come back empty on a busy machine,
  because the text was split into new nodes and the browser was asked for their fonts before laying them out.
- `long-form` no longer counts checkboxes and radios nobody can see. Ones inside a closed `<details>`, a `hidden`
  panel or a `display: none` step were counted, so a page that had already tucked its advanced options away was
  told to tuck them away. A custom checkbox drawn by a sibling (transparent or clipped input) still counts.
- Plugin hook: `design-kit check-image` (and `check-mod`) no longer count as a run of the page gate; the old pattern
  matched `check` followed by any word boundary, a hyphen included.

## [0.2.1] - 2026-11-10

### Fixed

- A blank page no longer passes. Before, a page that rendered nothing (a component whose script failed, or content
  that arrived after the network went idle) passed every check with "0 findings", because there was nothing to
  fail. Found while checking a Home Assistant card outside Home Assistant.
- `text-min` and `body-size` measure text at its rendered size when the element or any ancestor (through slots
  and shadow hosts) is shrunk by `transform`, `scale` or `zoom`: 12 px labels in a diagram scaled to 0.55 render at
  6.6 px and used to pass. Translate, rotate and transforms on inline boxes are not counted, and the page probe
  waits for finite animations first so an opening `scale(.95) → 1` is not read as small text.

### Added

- `render` check (hard): nothing visible (no text, image or graphic, through shadow roots) after load. The gate now
  waits up to 5 s for content that arrives after the network is idle, measures it once it appears, and notes the
  delay. An empty custom element that is never defined is a soft `render` finding; an unregistered one with children
  (an app root, a styling tag) is only a note.
- `errors` check (hard): an uncaught script error, or a script or stylesheet that fails to load (HTTP ≥ 400 or a
  failed request; aborted requests and console messages are ignored).

## [0.2.0] - 2026-11-10

First public release.

### Added

- `design-kit check <file|dir|url>...`: renders each page at 320/390/1280 px in light and dark and runs 18 checks.
  Hard: overflow at 320 px, axe-core WCAG 2.2 AA serious/critical, text < 12 px, Vietnamese heading line height
  < 1.2, `lang="vi"`, reduced motion, steps, Impeccable. Soft: body size and line height, line length, fonts, focus,
  inner scroll, long forms, guidance, LCP, CLS. Measures through open shadow roots. `--query`, `--viewports`,
  `--schemes`, `--shots`, `--jobs`, `--strict`, `--limit`, `--full`.
- States after scripted actions: `--steps <file|json>` and `<page>.steps.json` beside the page (click, fill, check,
  select, press, hover, wait; optional per-state `viewports`). Each state gets its own verdict; a step that cannot
  be done is a hard failure.
- `guide` check: a button whose whole name is "Tiếp"/"Next", an empty state with no next action, a tour or welcome
  modal on load. `design-kit` prints `workflow` reminders and every `check` ends with a "Guide like a game" hint.
- Focus checked at the widest and the narrowest width, including focus landing on invisible elements; custom
  checkbox/radio inputs are judged by the ring on their visible proxy.
- `design-kit setup`: finds a browser and the Impeccable engine; downloads the pinned engine (0.1.19, sha256
  verified) into `~/.design-kit` when missing. The browser falls back to Playwright's Chromium.
- `design-kit doi-mau` / `kiem-mau`: re-hue a direction for a brand while every color pair keeps passing WCAG;
  check any token file.
- Tokens and three directions (Đêm, Giấy, Đậm) with light and dark themes, generated DESIGN.md, self-hosted fonts
  (Latin + Vietnamese subsets, SIL OFL).
- 13 HTML/CSS blocks and 4 React + shadcn/ui blocks, each passing the gate in 3 directions × light/dark, with steps
  files for 12 of them.
- Claude Code plugin: the `design-kit` skill (directions, blocks, task map and guide patterns, the gate, known traps)
  and hooks that remind after UI edits and block one stop when the gate was not run.
- Bilingual README (readme-axi), MIT license, GitHub Actions CI on a clean Linux container.
