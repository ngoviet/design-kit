import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, extname, join, relative, resolve } from "node:path";
import type { Browser, Page } from "playwright-core";
import { type FlagSpec, listFlag, parseCommandArgs } from "../args.js";
import { launchBrowser, serveRoot, startServer, urlFor } from "../browser.js";
import { fail } from "../errors.js";
import { findImpeccable, runImpeccable } from "../impeccable.js";
import { installVitals, probeFocus, probeMotion, probePage, type ProbeHit } from "../probe.js";
import type { Runtime } from "../runtime.js";

export const CHECK_HELP = `usage: design-kit check <file|dir|url>... [flags]
description: Design gate. Renders each page at 320/390/1280 px in light and dark, then measures what a person would hit: axe-core (WCAG 2.2 AA), horizontal overflow, text size and line height (through open shadow roots), Vietnamese lang and fonts, line length, reduced motion, keyboard focus, LCP/CLS, and the Impeccable detector. Prints one verdict per page: hard failures block "done", soft ones need a reason
flags[12]:
  --query <q,q>: run each page once per query string (e.g. dk=dem,dk=giay,dk=dam for design-kit blocks)
  --viewports <w,w>: widths in px (default 320,390,1280; 320 is used for overflow only)
  --schemes <light,dark>: color schemes to render (default light,dark)
  --shots <dir>: screenshot folder (default .design-kit/shots); --no-shots to skip
  --no-shots: do not save screenshots
  --no-impeccable: skip the Impeccable detector (faster)
  --focus <n>: Tab stops to inspect (default 15)
  --strict: exit 1 when any page has a hard failure
  --jobs <n>: pages checked at once (default 3, max 8)
  --limit <n>: findings to show (default 25)
  --full: every finding
  --help: this help
gates[3]:
  hard: overflow at 320px, axe serious/critical (contrast, target size, labels…), text < 12px, heading line-height < 1.2 in Vietnamese, missing lang="vi", animation that ignores reduced motion, Impeccable slop rules and quality rules a user trips on (low-contrast, tiny-text, overflow, occlusion, script errors)
  soft: axe moderate/minor, body text < 16px or line-height < 1.5, lines > 80ch, a scroll box hiding content (cut-off table), web font not loaded, focus ring missing or hidden, LCP > 2.5s, CLS > 0.1, other Impeccable quality rules and advisories
  human: hierarchy and taste: open the screenshots
notes[3]:
  Local files are served over http://127.0.0.1 from the nearest folder with .git or package.json, so ../ links resolve
  Exit 0 whenever the pages were checked: read \`status\`. --strict turns hard failures into exit 1
  Browser: Edge, else Chrome (channel), else DK_BROWSER. Impeccable: IMPECCABLE_BIN, else the skill's bundled engine
examples[3]:
  design-kit check index.html
  design-kit check blocks/html --query dk=dem,dk=giay,dk=dam --strict
  design-kit check http://localhost:5173 --viewports 390,1280
`;

const FLAGS: Record<string, FlagSpec> = {
  query: { type: "string", hint: "--query <q,q>" },
  viewports: { type: "string", hint: "--viewports <w,w>" },
  schemes: { type: "string", hint: "--schemes light,dark" },
  shots: { type: "string", hint: "--shots <dir>" },
  "no-shots": { type: "boolean", hint: "--no-shots" },
  "no-impeccable": { type: "boolean", hint: "--no-impeccable" },
  focus: { type: "string", hint: "--focus <n>" },
  strict: { type: "boolean", hint: "--strict" },
  jobs: { type: "string", hint: "--jobs <n>" },
};

type Gate = "hard" | "soft";
interface Finding {
  gate: Gate;
  check: string;
  where: string;
  detail: string;
  renders: Set<string>;
}
interface PageReport {
  target: string;
  findings: Map<string, Finding>;
  checks: Map<string, { gate: Gate; failed: number }>;
  notes: string[];
  shots: number;
}

