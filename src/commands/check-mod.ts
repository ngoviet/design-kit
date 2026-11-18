import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser } from "playwright-core";
import { type FlagSpec, listFlag, parseCommandArgs } from "../args.js";
import { launchBrowser } from "../browser.js";
import { fail } from "../errors.js";
import { probePage, settleAnimations } from "../probe.js";
import type { Runtime } from "../runtime.js";
import { collectDrawings, inspectMod, type RunResult } from "../mod/collect.js";
import { fmtRatio, loadThemes, TERM_BG } from "../mod/colors.js";
import { CELL_PX, DESK, desktopDoc, desktopHtml, desktopSlot } from "../mod/desktop.js";
import { ASK_COLUMNS, ASK_ROWS, engineRules, type Gate } from "../mod/rules.js";
import { droppedSvgs, loadInk, rawColors, renderTerm, termContrast, termShotHtml, textCuts, where, type TermRender } from "../mod/terminal.js";
import { describeNode, hashTree, isBlank, textOf, walk, widthRanges, type Drawing, type DrawNode, type Scheme, type Surface } from "../mod/tree.js";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** axe như `check`, kèm HTML của phần tử để cột where nói được chữ nào (bộ chọn của trang sinh ra không có nghĩa). */
async function axeNodes(page: import("playwright-core").Page, axeSource: string): Promise<Array<{ id: string; impact: string; nodes: Array<{ html: string; msg: string }> }>> {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async (tags) => {
    const w = window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string; nodes: Array<{ html: string; any: Array<{ message: string }>; failureSummary?: string }> }> }> } };
    const res = await w.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact ?? "minor", nodes: v.nodes.slice(0, 8).map((n) => ({ html: n.html, msg: n.any[0]?.message ?? n.failureSummary ?? "" })) }));
  }, AXE_TAGS);
}
/**
 * Như probeMotion nhưng gom cả hoạt ảnh trong shadow root: `document.getAnimations()` của Chromium không trả hoạt ảnh
 * của phần tử nằm trong shadow tree, mà mỗi Svg lớn của trang desktop nằm trong shadow root riêng.
 */
function probeMotionDeep(): { running: number; samples: string[] } {
  const roots: Array<Document | ShadowRoot> = [document];
  for (const el of document.querySelectorAll("*")) if (el.shadowRoot) roots.push(el.shadowRoot);
  const samples: string[] = [];
  let running = 0;
  for (const r of roots) {
    for (const a of r.getAnimations()) {
      if (a.playState !== "running") continue;
      const t = a.effect?.getComputedTiming();
      const dur = typeof t?.duration === "number" ? t.duration : 0;
      if (dur > 50 || t?.iterations === Infinity) {
        running++;
        if (samples.length < 4) samples.push((a as CSSAnimation).animationName || "animation");
      }
    }
  }
  return { running, samples };
}
const htmlText = (html: string): string => {
  const tag = /^<(\w+)/.exec(html)?.[1] ?? "element";
  const t = html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
  const label = /aria-label="([^"]*)"/.exec(html)?.[1];
  const shown = t || label || "";
  return shown ? `${tag} "${shown.length > 30 ? `${shown.slice(0, 29)}…` : shown}"` : tag;
};

const WIDTHS = [40, 52, 64, 78, 100, 120, 160, 200];

