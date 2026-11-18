// Phần check-mod chạy không cần Claude Code: đọc kết quả test, lớp chặn, màu, dựng terminal, trang desktop, luật engine.
import { describe, expect, it } from "vitest";
import { parseTestOutput } from "../src/mod/collect.js";
import { contrast, nearestThemeKey, resolveColor } from "../src/mod/colors.js";
import { desktopHtml, scrubSvg, svgMotionIssue } from "../src/mod/desktop.js";
import { engineRules } from "../src/mod/rules.js";
import { ENGINE_KEY, genericSource, rewriteTestImports, shimSource } from "../src/mod/shim.js";
import { ansiLineToHtml, droppedSvgs, loadInk, rawColors, renderTerm, termContrast, textCuts } from "../src/mod/terminal.js";
import { hashTree, isBlank, textOf, widthRanges, type DrawNode } from "../src/mod/tree.js";

const T = (props: Record<string, unknown>, ...children: Array<DrawNode | string>): DrawNode => ({ type: "Text", props, children });
const B = (props: Record<string, unknown>, ...children: Array<DrawNode | string>): DrawNode => ({ type: "Box", props, children });

describe("tree", () => {
  it("joins swept widths into ranges in sweep order", () => {
    expect(widthRanges([40, 52, 64, 100], [40, 52, 64, 78, 100, 120])).toBe("40–64,100");
    expect(widthRanges([120], [40, 120])).toBe("120");
    expect(widthRanges([90], [40, 120])).toBe("90");
  });
  it("hashes two mounts of the same drawing alike, whatever press handle the engine gave", () => {
    const a: DrawNode = { type: "Button", props: { key: "x", label: "×" }, press: { handle: 1 } };
    const b: DrawNode = { type: "Button", props: { key: "x", label: "×" }, press: { handle: 2 } };
    expect(hashTree(a)).toBe(hashTree(b));
  });
  it("tells a drawing with nothing of the mod: the generic engine stand-in or empty boxes", () => {
    expect(isBlank(B({}, B({ key: ENGINE_KEY })))).toBe(true);
    expect(isBlank(B({}, B({})))).toBe(true);
    expect(isBlank(B({}, T({}, "1")))).toBe(false);
  });
  it("reads a Button's label as its text", () => {
    expect(textOf({ type: "Button", props: { label: "Open" } })).toBe("Open");
  });
});

describe("shim", () => {
  it("rewrites value imports of claude-code/testing and keeps type imports", () => {
    const src = "import { expect, test } from 'claude-code/testing'\nimport type { Engine } from 'claude-code/testing'\n";
    const r = rewriteTestImports(src, "./__dk_shim");
    expect(r.changed).toBe(1);
    expect(r.source).toContain("import { expect, test } from './__dk_shim'");
    expect(r.source).toContain("import type { Engine } from 'claude-code/testing'");
  });
  it("bakes the run's language, widths and surfaces into the shim", () => {
    const s = shimSource({ run: "vi", language: "vi", soft: true, widths: [40, 120], surfaces: ["terminal", "desktop"] });
    expect(s).toContain('"language":"vi"');
    expect(s).toContain('"widths":[40,120]');
    expect(s).toContain("new Proxy({}"); // `$` bị đóng băng: không bọc thẳng
  });
  it("gives the generic test a stand-in for the engine's own drawing", () => {
    const s = genericSource("demo", [{ component: "AbovePrompt" }, { component: "Unknown" }], "./__dk_shim");
    expect(s).toContain(ENGINE_KEY);
    expect(s).toContain('"component":"AbovePrompt"');
    expect(s).not.toContain("Unknown");
  });
});