const HEIGHT: Record<number, number> = { 320: 720, 390: 844, 1280: 800 };
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Mọi kiểm tra có tên ở đây (để bảng `checks` liệt kê cả kiểm tra đã đạt). */
const CHECKS: Array<[string, Gate]> = [
  ["overflow", "hard"], ["axe", "hard"], ["text-min", "hard"], ["heading-lh", "hard"], ["lang", "hard"], ["motion", "hard"],
  ["impeccable", "hard"], ["body-size", "soft"], ["body-lh", "soft"], ["measure", "soft"], ["font", "soft"],
  ["focus", "soft"], ["inner-scroll", "soft"], ["lcp", "soft"], ["cls", "soft"],
];

/**
 * Cổng cho luật Impeccable (bộ tiêu chí, docs/tieu-chi.md): mọi luật "slop" chính là cứng (0 dấu hiệu UI do AI);
 * luật "quality" chỉ cứng khi đo thứ người dùng vấp thật (tương phản, chữ nhỏ, tràn, che chữ, lỗi script);
 * còn lại (độ dài dòng, nhịp tiêu đề, đệm…) là mềm.
 */
const IMP_HARD_QUALITY = new Set([
  "broken-image", "script-error", "content-hidden-at-rest", "text-occlusion", "first-viewport-column-overflow",
  "gray-on-color", "low-contrast", "body-text-viewport-edge", "tiny-text", "undersized-ui-text", "text-overflow",
]);
export function impGate(f: { antipattern: string; category?: string; severity?: string; advisory?: boolean }): Gate {
  if (f.advisory === true || f.severity === "advisory") return "soft";
  if (f.category === "slop") return "hard";
  return IMP_HARD_QUALITY.has(f.antipattern) ? "hard" : "soft";
}

function expandTargets(inputs: string[], cwd: string): string[] {
  const out: string[] = [];
  for (const t of inputs) {
    if (/^https?:\/\//i.test(t)) {
      out.push(t);
      continue;
    }
    const p = resolve(cwd, t);
    if (!existsSync(p)) fail(`not found: ${t}`, "VALIDATION_ERROR", ["Pass an .html file, a folder of .html files, or an http(s) URL"]);
    if (statSync(p).isDirectory()) {
      const files = readdirSync(p).filter((f) => extname(f).toLowerCase() === ".html").sort();
      if (!files.length) fail(`no .html files in ${t}`, "VALIDATION_ERROR");
      out.push(...files.map((f) => join(p, f)));
    } else out.push(p);
  }
  return out;
}

function add(r: PageReport, gate: Gate, check: string, where: string, detail: string, render: string): void {
  const key = `${check}|${where}|${detail}`;
  const f = r.findings.get(key) ?? { gate, check, where, detail, renders: new Set<string>() };
  f.renders.add(render);
  r.findings.set(key, f);
}

function hits(r: PageReport, gate: Gate, check: string, list: ProbeHit[], what: string, render: string, max = 6): void {
  for (const h of list.slice(0, max)) add(r, gate, check, h.where, `${what} ${h.value}`, render);
  if (list.length > max) add(r, gate, check, `+${list.length - max} more`, what, render);
}

async function axeRun(page: Page, axeSource: string): Promise<Array<{ id: string; impact: string; help: string; nodes: string[] }>> {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async (tags) => {
    const w = window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string; help: string; nodes: Array<{ target: unknown[]; any: Array<{ message: string }> }> }> }> } };
    const res = await w.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return res.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? "minor",
      help: v.help,
      nodes: v.nodes.slice(0, 4).map((n) => `${JSON.stringify(n.target).slice(1, -1).replace(/"/g, "")}${n.any[0] ? `: ${n.any[0].message}` : ""}`),
    }));
  }, AXE_TAGS);
}

