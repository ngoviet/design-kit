import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { type FlagSpec, listFlag, parseCommandArgs } from "../args.js";
import { launchBrowser, serveRoot, startServer, urlFor } from "../browser.js";
import { fail } from "../errors.js";
import { type AssumedHit, type CopyRules, loadCopyRules, probeCopy } from "../copy.js";
import { findImpeccable, runImpeccable } from "../impeccable.js";
import { installSchemeWatch, installVitals, probeCovered, probeFingerprint, probeFocus, probeMotion, probePage, probePause, probeReveal, probeStandalone, probeVisible, schemeReadOnce, settleAnimations, STANDALONE_TOKENS, type ProbeHit } from "../probe.js";
import type { Runtime } from "../runtime.js";
import { LATE_MS, type NetWatch, QUIET_CAP_MS, settleAfterChange, settlePage, watchNetwork } from "../settle.js";
import { inputZoomFinding } from "../zoom.js";
import { heightFor, lockedOrientation, manifestHref, MAX_WIDTH, MIN_WIDTH, parseSize, probeSticky, PROFILES, type Size, stickyFinding, SWEEP_SIZES, WIDE_FROM } from "../sizes.js";
import { installOnload, onloadFinding, readOnload } from "../onload.js";
import { probeLangParts } from "../langparts.js";
import { probeTouch, TOUCH_MIN, touchFinding } from "../touch.js";
import { probeFontUnit, type ResizeFinding, spacingPass, zoomPass } from "../textresize.js";
import { applyWaivers, loadWaivers, WAIVER_MAX_PER_PAGE } from "../waivers.js";
import { cacheKey, depPath, entryValid, fileSha, readEntry, sha, writeEntry } from "../cache.js";
import { VERSION } from "../version.js";
import { fileURLToPath } from "node:url";
import { runStandalone } from "../standalone.js";
import { loadSteps, parseSteps, runActions, STEPS_FORMAT, type StepAction, type StepState } from "../steps.js";

export const CHECK_HELP = `usage: design-kit check <file|dir|url>... [flags]
description: Design gate. Renders each page at 320/390/1280 px in light and dark, then measures what a person would hit: axe-core (WCAG 2.2 AA), horizontal overflow, text size and line height (through open shadow roots), text cut off by ellipsis or overflow, Vietnamese lang and fonts, line length, reduced motion, keyboard focus, LCP/CLS, guidance (vague "Next" buttons, dead-end empty states, up-front tours), copy that reads as unedited AI text (stock phrases, chatbot residue, placeholders, markdown left in) and the Impeccable detector. States reached by clicking (form errors, step 3, an open dialog) are measured too, from a steps file. A local file is also opened the way the Claude app's browser pane opens it (a data: URL, no server), to catch a page that loses its linked CSS. Prints one verdict per page and state: hard failures block "done", soft ones need a reason. Facts the agent filled in itself (marked data-assumed) are listed for the owner to confirm
flags[23]:
  --query <q,q>: run each page once per query string (e.g. dk=dem,dk=giay,dk=dam for design-kit blocks)
  --steps <file.json|json>: states to reach by clicking/typing, each measured like a page (overrides <page>.steps.json)
  --no-steps: ignore <page>.steps.json files next to the pages
  --viewports <w,w|WxH>: widths in px, or width x height (default 320,390,1280; every size gets every check)
  --profile devices: real device sizes instead of --viewports (320x568, 390x844, 768x1024, 1280x720, 1920x1080) plus --sweep; about 1.3 times the default time on the kit blocks
  --touch <px>: smallest touch target wanted on a touch screen (default 44, 0 to skip)
  --schemes <light,dark>: color schemes to render (default light,dark)
  --shots <dir>: screenshot folder (default .design-kit/shots); --no-shots to skip
  --no-shots: do not save screenshots
  --no-impeccable: skip the Impeccable detector (faster)
  --no-copy: skip the copy check and the data-assumed list
  --no-standalone: skip opening local files as a data: URL (a page only ever served over http)
  --focus <n>: Tab stops to inspect (default 15)
  --strict: exit 1 when any page has a hard failure
  --jobs <n>: pages checked at once (default 3, max 8)
  --waivers <file.json>: soft findings reviewed as fine, each with a reason (default .design-kit/waivers.json when it exists); listed under "waived", never hidden; --no-waivers ignores the file
  --no-waivers: show every finding, ignoring the waivers file
  --no-cache: measure every page again (and refresh the cache); by default a local page whose every loaded file is unchanged since its last check (same flags, same design-kit, axe, Impeccable and browser) reuses that result, and the output says how many
  --sweep: also check horizontal overflow, text painted over, stuck bars (and line length from 1536px) at 16 more sizes from 344 to 2560 px wide, with 640x360 (a 1280x720 screen zoomed to 200%) and 844x390 (a phone on its side), on the open page; about 0.3 s per size
  --fresh: load the page again for every width and color scheme (default: load once, resize and switch scheme in place, verified against one fresh load per page and redone fresh when the layout differs)
  --limit <n>: findings to show (default 25)
  --full: every finding
  --help: this help
gates[3]:
  hard: a page that shows nothing (no text, image or graphic, also 5 s after the network went idle), an uncaught script error or a script/stylesheet that fails to load, a page a phone lays out wider than its screen and shrinks (no width=device-width viewport meta; measured once with a mobile-emulated render at the widest --viewports width ≤ 480), overflow at 320px, axe serious/critical (contrast, target size, labels…), text < 12px, heading line-height < 1.2 in Vietnamese, missing lang="vi", animation that moves, scales or rotates things and ignores reduced motion (fades and color changes are allowed), a step that cannot be done (selector not found), Impeccable slop rules and quality rules a user trips on (low-contrast, tiny-text, overflow, occlusion, script errors)
  soft: a custom element that is never defined, axe moderate/minor, body text < 16px or line-height < 1.5, lines > 80ch, a scroll box hiding content (cut-off table), text cut off (an ellipsis or line-clamp hiding words, overflow hidden/clip cutting letters or Vietnamese accents; reports the text still shown and the width), more than 12 fields on one screen, input-zoom (a typing field with small text at phone width: iOS zooms the page in when it is tapped; rule in src/zoom.ts), guide (button that only says "Tiếp"/"Next", empty state with no next action, tour or welcome modal on load), web font not loaded, focus ring missing or hidden, copy (generation 1: stock phrases, template openers, chatbot residue such as "Chắc chắn rồi!", placeholders like [Tên công ty] or {{name}} or lorem ipsum, markdown ## or ** shown as text; generation 2: a row of 3–4 short stats under the hero, a heading in fragments "X. Y.", a link that only says "Xem thêm"/"Learn more"; lists in data/copy-tells.json), sticky (bars that stay stuck take over 30% of the screen height, 40% under 480px high), orientation (the web app manifest locks portrait or landscape), autoplay (sound started before any tap or key: audio/video play() or autoplay without muted, Web Audio start(), speech), permission (microphone, camera, notification, push or location asked before any tap or key), touch (a target under 44x44 px on a touch screen, links inside a sentence exempt; 24 stays hard through axe), text-zoom (with the reader's font size at 200%: body text that does not grow, text newly cut off or painted over, page wider than the screen; data-zoom-ok marks deliberate px text), text-spacing (text newly cut off or painted over with WCAG 1.4.12 spacing), font-unit (font-size in viewport units with no rem, em or %), nfc (letters typed as letter + combining mark), lang-part (Han characters outside lang zh/ja/ko, an English sentence inside lang="vi"; data-lang-ok marks deliberate ones), LCP > 2.5s, CLS > 0.1, standalone (opened as a file the page loses stylesheets or tokens, is over 400 KB (the pane opens at most 512 KiB), or draws Vietnamese letters from a second font), other Impeccable quality rules and advisories
  human: hierarchy and taste, and the task map (every hesitation point has a guide pattern): open the screenshots
steps:
  ${STEPS_FORMAT}
  Each state starts from a fresh load of the page and runs its own actions, then gets every check (Impeccable and LCP/CLS: initial state only)
  Put them in <page>.steps.json beside <page>.html and \`check\` picks them up, also when checking a folder
notes[5]:
  data-assumed="<why>" on an element marks a fact the agent filled in (opening hours, price, a number): listed under "assumed", not a finding, until the owner confirms it and the attribute is removed
  Local files are served over http://127.0.0.1 from the nearest folder with .git or package.json, so ../ links resolve
  standalone: the Claude app's browser pane opens file:///page.html as data:text/html,… so relative <link>s never load; fix with \`design-kit inline <page>\`
  Exit 0 whenever the pages were checked: read \`status\`. --strict turns hard failures into exit 1
  Browser: DK_BROWSER, else Edge, else Chrome (channel), else Playwright's Chromium. Impeccable: IMPECCABLE_BIN, else the skill's bundled engine
examples[4]:
  design-kit check index.html
  design-kit check blocks/html --query dk=dem,dk=giay,dk=dam --strict
  design-kit check http://localhost:5173 --viewports 390,1280
  design-kit check signup.html --steps '[{"name":"loi","do":[{"click":"text=Tạo tài khoản"}]}]'
`;

