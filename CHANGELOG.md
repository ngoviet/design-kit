# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- A blank page no longer passes. Before, a page that rendered nothing (a component whose script failed, or content
  that arrived after the network went idle) passed every check with "0 findings", because there was nothing to
  fail. Found while checking a Home Assistant card outside Home Assistant.

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
