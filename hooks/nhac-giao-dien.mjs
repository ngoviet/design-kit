#!/usr/bin/env node
// Hook của plugin design-kit (không phụ thuộc gói nào, Node ≥ 18).
//
// PostToolUse (Write|Edit|MultiEdit): AI vừa ghi một tệp giao diện ⇒ nhắc bản đồ tác vụ + dẫn đường như game
//   + chạy cổng. Mỗi phiên nhắc lần đầu, sau đó tối đa 15 phút một lần (không thành tiếng ồn).
// Stop: phiên đã sửa giao diện mà sau lần sửa chưa chạy `design-kit check` trên trang đó ⇒ chặn một lần, nêu tệp.
//   Hai cách thấy lần sửa: lệnh Write/Edit trong transcript, và tệp giao diện git thấy đã đổi, sửa sau khi phiên bắt
//   đầu (sửa qua Bash, PowerShell, công cụ MCP: trước 15/11/2026 hook bỏ sót hết). Mỗi trạng thái chỉ bị chặn một
//   lần: AI có thể trả lời lý do không kiểm (không chạm giao diện, tệp do phiên khác sửa) rồi dừng. Tệp không còn
//   tồn tại (đã xoá, đã đổi tên) thì bỏ qua.
// Hình (`.svg`, `.png`, `.jpg`, `.webp`, `.avif`, `.ico` có tên tệp hay thư mục chứa nó là logo, icon, favicon, brand,
//   ký hiệu, minh hoạ…): hai sự kiện trên nhắc và đòi `design-kit check-image` trên tệp hay thư mục chứa nó.
// Mod Claude Code (`.tsx`/`.jsx` trong `hooks/` của một plugin có `hooks/hooks.json`) vẽ bằng `ui.render` trong
//   terminal hay app desktop, không có trang HTML để `design-kit check`: hai sự kiện trên nhắc và đòi
//   `claude plugin test` (hoặc `tools/check.sh` của repo chứa mod) thay cho cổng.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

const UI = /\.(html?|tsx|jsx|vue|svelte|astro|css|scss)$/i;
// Không phải giao diện người dùng: thư viện, bản build, ảnh chụp của cổng, fixture test (trang hỏng có chủ ý, kiểm
// qua bộ test), thư mục nháp của phiên Claude Code (scratchpad).
const SKIP = /(^|[\\/])(node_modules|dist|build|\.design-kit|coverage|fixtures|__fixtures__|scratchpad)[\\/]|\.(test|spec|stories)\.[jt]sx?$/i;
const MOD_UI = /\.[jt]sx$/i;
const EVERY_MS = 15 * 60 * 1000;
// Hình (logo, icon, ký hiệu, minh hoạ): kiểm bằng `design-kit check-image`. Chỉ xét tên tệp và thư mục chứa nó, không
// xét cả đường dẫn: repo tên "brand-site" thì mọi ảnh trong đó sẽ thành logo.
const IMG = /\.(svg|png|jpe?g|webp|avif|ico)$/i;
const IMG_HINT = /logo|icon|favicon|brand|glyph|symbol|bieu-tuong|ky-hieu|apple-touch|maskable|illus|minh-hoa/i;

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0); // không đọc được thì im lặng: hook không được làm hỏng phiên
}
const session = String(input.session_id ?? "khong-ro").replace(/[^\w-]/g, "");
const stateDir = join(tmpdir(), "design-kit-hook");
const stateFile = join(stateDir, `${session}.json`);
const load = () => { try { return JSON.parse(readFileSync(stateFile, "utf8")); } catch { return {}; } };
const save = (s) => { try { mkdirSync(stateDir, { recursive: true }); writeFileSync(stateFile, JSON.stringify(s)); } catch { /* bỏ qua */ } };
/**
 * Tệp nằm trong phần bỏ qua (node_modules, dist, fixtures…). Tệp trong thư mục của phiên: xét đường dẫn tương đối,
 * để dự án nằm trong thư mục tên `build` hay `dist` (D:\build\shop\index.html) không bị bỏ qua cả dự án như trước
 * 19/11/2026. Tệp ngoài thư mục đó (scratchpad của phiên): xét cả đường dẫn.
 */