export const CHECK_MOD_HELP = `usage: design-kit check-mod <mod folder> [flags]
description: Design gate for a Claude Code mod (a plugin whose hooks draw with ui.render: a band above the prompt, a pane, a row under a tool call). A mod has no page to open, so check-mod runs the mod's own tests through Claude Code's test kit (\`claude plugin test\` on a temporary copy; nothing is installed) with a shim that, every time a test mounts a component, also mounts it on the terminal and desktop surfaces at every width and prints the tree the surface is handed (\`ui.drawn()\`). One extra test mounts each component the mod hooks with default props. Each language of the mod's \`language\` option gets a run of its own. The terminal trees are laid out with Ink at the exact column count and measured on a dark and a light terminal; the desktop trees become an HTML page close to the app's renderer and get axe, the text-size probe (SVG text included, as drawn) and the reduced-motion check; the engine's own limits are checked on the trees. Prints one verdict, hard failures block "done"
flags[10]:
  --widths <n,n>: columns to sweep (default ${WIDTHS.join(",")}); AbovePrompt and Pane get them as bodyColumns, every component as viewport.columns
  --surfaces <terminal,desktop>: surfaces to draw on (default both)
  --languages <a,b|none>: language runs besides the default one (default: every value of the mod's language option except auto)
  --no-tests: skip the mod's tests, only mount each component with default props
  --pane-id <id>: requestId for a Pane the mod matches by a computed id (default: the mod's name)
  --term-bg <dark=#hex,light=#hex>: terminal backgrounds to measure against (default dark=${TERM_BG.dark},light=${TERM_BG.light})
  --shots <dir>: screenshot folder (default .design-kit/shots/mod-<name>); --no-shots to skip
  --no-shots: do not save screenshots
  --strict: exit 1 when there is a hard failure
  --keep: keep the temporary copies of the mod (paths in notes)
gates[3]:
  hard: mount (the surface refused the tree the mod returned, so the engine draws its own instead), render (Ink could not lay the tree out), svg-source (Svg source over 131072 characters or no alt), raster-size (terminal Image pixels outside 1–2048 inline, 1–4096 from a file), ask-rows (an AskUserQuestion tree over 12 rows on the terminal or 48 on desktop at 40 columns), overflow (a terminal line wider than the columns: the terminal wraps it; desktop content wider than its slot), contrast (text under 4.5:1, a lone symbol under 3:1, on a dark or light terminal or on desktop via axe; APCA Lc printed beside), text-min (desktop text under 12px, SVG text measured as drawn), motion (Svg animation that keeps running under prefers-reduced-motion, SMIL always does), axe serious/critical
  soft: rows (AbovePrompt taller than maxRows, or taller when narrow: text wraps instead of the band shrinking), text-cut (a Text not shown whole: ellipsis or clipped by overflow hidden), svg-terminal (an Svg on desktop is an empty box on the terminal: give the terminal a Text), hard-color (a hex/rgb color does not follow the person's light/dark theme; the nearest theme key is suggested), tests (a mod test failed while swept), axe moderate/minor
  human: open the screenshots (terminal: dark and light panels, the dashed line is the right edge)
notes[4]:
  Theme keys (success, subtle, …) are measured with Claude Code's default dark and light themes, data/claude-themes.json (refresh: node scripts/claude-themes.mjs)
  The desktop page is an approximation of the app's renderer (8px a cell, caption 12px … title 22px, app background #faf9f5 / #262624): verdicts rest on what the mod sets itself (hex colors, SVG font sizes, source length, animation)
  Ink is upstream Ink 6, not Claude Code's fork: wrapping at the very edge can differ by a cell
  Needs Claude Code (\`claude\` on PATH, or CLAUDE_BIN). Exit 0 when the mod was checked: read \`status\`. --strict turns hard failures into exit 1; usage errors exit 2
examples[3]:
  design-kit check-mod plugins/session-band
  design-kit check-mod plugins/agents-panel --languages en,vi --strict
  design-kit check-mod . --widths 40,80,120 --surfaces terminal
`;

const FLAGS: Record<string, FlagSpec> = {
  widths: { type: "string", hint: "--widths <n,n>" },
  surfaces: { type: "string", hint: "--surfaces terminal,desktop" },
  languages: { type: "string", hint: "--languages <a,b|none>" },
  "no-tests": { type: "boolean", hint: "--no-tests" },
  "pane-id": { type: "string", hint: "--pane-id <id>" },
  "term-bg": { type: "string", hint: "--term-bg dark=#hex,light=#hex" },
  shots: { type: "string", hint: "--shots <dir>" },
  "no-shots": { type: "boolean", hint: "--no-shots" },
  strict: { type: "boolean", hint: "--strict" },
  keep: { type: "boolean", hint: "--keep" },
};

const CHECKS: Array<[string, Gate]> = [
  ["mount", "hard"], ["render", "hard"], ["svg-source", "hard"], ["raster-size", "hard"], ["ask-rows", "hard"], ["overflow", "hard"],
  ["contrast", "hard"], ["text-min", "hard"], ["motion", "hard"], ["axe", "hard"],
  ["rows", "soft"], ["text-cut", "soft"], ["svg-terminal", "soft"], ["hard-color", "soft"], ["tests", "soft"],
];

interface Finding {
  gate: Gate;
  check: string;
  surface: Surface | "-";
  where: string;
  detail: string;
  renders: Set<string>;
}

/** Một cây vẽ duy nhất ở một bề rộng (gộp mọi test và lượt cho ra đúng cây đó). */
interface Group {
  key: string;
  hash: string;
  tree: DrawNode;
  surface: Surface;
  component: string;
  columns: number;
  maxRows?: number;
  runs: Set<string>;
  drawings: Drawing[];
}

const SCHEMES: Scheme[] = ["dark", "light"];