const FLAGS: Record<string, FlagSpec> = {
  query: { type: "string", hint: "--query <q,q>" },
  viewports: { type: "string", hint: "--viewports <w,w|WxH>" },
  schemes: { type: "string", hint: "--schemes light,dark" },
  profile: { type: "string", hint: "--profile devices" },
  touch: { type: "string", hint: "--touch <px>" },
  shots: { type: "string", hint: "--shots <dir>" },
  "no-shots": { type: "boolean", hint: "--no-shots" },
  "no-impeccable": { type: "boolean", hint: "--no-impeccable" },
  "no-copy": { type: "boolean", hint: "--no-copy" },
  "no-standalone": { type: "boolean", hint: "--no-standalone" },
  focus: { type: "string", hint: "--focus <n>" },
  strict: { type: "boolean", hint: "--strict" },
  jobs: { type: "string", hint: "--jobs <n>" },
  steps: { type: "string", hint: "--steps <file.json|json>" },
  "no-steps": { type: "boolean", hint: "--no-steps" },
  fresh: { type: "boolean", hint: "--fresh" },
  sweep: { type: "boolean", hint: "--sweep" },
  waivers: { type: "string", hint: "--waivers <file.json>" },
  "no-waivers": { type: "boolean", hint: "--no-waivers" },
  "no-cache": { type: "boolean", hint: "--no-cache" },
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
  assumed: AssumedHit[];
  /**
   * Bộ đệm N7: mỗi URL trên máy chủ cục bộ mà trang nhận, kèm băm của đúng thân phản hồi trang đã nhận ("missing" khi
   * ≥ 400, "unreadable" khi hỏng). Băm lúc nhận chứ không lúc job xong: tệp sửa giữa lượt đo không được đệm sai.
   */
  deps: Map<string, Array<Promise<string>>>;
}

/** Khổ tối đa còn tính là điện thoại (phép đo input-zoom, viewport). */
const PHONE_MAX = 480;
/** Khổ tối đa còn tính là máy tính bảng (phép đo touch). */
const TABLET_MAX = 1024;
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Mọi kiểm tra có tên ở đây (để bảng `checks` liệt kê cả kiểm tra đã đạt). */
const CHECKS: Array<[string, Gate]> = [
  ["render", "hard"], ["errors", "hard"], ["viewport", "hard"], ["overflow", "hard"], ["axe", "hard"], ["text-min", "hard"], ["heading-lh", "hard"], ["lang", "hard"], ["motion", "hard"],
  ["steps", "hard"], ["impeccable", "hard"], ["body-size", "soft"], ["body-lh", "soft"], ["measure", "soft"], ["font", "soft"],
  ["focus", "soft"], ["inner-scroll", "soft"], ["text-clip", "soft"], ["text-covered", "soft"], ["long-form", "soft"], ["input-zoom", "soft"], ["guide", "soft"], ["copy", "soft"], ["lcp", "soft"], ["cls", "soft"], ["standalone", "soft"], ["axe-bp", "soft"], ["pause", "soft"], ["reveal", "soft"],
  ["sticky", "soft"], ["orientation", "soft"], ["autoplay", "soft"], ["permission", "soft"], ["touch", "soft"], ["text-zoom", "soft"], ["text-spacing", "soft"], ["font-unit", "soft"], ["nfc", "soft"], ["lang-part", "soft"],
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
/**
 * Luật "slop" thuộc về khẩu vị (bảng màu), không phải công năng: hạ xuống mềm. A/B đợt 2 (09/11/2026):
 * chủ chấm mù chọn bản dashboard tiệm bánh nền kem mà luật cream-palette chặn cứng.
 */
const IMP_SOFT_SLOP = new Set(["cream-palette"]);
export function impGate(f: { antipattern: string; category?: string; severity?: string; advisory?: boolean }): Gate {
  if (f.advisory === true || f.severity === "advisory") return "soft";
  if (IMP_SOFT_SLOP.has(f.antipattern)) return "soft";
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

/** Báo cáo trang dạng JSON được (cho bộ đệm N7): Map, Set đổi thành mảng. */
interface CachedReport {
  findings: Array<Omit<Finding, "renders"> & { renders: string[] }>;
  notes: string[];
  shots: number;
  assumed: AssumedHit[];
}
const saveReport = (r: PageReport): CachedReport => ({
  findings: [...r.findings.values()].map((f) => ({ ...f, renders: [...f.renders] })),
  notes: r.notes,
  shots: r.shots,
  assumed: r.assumed,
});
function restoreReport(r: PageReport, c: CachedReport): void {
  for (const f of c.findings) r.findings.set(`${f.check}|${f.where}|${f.detail}`, { ...f, renders: new Set(f.renders) });
  r.notes.push(...c.notes);
  r.shots = c.shots;
  r.assumed.push(...c.assumed);
}

/**
 * Băm mã của chính cổng: mọi tệp .js/.ts/.mjs/.json ở thư mục của module này và thư mục cha (dist/ khi chạy bản build,
 * src/ khi chạy test). Sửa probe hay luật thì mục đệm cũ hết hiệu lực dù chưa tăng phiên bản.
 */
function codeSha(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const files = [here, dirname(here)].flatMap((d) => readdirSync(d).filter((f) => /\.(js|ts|mjs|json)$/.test(f)).sort().map((f) => join(d, f)));
  return sha(files.map((f) => fileSha(f) ?? "").join(","));
}

function hits(r: PageReport, gate: Gate, check: string, list: ProbeHit[], what: string, render: string, max = 6): void {
  for (const h of list.slice(0, max)) add(r, gate, check, h.where, what ? `${what} ${h.value}` : h.value, render);
  if (list.length > max) add(r, gate, check, `+${list.length - max} more`, what || `more ${check} findings`, render);
}

/**
 * axe một lần cho cả WCAG và nhóm `best-practice` (thứ tự tiêu đề, một h1, vùng main…). `wcag`: luật có thẻ WCAG
 * (cứng theo mức nghiêm trọng như trước); luật chỉ thuộc best-practice thì chỉ là phát hiện mềm `axe-bp` (N6, 19/11/2026).
 */
async function axeRun(page: Page, axeSource: string): Promise<Array<{ id: string; impact: string; help: string; wcag: boolean; nodes: string[] }>> {
  // Nạp qua evaluate (CDP), không qua thẻ <script>: trang có CSP `script-src 'self'` chặn thẻ chèn vào và trước kia làm
  // hỏng cả lượt kiểm. Trang đang mở (đổi khổ tại chỗ) đã có axe thì không nạp lại.
  if (!(await page.evaluate(() => "axe" in window))) await page.evaluate(axeSource);
  return page.evaluate(async (tags) => {
    const w = window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string; help: string; tags: string[]; nodes: Array<{ target: unknown[]; any: Array<{ message: string }> }> }> }> } };
    const res = await w.axe.run(document, { runOnly: { type: "tag", values: [...tags, "best-practice"] }, resultTypes: ["violations"] });
    return res.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? "minor",
      help: v.help,
      wcag: v.tags.some((t) => tags.includes(t)),
      nodes: v.nodes.slice(0, 4).map((n) => `${JSON.stringify(n.target).slice(1, -1).replace(/"/g, "")}${n.any[0] ? `: ${n.any[0].message}` : ""}`),
    }));
  }, AXE_TAGS);
}

/**
 * Nội dung có thể đến sau khi mạng đã rảnh: card đợi thư viện rồi mới vẽ, trang dựng bằng setTimeout. Đo ngay
 * thì gặp trang trắng và mọi phép đo đều "đạt". Đợi tới khi có chữ hoặc đồ hoạ, tối đa LATE_MS.
 * Trả về số ms tính từ lúc mạng rảnh tới khi nội dung hiện, 0 nếu có sẵn, -1 nếu hết giờ vẫn trắng.
 */

/** Phép đo motion đọc các hiệu ứng còn chạy sau ngần này kể từ lúc trang (hoặc thao tác cuối) đã yên. */
const MOTION_SETTLE_MS = 700;
/** Hiệu ứng vào trang có hồi kết được chờ tối đa ngần này trước khi đo chữ (xem chỗ gọi settleAnimations). */
const ENTRANCE_MS = 1_500;
async function waitForContent(page: Page, idleAt: number): Promise<number> {
  const start = Date.now();
  const seen = async () => {
    const v = await page.evaluate(probeVisible);
    return v.text > 0 || v.media > 0;
  };
  if (await seen()) return 0;
  while (Date.now() - start < LATE_MS) {
    await page.waitForTimeout(250);
    if (await seen()) {
      const at = Date.now() - idleAt;
      // Nội dung vừa tới thường kéo theo font và ảnh: chờ font xong và một nhịp ngắn cho bố cục ổn định.
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.waitForTimeout(500);
      return at;
    }
  }
  return -1;
}

/**
 * Mở trang một lần như điện thoại thật (isMobile: trình duyệt đọc thẻ meta viewport) rồi đọc bề rộng dàn trang.
 * Các lượt render khác chỉ đặt bề rộng cửa sổ, nên Playwright bỏ qua thẻ này: trang thiếu nó vẫn dàn ở 390px và qua
 * cổng, trong khi điện thoại dàn ở 980px rồi thu cả trang cho vừa màn (chữ 16px còn 6,4px). Thiếu meta viewport là
 * nguyên nhân gốc đứng đầu ở trang do AI sinh (46%, WebCompat 2026, docs/nguon.md c38).
 */
