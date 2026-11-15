#!/usr/bin/env node
// Hook của plugin design-kit (không phụ thuộc gói nào, Node ≥ 18).
//
// PostToolUse (Write|Edit|MultiEdit): AI vừa ghi một tệp giao diện ⇒ nhắc bản đồ tác vụ + dẫn đường như game
//   + chạy cổng. Mỗi phiên nhắc lần đầu, sau đó tối đa 15 phút một lần (không thành tiếng ồn).
// Stop: phiên đã sửa giao diện mà sau lần sửa chưa chạy `design-kit check` trên trang đó ⇒ chặn một lần, nêu tệp.
//   Hai cách thấy lần sửa: lệnh Write/Edit trong transcript, và tệp giao diện git thấy đã đổi, sửa sau khi phiên bắt
//   đầu (sửa qua Bash, PowerShell, công cụ MCP: trước 15/11/2026 hook bỏ sót hết). Mỗi trạng thái chỉ bị chặn một
//   lần: AI có thể trả lời lý do không kiểm (không chạm giao diện, tệp do phiên khác sửa) rồi dừng.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

const UI = /\.(html?|tsx|jsx|vue|svelte|astro|css|scss)$/i;
// Không phải giao diện người dùng: thư viện, bản build, ảnh chụp của cổng, fixture test (trang hỏng có chủ ý, kiểm
// qua bộ test), thư mục nháp của phiên Claude Code (scratchpad).
const SKIP = /(^|[\\/])(node_modules|dist|build|\.design-kit|coverage|fixtures|__fixtures__|scratchpad)[\\/]|\.(test|spec|stories)\.[jt]sx?$/i;
const EVERY_MS = 15 * 60 * 1000;

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
const isUi = (f) => typeof f === "string" && UI.test(f) && !SKIP.test(f);

if (input.hook_event_name === "PostToolUse") {
  const file = input.tool_input?.file_path;
  if (!isUi(file)) process.exit(0);
  const s = load();
  const now = Date.now();
  if (s.lastRemind && now - s.lastRemind < EVERY_MS) process.exit(0);
  save({ ...s, lastRemind: now });
  let target;
  if (/\.html?$/i.test(file)) {
    const cwd = typeof input.cwd === "string" ? input.cwd : "";
    const rel = cwd ? relative(cwd, resolve(cwd, file)) : "";
    target = (rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : file).replace(/\\/g, "/");
  }
  const gate = target
    ? `2. Chạy \`design-kit check ${target} --strict\``
    : "2. Chạy `design-kit check <trang .html, URL dev server hoặc dist/*.html hiển thị tệp này> --strict` (không kiểm thẳng tệp nguồn)";
  const msg = [
    `design-kit: vừa sửa tệp giao diện ${basename(file)}. Trước khi báo xong:`,
    "1. Bản đồ tác vụ: việc chính của người dùng, chỗ người dùng lần đầu dễ lúng túng, và mẫu dẫn đường cho từng chỗ (làm từng bước có tên bước kế, danh sách \"Bắt đầu\", mẹo đúng lúc cạnh điều khiển, màn trống chỉ việc làm tiếp, Hoàn tác). Không dùng tour mở đầu.",
    `${gate}; trạng thái sau thao tác (lỗi form, bước 2, menu mở) ghi vào <trang>.steps.json.`,
    "3. Mở ảnh chụp trong .design-kit/shots và tự duyệt trước khi đưa chủ xem. Chi tiết: skill design-kit.",
  ].join("\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg } }));
  process.exit(0);
}

/** Đường dẫn để so: tuyệt đối, gạch xuôi, chữ thường (Windows không phân biệt hoa thường). */
const norm = (p) => p.replace(/\\/g, "/").toLowerCase();

/**
 * Lệnh kiểm có phủ tệp này không. Trang .html: lệnh phải nêu tên tệp, đúng thư mục chứa nó (`check` chỉ lấy các
 * .html nằm ngay trong thư mục được nêu), hoặc một URL (máy chủ dev: không ánh xạ được, tính là phủ). Tệp nguồn
 * (.tsx, .css…) được kiểm qua trang build hay URL, nên lần chạy cổng nào cũng tính.
 */
function covers(cmd, file, cwd) {
  if (!/\.html?$/i.test(file)) return true;
  const c = ` ${norm(cmd)} `.replace(/["']/g, " ");
  if (/https?:\/\//.test(c) || c.includes(norm(basename(file)))) return true;
  const dirs = [norm(dirname(file)), norm(relative(cwd, dirname(file)))];
  if (dirs[1] === "") dirs.push(".", "./");
  return dirs.some((d) => d && (c.includes(` ${d} `) || c.includes(` ${d}/ `)));
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
      if (["Write", "Edit", "MultiEdit"].includes(c.name) && isUi(c.input?.file_path)) {
        edits.set(norm(resolve(cwd, c.input.file_path)), { i, id: c.id, file: resolve(cwd, c.input.file_path) });
      }
      const cmd = c.input?.command;
      if (typeof cmd === "string" && /design-kit(\.js)?\s+check\b/.test(cmd)) checks.push({ i, cmd, id: c.id });
    }
  });
  const pending = new Map(); // tệp (norm) → { file, key }
  // (A) Sửa qua Write/Edit: cần một lần kiểm phủ tệp, gọi sau lần sửa (theo thứ tự dòng).
  for (const [k, e] of edits) {
    if (!checks.some((x) => x.i > e.i && covers(x.cmd, e.file, cwd))) pending.set(k, { file: e.file, key: e.id });
  }
  // (B) Tệp giao diện git thấy đã đổi, sửa sau khi phiên bắt đầu: cần một lần kiểm phủ tệp, xong sau lần sửa.
  // Lấy lúc lệnh kiểm có kết quả, nên "sửa rồi kiểm" trong cùng một lệnh vẫn tính.
  if (Number.isFinite(start)) {
    for (const file of gitChanged(cwd)) {
      if (!isUi(file)) continue;
      let m;
      try { m = statSync(file).mtimeMs; } catch { continue; }
      if (m <= start) continue;
      const ok = checks.some((x) => (doneAt.get(x.id) ?? atOf.get(x.id) ?? -Infinity) > m && covers(x.cmd, file, cwd));
      if (!ok) pending.set(norm(file), { file, key: `mtime:${norm(file)}:${Math.round(m)}` });
      else pending.delete(norm(file));
    }
  }
  if (!pending.size) process.exit(0);
  const sig = [...pending.values()].map((p) => p.key).sort().join("|");
  const s = load();
  if (s.nagged === sig) process.exit(0);
  save({ ...s, nagged: sig });
  const names = [...pending.values()].map((p) => {
    const rel = relative(cwd, p.file);
    return (rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : p.file).replace(/\\/g, "/");
  });
  const shown = names.slice(0, 5).join(", ") + (names.length > 5 ? ` và ${names.length - 5} tệp khác` : "");
  const reason =
    `design-kit: phiên này đã sửa ${shown} nhưng chưa có lần \`design-kit check\` nào chạy trên đó sau lần sửa. ` +
    "Chạy cổng (kèm --strict) trên đúng trang, thư mục chứa nó, hoặc URL hiển thị nó, và tự xem ảnh chụp; nêu bản đồ tác vụ nếu là màn mới. " +
    "Nếu thay đổi không chạm giao diện người dùng, hoặc tệp do phiên khác hay chủ sửa, thì nói ngắn lý do rồi dừng.";
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}
process.exit(0);
