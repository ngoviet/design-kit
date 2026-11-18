// check-mod từ đầu tới cuối trên test/fixtures/mods/xau: một thanh cố ý mắc mỗi lỗi một lần.
// Cần Claude Code (`claude` hoặc CLAUDE_BIN) để chạy test của mod; máy không có thì bỏ qua phần đó,
// trừ khi DK_REQUIRE_CLAUDE=1 (CI cài Claude Code và đặt biến này): khi ấy thiếu claude là test trượt.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";

const root = join(__dirname, "..");
const bin = process.env["CLAUDE_BIN"] ?? "claude";
const hasClaude = (() => {
  let r = spawnSync(bin, ["--version"], { encoding: "utf8" });
  // Windows: claude cài qua npm là claude.cmd, chỉ chạy được qua shell (một chuỗi lệnh, không mảng đối số).
  if (r.error && process.platform === "win32") r = spawnSync(`"${bin}" --version`, { encoding: "utf8", shell: true });
  return r.status === 0 && /Claude Code/.test(r.stdout);
})();
const requireClaude = process.env["DK_REQUIRE_CLAUDE"] === "1";

async function run(argv: string[]): Promise<{ out: string; code: number | undefined }> {
  let out = "";
  const prev = process.exitCode;
  process.exitCode = undefined;
  await main({ argv, stdout: { write: (c: string) => (out += c) }, runtime: { env: process.env, home: "", cwd: root } });
  const code = process.exitCode as number | undefined;
  process.exitCode = prev;
  return { out, code };
}

describe("check-mod arguments", () => {
  it("rejects a folder that is not a mod", async () => {
    const { out, code } = await run(["check-mod", "test/fixtures"]);
    expect(out).toContain("no .claude-plugin/plugin.json");
    expect(code).toBe(2);
  });
  it("rejects an unknown surface", async () => {
    const { out, code } = await run(["check-mod", "test/fixtures/mods/xau", "--surfaces", "mobile"]);
    expect(out).toContain("--surfaces");
    expect(code).toBe(2);
  });
});

describe.skipIf(!hasClaude && !requireClaude)("check-mod on the fixture mod", () => {
  it("has Claude Code to run the mod's tests", () => {
    expect(hasClaude, `\`${bin} --version\` failed: install Claude Code or set CLAUDE_BIN`).toBe(true);
  });
  it.skipIf(!hasClaude)("finds every fault the fixture plants, on the surface it belongs to", async () => {
    const { out, code } = await run(["check-mod", "test/fixtures/mods/xau", "--widths", "40,120", "--no-shots", "--full", "--strict"]);
    expect(out).toMatch(/^status: "fail: \d+ hard/m);
    expect(code).toBe(1);
    // Hai lượt ngôn ngữ (en, vi) ngoài lượt mặc định; test của mod qua ở lượt mặc định.
    expect(out).toContain('default,"1 pass, 0 fail"');
    expect(out).toMatch(/^ {2}vi,/m);
    const finding = (gate: string, check: string, surface: string) => new RegExp(`^ {2}${gate},${check},${surface},`, "m");
    expect(out).toMatch(finding("hard", "contrast", "terminal"));
    expect(out).toMatch(finding("hard", "overflow", "terminal"));
    expect(out).toMatch(finding("hard", "svg-source", "desktop"));
    expect(out).toMatch(finding("hard", "text-min", "desktop"));
    expect(out).toMatch(finding("hard", "motion", "desktop"));
    expect(out).toMatch(finding("soft", "svg-terminal", "terminal"));
    expect(out).toMatch(finding("soft", "hard-color", "terminal"));
    expect(out).toMatch(finding("soft", "text-cut", "terminal"));
    // Chữ tô bằng khoá theme `success` đổi theo theme: không bị báo.
    expect(out).not.toMatch(/contrast,terminal,"[^"]*\\"ok\\"/);
  });
});