async function checkViewport(browser: Browser, url: string, width: number, height: number, r: PageReport): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
  try {
    const page = await ctx.newPage();
    const net = watchNetwork(page);
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    await settlePage(page, net);
    const v = await page.evaluate(() => {
      const metas = Array.from(document.querySelectorAll('meta[name="viewport" i]'));
      const text = Array.from(document.querySelectorAll("p, li, td, dd, label, span")).find((e) => (e.textContent ?? "").trim().length > 20);
      return {
        layout: document.documentElement.clientWidth,
        meta: metas.length ? (metas[metas.length - 1]!.getAttribute("content") ?? "") : null,
        fontSize: parseFloat(getComputedStyle(text ?? document.body).fontSize),
      };
    });
    if (v.layout > width + 1) {
      const shown = (v.fontSize * (width / v.layout)).toFixed(1);
      const why = v.meta === null ? 'no <meta name="viewport">' : `<meta name="viewport" content="${v.meta}">`;
      add(r, "hard", "viewport", "<head>",
        `${why}: on a phone the page lays out ${v.layout}px wide and is shrunk to fit ${width}px (${Math.round((width / v.layout) * 100)}%), so ${v.fontSize}px body text shows at ${shown}px. Use <meta name="viewport" content="width=device-width, initial-scale=1">`,
        `mobile/${width}`);
    }
    // Tải manifest ngoài trang: CSP `connect-src` của trang không chặn được.
    const href = await page.evaluate(manifestHref);
    const res = href && /^https?:/.test(href) ? await ctx.request.get(href, { timeout: 10_000 }).catch(() => undefined) : undefined;
    const locked = res?.ok() ? lockedOrientation(await res.text()) : undefined;
    if (locked) add(r, "soft", "orientation", "manifest", `"orientation": "${locked}" locks the installed app to one direction (WCAG 1.3.4): drop it, or use "any"`, `mobile/${width}`);
  } finally {
    await ctx.close();
  }
}

/**
 * Đích chạm (phép đo `touch`): mở trang với `hasTouch` để `(any-pointer: coarse)` đúng như máy chạm, ở khổ điện thoại và khổ
 * máy tính bảng có đo. Cửa sổ rộng hơn 1024 không đo: laptop thường dùng chuột.
 */
async function checkTouch(browser: Browser, url: string, size: Size, min: number, r: PageReport): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, isMobile: true, hasTouch: true });
  try {
    const page = await ctx.newPage();
    const net = watchNetwork(page);
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    await settlePage(page, net);
    await waitForContent(page, Date.now());
    await page.evaluate(settleAnimations, ENTRANCE_MS);
    // Cả khung con: nút trong iframe nhúng cũng là thứ ngón tay phải trúng.
    const small = [];
    for (const frame of page.frames()) small.push(...((await frame.evaluate(probeTouch, min).catch(() => undefined))?.small ?? []));
    hits(r, "soft", "touch", small.map((x) => ({ where: x.where, value: touchFinding(x, min) })), "", `touch/${size.w}`);
  } finally {
    await ctx.close();
  }
}

/** Ghi các phát hiện của textresize.ts. */
function addResize(r: PageReport, list: ResizeFinding[], render: string): void {
  for (const f of list) add(r, "soft", f.check, f.where, f.detail, render);
}

/** Một phép đo phụ hỏng (CDP, trang tự điều hướng) thì ghi chú, không làm hỏng cả lượt kiểm. */
async function optional(r: PageReport, name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    r.notes.push(`${name}: not measured (${(e as Error).message.split("\n")[0]})`);
  }
}

/** Đọc sổ tự phát tiếng và xin quyền ở mọi khung, muộn nhất có thể trước khi trang bị nạp lại. */
async function onloadPass(page: Page, r: PageReport, render: string): Promise<void> {
  for (const frame of page.frames()) {
    const calls = await frame.evaluate(readOnload).catch(() => []);
    for (const c of calls) {
      const f = onloadFinding(c);
      add(r, "soft", f.check, f.where, f.detail, render);
    }
  }
}

interface PageOpts {
  viewports: number[];
  schemes: string[];
  shotsDir?: string;
  focusStops: number;
  axeSource: string;
  state?: StepState;
  standalone?: string;
  copy?: CopyRules;
  /** Nạp lại trang cho mỗi khổ và chế độ màu (cách cũ), không đổi tại chỗ. */
  fresh?: boolean;
  /** Chiều cao của từng bề rộng trong `viewports`. */
  heights: Record<number, number>;
  /** Khổ trung gian (--sweep): tràn ngang, chữ bị che, phần dính, và độ dài dòng ở màn rộng. */
  sweep?: Size[];
}
const vhOf = (opts: PageOpts, vw: number): number => opts.heights[vw] ?? heightFor(vw);

/** Trang không mở được (sai URL, máy chủ dev chưa chạy, HTTP ≥ 400): lỗi của riêng trang đó, không của cả lượt kiểm. */
export class PageLoadError extends Error {}

interface Loaded {
  ctx: BrowserContext;
  page: Page;
  net: NetWatch;
  /** Lỗi script, script/stylesheet không tải được, tích luỹ suốt đời trang. */
  errs: string[];
}

