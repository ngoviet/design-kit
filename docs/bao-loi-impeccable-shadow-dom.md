# Bản nháp báo lỗi gửi Impeccable: detector bỏ qua shadow DOM

- Trạng thái: **bản nháp, chưa gửi**. Chỉ gửi khi chủ đồng ý.
- Nơi gửi: `pbakaus/impeccable`. Đã tìm ngày 09/11/2026 với từ khoá "shadow" và "shadow root web component": chưa có issue nào trùng.
- Tái hiện lại ngày 09/11/2026: skill 4.8.1, engine 0.1.19, Windows 11 x64.
- Lệnh gửi, sau khi chủ duyệt:
  ```bash
  gh issue create -R pbakaus/impeccable --title "<tiêu đề>" --body-file <tệp chứa phần dưới đây>
  ```

---

**Title:** [Bug] detect: findings inside open shadow roots are never reported (Lit / Home Assistant cards look clean)

**What happens**

`impeccable detect` does not look inside open shadow roots. A text node that is 9.9 px and 1.6:1 contrast is reported when it sits in the light DOM. The exact same node inside a custom element's open shadow root produces no finding at all. A page whose only defects live in shadow DOM scans as clean (exit 0).

This matters for any Web Component UI: Lit, Stencil, Shoelace, and Home Assistant Lovelace cards, where nearly all of the visible UI is in shadow roots.

**Repro** (engine 0.1.19, skill 4.8.1, Windows 11 x64, URL mode)

`shadow-only.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shadow DOM repro (shadow only)</title>
<style>body { margin: 0; padding: 32px; font: 16px/1.6 system-ui, sans-serif; background: #fff; color: #1a1a1a; }</style>
</head>
<body>
  <h1>Network panel</h1>
  <p>The only defect on this page sits inside an open shadow root.</p>
  <topo-card></topo-card>
  <script>
    customElements.define("topo-card", class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" }).innerHTML =
          '<style>.lbl{font-size:9.9px;color:#7b8a8e;background:#5b6b70;padding:2px}</style><span class="lbl">Port 2 down 12 Mb/s</span>';
      }
    });
  </script>
</body>
</html>
```

`index.html` is the same page, plus a control: the same `<span class="lbl">` placed in the light DOM ("Port 1 …").

```text
$ impeccable detect --json --viewport 1280x800 http://127.0.0.1:8765/shadow-only.html
[]                                   # exit 0

$ impeccable detect --json --viewport 1280x800 http://127.0.0.1:8765/index.html
low-contrast        1.6:1 (need 4.5:1) — text #7b8a8e on #5b6b70
undersized-ui-text  9.9px functional text "Port 1 down 12 Mb/s" (below 11px floor)
                                     # exit 2. "Port 2" (in the shadow root) is missing
```

**Expected**

Both "Port 1" (light DOM) and "Port 2" (shadow root) are reported, so `index.html` gives 4 findings and `shadow-only.html` gives 2 findings and exits 2.

**Cross-check**

axe-core 4.14 (`color-contrast`) flags the shadow-root span on the same page. So does a small probe that walks `el.shadowRoot` recursively and reads `getComputedStyle` on each element. That probe is what we use in our own gate today.

**Possible fix**

Where the browser-side collector gathers elements (`querySelectorAll('*')` or a TreeWalker over `document`), recurse into `el.shadowRoot` for every element that has an open one. Computed styles, bounding rects and `elementFromPoint`-style occlusion checks all work inside open shadow roots. In the snippet or selector, prefix the host (for example `topo-card::shadow span.lbl`), so the finding can be located. Closed shadow roots can stay out of scope.

Happy to test a build against our fixtures.