const skipped = (f) => {
  const base = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const rel = relative(base, resolve(base, f));
  return SKIP.test(rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : f);
};
const isUi = (f) => typeof f === "string" && UI.test(f) && !skipped(f);
const isImg = (f) => typeof f === "string" && IMG.test(f) && !skipped(f) && (IMG_HINT.test(basename(f)) || IMG_HINT.test(basename(dirname(f))));

/** Đường dẫn để hiện cho AI: tương đối với cwd nếu nằm trong (cwd chính nó là "."), không thì tuyệt đối; gạch xuôi. */
function show(p, cwd) {
  if (!cwd) return p.replace(/\\/g, "/");
  const abs = resolve(cwd, p);
  const rel = relative(cwd, abs);
  if (rel === "") return ".";
  return (!rel.startsWith("..") && !isAbsolute(rel) ? rel : abs).replace(/\\/g, "/");
}

/** Thư mục cha gần nhất có `tools/check.sh` (kiểm cả repo), dừng ở gốc repo git. */
function repoCheck(dir) {
  for (let d = dir; ; d = dirname(d)) {
    const sh = join(d, "tools", "check.sh");
    if (existsSync(sh)) return sh;
    if (existsSync(join(d, ".git")) || dirname(d) === d) return undefined;
  }
}

/**
 * Mod Claude Code mà tệp này là mã giao diện, hoặc undefined. Đi ngược thư mục cha tới plugin gần nhất (thư mục có
 * `.claude-plugin/plugin.json` và `hooks/hooks.json`); tệp `.tsx`/`.jsx` nằm trong `hooks/` của nó là giao diện vẽ
 * bằng `ui.render`, kiểm bằng `claude plugin test`. Tệp ngoài `hooks/` (trang web plugin mang theo, khối mẫu của chính
 * design-kit) vẫn là giao diện web. `check`: `tools/check.sh` của repo chứa mod, nếu có.
 */
function modOf(file, cwd) {
  if (typeof file !== "string" || !MOD_UI.test(file)) return undefined;
  const abs = resolve(cwd || ".", file);
  for (let d = dirname(abs); dirname(d) !== d; d = dirname(d)) {
    if (!existsSync(join(d, ".claude-plugin", "plugin.json")) || !existsSync(join(d, "hooks", "hooks.json"))) continue;
    const rel = relative(join(d, "hooks"), abs);
    return rel && !rel.startsWith("..") && !isAbsolute(rel) ? { root: d, check: repoCheck(d) } : undefined;
  }
  return undefined;
}