describe("parseTestOutput", () => {
  it("reads drawings, passes and failures, and leaves the generic test out of the count", () => {
    const out = [
      'DKTREE {"run":"default","test":"a","scene":1,"component":"AbovePrompt","surface":"terminal","columns":40,"tree":{"type":"Box"}}',
      "(pass) a [12.00ms]",
      "(fail) b [3ms]",
      "  error: expected 1 to be 2",
      "(fail) design-kit generic: AbovePrompt [1ms]",
      "DKTREE {broken",
    ].join("\r\n");
    const r = parseTestOutput(out);
    expect(r.drawings).toHaveLength(1);
    expect(r.pass).toBe(1);
    expect(r.fail).toBe(1);
    expect(r.failures[0]).toEqual({ test: "b", error: "error: expected 1 to be 2" });
  });
});

describe("colors", () => {
  it("resolves theme keys per scheme, raw hex, ANSI names", () => {
    expect(resolveColor("success", "dark")).toMatchObject({ kind: "theme", css: "rgb(78,186,101)" });
    expect(resolveColor("success", "light")).toMatchObject({ kind: "theme", css: "rgb(44,122,57)" });
    expect(resolveColor("#4caf6e", "light")).toMatchObject({ kind: "raw" });
    expect(resolveColor("red", "dark")).toMatchObject({ kind: "named", css: "#c50f1f" });
    expect(resolveColor("transparent", "dark").kind).toBe("none");
    expect(resolveColor("nope", "dark").kind).toBe("unknown");
  });
  it("measures WCAG and APCA", () => {
    const c = contrast("#4caf6e", "#ffffff");
    expect(c.ratio).toBeCloseTo(2.74, 2);
    expect(c.lc).toBeGreaterThan(50);
  });
  it("suggests the nearest theme key for a fixed color", () => {
    expect(nearestThemeKey("#4caf6e")).toBe("success");
    expect(nearestThemeKey("#e2a94e")).toBe("warning");
  });
});

describe("terminal (Ink)", () => {
  it("finds a line wider than the columns", async () => {
    const k = await loadInk();
    // Hai hộp không co, mỗi hộp 15 ô, trong 20 cột: Ink vẽ tràn (một hộp đơn thì chữ chỉ xuống dòng).
    const fixed = () => B({ flexShrink: 0 }, T({}, "abcdefghijklmno"));
    const r = renderTerm(B({ flexDirection: "row", columnGap: 1 }, fixed(), fixed()), 20, "dark", k);
    expect(r.widest).toBe(31);
  });
  it("finds a Text cut by truncate, and not one that only wraps", async () => {
    const k = await loadInk();
    const cut = T({ wrap: "truncate-end" }, "a long note that gets cut");
    const r = renderTerm(B({}, cut), 12, "dark", k);
    expect(textCuts(B({}, cut), r)[0]).toMatchObject({ text: "a long note that gets cut" });
    const wrapped = T({}, "a long note that wraps");
    expect(textCuts(B({}, wrapped), renderTerm(B({}, wrapped), 12, "dark", k))).toHaveLength(0);
  });
  it("fails a fixed hex on a light terminal, passes a theme key; a lone symbol or a bar needs 3:1", () => {
    const tree = B({}, T({ color: "#4caf6e" }, "$0.50"), T({ color: "success" }, "ok"), T({ color: "#8b8cf8" }, "⚡"), T({ color: "#888780" }, "████░░"));
    const hits = termContrast(tree, "light", "#ffffff");
    const by = (t: string) => hits.find((h) => h.text === t)!;
    expect(by("$0.50").ratio).toBeLessThan(by("$0.50").need);
    expect(by("ok").ratio).toBeGreaterThanOrEqual(4.5);
    expect(by("⚡").need).toBe(3);
    expect(by("████░░").need).toBe(3);
  });
  it("draws dimColor in the theme's dim color", () => {
    const [h] = termContrast(B({}, T({ dimColor: true }, "Turn")), "dark", "#1e1e1e");
    expect(h!.fgCss).toBe("rgb(153,153,153)");
  });
  it("lists fixed colors with the nearest theme key", () => {
    expect(rawColors(B({ borderColor: "#e0846b" }, T({ color: "success" }, "x")))).toMatchObject([{ prop: "borderColor", value: "#e0846b" }]);
  });
  it("finds an Svg the terminal drew as an empty box", () => {
    const desk = B({}, { type: "Svg", props: { source: "<svg/>", alt: "cache" } }, T({}, "1"));
    const term = B({}, B({ flexDirection: "column" }), T({}, "1"));
    expect(droppedSvgs(desk, term).map((n) => n.props?.["alt"])).toEqual(["cache"]);
  });
  it("turns ANSI truecolor and named codes into styled spans", () => {
    const html = ansiLineToHtml("\x1b[1m\x1b[38;2;76;175;110m$0.50\x1b[39m\x1b[22m \x1b[31mEND\x1b[39m");
    expect(html).toContain("color:rgb(76,175,110)");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("color:#c50f1f");
  });
});

