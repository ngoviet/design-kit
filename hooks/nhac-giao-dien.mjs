#!/usr/bin/env node
// Hook của plugin design-kit (không phụ thuộc gói nào, Node ≥ 18).
//
// PostToolUse (Write|Edit|MultiEdit): AI vừa ghi một tệp giao diện ⇒ nhắc bản đồ tác vụ + dẫn đường như game
//   + chạy cổng. Mỗi phiên nhắc lần đầu, sau đó tối đa 15 phút một lần (không thành tiếng ồn).
// Stop: phiên đã sửa giao diện mà sau lần sửa cuối chưa chạy `design-kit check` ⇒ chặn một lần, nêu tệp cần kiểm.
//   Mỗi lần sửa chỉ bị chặn một lần: AI có thể trả lời lý do không kiểm (thay đổi không chạm giao diện) rồi dừng.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

const UI = /\.(html?|tsx|jsx|vue|svelte|astro|css|scss)$/i;
const SKIP = /(^|[\\/])(node_modules|dist|build|\.design-kit|coverage)[\\/]|\.(test|spec|stories)\.[jt]sx?$/i;
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

if (input.hook_event_name === "Stop") {
  if (input.stop_hook_active || !input.transcript_path || !existsSync(input.transcript_path)) process.exit(0);
  // Tìm lần sửa giao diện cuối và lần chạy `design-kit check` cuối trong transcript của phiên.
  let lastEdit = null;
  let lastCheck = -1;
  const lines = readFileSync(input.transcript_path, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!line.includes('"tool_use"')) return;
    let o;
    try { o = JSON.parse(line); } catch { return; }
    for (const c of o?.message?.content ?? []) {
      if (c?.type !== "tool_use") continue;
      if (["Write", "Edit", "MultiEdit"].includes(c.name) && isUi(c.input?.file_path)) lastEdit = { i, id: c.id, file: c.input.file_path };
      const cmd = c.input?.command;
      if (typeof cmd === "string" && /design-kit(\.js)?\s+check\b/.test(cmd)) lastCheck = i;
    }
  });
  if (!lastEdit || lastCheck > lastEdit.i) process.exit(0);
  const s = load();
  if (s.nagged === lastEdit.id) process.exit(0);
  save({ ...s, nagged: lastEdit.id });
  const reason =
    `design-kit: phiên này đã sửa ${basename(lastEdit.file)} nhưng chưa chạy \`design-kit check\` sau lần sửa đó. ` +
    "Chạy cổng (kèm --strict) và tự xem ảnh chụp, nêu bản đồ tác vụ nếu là màn mới; " +
    "nếu thay đổi không chạm giao diện người dùng thì nói ngắn lý do rồi dừng.";
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}
process.exit(0);