/** Mở một trang ở khổ và chế độ màu cho trước, đợi yên và đợi nội dung đến muộn. Ném PageLoadError nếu không mở được. */
async function openPage(browser: Browser, url: string, label: string, vw: number, vh: number, scheme: string, r: PageReport): Promise<Loaded> {
  const ctx = await browser.newContext({
    viewport: { width: vw, height: vh },
    colorScheme: scheme as "light" | "dark",
    reducedMotion: "no-preference",
  });
  try {
    const page = await ctx.newPage();
    const net = watchNetwork(page);
    const dep = (u: string, h: Promise<string>): void => {
      if (/^http:\/\/127\.0\.0\.1:\d+\//.test(u)) r.deps.set(u, [...(r.deps.get(u) ?? []), h]);
    };
    page.on("response", (s) => dep(s.url(), s.status() >= 400 ? Promise.resolve("missing") : s.body().then((b) => sha(b), () => "unreadable")));
    page.on("requestfailed", (q) => dep(q.url(), Promise.resolve("unreadable")));
    await page.addInitScript(installVitals);
    await page.addInitScript(installSchemeWatch);
    await page.addInitScript(installOnload);
    // Lỗi người dùng gặp ngay khi mở: script ném lỗi, script/stylesheet không tải được (thường là nguyên nhân
    // của trang trắng). Bỏ ERR_ABORTED (yêu cầu bị huỷ khi trang tự điều hướng), bỏ console.error (favicon 404…).
    const errs: string[] = [];
    const short = (u: string) => u.replace(/^https?:\/\/127\.0\.0\.1:\d+/, "");
    page.on("pageerror", (e) => errs.push(`uncaught ${e.name}: ${e.message.split("\n")[0]}`));
    page.on("response", (s) => {
      const t = s.request().resourceType();
      if ((t === "script" || t === "stylesheet") && s.status() >= 400) errs.push(`${t} failed to load: ${short(s.url())} (HTTP ${s.status()})`);
    });
    page.on("requestfailed", (q) => {
      const t = q.resourceType();
      const why = q.failure()?.errorText ?? "";
      if ((t === "script" || t === "stylesheet") && !/ERR_ABORTED/.test(why)) errs.push(`${t} failed to load: ${short(q.url())} (${why})`);
    });
    let resp;
    try {
      resp = await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    } catch (e) {
      throw new PageLoadError(`${label}: ${(e as Error).message.split("\n")[0]}`);
    }
    if (resp && resp.status() >= 400) throw new PageLoadError(`${label}: HTTP ${resp.status()}`);
    // Font xong, không còn yêu cầu mạng dở, hai khung hình: thay cho networkidle (im đủ 500 ms) + 300 ms cố định,
    // vốn chiếm 0,8 s trong mỗi 1,05 s của một lượt render (đo 14/11/2026). Xem src/settle.ts.
    if ((await settlePage(page, net)).capped && !r.notes.some((n) => n.startsWith("network still busy"))) {
      r.notes.push(`network still busy ${QUIET_CAP_MS / 1000} s after load (a stream or long polling?): measured anyway`);
    }
    const idleAt = Date.now();
    const late = await waitForContent(page, idleAt);
    if (late > 0 && !r.notes.some((n) => n.startsWith("content appeared"))) {
      r.notes.push(`content appeared ${late} ms after the network went idle: measured after it appeared`);
    }
    return { ctx, page, net, errs };
  } catch (e) {
    await ctx.close().catch(() => undefined);
    throw e;
  }
}

/** Đổi khổ và chế độ màu ngay trên trang đang mở (P7), về đầu trang, đợi bố cục mới. */
async function switchTo(L: Loaded, vw: number, vh: number, scheme: string): Promise<void> {
  await L.page.setViewportSize({ width: vw, height: vh });
  await L.page.emulateMedia({ colorScheme: scheme as "light" | "dark" });
  await L.page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await settleAfterChange(L.page, L.net);
}

/** Mọi phép đo của một lượt render (một khổ, một chế độ màu) trên trang đã yên và đã tới trạng thái cần đo. */
async function measureRender(
  browser: Browser,
  L: Loaded,
  vw: number,
  scheme: string,
  opts: PageOpts,
  r: PageReport,
  at: { first: boolean; widest: boolean; actions: boolean },
): Promise<void> {
  const { page } = L;
  const render = `${scheme}/${vw}`;
  // Cỡ chữ tính cả hệ số co của transform: đo giữa hiệu ứng mở scale(.95) → 1 sẽ báo nhầm chữ nhỏ.
  // Chờ tới ENTRANCE_MS: trước kia 0,8 s chờ cố định cộng 600 ms ở đây cho hiệu ứng vào trang khoảng 1,4 s để
  // xong; bỏ chờ cố định mà giữ 600 ms thì hiệu ứng mở 1,1 s bị đo giữa chừng (fixture co-gian.html, 15/11/2026).
  // Trang không có hiệu ứng có hồi kết thì không mất thêm gì.
  await page.evaluate(settleAnimations, ENTRANCE_MS);
  const p = await page.evaluate(probePage);

  // Trang trắng: không có gì để trượt nên mọi phép đo khác "đạt". Phải là lỗi cứng.
  const vis = await page.evaluate(probeVisible);
  const undef = vis.undefinedTags.join(", ");
  const unreg = vis.unregisteredTags.join(", ");
  if (!vis.text && !vis.media) {
    const all = [...vis.undefinedTags, ...vis.unregisteredTags].join(", ");
    add(r, "hard", "render", "page", `nothing visible: no text, image or graphic, also ${LATE_MS / 1000} s after the network went idle${all ? `; custom elements never defined: ${all}` : ""}`, render);
  } else {
    if (undef) add(r, "soft", "render", "page", `custom element never defined (its script failed or has not loaded): ${undef}`, render);
    if (unreg && !r.notes.some((n) => n.startsWith("not registered"))) {
      r.notes.push(`not registered as custom elements (fine for app roots and styling tags; a missing host-app component otherwise): ${unreg}`);
    }
  }
  for (const e of new Set(L.errs)) add(r, "hard", "errors", "page", e.slice(0, 200), render);

  if (p.scrollW > p.clientW + 1) add(r, "hard", "overflow", `${vw}px`, `page is ${p.scrollW}px wide, viewport ${p.clientW}px`, render);
  // Mọi khổ đều đo đủ. Trước 15/11/2026 khổ 320 chỉ đo tràn ngang, nên khối hero hiện "Camer", "23/2" ở đó mà cổng
  // vẫn đạt; khổ hẹp nhất là nơi bố cục gãy trước tiên.
  if (p.shadowRoots && !r.notes.some((n) => n.startsWith("shadow"))) r.notes.push(`shadow roots measured: ${p.shadowRoots}`);
  hits(r, "hard", "text-min", p.textMin, "font-size", render);
  hits(r, "soft", "body-size", p.bodySmall, "body text", render);
  hits(r, "soft", "body-lh", p.bodyTight, "line-height", render);
  hits(r, "soft", "measure", p.measure, "line length", render, 3);
  hits(r, "soft", "font", p.fontFallback, "web font not loaded:", render, 3);
  hits(r, "soft", "inner-scroll", p.innerScroll, "horizontal scroll hides content:", render, 3);
  hits(r, "soft", "text-clip", p.textClip, "text cut off", render);
  hits(r, "soft", "text-covered", await page.evaluate(probeCovered), "text", render);
  // Chỉ ở trạng thái đầu: menu vừa mở trong đầu trang dính cao hơn 30% màn là chuyện thường, người dùng đóng lại được
  // (dau-trang #menu bị báo nhầm, 24/11/2026).
  if (!at.actions) {
    const stuck = stickyFinding(await page.evaluate(probeSticky), vw, vhOf(opts, vw));
    if (stuck) add(r, "soft", "sticky", `${vw}x${vhOf(opts, vw)}`, stuck, render);
  }
  if (p.visibleFields > 12) add(r, "soft", "long-form", "page", `${p.visibleFields} fields on one screen: split into named steps or tuck advanced options away`, render);
  // Ô gõ chữ có chữ nhỏ: chỉ điện thoại phóng to khi chạm (iOS), nên chỉ đo ở khổ điện thoại.
  if (vw <= PHONE_MAX) {
    const zoom = p.typingFields.flatMap((f) => {
      const msg = inputZoomFinding(f);
      return msg ? [{ where: f.where, value: msg }] : [];
    });
    hits(r, "soft", "input-zoom", zoom, "", render);
  }
  hits(r, "soft", "guide", p.vagueNext, "button does not say where it goes, name the next step:", render, 3);
  hits(r, "soft", "guide", p.emptyDeadEnd, "empty state with no next action:", render, 3);
  // Tour mở bằng tay (bấm "Hướng dẫn") là được; chỉ tour tự bật lúc mở trang mới bị nhắc.
  if (!at.actions) hits(r, "soft", "guide", p.tour, "up-front tour, teach in context instead:", render, 1);
  if (p.vietnamese) {
    hits(r, "hard", "heading-lh", p.headingTight, "line-height", render);
    if (!/^vi\b/i.test(p.lang)) add(r, "hard", "lang", "<html>", `Vietnamese text but lang="${p.lang}"`, render);
  }
  // axe chạy ở mọi khổ và mọi chế độ: tương phản bản tối hay hỏng nhất.
  for (const v of await axeRun(page, opts.axeSource)) {
    if (!v.wcag) {
      for (const n of v.nodes) add(r, "soft", "axe-bp", v.id, n.slice(0, 220), render);
      continue;
    }
    const gate: Gate = v.impact === "serious" || v.impact === "critical" ? "hard" : "soft";
    for (const n of v.nodes) add(r, gate, "axe", `${v.id}`, n.slice(0, 220), render);
  }
  // WCAG 2.2.2: chuyển động tự chạy quá 5 giây không có nút dừng. Một lần, ở trạng thái đầu (N4, 19/11/2026).
  if (at.first && at.widest && !at.actions) hits(r, "soft", "pause", await page.evaluate(probePause), "", render, 4);
  if (opts.shotsDir) {
    await page.screenshot({ path: join(opts.shotsDir, `${scheme}-${vw}.png`), fullPage: true });
    r.shots++;
  }
  // Vitals: một lần (chế độ đầu, khổ rộng nhất), ở lần nạp đầu, trước khi bấm phím nào.
  if (at.first && at.widest && !at.actions) {
    const v = await page.evaluate(() => (window as unknown as { __dk: { lcp: number; cls: number } }).__dk);
    if (v.lcp > 2500) add(r, "soft", "lcp", "page", `LCP ${Math.round(v.lcp)} ms > 2500`, render);
    if (v.cls > 0.1) add(r, "soft", "cls", "page", `CLS ${v.cls.toFixed(3)} > 0.1`, render);
    r.notes.push(`lab vitals: LCP ${Math.round(v.lcp)} ms, CLS ${v.cls.toFixed(3)} (local load; field p75 decides)`);
  }
  // Chữ trên trang và dữ kiện tự điền: một lần mỗi trang/trạng thái (chữ không đổi theo khổ hay chế độ màu).
  // Trạng thái sau thao tác cũng chấm, vì thông báo lỗi, hộp thoại mới hiện chữ ở đó.
  if (at.first && at.widest && opts.copy) {
    const c = await page.evaluate(probeCopy, opts.copy);
    hits(r, "soft", "copy", c.copy, "", render, 20);
    r.assumed.push(...c.assumed);
  }
  // Ngôn ngữ từng phần và chữ dựng sẵn: như trên, một lần mỗi trang và trạng thái.
  if (at.first && at.widest) {
    const lp = await page.evaluate(probeLangParts);
    hits(r, "soft", "nfc", lp.nfc, "letters typed as letter + combining mark (normalize to NFC):", render, 4);
    hits(r, "soft", "lang-part", lp.han, "", render, 4);
    hits(r, "soft", "lang-part", lp.english, "", render, 4);
    hits(r, "soft", "font-unit", await page.evaluate(probeFontUnit), "font-size only in viewport units, so zooming cannot enlarge it (add a rem part):", render, 4);
  }
  // Mở như pane của app Claude (data: URL, không máy chủ) rồi so với bản http vừa đo: một lần mỗi tệp.
  if (at.first && at.widest && !at.actions && opts.standalone) {
    // Phép đo phụ: hỏng (CDP, trang tự điều hướng) thì ghi chú, không làm hỏng cả lượt kiểm.
    try {
      const a = await page.evaluate(probeStandalone, STANDALONE_TOKENS);
      const res = await runStandalone(browser, opts.standalone, a, vis.text > 0 || vis.media > 0, { width: vw, height: vhOf(opts, vw) }, scheme as "light" | "dark");
      for (const f of res.findings) add(r, "soft", "standalone", f.where, f.detail, render);
      r.notes.push(...res.notes);
    } catch (e) {
      r.notes.push(`standalone: not measured (${(e as Error).message.split("\n")[0]})`);
    }
  }
}

/**
 * Focus: bấm Tab tới `focusStops` lần. Chạy ở khổ rộng nhất VÀ khổ hẹp nhất có đo, chế độ màu đầu. Nút bị giấu ở
 * khổ hẹp mà vẫn nhận Tab (focus lạc vào chỗ không thấy) chỉ lộ ra ở khổ hẹp: bảng dữ liệu từng bị đúng lỗi này
 * (09/11/2026). Gọi trên trang chưa từng nhận Tab, vì Tab đi tiếp từ phần tử focus gần nhất.
 */
async function focusPass(page: Page, vw: number, scheme: string, focusStops: number, r: PageReport): Promise<void> {
  const render = `${scheme}/${vw}`;
  const seen = new Set<string>();
  for (let i = 0; i < focusStops; i++) {
    await page.keyboard.press("Tab");
    await page.evaluate(settleAnimations, 600);
    const f = await page.evaluate(probeFocus);
    if (!f || seen.has(f.where)) continue;
    seen.add(f.where);
    // Mất hẳn chỉ báo trượt WCAG 2.4.7 (AA); có mà mỏng hơn 2px chỉ dưới mức 2.4.13 (AAA). Tách hai lời báo, cả hai còn mềm:
    // phép đo chỉ đọc outline và box-shadow, chưa thấy chỉ báo bằng viền hay nền, nên chưa đủ chắc để thành cứng.
    if (!f.indicator) add(r, "soft", "focus", f.where, f.thin ? "focus ring thinner than 2px (WCAG 2.4.13)" : "no visible focus ring (outline ≥ 2px or box-shadow)", render);
    else if (f.shadowOnly) {
      // Vòng chỉ bằng box-shadow: đo thật trong chế độ màu ép buộc, ngay khi phần tử đang focus (focus và
      // :focus-visible giữ nguyên). Tailwind v4 `outline-hidden` chỉ thêm viền trong @media (forced-colors), nên
      // đọc CSS ở chế độ thường là báo nhầm.
      await page.emulateMedia({ forcedColors: "active" });
      const g = await page.evaluate(probeFocus);
      await page.emulateMedia({ forcedColors: null });
      if (g && g.where === f.where && !g.indicator) {
        add(r, "soft", "focus", f.where, "focus ring disappears in forced-colors mode (Windows High Contrast removes box-shadow): add outline: 2px solid transparent (Tailwind v4: outline-hidden)", render);
      }
    }
    if (f.obscured) add(r, "soft", "focus", f.where, f.hidden ? "focus lands on an element nobody can see (hidden or clipped)" : "focused element is covered by other content", render);
  }
  r.notes.push(`focus stops inspected at ${vw}px: ${seen.size}`);
}

/** Giảm chuyển động: nạp lại với prefers-reduced-motion: reduce, một lần mỗi trang/trạng thái. */
async function motionPass(L: Loaded, vw: number, scheme: string, actions: StepAction[] | undefined, r: PageReport): Promise<void> {
  const { page, net } = L;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "load" });
  await settlePage(page, net);
  await waitForContent(page, Date.now());
  if (actions) {
    // Không tới lại được trạng thái sau khi nạp lại: đo motion ở đó sẽ đo nhầm trạng thái, nên ghi chú thay vì đo.
    const err = await runActions(page, actions, net);
    if (err) {
      r.notes.push(`motion: not measured, the steps failed after reloading with reduced motion (${err})`);
      return;
    }
  }
  // Chỉ hiệu ứng còn chạy sau MOTION_SETTLE_MS mới tính (vòng xoay, chữ chạy, chuyển cảnh dài); hiệu ứng vào
  // trang ngắn hơn thì đã xong. Giữ đúng thời điểm đo cũ (khoảng 0,9 s sau khi nạp) để ngữ nghĩa phép đo không đổi.
  await page.waitForTimeout(MOTION_SETTLE_MS);
  const m = await page.evaluate(probeMotion);
  if (m.running) add(r, "hard", "motion", m.samples.join(", "), `${m.running} animation(s) still run with prefers-reduced-motion: reduce`, `${scheme}/${vw}`);
  // Chữ hiện dần khi cuộn mà không bao giờ hiện với người bật giảm chuyển động (N5, 19/11/2026).
  hits(r, "soft", "reveal", await page.evaluate(probeReveal), "", `${scheme}/${vw}`, 4);
}