if (input.hook_event_name === "PostToolUse") {
  const file = input.tool_input?.file_path;
  const cwd = typeof input.cwd === "string" ? input.cwd : "";
  if (isImg(file)) {
    // Hình nhắc theo nhịp riêng: sửa logo không nuốt lời nhắc cho trang web sửa ngay sau đó.
    const s = load();
    const now = Date.now();
    if (s.lastRemindImg && now - s.lastRemindImg < EVERY_MS) process.exit(0);
    save({ ...s, lastRemindImg: now });
    const msg = [
      `design-kit: vừa sửa hình ${basename(file)} (logo, icon, ký hiệu hay minh hoạ). Trước khi báo xong:`,
      `1. Chạy \`design-kit check-image ${show(file, cwd)} --strict\` (bộ icon: chạy trên cả thư mục để so với nhau).`,
      "2. Mở tờ soát trong .design-kit/shots/images và tự xem: nhận ra được ở 16 px không, bản một màu và bản đảo trên nền tối, icon có lệch khỏi bộ không.",
      "3. Logo, icon giao diện nên là SVG: chữ chuyển thành nét, có viewBox, không script; icon một màu dùng currentColor.",
    ].join("\n");
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg } }));
    process.exit(0);
  }
  if (!isUi(file)) process.exit(0);
  const mod = modOf(file, cwd);
  // Mod và trang web nhắc riêng nhịp: sửa mod không nuốt lời nhắc cho trang web sửa ngay sau đó.
  const key = mod ? "lastRemindMod" : "lastRemind";
  const s = load();
  const now = Date.now();
  if (s[key] && now - s[key] < EVERY_MS) process.exit(0);
  save({ ...s, [key]: now });
  let msg;
  if (mod) {
    const dir = show(mod.root, cwd);
    const repo = mod.check ? ` (hoặc \`bash ${show(mod.check, cwd)}\` kiểm cả repo)` : "";
    msg = [
      `design-kit: vừa sửa ${basename(file)}, giao diện của mod Claude Code ${dir} (vẽ bằng ui.render trong terminal và app desktop, không có trang HTML nên không chạy \`design-kit check\`). Trước khi báo xong:`,
      `1. Chạy \`claude plugin validate ${dir}\` và \`claude plugin test ${dir}\`${repo}.`,
      "2. Xem cây vẽ trong test: `$.ui.mount(...)` rồi `ui.drawn()`; khẳng định chữ, thứ tự, trạng thái trống và lỗi, chữ dài ở khung hẹp. Thêm test khi thêm khung hay trạng thái mới.",
      "3. Bản đồ tác vụ chỉ cần khi thêm màn hay khung mới có thao tác (nút, lệnh, ô nhập): việc chính, chỗ người dùng lần đầu dễ lúng túng, mẫu dẫn đường cho từng chỗ. Không dùng tour mở đầu.",
    ].join("\n");
  } else {
    const gate = /\.html?$/i.test(file)
      ? `2. Chạy \`design-kit check ${show(file, cwd)} --strict\``
      : "2. Chạy `design-kit check <trang .html, URL dev server hoặc dist/*.html hiển thị tệp này> --strict` (không kiểm thẳng tệp nguồn)";
    msg = [
      `design-kit: vừa sửa tệp giao diện ${basename(file)}. Trước khi báo xong:`,
      "1. Bản đồ tác vụ: việc chính của người dùng, chỗ người dùng lần đầu dễ lúng túng, và mẫu dẫn đường cho từng chỗ (làm từng bước có tên bước kế, danh sách \"Bắt đầu\", mẹo đúng lúc cạnh điều khiển, màn trống chỉ việc làm tiếp, Hoàn tác). Không dùng tour mở đầu.",
      `${gate}; trạng thái sau thao tác (lỗi form, bước 2, menu mở) ghi vào <trang>.steps.json.`,
      "3. Mở ảnh chụp trong .design-kit/shots và tự duyệt trước khi đưa chủ xem. Chi tiết: skill design-kit.",
    ].join("\n");
  }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg } }));
  process.exit(0);
}

/** Đường dẫn để so: tuyệt đối, gạch xuôi, chữ thường (Windows không phân biệt hoa thường). */
const norm = (p) => p.replace(/\\/g, "/").toLowerCase();