async function checkPage(
  browser: Browser,
  url: string,
  label: string,
  opts: { viewports: number[]; schemes: string[]; shotsDir?: string; focusStops: number; axeSource: string },
  r: PageReport,
): Promise<void> {
  for (const scheme of opts.schemes) {
    for (const vw of opts.viewports) {
      const render = `${scheme}/${vw}`;
      const ctx = await browser.newContext({
        viewport: { width: vw, height: HEIGHT[vw] ?? 900 },
        colorScheme: scheme as "light" | "dark",
        reducedMotion: "no-preference",
      });
      const page = await ctx.newPage();
      await page.addInitScript(installVitals);
      let resp;
      try {
        resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
      } catch (e) {
        await ctx.close();
        fail(`${label}: ${(e as Error).message.split("\n")[0]}`, "LOAD_FAILED", ["Check the URL or that the dev server is running"]);
      }
      if (resp && resp.status() >= 400) {
        await ctx.close();
        fail(`${label}: HTTP ${resp.status()}`, "LOAD_FAILED");
      }
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.waitForTimeout(300);
      const p = await page.evaluate(probePage);

      if (p.scrollW > p.clientW + 1) add(r, "hard", "overflow", `${vw}px`, `page is ${p.scrollW}px wide, viewport ${p.clientW}px`, render);
      if (vw !== 320) {
        if (p.shadowRoots && !r.notes.some((n) => n.startsWith("shadow"))) r.notes.push(`shadow roots measured: ${p.shadowRoots}`);
        hits(r, "hard", "text-min", p.textMin, "font-size", render);
        hits(r, "soft", "body-size", p.bodySmall, "body text", render);
        hits(r, "soft", "body-lh", p.bodyTight, "line-height", render);
        hits(r, "soft", "measure", p.measure, "line length", render, 3);
        hits(r, "soft", "font", p.fontFallback, "web font not loaded:", render, 3);
        hits(r, "soft", "inner-scroll", p.innerScroll, "horizontal scroll hides content:", render, 3);
        if (p.vietnamese) {
          hits(r, "hard", "heading-lh", p.headingTight, "line-height", render);
          if (!/^vi\b/i.test(p.lang)) add(r, "hard", "lang", "<html>", `Vietnamese text but lang="${p.lang}"`, render);
        }
        // axe chạy ở mọi khổ ≠ 320 và mọi chế độ: tương phản bản tối hay hỏng nhất.
        for (const v of await axeRun(page, opts.axeSource)) {
          const gate: Gate = v.impact === "serious" || v.impact === "critical" ? "hard" : "soft";
          for (const n of v.nodes) add(r, gate, "axe", `${v.id}`, n.slice(0, 220), render);
        }
        if (opts.shotsDir) {
          await page.screenshot({ path: join(opts.shotsDir, `${scheme}-${vw}.png`), fullPage: true });
          r.shots++;
        }
      }
      // Một lần (sáng, khổ rộng nhất): vitals, focus, giảm chuyển động.
      if (scheme === opts.schemes[0] && vw === Math.max(...opts.viewports)) {
        const v = await page.evaluate(() => (window as unknown as { __dk: { lcp: number; cls: number } }).__dk);
        if (v.lcp > 2500) add(r, "soft", "lcp", "page", `LCP ${Math.round(v.lcp)} ms > 2500`, render);
        if (v.cls > 0.1) add(r, "soft", "cls", "page", `CLS ${v.cls.toFixed(3)} > 0.1`, render);
        r.notes.push(`lab vitals: LCP ${Math.round(v.lcp)} ms, CLS ${v.cls.toFixed(3)} (local load; field p75 decides)`);
        const seen = new Set<string>();
        for (let i = 0; i < opts.focusStops; i++) {
          await page.keyboard.press("Tab");
          const f = await page.evaluate(probeFocus);
          if (!f || seen.has(f.where)) continue;
          seen.add(f.where);
          if (!f.indicator) add(r, "soft", "focus", f.where, "no visible focus ring (outline ≥ 2px or box-shadow)", render);
          if (f.obscured) add(r, "soft", "focus", f.where, "focused element is covered by other content", render);
        }
        r.notes.push(`focus stops inspected: ${seen.size}`);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForTimeout(400);
        const m = await page.evaluate(probeMotion);
        if (m.running) add(r, "hard", "motion", m.samples.join(", "), `${m.running} animation(s) still run with prefers-reduced-motion: reduce`, render);
      }
      await ctx.close();
    }
  }
}