/** Khổ được đo focus: rộng nhất và khổ hẹp nhất ngoài 320 (mặc định 390). */
function focusWidths(widths: number[]): Set<number> {
  const measured = widths.filter((w) => w !== 320);
  return new Set([Math.max(...widths), ...(measured.length ? [Math.min(...measured)] : [])]);
}

/** Cách cũ (--fresh, và đường lùi của cách mới): mỗi khổ × chế độ màu một lần nạp mới. */
async function checkFresh(browser: Browser, url: string, label: string, widths: number[], opts: PageOpts, r: PageReport): Promise<void> {
  const actions = opts.state?.do;
  const focusAt = focusWidths(widths);
  const widestW = Math.max(...widths);
  for (const scheme of opts.schemes) {
    for (const vw of widths) {
      const L = await openPage(browser, url, label, vw, vhOf(opts, vw), scheme, r);
      try {
        if (actions) {
          // Không tới được trạng thái ⇒ chưa đo được ⇒ cứng: sửa trang (nút bị giấu ở khổ hẹp?) hoặc sửa tệp steps.
          const err = await runActions(L.page, actions, L.net);
          if (err) {
            add(r, "hard", "steps", opts.state!.name, err, `${scheme}/${vw}`);
            continue;
          }
        }
        const first = scheme === opts.schemes[0];
        const widest = vw === widestW;
        await measureRender(browser, L, vw, scheme, opts, r, { first, widest, actions: !!actions });
        if (first && focusAt.has(vw)) await focusPass(L.page, vw, scheme, opts.focusStops, r);
        if (first && !actions) {
          if (focusAt.has(vw)) await optional(r, "text-spacing", async () => addResize(r, await spacingPass(L.page, L.net), `${scheme}/${vw}`));
          if (widest) {
            await onloadPass(L.page, r, `${scheme}/${vw}`);
            await optional(r, "text-zoom", async () => addResize(r, await zoomPass(L.page, L.net), `${scheme}/${vw}`));
          }
        }
        if (first && widest) await motionPass(L, vw, scheme, actions, r);
      } finally {
        await L.ctx.close().catch(() => undefined);
      }
    }
  }
}

/**
 * Cách mới (P7): nạp một lần ở khổ rộng nhất, đổi khổ và chế độ màu ngay trên trang. Tự kiểm, lệch ở bước nào thì trả
 * lý do và trang đó được đo lại theo cách cũ:
 * - một lần nạp mới ở khổ HẸP NHẤT phải cho đúng dấu vân bố cục và màu như trang đã đổi khổ (trang đọc khổ màn bằng
 *   script lúc nạp); lỗi script của lần nạp đó cũng được báo (lỗi chỉ có ở khổ hẹp);
 * - khổ hẹp có đo focus (390) khác khổ hẹp nhất: trang kiểm đổi khổ lên đó, dấu vân phải trùng trang chính (hai đường
 *   đổi khổ khác nhau cho cùng kết quả), rồi đo focus trên trang kiểm (chưa từng nhận Tab);
 * - quay lại khổ rộng nhất, dấu vân phải trùng lần nạp đầu (trang giữ trạng thái từ khổ hẹp: menu bị ẩn không hiện lại);
 * - phần trang đang chạy hiệu ứng hình học quá lớn để so thì không tin dấu vân.
 * Script đọc chế độ màu một lần lúc nạp thì mỗi chế độ màu nạp riêng. Số lần nạp mỗi trang từ 7 còn 3.
 */