// `check` đứng riêng: `\b` sau "check" cũng khớp "check-image" và "check-mod" (dấu gạch không phải chữ), nên một lần
// chấm hình từng được tính như đã chạy cổng trang.
// Lệnh phải ĐƯỢC CHẠY: đứng đầu một đoạn lệnh (đầu dòng, sau ; & | ( hay `time`), có thể qua npx hay node <đường dẫn>.
// Trước 19/11/2026 chỉ cần chuỗi xuất hiện, nên `grep "design-kit check" README.md` hay một lời commit nhắc lệnh cũng
// được tính là đã chạy cổng.
const RUN_AT = String.raw`(?:^|[;&|(\n]\s*|\btime\s+)(?:npx\s+(?:-\S+\s+)*)?(?:node\s+)?["']?(?:[^\s"']*[\\/])?design-kit(?:\.js)?["']?\s+`;
const GATE = new RegExp(`${RUN_AT}check(?![\\w-])`);
const IMG_GATE = new RegExp(`${RUN_AT}check-image\\b`);
const PLUGIN_TEST = /claude(?:\.exe)?\s+plugin\s+test\b([^;&|\r\n]*)/g;
// Cổng mod của chính design-kit cũng chạy `claude plugin test` trên mod (kèm phép đo), nên tính như lệnh đó.
const MOD_GATE = new RegExp(`${RUN_AT}check-mod\\b([^;&|\\r\\n]*)`, "g");
const REPO_CHECK = /(?:^|[\s;&|(])(?:bash\s+|sh\s+|\.\/)[^\s;&|]*tools[\\/]check\.sh\b/;
/** Lệnh có thể là một lần kiểm: cổng design-kit, chấm hình, `claude plugin test`, hoặc `tools/check.sh` của repo chứa mod. */
const isCheck = (cmd) => GATE.test(cmd) || IMG_GATE.test(cmd) || /claude(?:\.exe)?\s+plugin\s+test\b/.test(cmd) || new RegExp(`${RUN_AT}check-mod\\b`).test(cmd) || REPO_CHECK.test(cmd);

/**
 * Lệnh nêu tệp này: một đối số trỏ đúng tệp hay thư mục chứa nó (tuyệt đối, hoặc tương đối với cwd), hoặc đúng tên tệp
 * đứng trơn (lệnh chạy sau `cd` vào thư mục đó). Trước 19/11/2026 hàm so chuỗi con, nên kiểm `old/footer-logo.svg` được
 * tính là đã kiểm `brand/logo.svg`, và `check khac/index.html` phủ cả `app/index.html`.
 */
function names(cmd, file, cwd) {
  const f = norm(file);
  const d = norm(dirname(file));
  const base = norm(basename(file));
  // Đường dẫn tương đối tính từ cwd hoặc từ thư mục `cd` gần nhất trong cùng lệnh; giữ nguyên đường dẫn trong nháy
  // (có dấu cách).
  const bases = [cwd, ...cdDirs(cmd, cwd)];
  return [...cmd.matchAll(/"([^"]*)"|'([^']*)'|([^\s;&|()]+)/g)].some((m) => {
    const t = unshell(m[1] ?? m[2] ?? m[3] ?? "");
    if (!t || t.startsWith("-")) return false;
    if (!/[\\/]/.test(t) && norm(t) === base) return true;
    return bases.some((b) => {
      const abs = norm(resolve(b, t)).replace(/\/+$/, "");
      return abs === f || abs === d;
    });
  });
}