export async function checkModCommand(args: string[], rt: Runtime): Promise<Record<string, unknown>> {
  const p = parseCommandArgs("check-mod", args, FLAGS, { min: 1, max: 1, usage: "<mod folder>" });
  const widths = (listFlag(p, "widths") ?? WIDTHS.map(String)).map(Number);
  if (widths.some((w) => !Number.isInteger(w) || w < 20 || w > 400)) fail("--widths: whole numbers of columns between 20 and 400", "VALIDATION_ERROR");
  const surfaces = (listFlag(p, "surfaces") ?? ["terminal", "desktop"]) as Surface[];
  if (surfaces.some((s) => s !== "terminal" && s !== "desktop")) fail("--surfaces: terminal and/or desktop", "VALIDATION_ERROR");
  const termBg = { ...TERM_BG };
  for (const kv of listFlag(p, "term-bg") ?? []) {
    const m = /^(dark|light)=(#[0-9a-f]{6})$/i.exec(kv);
    if (!m) fail("--term-bg: dark=#rrggbb and/or light=#rrggbb", "VALIDATION_ERROR");
    termBg[m[1]!.toLowerCase() as Scheme] = m[2]!;
  }
  const dir = resolve(rt.cwd, p.positionals[0]!);
  const info = inspectMod(dir, rt.env);
  const langFlag = listFlag(p, "languages");
  const languages = langFlag ? (langFlag.length === 1 && langFlag[0] === "none" ? [] : langFlag) : info.languages;
  const limit = p.global.full ? Infinity : (p.global.limit ?? 25);
  const label = relative(rt.cwd, dir).replace(/\\/g, "/") || ".";

  if (!info.components.length) {
    return {
      status: `pass: nothing to check, ${info.name} hooks no ui.render`,
      mod: `${info.name} ${info.version} (${label})`,
      help: ["check-mod measures what a mod draws (ui.render on AbovePrompt, Pane, ToolUse…); a mod that only hooks events has no UI to gate"],
    };
  }

  const t0 = Date.now();
  const { drawings, runs, notes } = await collectDrawings(info, {
    widths,
    surfaces,
    languages,
    useTests: !p.bool("no-tests"),
    ...(p.str("pane-id") ? { paneId: p.str("pane-id")! } : {}),
    env: rt.env,
    keep: p.bool("keep"),
  });
  const collectMs = Date.now() - t0;
  // Ghi mọi cây ra tệp (soi lỗi, làm fixture cho test): DK_MOD_DUMP=<tệp.json>.
  if (rt.env["DK_MOD_DUMP"]) writeFileSync(resolve(rt.cwd, rt.env["DK_MOD_DUMP"]), JSON.stringify({ mod: info.name, widths, drawings }, null, 1));

  const findings = new Map<string, Finding>();
  const add = (gate: Gate, check: string, surface: Surface | "-", whereAt: string, detail: string, render: string) => {
    const k = `${gate}|${check}|${surface}|${whereAt}|${detail}`;
    const f = findings.get(k) ?? { gate, check, surface, where: whereAt, detail, renders: new Set<string>() };
    f.renders.add(render);
    findings.set(k, f);
  };

  // ---- Lỗi mount và test hỏng ----
  const hookFailed = new Set<string>();
  for (const d of drawings) {
    if (!d.error) continue;
    const refused = /refus|cannot draw|can't draw|lacks|not allowed|past its rows|invalid/i.test(d.error);
    if (refused && !d.generic) add("hard", "mount", d.surface, d.component, d.error.slice(0, 220), `${d.columns}`);
    else hookFailed.add(`${d.generic ? "generic mount" : `test "${d.test}"`} on ${d.surface}: ${d.error.slice(0, 160)}`);
  }
  for (const n of [...hookFailed].slice(0, 4)) notes.push(`not drawn: ${n}`);
  const defaultRun = runs.find((r) => r.run === "default");
  for (const f of defaultRun?.failures ?? []) add("soft", "tests", "-", f.test.slice(0, 80), f.error || "failed", "default run");
  for (const r of runs) if (r.broken) notes.push(`run ${r.run}: no test ran (${r.broken})`);

  // ---- Gộp cây trùng ----
  const groups = new Map<string, Group>();
  let blank = 0;
  for (const d of drawings) {
    if (!d.tree) continue;
    if (isBlank(d.tree)) {
      blank++;
      continue;
    }
    const hash = hashTree(d.tree);
    const key = `${d.surface}|${d.component}|${d.columns}|${hash}`;
    const g = groups.get(key) ?? { key, hash, tree: d.tree, surface: d.surface, component: d.component, columns: d.columns, runs: new Set<string>(), drawings: [], ...(d.maxRows !== undefined ? { maxRows: d.maxRows } : {}) };
    g.runs.add(d.run);
    g.drawings.push(d);
    groups.set(key, g);
  }
  const term = [...groups.values()].filter((g) => g.surface === "terminal");
  const desk = [...groups.values()].filter((g) => g.surface === "desktop");

  // ---- Luật engine (mỗi cây một lần, ghi mọi bề rộng có cây đó) ----
  const colsOf = new Map<string, number[]>();
  for (const g of groups.values()) colsOf.set(`${g.surface}|${g.hash}`, [...(colsOf.get(`${g.surface}|${g.hash}`) ?? []), g.columns]);
  const ruled = new Set<string>();
  for (const g of groups.values()) {
    const hk = `${g.surface}|${g.hash}`;
    if (ruled.has(hk)) continue;
    ruled.add(hk);
    for (const h of engineRules(g.tree, g.component)) {
      // Hoạt ảnh SVG chỉ chạy trên desktop; luật nguồn Svg cũng chỉ áp ở đó (terminal không có Svg).
      if (g.surface === "terminal" && (h.check === "motion" || h.check === "svg-source")) continue;
      for (const c of colsOf.get(hk) ?? [g.columns]) add(h.gate, h.check, g.surface, h.where, h.detail, `${c}`);
    }
  }
  // Dòng tràn: một phát hiện mỗi component, ghi dòng rộng nhất.
  const overflowAt = new Map<string, { widest: number; cols: Set<number> }>();

  // ---- Terminal ----
  const k = await loadInk();
  const renders = new Map<string, TermRender>();
  const contrastGroups = new Map<string, { component: string; texts: Set<string>; detail: string; renders: Set<string> }>();
  const rawGroups = new Map<string, { component: string; prop: string; value: string; suggest: string; texts: Set<string>; renders: Set<string> }>();
  const rowsByScene = new Map<string, Array<{ columns: number; rows: number }>>();
  for (const g of term) {
    for (const scheme of SCHEMES) {
      const r = renderTerm(g.tree, g.columns, scheme, k);
      renders.set(`${g.key}|${scheme}`, r);
      if (r.error) {
        add("hard", "render", "terminal", g.component, `Ink could not lay the tree out: ${r.error.slice(0, 160)}`, `${g.columns}`);
        continue;
      }
      for (const h of termContrast(g.tree, scheme, termBg[scheme])) {
        if (h.ratio >= h.need) continue;
        const named = h.fg.kind === "named" ? "; a named color, its shade depends on the terminal palette" : "";
        const fgName = h.fg.value && h.fg.value !== h.fgCss ? `${h.fg.value} (${h.fgCss})` : h.fgCss;
        const ck = `${g.component}|${h.fgCss}|${h.bg}|${h.need}`;
        const c = contrastGroups.get(ck) ?? { component: g.component, texts: new Set<string>(), detail: `${fgName} on ${h.bg}: ${fmtRatio(h.ratio)}, needs ${h.need}:1 (${h.need === 3 ? "a lone symbol" : "text"}); APCA Lc ${h.lc.toFixed(1)}${named}`, renders: new Set<string>() };
        c.texts.add(h.text);
        c.renders.add(`${scheme}/${g.columns}`);
        contrastGroups.set(ck, c);
      }
      if (scheme !== "dark") continue;
      // Bố cục không đổi theo màu: đo một lần.
      if (r.widest > g.columns) {
        const o = overflowAt.get(g.component) ?? { widest: 0, cols: new Set<number>() };
        o.widest = Math.max(o.widest, r.widest - g.columns);
        o.cols.add(g.columns);
        overflowAt.set(g.component, o);
      }
      for (const c of textCuts(g.tree, r)) add("soft", "text-cut", "terminal", where(g.component, c.node), c.shown ? `shows "${c.shown}" of "${c.text}"` : `"${c.text}" is not shown`, `${g.columns}`);
      if (g.component === "AbovePrompt" && g.maxRows !== undefined && r.rows > g.maxRows) add("soft", "rows", "terminal", "AbovePrompt", `${r.rows} rows, the band shows ${g.maxRows} and scrolls the rest`, `${g.columns}`);
      if (g.component === "AskUserQuestion" && g.columns === ASK_COLUMNS && r.rows > ASK_ROWS.terminal) add("hard", "ask-rows", "terminal", "AskUserQuestion", `${r.rows} rows at ${ASK_COLUMNS} columns, the dialog takes at most ${ASK_ROWS.terminal}`, `${g.columns}`);
      for (const d of g.drawings) {
        const sk = `${d.run}|${d.scene}`;
        const list = rowsByScene.get(sk) ?? [];
        if (!list.some((x) => x.columns === d.columns)) list.push({ columns: d.columns, rows: r.rows });
        rowsByScene.set(sk, list);
      }
    }
    for (const c of rawColors(g.tree)) {
      const ck = `${g.component}|${c.prop}|${c.value.toLowerCase()}`;
      const e = rawGroups.get(ck) ?? { component: g.component, prop: c.prop, value: c.value, suggest: c.suggest, texts: new Set<string>(), renders: new Set<string>() };
      const t = c.node.type === "Box" ? "" : textOf(c.node).trim();
      e.texts.add(t ? `${c.node.type} "${t.length > 24 ? `${t.slice(0, 23)}…` : t}"` : c.node.type);
      e.renders.add(`${g.columns}`);
      rawGroups.set(ck, e);
    }
  }
  // Một dòng cho mỗi màu: liệt kê các chữ dùng nó.
  const listTexts = (s: Set<string>, n = 3) => {
    const a = [...s];
    return `${a.slice(0, n).join(", ")}${a.length > n ? ` +${a.length - n} more` : ""}`;
  };
  for (const c of contrastGroups.values()) {
    for (const r of c.renders) add("hard", "contrast", "terminal", `${c.component} › ${listTexts(new Set([...c.texts].map((t) => `"${t.length > 20 ? `${t.slice(0, 19)}…` : t}"`)))}`, c.detail, r);
  }
  for (const e of rawGroups.values()) {
    for (const r of e.renders) add("soft", "hard-color", "terminal", `${e.component} › ${e.prop} ${e.value}`, `fixed color on ${listTexts(e.texts)}: it does not follow the person's dark/light theme; nearest theme key: ${e.suggest}`, r);
  }
  for (const [component, o] of overflowAt) {
    for (const c of o.cols) add("hard", "overflow", "terminal", component, `a line runs up to ${o.widest} cell(s) past the columns: the terminal wraps it and the layout breaks; let the content shrink (flexShrink, wrap="truncate-end") or drop parts when narrow`, `${c}`);
  }
  // Thanh cao lên khi hẹp lại: chữ xuống dòng thay vì thanh co lại.
  for (const [sk, list] of rowsByScene) {
    const comp = drawings.find((d) => `${d.run}|${d.scene}` === sk)?.component;
    if (comp !== "AbovePrompt" || list.length < 2) continue;
    list.sort((a, b) => a.columns - b.columns);
    const wide = list[list.length - 1]!;
    const grown = list.filter((x) => x.rows > wide.rows);
    if (grown.length) add("soft", "rows", "terminal", "AbovePrompt", `${wide.rows} row(s) at ${wide.columns} columns, ${Math.max(...grown.map((x) => x.rows))} when narrow: text wraps instead of the band shrinking`, widthRanges(grown.map((x) => x.columns), widths));
  }
  // Svg trên desktop thành hộp rỗng trên terminal.
  const byMount = new Map<string, { terminal?: Drawing; desktop?: Drawing }>();
  for (const d of drawings) {
    if (!d.tree) continue;
    const mk = `${d.run}|${d.scene}|${d.columns}`;
    const e = byMount.get(mk) ?? {};
    e[d.surface] = d;
    byMount.set(mk, e);
  }
  for (const { terminal, desktop } of byMount.values()) {
    if (!terminal?.tree || !desktop?.tree) continue;
    for (const svg of droppedSvgs(desktop.tree, terminal.tree)) {
      add("soft", "svg-terminal", "terminal", describeNode(terminal.component, svg), "an empty box on the terminal: the picture and its alt are gone; draw a Text (glyph or word) there when e.surface is terminal", `${terminal.columns}`);
    }
  }

  // ---- Desktop và ảnh chụp ----
  const name = info.name.replace(/[^\w.-]+/g, "_");
  const shotsDir = p.bool("no-shots") ? undefined : resolve(rt.cwd, p.str("shots") ?? join(".design-kit", "shots", `mod-${name}`));
  // Trang đo theo lô ở thư mục tạm; thư mục ảnh chỉ giữ ảnh và trang một cây của các ảnh đó.
  const pagesDir = join(tmpdir(), `dk-mod-pages-${process.pid}-${Date.now()}`);
  if (shotsDir) rmSync(shotsDir, { recursive: true, force: true });
  mkdirSync(pagesDir, { recursive: true });
  let shots = 0;
  let via = "";
  const needBrowser = desk.length > 0 || !!shotsDir;
  let browser: Browser | undefined;
  try {
    if (needBrowser) ({ browser, via } = await launchBrowser(rt.env));
    if (desk.length && browser) await checkDesktop(browser, desk, info.name, pagesDir, widths, add);

    if (shotsDir && browser) shots = await takeShots(browser, { term, desk, renders, termBg, shotsDir, name: info.name, widths });
  } finally {
    await browser?.close();
    rmSync(pagesDir, { recursive: true, force: true });
  }

  // ---- Tổng hợp TOON ----
  const all = [...findings.values()].sort((a, b) => (a.gate === b.gate ? 0 : a.gate === "hard" ? -1 : 1));
  const hard = all.filter((f) => f.gate === "hard").length;
  const distinct = (s: Surface) => new Set([...groups.values()].filter((g) => g.surface === s).map((g) => g.hash)).size;
  const total = distinct("terminal") + distinct("desktop");
  const out: Record<string, unknown> = {
    status: hard ? `fail: ${hard} hard finding(s) across ${total} distinct drawings` : `pass: ${total} distinct drawings, 0 hard failures`,
    mod: `${info.name} ${info.version} (${label})`,
    renders: [
      surfaces.includes("terminal") ? `terminal: Ink ${k.version} at ${widths.join(",")} columns on dark ${termBg.dark} and light ${termBg.light}` : "",
      surfaces.includes("desktop") ? `desktop: HTML approximation (${CELL_PX}px a cell) via ${via || "browser"}, light ${DESK.light.bg} and dark ${DESK.dark.bg}` : "",
    ].filter(Boolean).join("; "),
  };
  out["runs"] = runs.map((r: RunResult) => ({
    run: r.run,
    tests: r.run === "default" ? `${r.pass} pass, ${r.fail} fail` : `${r.pass + r.fail} ran (expect made soft)`,
    drawings: drawings.filter((d) => d.run === r.run && d.tree).length,
    seconds: Math.round(r.ms / 100) / 10,
  }));
  const comps = [...new Set([...groups.values()].map((g) => `${g.component}|${g.surface}`))];
  out["drawings"] = comps.length
    ? comps.map((cs) => {
        const [component, surface] = cs.split("|") as [string, Surface];
        const gs = [...groups.values()].filter((g) => g.component === component && g.surface === surface);
        const fromTests = new Set(gs.flatMap((g) => g.drawings.filter((d) => !d.generic).map((d) => d.test))).size;
        return { component, surface, distinct: new Set(gs.map((g) => g.hash)).size, from: `${fromTests} test(s)${gs.some((g) => g.drawings.some((d) => d.generic)) ? " + generic" : ""}` };
      })
    : "0 drawings: no mount drew anything (read notes)";
  out["checks"] = CHECKS.map(([id, gate]) => {
    const of = (g: Gate) => all.filter((f) => f.check === id && f.gate === g).length;
    const h = of("hard");
    const s = of("soft");
    const skipped = (id === "text-min" || id === "axe" || id === "motion") && !surfaces.includes("desktop");
    return { check: id, gate, result: skipped ? "skipped" : h || s ? [h && `${h} hard`, s && `${s} soft`].filter(Boolean).join(", ") : "ok" };
  });
  const shown = all.slice(0, limit).map((f) => ({ gate: f.gate, check: f.check, surface: f.surface, where: f.where, detail: f.detail, renders: compressRenders([...f.renders], widths) }));
  if (shown.length < all.length) out["count"] = `${shown.length} of ${all.length} total`;
  out["findings"] = shown.length ? shown : "0 findings found";
  if (blank) notes.push(`${blank} drawing(s) showed nothing of the mod (it returned next(e)): not measured`);
  notes.push(`theme colors: ${loadThemes().source}`);
  notes.push(`collected ${drawings.length} drawings in ${(collectMs / 1000).toFixed(1)} s`);
  if (shotsDir) notes.push(`screenshots: ${relative(rt.cwd, shotsDir).replace(/\\/g, "/")} (${shots}), with the desktop pages as .html`);
  out["notes"] = notes;
  const help: string[] = [];
  if (all.length > shown.length) help.push(`${all.length - shown.length} more findings: add --full`);
  if (hard) help.push("Fix hard failures, then rerun the same command; soft ones need a fix or a written reason");
  if (all.some((f) => f.check === "contrast" && f.surface === "terminal")) help.push("Terminal contrast: color text with theme keys (success, warning, inactive…) so it follows the person's theme; a fixed hex has to pass on a dark and a light terminal both");
  if (all.some((f) => f.check === "hard-color")) help.push("hard-color: prefer a theme key; keep a hex only where the brand needs it, and check it on both terminals");
  if (all.some((f) => f.check === "svg-terminal")) help.push("svg-terminal: the terminal resolves Svg to an empty box, so a check like 'Svg' in ui does not pick the fallback; branch on e.surface");
  if (!info.tests.length) help.push("Write tests that mount each component in its real states (seed events, mock.clock): check-mod sweeps every mount, the generic mount only shows the empty state");
  if (shotsDir) help.push(`Open the screenshots under ${relative(rt.cwd, shotsDir).replace(/\\/g, "/")} and judge hierarchy before calling the mod done`);
  out["help"] = help;
  if (p.bool("strict") && hard) process.exitCode = 1;
  return out;
}

/** "dark/40 dark/52 light/40" ⇒ "dark/40–52 light/40" (theo thứ tự quét). */
function compressRenders(list: string[], widths: number[]): string {
  const by = new Map<string, number[]>();
  const plain: string[] = [];
  for (const r of list) {
    const m = /^(?:(\w+)\/)?(\d+)$/.exec(r);
    if (!m) {
      plain.push(r);
      continue;
    }
    const k = m[1] ?? "";
    by.set(k, [...(by.get(k) ?? []), Number(m[2])]);
  }
  const parts = [...by].map(([k, cols]) => `${k ? `${k}/` : ""}${widthRanges(cols, widths)}`);
  return [...parts, ...plain].join(" ");
}

type AddFn = (gate: Gate, check: string, surface: Surface | "-", whereAt: string, detail: string, render: string) => void;

const langOf = (g: Group): string => [...g.runs].find((r) => r !== "default") ?? "en";

/**
 * Đo trên desktop theo lô: mỗi trang chứa mọi cây của một component ở một bề rộng và một chế độ màu (mỗi cây một
 * khung có id), nên số lần nạp trang và chạy axe tính theo bề rộng, không theo số cây.
 */
async function checkDesktop(browser: Browser, desk: Group[], modName: string, dir: string, widths: number[], add: AddFn): Promise<void> {
  const require = createRequire(import.meta.url);
  const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  const batches = new Map<string, Group[]>();
  for (const g of desk) {
    const k = `${g.component}|${g.columns}`;
    batches.set(k, [...(batches.get(k) ?? []), g]);
  }
  const jobs: Array<{ component: string; columns: number; scheme: Scheme; file: string; animated: boolean }> = [];
  for (const [k, gs] of batches) {
    const [component, cols] = k.split("|") as [string, string];
    const columns = Number(cols);
    const animated = gs.some((g) => {
      let yes = false;
      walk(g.tree, (n) => {
        if (n.type === "Svg" && /@keyframes|animation\s*:|<animate/i.test(String(n.props?.["source"] ?? ""))) yes = true;
      });
      return yes;
    });
    for (const scheme of ["light", "dark"] as Scheme[]) {
      const file = join(dir, `batch-${component}-${columns}-${scheme}.html`);
      const slots = gs.map((g, i) => desktopSlot(g.tree, { columns, scheme, lang: langOf(g), id: `d${i}` }));
      writeFileSync(file, desktopDoc(slots, { scheme, lang: "en", title: `${modName} ${component}: ${gs.length} drawing(s) at ${columns} columns (${scheme})` }));
      jobs.push({ component, columns, scheme, file, animated });
    }
  }

  // Chữ nhỏ: gom theo cỡ chữ, một dòng liệt kê các chữ (agents-panel có hàng chục chữ 11px như nhau).
  const small = new Map<string, { component: string; size: string; svg: boolean; texts: Set<string>; renders: Set<string> }>();
  const wide = new Map<string, { px: number; renders: Set<string> }>();
  const viewport = { width: Math.max(...widths) * CELL_PX + 48, height: 900 };
  const run = async (list: typeof jobs) => {
    for (const j of list) {
      const ctx = await browser.newContext({ viewport, colorScheme: j.scheme });
      const page = await ctx.newPage();
      try {
        const render = `${j.scheme}/${j.columns}`;
        await page.goto(pathToFileURL(j.file).href, { waitUntil: "load" });
        await page.evaluate(settleAnimations, 600);
        const p = await page.evaluate(probePage);
        for (const h of p.textMin) {
          const size = /([\d.]+px)/.exec(h.value)?.[1] ?? h.value;
          const svg = /svg|::shadow text/i.test(h.where);
          const text = /"(.*)"$/.exec(h.where)?.[1] ?? h.where;
          const k = `${j.component}|${size}|${svg}`;
          const e = small.get(k) ?? { component: j.component, size, svg, texts: new Set<string>(), renders: new Set<string>() };
          e.texts.add(text.length > 28 ? `${text.slice(0, 27)}…` : text);
          e.renders.add(render);
          small.set(k, e);
        }
        for (const h of p.textClip) add("soft", "text-cut", "desktop", `${j.component} › ${h.where}`, `text cut off ${h.value.replace(/^at \d+px /, "")}`, render);
        const over = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>(".slot")].filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => ({ scroll: s.scrollWidth, client: s.clientWidth })),
        );
        for (const o of over) {
          const e = wide.get(j.component) ?? { px: 0, renders: new Set<string>() };
          e.px = Math.max(e.px, o.scroll - o.client);
          e.renders.add(render);
          wide.set(j.component, e);
        }
        for (const v of await axeNodes(page, axeSource)) {
          const gate: Gate = v.impact === "serious" || v.impact === "critical" ? "hard" : "soft";
          for (const n of v.nodes) {
            if (v.id === "color-contrast") {
              const m = /contrast of ([\d.]+) \(foreground color: (#\w+), background color: (#\w+).*?Expected contrast ratio of ([\d.]+:1)/.exec(n.msg);
              add(gate, "contrast", "desktop", `${j.component} › ${htmlText(n.html)}`, m ? `${m[2]} on ${m[3]}: ${m[1]}:1, needs ${m[4]}` : n.msg.slice(0, 200), render);
            } else add(gate, "axe", "desktop", `${j.component} › ${v.id}: ${htmlText(n.html)}`, n.msg.slice(0, 200), render);
          }
        }
        // Giảm chuyển động: nạp lại lô có Svg hoạt ảnh với prefers-reduced-motion: reduce (một chế độ màu là đủ).
        if (j.animated && j.scheme === "light") {
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.reload({ waitUntil: "load" });
          await page.waitForTimeout(700);
          const m = await page.evaluate(probeMotionDeep);
          if (m.running) add("hard", "motion", "desktop", j.component, `animation in Svg still runs with prefers-reduced-motion: reduce (${[...new Set(m.samples)].join(", ")})`, `${j.columns}`);
        }
      } finally {
        await ctx.close();
      }
    }
  };
  const LANES = 4;
  await Promise.all(Array.from({ length: LANES }, (_, i) => run(jobs.filter((_, n) => n % LANES === i))));

  for (const [component, e] of wide) {
    for (const r of e.renders) add("hard", "overflow", "desktop", component, `content runs up to ${e.px}px past its slot`, r);
  }
  for (const e of small.values()) {
    const all = [...e.texts];
    const list = `${all.slice(0, 3).map((t) => `"${t}"`).join(", ")}${all.length > 3 ? ` +${all.length - 3} more` : ""}`;
    for (const r of e.renders) add("hard", "text-min", "desktop", `${e.component} › ${e.svg ? "SVG text" : "text"} at ${e.size}`, `under 12px: ${list}`, r);
  }
}