async function checkReuse(browser: Browser, url: string, label: string, widths: number[], opts: PageOpts, r: PageReport): Promise<string | undefined> {
  if (opts.state) return checkStateInPlace(browser, url, label, widths, opts.state.do, opts, r);
  const desc = [...widths].sort((a, b) => b - a);
  const widestW = desc[0]!;
  const narrowW = desc[desc.length - 1]!;
  const first = opts.schemes[0]!;
  const focusAt = focusWidths(widths);
  const fpMain = new Map<number, string>();
  const fingerprint = async (L: Loaded): Promise<{ hash: string; why?: string }> => {
    await L.page.evaluate(settleAnimations, ENTRANCE_MS);
    const f = await L.page.evaluate(probeFingerprint);
    return { hash: f.hash, ...(f.skipped > f.count ? { why: `${f.skipped} of ${f.skipped + f.count} elements move with a running animation, too many to verify` } : {}) };
  };
  const main = await openPage(browser, url, label, widestW, vhOf(opts, widestW), first, r);
  try {
    const perScheme = opts.schemes.length > 1 && (await main.page.evaluate(schemeReadOnce));
    if (perScheme) r.notes.push("a script reads prefers-color-scheme once without listening for changes: each color scheme loaded fresh");
    for (const [si, scheme] of opts.schemes.entries()) {
      let L = main;
      if (si > 0 && perScheme) {
        L = await openPage(browser, url, label, widestW, vhOf(opts, widestW), scheme, r);
      }
      try {
        for (const [i, vw] of desc.entries()) {
          // Trang vừa nạp đã đúng khổ rộng nhất và đúng chế độ màu; mọi lượt khác đổi tại chỗ.
          if (!(i === 0 && (si === 0 || L !== main))) await switchTo(L, vw, vhOf(opts, vw), scheme);
          if (si === 0) {
            const f = await fingerprint(L);
            if (f.why) return f.why;
            fpMain.set(vw, f.hash);
          }
          await measureRender(browser, L, vw, scheme, opts, r, { first: si === 0, widest: i === 0, actions: false });
        }
      } finally {
        if (L !== main) await L.ctx.close().catch(() => undefined);
      }
    }
    if (desc.length > 1) {
      const F = await openPage(browser, url, label, narrowW, vhOf(opts, narrowW), first, r);
      try {
        if ((await fingerprint(F)).hash !== fpMain.get(narrowW)) return `layout at ${narrowW}px after resizing differs from a fresh load`;
        // Lỗi script chỉ xảy ra khi trang nạp ở khổ hẹp (khởi tạo menu điện thoại) không đổi bố cục vẫn phải báo.
        for (const e of new Set(F.errs)) add(r, "hard", "errors", "page", e.slice(0, 200), `${first}/${narrowW}`);
        for (const w of [...focusAt].filter((x) => x !== widestW)) {
          if (w !== narrowW) {
            await switchTo(F, w, vhOf(opts, w), first);
            if ((await fingerprint(F)).hash !== fpMain.get(w)) return `layout at ${w}px differs between resizing down and resizing up`;
          }
          await focusPass(F.page, w, first, opts.focusStops, r);
          await optional(r, "text-spacing", async () => addResize(r, await spacingPass(F.page, F.net), `${first}/${w}`));
        }
      } finally {
        await F.ctx.close().catch(() => undefined);
      }
    }
    // Khổ trung gian: tràn ngang, chữ bị che, phần dính, độ dài dòng ở màn rộng; chế độ màu đầu, trên trang đang mở; đợi
    // hiệu ứng (bề rộng chuyển dần qua mốc).
    for (const { w, h } of opts.sweep ?? []) {
      await switchTo(main, w, h, first);
      await main.page.evaluate(settleAnimations, ENTRANCE_MS);
      const at = `${first}/${w}`;
      const o = await main.page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      if (o.s > o.c + 1) add(r, "hard", "overflow", `${w}px`, `page is ${o.s}px wide, viewport ${o.c}px`, at);
      hits(r, "soft", "text-covered", await main.page.evaluate(probeCovered), "text", at);
      const stuck = stickyFinding(await main.page.evaluate(probeSticky), w, h);
      if (stuck) add(r, "soft", "sticky", `${w}x${h}`, stuck, at);
      if (w >= WIDE_FROM) hits(r, "soft", "measure", (await main.page.evaluate(probePage)).measure, "line length", at, 3);
    }
    await switchTo(main, widestW, vhOf(opts, widestW), first);
    // Đã đi qua các khổ hẹp (và chế độ màu khác): trang phải về đúng như lần nạp đầu, không thì bản tối và focus ở khổ
    // rộng đã đo trên một trang mang trạng thái từ khổ hẹp.
    if ((await fingerprint(main)).hash !== fpMain.get(widestW)) return `layout at ${widestW}px after visiting narrower widths differs from the first load`;
    if (focusAt.has(widestW)) await focusPass(main.page, widestW, first, opts.focusStops, r);
    const atWide = `${first}/${widestW}`;
    await onloadPass(main.page, r, atWide);
    await optional(r, "text-spacing", async () => addResize(r, await spacingPass(main.page, main.net), atWide));
    await optional(r, "text-zoom", async () => addResize(r, await zoomPass(main.page, main.net), atWide));
    await motionPass(main, widestW, first, undefined, r);
    return undefined;
  } finally {
    await main.ctx.close().catch(() => undefined);
  }
}

/**
 * Trạng thái sau thao tác: mỗi khổ một lần nạp và chạy lại thao tác, chỉ đổi chế độ màu tại chỗ. Không đổi khổ trên
 * trang đã bấm: con trỏ chuột còn ở toạ độ của khổ cũ, đổi khổ thì nó rơi vào phần tử khác và `:hover` khác lần nạp mới
 * (thong-bao #loi, thanh-ben #ngan-keo; 19/11/2026). 4 lần nạp thay cho 7. Script đọc chế độ màu một lần lúc nạp
 * thì trả lý do để đo theo cách cũ.
 */
async function checkStateInPlace(browser: Browser, url: string, label: string, widths: number[], actions: StepAction[], opts: PageOpts, r: PageReport): Promise<string | undefined> {
  const desc = [...widths].sort((a, b) => b - a);
  const widestW = desc[0]!;
  const first = opts.schemes[0]!;
  const focusAt = focusWidths(widths);
  for (const vw of desc) {
    const L = await openPage(browser, url, label, vw, vhOf(opts, vw), first, r);
    try {
      const err = await runActions(L.page, actions, L.net);
      if (err) {
        // Như cách cũ: mỗi lượt render của khổ này là một lần không tới được trạng thái.
        for (const scheme of opts.schemes) add(r, "hard", "steps", opts.state!.name, err, `${scheme}/${vw}`);
        continue;
      }
      if (opts.schemes.length > 1 && (await L.page.evaluate(schemeReadOnce))) return "a script reads prefers-color-scheme once without listening for changes";
      for (const [si, scheme] of opts.schemes.entries()) {
        if (si > 0) {
          await L.page.emulateMedia({ colorScheme: scheme as "light" | "dark" });
          await settleAfterChange(L.page, L.net);
        }
        await measureRender(browser, L, vw, scheme, opts, r, { first: si === 0, widest: vw === widestW, actions: true });
      }
      if (focusAt.has(vw)) {
        if (opts.schemes.length > 1) {
          await L.page.emulateMedia({ colorScheme: first as "light" | "dark" });
          await settleAfterChange(L.page, L.net);
        }
        await focusPass(L.page, vw, first, opts.focusStops, r);
      }
      if (vw === widestW) await motionPass(L, vw, first, actions, r);
    } finally {
      await L.ctx.close().catch(() => undefined);
    }
  }
  return undefined;
}

async function checkPage(browser: Browser, url: string, label: string, opts: PageOpts, r: PageReport): Promise<void> {
  const only = opts.state?.viewports;
  const widths = only ? opts.viewports.filter((v) => only.includes(v)) : opts.viewports;
  if (!widths.length) {
    r.notes.push(`state ${opts.state!.name}: none of its viewports (${only!.join(",")}) is rendered, so it was not measured`);
    return;
  }
  if (!opts.fresh) {
    // Đo vào bản nháp: tự kiểm lệch thì bỏ nháp, đo lại theo cách cũ.
    const draft: PageReport = { target: r.target, findings: new Map(), checks: new Map(), notes: [], shots: 0, assumed: [], deps: new Map() };
    const why = await checkReuse(browser, url, label, widths, opts, draft);
    if (why === undefined) {
      for (const [k, f] of draft.findings) r.findings.set(k, f);
      for (const [u, l] of draft.deps) r.deps.set(u, [...(r.deps.get(u) ?? []), ...l]);
      r.notes.push(...draft.notes);
      r.shots += draft.shots;
      r.assumed.push(...draft.assumed);
      return;
    }
    r.notes.push(`resize in place not used (${why}): every width loaded fresh${opts.sweep?.length ? ", --sweep skipped for this page" : ""}`);
  }
  await checkFresh(browser, url, label, widths, opts, r);
}

