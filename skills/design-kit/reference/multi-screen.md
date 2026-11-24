# Checking on every screen: phone, tablet, laptop, 4K

Read this before you say "works on every device", and before you trust a measurement you took yourself. From a full check
of a real app on 24/11/2026 (13 screen sizes × 20 screens, about 230 renders).

## 1. Sizes are CSS pixels, and height counts

| Physical screen | 100% | 125% | 150% | 200% |
| --- | --- | --- | --- | --- |
| Full HD 1920×1080 | 1920×1080 | 1536×864 | 1280×720 | 960×540 |
| 2K 2560×1440 | 2560×1440 | 2048×1152 | 1707×960 | 1280×720 |
| 4K 3840×2160 | 3840×2160 | 3072×1728 | 2560×1440 | 1920×1080 |

"4K" is usually 2560 or 1920 CSS px; a Full HD laptop is usually 1536×864 or 1280×720, so 720 px of height is the one to
test. Phones lose the browser bars: an iPhone 15 shows about 393×659, an iPhone SE 375×553, a small Android 360×640.

```bash
design-kit check <page> --profile devices --strict     # 320x568 390x844 768x1024 1280x720 1920x1080 + 14 swept sizes to 2560
design-kit check <page> --viewports 375x553,393x659 --strict   # your own sizes
```

The profile adds: overflow, text painted over and stuck bars at every swept size (with 640×360 = 1280×720 zoomed to 200% and
844×390 = a phone on its side), line length from 1536 px, touch targets on a tablet. The default 320/390/1280 stays for the
quick loop.

## 2. Three layers, all needed

1. **Sizes**: the profile above, then look at the screenshots: at 2560 does the extra room show more, or only more margin?
2. **Flows**: walk the real path (`<page>.steps.json`) in the state people are in. Most bugs live between screens: a dialog
   that drifts down, Back that does not close it, a tab switch that loses text. Both first time and returning.
3. **Content, by data**: count what each unit really has; list columns that hold data and no code uses (one app had a spoken
   word for all 840 entries and never played one); check against two dictionaries before calling a word wrong.

## 3. Measuring traps (read before you conclude)

1. **Scrolling to the top before measuring** and reporting "the button is below the fold": measure where the user is.
2. **A clean browser profile is a first-time user.** `localStorage` is empty: say so, or measure the returning state too.
3. **Full-page screenshots over 16,384 px** repeat the top of the page. Count DOM elements before reporting a duplicate.
4. **A metric that picked the wrong element** (a hidden skip link counted as the main button): drop what is off screen first.
5. **A server started before your edit** serves the old code. Restart it, and reset the data before every run.
6. **`page.evaluate` counts as a user gesture** in Playwright: `navigator.userActivation` is already true. Listen for trusted
   events instead.
7. **Autoplay is blocked in the headless browser**, so `paused` after 5 s is the same on a good and a bad page: record the
   attempt (`play()`, Web Audio `start()`), as `autoplay` does.
8. **`transition: all` animates font-size**: wait for animations after changing text size, or 14 px reads as 16 px.
9. **Handy numbers** remembered from a run ("−0.095") must be recomputed from the data before you report them.
10. **Mixed CRLF/LF** makes `diff` report whole blocks: compare with `--strip-trailing-cr`.

## 4. What the machine cannot see

Safari (sound, recording, `100vh`, safe areas), a real touch screen, an installed PWA, a screen reader, a person. Say which of
these you did not check. Label every finding: measured, read in code, inferred, needs a real device.

Real-device pass before people use it: iPhone Safari; the installed app on iPhone or iPad, both directions; Android Chrome; a
Full HD laptop at 125%; a 4K screen at 150%. Six tasks: first open, one full task, record or upload, rotate in the middle, lose
the network in the middle, close and reopen.

## 5. Shipping to a machine people are using

Prove both sides run the same code (hash every file) · copy the live database with its backup API and run the migration twice on
the copy · open the new database with the OLD code (that is the way back) · check nobody is in the middle of something · back up on
that machine · deploy only your files · restart, then read-only checks: counts, hashes, the first screen · write the way back
into the report.

## 6. Independent check

Give a fresh session the old and the new code, not your conclusion. Ask it to break the new code on purpose and see which tests
stay green: in one run 8 of 20 deliberate bugs went unnoticed, and it found an Undo that returned to a middle state.

## Checklist

- [ ] `--profile devices` passes, screenshots at 390, 1280×720 and 1920 opened
- [ ] Every main flow walked, first-time and returning, at the real scroll position
- [ ] Findings labelled by certainty; what was not checked is written down
- [ ] Content columns with data and no use listed
- [ ] New checks tried against deliberate bugs by someone else
