#!/usr/bin/env node
// Đọc màu của các khoá theme (text, subtle, success…) từ tệp chạy của Claude Code rồi ghi data/claude-themes.json.
// `design-kit check-mod` dùng bảng này để đo tương phản của chữ mod tô bằng khoá theme, ở theme tối và sáng.
//
//   node scripts/claude-themes.mjs [đường-dẫn-claude]   (mặc định: `claude` tìm trên PATH)
//
// Tệp chạy là một bundle JS: mỗi theme là một object literal `{autoAccept:"rgb(…)",…,planMode:"rgb(…)",…}`.
// Bốn bản đầu tiên là sáng, sáng cho người mù màu, tối, tối cho người mù màu; lấy bản thường của sáng và tối.
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEYS = [
  "text", "inverseText", "inactive", "subtle", "suggestion", "remember", "success", "error", "warning", "merged", "claude",
  "permission", "planMode", "autoAccept", "promptBorder", "bashBorder", "ide",
  "diffAdded", "diffRemoved", "diffAddedDimmed", "diffRemovedDimmed", "diffAddedWord", "diffRemovedWord",
];

function findClaude() {
  const arg = process.argv[2];
  if (arg) return realpathSync(arg);
  const cmd = process.platform === "win32" ? "where" : "which";
  const first = execFileSync(cmd, ["claude"], { encoding: "utf8" }).split(/\r?\n/).find(Boolean);
  if (!first) throw new Error("claude not found on PATH; pass its path");
  return realpathSync(first.trim());
}

const bin = findClaude();
const version = execFileSync(bin, ["--version"], { encoding: "utf8" }).trim().split(/\s/)[0];
const buf = readFileSync(bin);
const needle = Buffer.from('planMode:"rgb(');
const themes = [];
for (let i = buf.indexOf(needle); i !== -1 && themes.length < 8; i = buf.indexOf(needle, i + needle.length)) {
  const start = buf.lastIndexOf(Buffer.from("{"), i);
  const end = buf.indexOf(Buffer.from("}"), i);
  const body = buf.subarray(start + 1, end).toString("latin1");
  const theme = {};
  for (const m of body.matchAll(/([A-Za-z_]+):"(rgb\([^)]*\))"/g)) theme[m[1]] = m[2].replace(/\s+/g, "");
  if (KEYS.every((k) => theme[k])) themes.push(theme);
}
const light = themes.find((t) => t.text === "rgb(0,0,0)");
const dark = themes.find((t) => t.text === "rgb(255,255,255)");
if (!light || !dark) throw new Error(`light/dark themes not found in ${bin} (found ${themes.length} theme objects)`);
const pick = (t) => Object.fromEntries(KEYS.map((k) => [k, t[k]]));
const out = {
  source: `Claude Code ${version}: the default dark and light themes, read from its executable by scripts/claude-themes.mjs`,
  dark: pick(dark),
  light: pick(light),
};
const file = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "claude-themes.json");
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${file} from Claude Code ${version}`);