export async function checkCommand(args: string[], rt: Runtime): Promise<Record<string, unknown>> {
  const p = parseCommandArgs("check", args, FLAGS, { min: 1, max: Infinity, usage: "<file|dir|url>..." });
  const profileName = p.str("profile");
  const profile = profileName === undefined ? undefined : PROFILES[profileName];
  if (profileName !== undefined && !profile) fail(`--profile: unknown profile ${profileName}`, "VALIDATION_ERROR", [`Profiles: ${Object.keys(PROFILES).join(", ")}`]);
  if (profile && p.str("viewports") !== undefined) fail("--profile sets the sizes: drop --viewports", "VALIDATION_ERROR");
  const sizes = profile ? profile.sizes : (listFlag(p, "viewports") ?? ["320", "390", "1280"]).map(parseSize);
  if (sizes.some((v) => v === undefined)) fail(`--viewports: widths between ${MIN_WIDTH} and ${MAX_WIDTH}, or WxH like 1280x720`, "VALIDATION_ERROR");
  const given = sizes as Size[];
  const viewports = given.map((v) => v.w);
  if (new Set(viewports).size !== viewports.length) fail("--viewports: each width once (two heights at one width: run check twice)", "VALIDATION_ERROR");
  const heights: Record<number, number> = Object.fromEntries(given.map((v) => [v.w, v.h]));
  const touchMin = Number(p.str("touch") ?? TOUCH_MIN);
  if (!Number.isInteger(touchMin) || touchMin < 0 || touchMin > 200) fail("--touch must be a whole number of px from 0 to 200", "VALIDATION_ERROR");
  const schemes = listFlag(p, "schemes") ?? ["light", "dark"];
  if (schemes.some((s) => s !== "light" && s !== "dark")) fail("--schemes: light and/or dark", "VALIDATION_ERROR");
  const queries = listFlag(p, "query") ?? [""];
  const focusStops = Number(p.str("focus") ?? 15);
  if (!Number.isInteger(focusStops) || focusStops < 0) fail("--focus must be a whole number", "VALIDATION_ERROR");
  if (!/^[1-8]$/.test(p.str("jobs") ?? "3")) fail("--jobs must be 1 to 8", "VALIDATION_ERROR");
  const limit = p.global.full ? Infinity : (p.global.limit ?? 25);
  const targets = expandTargets(p.positionals, rt.cwd);
  const shotsBase = p.bool("no-shots") ? undefined : resolve(rt.cwd, p.str("shots") ?? ".design-kit/shots");
  const waiversArg = p.str("waivers");
  const waivers = p.bool("no-waivers") ? [] : loadWaivers(resolve(rt.cwd, waiversArg ?? join(".design-kit", "waivers.json")), waiversArg ?? ".design-kit/waivers.json", waiversArg !== undefined);
  const stepsArg = p.str("steps");
  const explicitSteps = stepsArg !== undefined ? loadSteps(stepsArg, (f) => resolve(rt.cwd, f)) : undefined;
  /** Trạng thái của một trang: --steps, nếu không thì tệp <trang>.steps.json bên cạnh (trừ khi --no-steps). */
  const statesFor = (t: string): StepState[] => {
    if (explicitSteps) return explicitSteps;
    if (p.bool("no-steps") || /^https?:/i.test(t)) return [];
    const side = t.replace(/\.html?$/i, ".steps.json");
    return side !== t && existsSync(side) ? parseSteps(readFileSync(side, "utf8"), relative(rt.cwd, side).replace(/\\/g, "/")) : [];
  };

  const require = createRequire(import.meta.url);
  const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  const impBin = p.bool("no-impeccable") ? undefined : findImpeccable(rt.env);
  const copy = p.bool("no-copy") ? undefined : loadCopyRules();
  const { browser, via } = await launchBrowser(rt.env);
  const servers = new Map<string, { origin: string; close: () => void }>();
  const jobsN = Number(p.str("jobs") ?? 3);
  // Bước 1: danh sách việc (máy chủ tĩnh dựng tuần tự). Bước 2: chạy song song có giới hạn, giữ thứ tự kết quả.
  const jobs: Array<{ url: string; label: string; r: PageReport; shotsDir?: string; state?: StepState; standalone?: string; mobile?: boolean; served?: { root: string; origin: string } }> = [];
  // Khổ điện thoại để mở trang như máy thật (phép đo viewport): khổ lớn nhất ≤ 480 trong --viewports; không có thì bỏ.
  const phones = viewports.filter((w) => w <= PHONE_MAX);
  const wantSweep = p.bool("sweep") || profile?.sweep === true;
  const sweep = wantSweep ? SWEEP_SIZES.filter((s) => s.w > Math.min(...viewports) && !viewports.includes(s.w)) : [];
  if (wantSweep && p.bool("fresh")) fail("--sweep needs resize in place: drop --fresh", "VALIDATION_ERROR");
  const phoneWidth = phones.length ? Math.max(...phones) : undefined;
  // Đích chạm: khổ điện thoại đó, và khổ máy tính bảng lớn nhất (481–1024) nếu có đo.
  const tablets = viewports.filter((w) => w > PHONE_MAX && w <= TABLET_MAX);
  const touchSizes: Size[] = touchMin ? [...(phoneWidth ? [phoneWidth] : []), ...(tablets.length ? [Math.max(...tablets)] : [])].map((w) => ({ w, h: heights[w]! })) : [];
  // Bộ đệm (N7). Dấu vân của lượt chạy: mọi thứ ngoài nội dung trang quyết định kết quả. --no-cache đo lại mọi trang
  // nhưng vẫn ghi mục mới, để lượt sau dùng được.
  const cacheDir: string | undefined = resolve(rt.cwd, ".design-kit", "cache");
  const readCache = !p.bool("no-cache");
  const runPrint = {
    v: VERSION, code: codeSha(), axe: sha(axeSource), imp: impBin ? (fileSha(impBin) ?? impBin) : null, browser: browser.version(),
    viewports, heights, schemes, focusStops, copy: copy ? sha(JSON.stringify(copy)) : null, sweep, touchMin, fresh: p.bool("fresh"),
  };
  let cachedN = 0;
  try {
    for (const t of targets) {
      let base = t;
      let served: { root: string; origin: string } | undefined;
      if (!/^https?:/i.test(t)) {
        const root = serveRoot(t);
        if (!servers.has(root)) {
          const s = await startServer(root);
          servers.set(root, { origin: s.origin, close: () => s.server.close() });
        }
        base = urlFor(servers.get(root)!.origin, root, t);
        served = { root, origin: servers.get(root)!.origin };
      }
      const states = statesFor(t);
      for (const q of queries) {
        const url = q ? `${base}${base.includes("?") ? "&" : "?"}${q}` : base;
        // Trạng thái đầu (không thao tác) rồi từng trạng thái trong tệp steps: mỗi cái một dòng phán quyết.
        for (const state of [undefined, ...states]) {
          const label = `${/^https?:/i.test(t) ? t : relative(rt.cwd, t).replace(/\\/g, "/")}${q ? `?${q}` : ""}${state ? ` #${state.name}` : ""}`;
          const r: PageReport = { target: label, findings: new Map(), checks: new Map(), notes: [], shots: 0, assumed: [], deps: new Map() };
          let shotsDir: string | undefined;
          if (shotsBase) {
            // Tên theo đường dẫn tương đối (không chỉ tên tệp): blocks/html/x.html và blocks/react/dist/x.html không ghi đè nhau.
            const stem = /^https?:/i.test(t) ? t.replace(/^https?:\/\//i, "") : relative(rt.cwd, t).replace(/\.html?$/i, "");
            const slug = `${stem}${q ? `-${q}` : ""}${state ? `--${state.name}` : ""}`.replace(/[\\/]+/g, "~").replace(/[^\w.~-]+/g, "_").replace(/^[._~]+/, "");
            shotsDir = join(shotsBase, slug || basename(t, extname(t)));
            mkdirSync(shotsDir, { recursive: true });
          }
          // Mở dạng data: URL không mang query, nên chỉ cần một lần mỗi tệp: trạng thái đầu của query đầu.
          const standalone = !p.bool("no-standalone") && !/^https?:/i.test(t) && !state && q === queries[0] ? t : undefined;
          // Thẻ meta viewport không đổi theo query hay trạng thái: một lần mỗi trang, trạng thái đầu của query đầu.
          const mobile = !state && q === queries[0] && (phoneWidth !== undefined || touchSizes.length > 0);
          jobs.push({ url, label, r, ...(shotsDir ? { shotsDir } : {}), ...(state ? { state } : {}), ...(standalone ? { standalone } : {}), ...(mobile ? { mobile } : {}), ...(served ? { served } : {}) });
        }
      }
    }
    const runJob = async ({ url, label, r, shotsDir, state, standalone, mobile, served }: (typeof jobs)[number]): Promise<void> => {
      // Bộ đệm (N7): trang cục bộ không đổi kể từ lần đo trước thì dùng lại kết quả. Khoá gồm mọi thứ quyết định kết quả
      // trừ nội dung tệp; nội dung các tệp mà trang đã nạp được băm trong mục và phải còn nguyên.
      const key = cacheDir && served
        ? cacheKey({ fp: runPrint, label, root: served.root, state: state ?? null, standalone: !!standalone, mobile: !!mobile, shots: shotsDir ?? null })
        : undefined;
      if (key && readCache) {
        const e = readEntry<CachedReport>(cacheDir!, key);
        if (e && entryValid(e)) {
          restoreReport(r, e.report);
          cachedN++;
          return;
        }
      }
      // Impeccable tự mở trang theo URL, không phát lại được thao tác: chỉ chạy ở trạng thái đầu. Khổ rộng nhất, 390 và
      // 320 (khổ hẹp nhất là nơi bố cục gãy trước: ở 320 nó bắt được ô số tràn 39px của khối hero, 15/11/2026).
      // Mỗi bề rộng một lần: khổ rộng nhất là 390 thì trước kia chạy cả 390x800 lẫn 390x844 (thừa một tiến trình).
      const widestVp = Math.max(...viewports);
      const impWidths = [`${widestVp}x800`, ...(viewports.includes(390) && widestVp !== 390 ? ["390x844"] : []), ...(viewports.includes(320) && widestVp !== 320 ? ["320x720"] : [])];
      const imp = impBin && !state
        ? Promise.all(impWidths.map(async (vp) => ({ vp, res: await runImpeccable(impBin, url, vp) })))
        : Promise.resolve([]);
      try {
        await checkPage(browser, url, label, { viewports, heights, schemes, focusStops, axeSource, fresh: p.bool("fresh"), ...(sweep.length ? { sweep } : {}), ...(copy ? { copy } : {}), ...(shotsDir ? { shotsDir } : {}), ...(state ? { state } : {}), ...(standalone ? { standalone } : {}) }, r);
      } catch (e) {
        // Một trang không mở được thì chỉ trang đó trượt; các trang khác vẫn đo. Chờ Impeccable xong để không còn
        // tiến trình con chạy sau khi trình duyệt đã đóng.
        if (!(e instanceof PageLoadError)) throw e;
        loadFailed.push(e.message);
        add(r, "hard", "render", "page", `page did not load: ${e.message.slice(label.length + 2, label.length + 202)}`, "load");
        await imp;
        return;
      }
      if (mobile && phoneWidth) await optional(r, "viewport", () => checkViewport(browser, url, phoneWidth, heights[phoneWidth]!, r));
      if (mobile) for (const size of touchSizes) await optional(r, "touch", () => checkTouch(browser, url, size, touchMin, r));
      for (const { vp, res } of await imp) {
        if (res.error) r.notes.push(`impeccable ${vp}: ${res.error}`);
        for (const f of res.findings ?? []) {
          add(r, impGate(f), "impeccable", f.antipattern, (f.snippet ?? f.name ?? "").slice(0, 200), `light/${vp.split("x")[0]}`);
        }
      }
      if (!impBin && !p.bool("no-impeccable")) r.notes.push("impeccable: engine not found, run `design-kit setup` (downloads the pinned engine) or set IMPECCABLE_BIN");
      if (impBin && state) r.notes.push("states (#name): every check except Impeccable and LCP/CLS, which run on the initial state");
      if (shotsDir) r.notes.push(`screenshots: ${relative(rt.cwd, shotsDir).replace(/\\/g, "/")} (${r.shots})`);
      // Không đệm khi kết quả có thể là tạm: Impeccable hỏng, mạng bận, phép đo phụ không chạy được, hay có lỗi cứng
      // `errors`/`render` (tài nguyên ngoài máy không tải được lúc này; trang tự sửa xong thì lần sau phải đo lại).
      const transient = r.notes.some((n) => /^impeccable \d|^network still busy|not measured/.test(n))
        || [...r.findings.values()].some((f) => f.gate === "hard" && (f.check === "errors" || f.check === "render"));
      if (key && served && !transient) {
        // Mỗi URL một nội dung trong cả lượt đo: nhận hai nội dung khác nhau (tệp sửa giữa chừng) hay không đọc được thì
        // không đệm.
        const deps: Array<{ path: string; sha: string }> = [];
        let consistent = true;
        for (const [u, list] of r.deps) {
          const got = new Set(await Promise.all(list));
          const path = depPath(u, served.origin, served.root);
          if (!path) continue;
          if (got.size !== 1 || got.has("unreadable")) consistent = false;
          deps.push({ path, sha: [...got][0]! });
        }
        const shots = shotsDir ? readdirSync(shotsDir).filter((f) => f.endsWith(".png")).map((f) => join(shotsDir, f)) : [];
        if (consistent) writeEntry(cacheDir!, key, deps, shots, saveReport(r));
      }
    };
    const loadFailed: string[] = [];
    let next = 0;
    // Lỗi bất ngờ ở một việc: các việc khác đang chạy dở vẫn được chạy xong (không đóng trình duyệt dưới chân chúng),
    // không nhận việc mới, rồi mới ném lỗi đầu tiên.
    let firstErr: { e: unknown } | undefined;
    await Promise.all(
      Array.from({ length: Math.min(jobsN, jobs.length) }, async () => {
        while (next < jobs.length && !firstErr) {
          try {
            await runJob(jobs[next++]!);
          } catch (e) {
            firstErr ??= { e };
          }
        }
      }),
    );
    if (firstErr) throw firstErr.e;
    // Không trang nào mở được (máy chủ dev chưa chạy, sai URL): lỗi của lệnh, không phải phán quyết về giao diện.
    if (loadFailed.length === jobs.length) fail(loadFailed[0]!, "LOAD_FAILED", ["Check the URL or that the dev server is running"]);
  } finally {
    await browser.close();
    for (const s of servers.values()) s.close();
  }

  const reports = jobs.map((j) => j.r);
  // Miễn trừ có lý do: gỡ phát hiện mềm đã được xét trước khi đếm (N8).
  const wv = applyWaivers(reports, waivers);
  // ---- Tổng hợp TOON ----
  const count = (r: PageReport, g: Gate) => [...r.findings.values()].filter((f) => f.gate === g).length;
  const hardPages = reports.filter((r) => count(r, "hard") > 0).length;
  const stateJobs = jobs.filter((j) => j.state).length;
  const ofStates = stateJobs ? ` (${stateJobs} of them states after steps)` : "";
  const out: Record<string, unknown> = {
    status: `${hardPages ? `fail: ${hardPages} of ${reports.length} pages have hard failures${ofStates}` : `pass: ${reports.length} pages${ofStates}, 0 hard failures`}`,
    renders: `${schemes.join("+")} × ${given.map((v) => (v.h === heightFor(v.w) ? String(v.w) : `${v.w}x${v.h}`)).join("/")} px${sweep.length ? ` + ${sweep.length} swept sizes` : ""} via ${via}${impBin ? ", impeccable on" : ""}`,
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
    const skipped = (id === "impeccable" && !impBin) || (id === "standalone" && !jobs.some((j) => j.standalone)) || (id === "copy" && !copy) || (id === "viewport" && !phoneWidth) || (id === "input-zoom" && !viewports.some((w) => w <= PHONE_MAX)) || (id === "orientation" && !phoneWidth) || (id === "touch" && !touchSizes.length);
    const unused = id === "steps" && !stateJobs;
    const result = skipped ? "skipped" : unused ? "none: no steps file" : h || s ? [h && `${h} hard`, s && `${s} soft`].filter(Boolean).join(", ") : "ok";
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
  // Nhiều trang: ghi chú gộp lại, bỏ ghi chú riêng từng trang; ghi chú về một trang cụ thể thì kèm tên trang.
  const perPage = (n: string) => n.startsWith("resize in place not used") || n.startsWith("motion: not measured");
  const notes = reports.length === 1
    ? reports[0]!.notes
    : [...new Set(reports.flatMap((r) => r.notes.filter((n) => !n.startsWith("lab vitals") && !n.startsWith("focus stops") && !n.startsWith("screenshots")).map((n) => (perPage(n) ? `${r.target}: ${n}` : n))))];
  if (notes.length) out["notes"] = notes;
  // Dữ kiện agent tự điền (data-assumed): không phải lỗi, nhưng chủ phải duyệt từng mục trước khi trang ra ngoài.
  // Một mục xuất hiện ở nhiều trạng thái, hay nhiều --query, của cùng trang chỉ ghi một lần.
  const seenAssumed = new Set<string>();
  const assumed = reports.flatMap((r) => {
    const pageOf = r.target.replace(/ #[^#]*$/, "").replace(/\?[^ ]*$/, "");
    return r.assumed.flatMap((a) => {
      const k = `${pageOf}|${a.where}|${a.text}`;
      if (seenAssumed.has(k)) return [];
      seenAssumed.add(k);
      return [{ ...(reports.length > 1 ? { page: pageOf } : {}), where: a.where, text: a.text, note: a.note || "(no reason given)" }];
    });
  });
  if (assumed.length) out["assumed"] = assumed;
  if (cachedN) out["cache"] = `${cachedN} of ${jobs.length} pages unchanged since their last check: results reused (--no-cache measures again)`;
  if (wv.used.length) out["waived"] =wv.used.map((w) => ({ page: w.page, check: w.check, where: w.where, findings: w.count, reason: w.reason }));
  const waiverNotes = [
    ...wv.unused.map((w) => `waiver matches nothing (fixed? remove it): ${w.page} ${w.check} ${w.where}`),
    ...wv.refused.map((w) => `waiver not applied, a hard finding cannot be waived: ${w.page} ${w.check} ${w.where}`),
    ...wv.tooMany.map((pg) => `more than ${WAIVER_MAX_PER_PAGE} waivers for ${pg}: only the first ${WAIVER_MAX_PER_PAGE} apply; fix the page instead`),
  ];
  if (waiverNotes.length) out["notes"] = [...((out["notes"] as string[] | undefined) ?? []), ...waiverNotes];
  const help: string[] = [];
  if (assumed.length) help.push(`${assumed.length} fact(s) the agent filled in (data-assumed): list them for the owner to confirm or correct, then remove the attribute; a page with assumed facts is not ready to publish`);
  if (all.some((f) => f.check === "copy")) help.push("copy: rewrite flagged text with the owner's real details and words (skill viet-tu-nhien), or put data-copy-ok on the element when the wording is deliberate; lists in data/copy-tells.json");
  if (all.length > shown.length) help.push(`${all.length - shown.length} more findings: add --full`);
  if (all.some((f) => f.gate === "hard")) help.push("Fix hard failures, then rerun the same command; soft ones need a fix or a written reason");
  if (all.some((f) => f.check === "render" && f.gate === "hard")) {
    help.push("Blank page: read the `errors` rows, or open the page in a browser console. A component that needs a host app (Home Assistant card, widget) needs a test page that provides it: the host's custom elements, data and lang");
  }
  if (all.some((f) => f.check === "standalone" && f.where === "data: URL")) {
    help.push("standalone: a page opened in the Claude app's browser pane (a data: URL, no server) gets none of its linked CSS. Run `design-kit inline <page>` (CSS into the page, font links kept), or write why the page is only ever served over http and pass --no-standalone");
  }
  if (shotsBase) help.push(`Open the screenshots under ${relative(rt.cwd, shotsBase).replace(/\\/g, "/") || "."} and judge hierarchy before calling the page done`);
  // Nhắc dẫn đường mỗi lần chạy (chủ yêu cầu 09/11/2026): quy trình phức tạp đến mấy cũng phải dễ như phần hướng dẫn trong game.
  help.push("Guide like a game: your report names the task map (main tasks, where a first-time user hesitates) and the pattern covering each point: steps (trinh-tu), first-run checklist and just-in-time tips (bat-dau), empty state that teaches (trang-thai), Undo (thong-bao). Skill design-kit, section 2b");
  if (!stateJobs) help.push("Measure the states users reach by clicking (form errors, step 2, open dialog, first-run tips): add <page>.steps.json or pass ?state URLs with --query");
  out["help"] = help;
  if (p.bool("strict") && hardPages) {
    process.exitCode = 1;
  }
  return out;
}