describe("desktop page", () => {
  const svg = (w: number, h: number) => ({ type: "Svg", props: { source: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text>Cost</text></svg>`, alt: "x", width: w, height: h } });
  it("draws an icon as an image and a larger Svg inline in its own shadow root", () => {
    const html = desktopHtml(B({}, svg(22, 22), svg(320, 60)), { columns: 80, scheme: "dark", lang: "en", title: "t" });
    expect(html).toContain('<img class="svg" alt="x" src="data:image/svg+xml');
    expect(html).toContain('<template shadowrootmode="open">');
    expect(html).toContain("width:640px");
  });
  it("marks text whose colors are only the app's or a theme key's as guessed, not text the mod colored", () => {
    const html = (t: DrawNode) => desktopHtml(t, { columns: 80, scheme: "light", lang: "en", title: "t" });
    expect(html(T({ color: "warning" }, "52%"))).toContain("data-dk-guess");
    expect(html(T({}, "plain"))).toContain("data-dk-guess");
    expect(html(T({ color: "#4caf6e" }, "$0.50"))).not.toContain("data-dk-guess");
    // Màu mod tự đặt ở Text cha được thừa hưởng; nền mod tự tô thì mod chịu trách nhiệm cả chữ theme trên đó.
    expect(html(T({ color: "#4caf6e" }, T({ bold: true }, "$0.50")))).not.toContain("data-dk-guess");
    expect(html(B({ backgroundColor: "#202020" }, T({ color: "warning" }, "52%")))).not.toContain("data-dk-guess");
    expect(html(B({ backgroundColor: "warning" }, T({ color: "text" }, "52%")))).toContain("data-dk-guess");
  });
  it("scrubs scripts and handlers as the engine does", () => {
    expect(scrubSvg('<svg onload="x()"><script>alert(1)</script><rect/></svg>')).toBe("<svg><rect/></svg>");
  });
  it("knows animation that reduced motion cannot stop", () => {
    expect(svgMotionIssue("<svg><animate attributeName='x'/></svg>")).toMatch(/SMIL/);
    expect(svgMotionIssue("<svg><style>@keyframes p{}</style></svg>")).toMatch(/no prefers-reduced-motion/);
    expect(svgMotionIssue("<svg><style>@keyframes p{} @media (prefers-reduced-motion: reduce){*{animation:none}}</style></svg>")).toBeUndefined();
  });
});

describe("engine rules", () => {
  it("refuses an Svg source over 131072 characters and an Svg without alt", () => {
    const long = { type: "Svg", props: { source: `<svg>${"x".repeat(131_073)}</svg>`, alt: "big" } };
    const noAlt = { type: "Svg", props: { source: "<svg/>", alt: " " } };
    const hits = engineRules(B({}, long, noAlt), "Pane");
    expect(hits.map((h) => h.detail)).toEqual([expect.stringMatching(/131,072/), expect.stringMatching(/no alt/)]);
  });
  it("checks terminal Image pixel sizes", () => {
    const img = { type: "Image", props: { source: { rgba: "", width: 4000, height: 10 } } };
    expect(engineRules(B({}, img), "ToolUse")[0]).toMatchObject({ check: "raster-size" });
  });
});