/** Ảnh chụp: mỗi lần mount (scene) lấy bề rộng hẹp nhất và rộng nhất; trùng cây thì một ảnh. Tối đa 24 mỗi surface. */
async function takeShots(
  browser: Browser,
  o: { term: Group[]; desk: Group[]; renders: Map<string, TermRender>; termBg: Record<Scheme, string>; shotsDir: string; name: string; widths: number[] },
): Promise<number> {
  const MAX = 24;
  mkdirSync(o.shotsDir, { recursive: true });
  const pick = (gs: Group[]): Group[] => {
    const ends = new Map<string, { min: Group; max: Group }>();
    for (const g of gs) {
      for (const d of g.drawings) {
        const sk = `${d.run}|${d.scene}`;
        const e = ends.get(sk);
        if (!e) ends.set(sk, { min: g, max: g });
        else {
          if (g.columns < e.min.columns) e.min = g;
          if (g.columns > e.max.columns) e.max = g;
        }
      }
    }
    const chosen = new Map<string, Group>();
    for (const { min, max } of ends.values()) for (const g of [min, max]) chosen.set(g.key, g);
    return [...chosen.values()].sort((a, b) => a.component.localeCompare(b.component) || a.hash.localeCompare(b.hash) || a.columns - b.columns).slice(0, MAX);
  };
  let n = 0;
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try {
    const termFg: Record<Scheme, string> = { dark: "#cccccc", light: "#1e1e1e" };
    for (const g of pick(o.term)) {
      const panels = SCHEMES.flatMap((s) => {
        const r = o.renders.get(`${g.key}|${s}`);
        return r ? [{ label: `${s} terminal ${o.termBg[s]} · ${g.columns} columns · ${r.rows} row(s)`, bg: o.termBg[s], fg: termFg[s], render: r }] : [];
      });
      if (!panels.length) continue;
      await page.setContent(termShotHtml(panels));
      await page.locator("body").screenshot({ path: join(o.shotsDir, `terminal-${g.component}-${g.hash}-${g.columns}.png`) });
      n++;
    }
    for (const g of pick(o.desk)) {
      for (const s of ["light", "dark"] as Scheme[]) {
        // SVG của mod đổi màu theo prefers-color-scheme: chụp bản tối với trình duyệt ở chế độ tối.
        await page.emulateMedia({ colorScheme: s });
        const file = join(o.shotsDir, `desktop-${g.component}-${g.hash}-${g.columns}-${s}.html`);
        writeFileSync(file, desktopHtml(g.tree, { columns: g.columns, scheme: s, lang: langOf(g), title: `${o.name} ${g.component} ${g.columns} columns (${s})` }));
        await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
        try {
          await page.locator("#slot").screenshot({ path: join(o.shotsDir, `desktop-${g.component}-${g.hash}-${g.columns}-${s}.png`), timeout: 5000 });
          n++;
        } catch {
          // Khung rỗng (0 px): không có gì để chụp.
        }
      }
    }
  } finally {
    await ctx.close();
  }
  return n;
}