export async function checkCommand(args: string[], rt: Runtime): Promise<Record<string, unknown>> {
  const p = parseCommandArgs("check", args, FLAGS, { min: 1, max: Infinity, usage: "<file|dir|url>..." });
  const viewports = (listFlag(p, "viewports") ?? ["320", "390", "1280"]).map(Number);
  if (viewports.some((v) => !Number.isInteger(v) || v < 200 || v > 3000)) fail("--viewports: widths between 200 and 3000", "VALIDATION_ERROR");
  const schemes = listFlag(p, "schemes") ?? ["light", "dark"];
  if (schemes.some((s) => s !== "light" && s !== "dark")) fail("--schemes: light and/or dark", "VALIDATION_ERROR");
  const queries = listFlag(p, "query") ?? [""];
  const focusStops = Number(p.str("focus") ?? 15);
  if (!Number.isInteger(focusStops) || focusStops < 0) fail("--focus must be a whole number", "VALIDATION_ERROR");
  if (!/^[1-8]$/.test(p.str("jobs") ?? "3")) fail("--jobs must be 1 to 8", "VALIDATION_ERROR");
  const limit = p.global.full ? Infinity : (p.global.limit ?? 25);
  const targets = expandTargets(p.positionals, rt.cwd);
  const shotsBase = p.bool("no-shots") ? undefined : resolve(rt.cwd, p.str("shots") ?? ".design-kit/shots");

  const require = createRequire(import.meta.url);
  const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  const impBin = p.bool("no-impeccable") ? undefined : findImpeccable(rt.env);
  const { browser, via } = await launchBrowser(rt.env);
  const servers = new Map<string, { origin: string; close: () => void }>();
  const jobsN = Number(p.str("jobs") ?? 3);
  // Bước 1: danh sách việc (máy chủ tĩnh dựng tuần tự). Bước 2: chạy song song có giới hạn, giữ thứ tự kết quả.
  const jobs: Array<{ url: string; label: string; r: PageReport; shotsDir?: string }> = [];
  try {
    for (const t of targets) {
      let base = t;
      if (!/^https?:/i.test(t)) {
        const root = serveRoot(t);
        if (!servers.has(root)) {
          const s = await startServer(root);
          servers.set(root, { origin: s.origin, close: () => s.server.close() });
        }
        base = urlFor(servers.get(root)!.origin, root, t);
      }
      for (const q of queries) {
        const url = q ? `${base}${base.includes("?") ? "&" : "?"}${q}` : base;
        const label = `${/^https?:/i.test(t) ? t : relative(rt.cwd, t).replace(/\\/g, "/")}${q ? `?${q}` : ""}`;
        const r: PageReport = { target: label, findings: new Map(), checks: new Map(), notes: [], shots: 0 };
        let shotsDir: string | undefined;
        if (shotsBase) {
          // Tên theo đường dẫn tương đối (không chỉ tên tệp): blocks/html/x.html và blocks/react/dist/x.html không ghi đè nhau.
          const stem = /^https?:/i.test(t) ? t.replace(/^https?:\/\//i, "") : relative(rt.cwd, t).replace(/\.html?$/i, "");
          const slug = `${stem}${q ? `-${q}` : ""}`.replace(/[\\/]+/g, "~").replace(/[^\w.~-]+/g, "_").replace(/^[._~]+/, "");
          shotsDir = join(shotsBase, slug || basename(t, extname(t)));
          mkdirSync(shotsDir, { recursive: true });
        }
        jobs.push({ url, label, r, ...(shotsDir ? { shotsDir } : {}) });
      }
    }
    const runJob = async ({ url, label, r, shotsDir }: (typeof jobs)[number]): Promise<void> => {
      const imp = impBin
        ? Promise.all(
            [`${Math.max(...viewports)}x800`, ...(viewports.includes(390) ? ["390x844"] : [])].map(async (vp) => ({ vp, res: await runImpeccable(impBin, url, vp) })),
          )
        : Promise.resolve([]);
      await checkPage(browser, url, label, { viewports, schemes, focusStops, axeSource, ...(shotsDir ? { shotsDir } : {}) }, r);
      for (const { vp, res } of await imp) {
        if (res.error) r.notes.push(`impeccable ${vp}: ${res.error}`);
        for (const f of res.findings ?? []) {
          add(r, impGate(f), "impeccable", f.antipattern, (f.snippet ?? f.name ?? "").slice(0, 200), `light/${vp.split("x")[0]}`);
        }
      }
      if (!impBin && !p.bool("no-impeccable")) r.notes.push("impeccable: engine not found (install the skill or set IMPECCABLE_BIN)");
      if (shotsDir) r.notes.push(`screenshots: ${relative(rt.cwd, shotsDir).replace(/\\/g, "/")} (${r.shots})`);
    };
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(jobsN, jobs.length) }, async () => {
        while (next < jobs.length) await runJob(jobs[next++]!);
      }),
    );
  } finally {
    await browser.close();
    for (const s of servers.values()) s.close();
  }

  const reports = jobs.map((j) => j.r);
  // ---- Tổng hợp TOON ----
  const count = (r: PageReport, g: Gate) => [...r.findings.values()].filter((f) => f.gate === g).length;
  const hardPages = reports.filter((r) => count(r, "hard") > 0).length;
  const out: Record<string, unknown> = {
    status: `${hardPages ? `fail: ${hardPages} of ${reports.length} pages have hard failures` : `pass: ${reports.length} pages, 0 hard failures`}`,
    renders: `${schemes.join("+")} × ${viewports.join("/")} px via ${via}${impBin ? ", impeccable on" : ""}`,
  };
  out["pages"] = reports.map((r) => ({
    page: r.target,
    verdict: count(r, "hard") ? "fail" : "pass",
    hard: count(r, "hard"),
    soft: count(r, "soft"),
  }));
  // Bảng kiểm tra (trang đầu nếu một trang; gộp nếu nhiều).
  const checkRows = CHECKS.map(([id, gate]) => {
    const of = (g: Gate) => reports.reduce((s, r) => s + [...r.findings.values()].filter((f) => f.check === id && f.gate === g).length, 0);
    const h = of("hard");
    const s = of("soft");
    const skipped = id === "impeccable" && !impBin;
    const result = skipped ? "skipped" : h || s ? [h && `${h} hard`, s && `${s} soft`].filter(Boolean).join(", ") : "ok";
    return { check: id, gate, result };
  });
  out["checks"] = checkRows;
  const all = reports.flatMap((r) =>
    [...r.findings.values()].map((f) => ({ ...f, page: r.target })),
  ).sort((a, b) => (a.gate === b.gate ? 0 : a.gate === "hard" ? -1 : 1));
  const shown = all.slice(0, limit).map((f) => ({
    gate: f.gate,
    ...(reports.length > 1 ? { page: f.page } : {}),
    check: f.check,
    where: f.where,
    detail: f.detail,
    renders: [...f.renders].join(" "),
  }));
  if (shown.length < all.length) out["count"] = `${shown.length} of ${all.length} total`;
  out["findings"] = shown.length ? shown : "0 findings found";
  const notes = reports.length === 1 ? reports[0]!.notes : [...new Set(reports.flatMap((r) => r.notes.filter((n) => !n.startsWith("lab vitals") && !n.startsWith("focus stops") && !n.startsWith("screenshots"))))];
  if (notes.length) out["notes"] = notes;
  const help: string[] = [];
  if (all.length > shown.length) help.push(`${all.length - shown.length} more findings: add --full`);
  if (all.some((f) => f.gate === "hard")) help.push("Fix hard failures, then rerun the same command; soft ones need a fix or a written reason");
  if (shotsBase) help.push(`Open the screenshots under ${relative(rt.cwd, shotsBase).replace(/\\/g, "/") || "."} and judge hierarchy before calling the page done`);
  out["help"] = help;
  if (p.bool("strict") && hardPages) {
    process.exitCode = 1;
  }
  return out;
}