/** Các thư mục mà lệnh `cd` (hay Set-Location…) trong lệnh chuyển tới, nối tiếp nhau từ cwd. */
function cdDirs(cmd, cwd) {
  const out = [];
  let base = cwd;
  for (const cd of cmd.matchAll(/(?:^|[;&|(\n]\s*)(?:cd|pushd|Set-Location|Push-Location)\s+(?:-\w+\s+)*("[^"]*"|'[^']*'|[^\s;&|)]+)/gi)) {
    base = resolve(base, unshell(cd[1]));
    out.push(base);
  }
  return out;
}

/** Bỏ dấu nháy; trên Windows đổi đường dẫn Git Bash `/d/code/…` thành `d:/code/…`. */
function unshell(t) {
  const p = t.replace(/^["']|["']$/g, "");
  return process.platform === "win32" ? p.replace(/^\/([a-z])(?=\/|$)/i, "$1:") : p;
}

/**
 * Lệnh có kiểm mod này không: chạy `tools/check.sh` của repo chứa mod, hoặc `claude plugin test` trên thư mục mod hay
 * một thư mục cha của nó (lệnh chạy mọi *.test.ts(x) bên dưới thư mục nêu). Không nêu thư mục là thư mục hiện tại:
 * cwd của phiên, hoặc thư mục `cd` cuối cùng đứng trước trong cùng lệnh. Thư mục chứa biến shell (`"plugins/$mod"`
 * trong vòng lặp) không ánh xạ được, tính là phủ.
 */
function coversMod(cmd, mod, cwd) {
  if (mod.check && REPO_CHECK.test(cmd)) return true;
  const root = norm(mod.root);
  for (const m of [...cmd.matchAll(PLUGIN_TEST), ...cmd.matchAll(MOD_GATE)]) {
    if (/(^|\s)(-h|--help)(?=\s|$)/.test(m[1])) continue; // chỉ in trợ giúp, không chạy test
    let base = cwd;
    for (const cd of cmd.slice(0, m.index).matchAll(/(?:^|[;&|(\n]\s*)(?:cd|pushd|Set-Location|Push-Location)\s+(?:-\w+\s+)*("[^"]*"|'[^']*'|[^\s;&|)]+)/gi)) {
      base = resolve(base, unshell(cd[1]));
    }
    // Mọi đối số không phải cờ, bỏ giá trị của cờ có giá trị đứng trước (`check-mod --shots out <mod>`): trước kia chỉ
    // lấy đối số đầu, nên "out" bị coi là thư mục mod.
    const toks = m[1].trim().split(/\s+/);
    const args = toks.filter((t, i) => t && !t.startsWith("-") && !/^\d*[<>]/.test(t) && !/^--(shots|widths|surfaces|languages|pane-id|term-bg|limit|fields)$/.test(toks[i - 1] ?? ""));
    if (args.some((a) => /[$%]/.test(a))) return true;
    for (const a of args.length ? args : ["."]) {
      const dir = norm(resolve(base, unshell(a)));
      if (root === dir || root.startsWith(dir.endsWith("/") ? dir : `${dir}/`)) return true;
    }
  }
  return false;
}

/**
 * Lệnh kiểm có phủ tệp này không. Giao diện mod: xem `coversMod`. Còn lại lệnh phải là cổng `design-kit check`.
 * Trang .html: lệnh phải nêu tên tệp, đúng thư mục chứa nó (`check` chỉ lấy các .html nằm ngay trong thư mục được
 * nêu), hoặc một URL (máy chủ dev: không ánh xạ được, tính là phủ). Tệp nguồn (.tsx, .css…) được kiểm qua trang build
 * hay URL, nên lần chạy cổng nào cũng tính.
 */
function covers(cmd, file, cwd, mod, img) {
  if (mod) return coversMod(cmd, mod, cwd);
  // Hình: `check-image` nêu đúng tệp hay thư mục chứa nó (lệnh chỉ đọc ảnh nằm ngay trong thư mục được nêu).
  if (img) return IMG_GATE.test(cmd) && names(cmd, file, cwd);
  if (!GATE.test(cmd)) return false;
  if (!/\.html?$/i.test(file)) return true;
  return /https?:\/\//.test(cmd) || names(cmd, file, cwd);
}

/** Tệp git thấy đã đổi hoặc mới (chưa theo dõi, không bị .gitignore), đường dẫn tuyệt đối. Không phải repo git ⇒ rỗng. */
function gitChanged(cwd) {
  const r = spawnSync("git", ["ls-files", "--modified", "--others", "--exclude-standard", "-z"], { cwd, encoding: "utf8", timeout: 5000, windowsHide: true });
  if (r.status !== 0 || typeof r.stdout !== "string") return [];
  return [...new Set(r.stdout.split("\0").filter(Boolean))].map((f) => resolve(cwd, f));
}

if (input.hook_event_name === "Stop") {
  if (input.stop_hook_active || !input.transcript_path || !existsSync(input.transcript_path)) process.exit(0);
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  // Đọc transcript: lần sửa qua Write/Edit (theo thứ tự dòng), lần chạy cổng (thứ tự dòng và lúc chạy xong),
  // và mốc bắt đầu phiên (dòng sớm nhất có timestamp).
  let start = Infinity;
  const edits = new Map(); // tệp → { i, id }
  const checks = []; // { i, cmd, id }
  const doneAt = new Map(); // tool_use_id → lúc có kết quả
  const atOf = new Map(); // tool_use_id → lúc gọi
  const lines = readFileSync(input.transcript_path, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    let o;
    try { o = JSON.parse(line); } catch { return; }
    const at = Date.parse(o?.timestamp ?? "");
    if (Number.isFinite(at)) start = Math.min(start, at);
    for (const c of Array.isArray(o?.message?.content) ? o.message.content : []) {
      if (c?.type === "tool_result" && Number.isFinite(at)) doneAt.set(c.tool_use_id, at);
      if (c?.type !== "tool_use") continue;
      if (Number.isFinite(at)) atOf.set(c.id, at);
      if (["Write", "Edit", "MultiEdit"].includes(c.name) && (isUi(c.input?.file_path) || isImg(c.input?.file_path))) {
        edits.set(norm(resolve(cwd, c.input.file_path)), { i, id: c.id, file: resolve(cwd, c.input.file_path) });
      }
      const cmd = c.input?.command;
      if (typeof cmd === "string" && isCheck(cmd)) checks.push({ i, cmd, id: c.id });
    }
  });
  const pending = new Map(); // tệp (norm) → { file, key, mod }
  // (A) Sửa qua Write/Edit: cần một lần kiểm phủ tệp, gọi sau lần sửa (theo thứ tự dòng). Tệp không còn (đã xoá,
  // đã đổi tên) thì không còn gì để kiểm; chỗ mới của nó do (B) xét nếu git thấy đổi.
  for (const [k, e] of edits) {
    if (!existsSync(e.file)) continue;
    const img = isImg(e.file);
    const mod = img ? undefined : modOf(e.file, cwd);
    if (!checks.some((x) => x.i > e.i && covers(x.cmd, e.file, cwd, mod, img))) pending.set(k, { file: e.file, key: e.id, mod, img });
  }
  // (B) Tệp giao diện git thấy đã đổi, sửa sau khi phiên bắt đầu: cần một lần kiểm phủ tệp, xong sau lần sửa.
  // Lấy lúc lệnh kiểm có kết quả, nên "sửa rồi kiểm" trong cùng một lệnh vẫn tính.
  if (Number.isFinite(start)) {
    for (const file of gitChanged(cwd)) {
      const img = isImg(file);
      if (!isUi(file) && !img) continue;
      let m;
      try { m = statSync(file).mtimeMs; } catch { continue; }
      if (m <= start) continue;
      const mod = img ? undefined : modOf(file, cwd);
      const ok = checks.some((x) => (doneAt.get(x.id) ?? atOf.get(x.id) ?? -Infinity) > m && covers(x.cmd, file, cwd, mod, img));
      if (!ok) pending.set(norm(file), { file, key: `mtime:${norm(file)}:${Math.round(m)}`, mod, img });
      else pending.delete(norm(file));
    }
  }
  if (!pending.size) process.exit(0);
  const sig = [...pending.values()].map((p) => p.key).sort().join("|");
  const s = load();
  if (s.nagged === sig) process.exit(0);
  save({ ...s, nagged: sig });
  const list = (names) => names.slice(0, 5).join(", ") + (names.length > 5 ? ` và ${names.length - 5} tệp khác` : "");
  const web = [...pending.values()].filter((p) => !p.mod && !p.img);
  const mods = [...pending.values()].filter((p) => p.mod);
  const imgs = [...pending.values()].filter((p) => p.img);
  const parts = [];
  if (imgs.length) {
    parts.push(
      `phiên này đã sửa hình ${list(imgs.map((p) => show(p.file, cwd)))} nhưng chưa có lần \`design-kit check-image\` nào trên đó sau lần sửa. ` +
        "Chạy `design-kit check-image <tệp hoặc thư mục chứa nó> --strict` và tự xem tờ soát trong .design-kit/shots/images.",
    );
  }
  if (web.length) {
    parts.push(
      `${imgs.length ? "Phiên cũng" : "phiên này"} đã sửa ${list(web.map((p) => show(p.file, cwd)))} nhưng chưa có lần \`design-kit check\` nào chạy trên đó sau lần sửa. ` +
        "Chạy cổng (kèm --strict) trên đúng trang, thư mục chứa nó, hoặc URL hiển thị nó, và tự xem ảnh chụp; nêu bản đồ tác vụ nếu là màn mới.",
    );
  }
  if (mods.length) {
    const roots = [...new Set(mods.map((p) => show(p.mod.root, cwd)))];
    const repo = [...new Set(mods.map((p) => p.mod.check).filter(Boolean))].map((f) => `\`bash ${show(f, cwd)}\``);
    parts.push(
      `${web.length || imgs.length ? "Phiên cũng" : "phiên này"} đã sửa giao diện mod Claude Code ${list(mods.map((p) => show(p.file, cwd)))} nhưng chưa có lần \`claude plugin test\` nào trên mod đó sau lần sửa. ` +
        `Chạy ${roots.map((r) => `\`claude plugin test ${r}\``).join(", ")}${repo.length ? ` (hoặc ${repo.join(", ")})` : ""} và xem cây vẽ bằng \`ui.drawn()\` trong test; mod không có trang HTML nên không cần \`design-kit check\`.`,
    );
  }
  const reason =
    `design-kit: ${parts.join(" ")} ` +
    "Nếu thay đổi không chạm giao diện người dùng, hoặc tệp do phiên khác hay chủ sửa, thì nói ngắn lý do rồi dừng.";
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}
process.exit(0);
