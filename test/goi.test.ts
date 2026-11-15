import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";
import { dkCache, downloadEngine, engineAsset } from "../src/impeccable.js";

const root = join(__dirname, "..");
const hook = join(root, "hooks", "nhac-giao-dien.mjs");
const tmp = mkdtempSync(join(tmpdir(), "dk-test-"));

function runHook(input: Record<string, unknown>): string {
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify(input), encoding: "utf8" });
  expect(r.status).toBe(0);
  return r.stdout;
}
const sid = () => `test-${Math.random().toString(36).slice(2)}`;

describe("plugin hook", () => {
  it("reminds once on a UI edit, stays quiet on other files and within 15 minutes", () => {
    const s = sid();
    expect(runHook({ hook_event_name: "PostToolUse", session_id: s, tool_input: { file_path: "src/app.ts" } })).toBe("");
    const out = runHook({ hook_event_name: "PostToolUse", session_id: s, tool_input: { file_path: "src/Trang.tsx" } });
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
    expect(ctx).toContain("Bản đồ tác vụ");
    expect(ctx).not.toContain("design-kit check Trang.tsx");
    expect(ctx).toContain("dist/*.html");
    expect(runHook({ hook_event_name: "PostToolUse", session_id: s, tool_input: { file_path: "src/Khac.tsx" } })).toBe("");
    expect(runHook({ hook_event_name: "PostToolUse", session_id: sid(), tool_input: { file_path: "node_modules/x/a.css" } })).toBe("");
  });

  it("suggests an .html path the gate can resolve from the session cwd", () => {
    const ctx = (file: string) =>
      JSON.parse(runHook({ hook_event_name: "PostToolUse", session_id: sid(), cwd: tmp, tool_input: { file_path: file } }))
        .hookSpecificOutput.additionalContext as string;
    expect(ctx(join(tmp, "src", "pages", "a.html"))).toContain("design-kit check src/pages/a.html --strict");
    const outside = join(tmpdir(), "khac", "b.html");
    expect(ctx(outside)).toContain(`design-kit check ${outside.replace(/\\/g, "/")} --strict`);
  });

  it("blocks Stop once when a UI edit has no design-kit check after it", () => {
    const line = (content: unknown[]) => JSON.stringify({ type: "assistant", message: { content } });
    const edit = (id: string, file: string) => line([{ type: "tool_use", id, name: "Edit", input: { file_path: file } }]);
    const bash = (cmd: string) => line([{ type: "tool_use", id: "b", name: "Bash", input: { command: cmd } }]);
    const tr = join(tmp, "t1.jsonl");
    writeFileSync(tr, [bash("design-kit check a.html"), edit("e1", "D:/x/a.html")].join("\n"));
    const s = sid();
    const out = JSON.parse(runHook({ hook_event_name: "Stop", session_id: s, transcript_path: tr }));
    expect(out.decision).toBe("block");
    expect(out.reason).toContain("a.html");
    // Cùng lần sửa: không chặn lần nữa; đang tiếp tục vì hook: không chặn
    expect(runHook({ hook_event_name: "Stop", session_id: s, transcript_path: tr })).toBe("");
    expect(runHook({ hook_event_name: "Stop", session_id: sid(), transcript_path: tr, stop_hook_active: true })).toBe("");
    // Đã chạy cổng sau lần sửa: không chặn
    const tr2 = join(tmp, "t2.jsonl");
    writeFileSync(tr2, [edit("e2", "D:/x/a.html"), bash("node dist/bin/design-kit.js check a.html --strict")].join("\n"));
    expect(runHook({ hook_event_name: "Stop", session_id: sid(), transcript_path: tr2 })).toBe("");
  });
});

describe("plugin hook: UI files changed outside Write/Edit", () => {
  const git = (cwd: string, ...args: string[]) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
  };
  const iso = (ms: number) => new Date(ms).toISOString();
  const use = (id: string, name: string, input: Record<string, unknown>, at: number) =>
    JSON.stringify({ type: "assistant", timestamp: iso(at), message: { content: [{ type: "tool_use", id, name, input }] } });
  const result = (id: string, at: number) =>
    JSON.stringify({ type: "user", timestamp: iso(at), message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] } });

  it("a page edited through the shell needs a check of that page that finished after the edit", () => {
    const repo = mkdtempSync(join(tmpdir(), "dk-hook-"));
    git(repo, "init", "-q");
    git(repo, "config", "user.email", "t@example.invalid");
    git(repo, "config", "user.name", "t");
    mkdirSync(join(repo, "trang"));
    writeFileSync(join(repo, "trang", "a.html"), "<p>cũ</p>");
    writeFileSync(join(repo, "ghi-chu.md"), "x");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "init");
    const start = Date.now() - 60_000;
    // Sửa qua shell: không có Write/Edit nào trong transcript. Tệp .md đổi cũng không tính.
    writeFileSync(join(repo, "trang", "a.html"), "<p>mới</p>");
    writeFileSync(join(repo, "ghi-chu.md"), "y");
    const edited = statSync(join(repo, "trang", "a.html")).mtimeMs;
    const head = [JSON.stringify({ type: "user", timestamp: iso(start), message: { content: "làm trang" } }), use("b1", "Bash", { command: "node sua.mjs" }, edited - 500), result("b1", edited - 400)];
    const tr = join(repo, "t.jsonl");
    const stop = (lines: string[], s = sid()) => {
      writeFileSync(tr, lines.join("\n"));
      const out = runHook({ hook_event_name: "Stop", session_id: s, transcript_path: tr, cwd: repo });
      return out ? (JSON.parse(out) as { decision: string; reason: string }) : undefined;
    };
    const blocked = stop(head);
    expect(blocked?.decision).toBe("block");
    expect(blocked?.reason).toContain("a.html");
    expect(blocked?.reason).not.toContain("ghi-chu");
    // Kiểm trang khác: chưa đủ. Kiểm đúng thư mục chứa trang, xong sau lần sửa: đủ.
    expect(stop([...head, use("c1", "Bash", { command: "design-kit check trang/b.html --strict" }, edited + 1000), result("c1", edited + 3000)])?.decision).toBe("block");
    expect(stop([...head, use("c2", "Bash", { command: "design-kit check trang --strict" }, edited + 1000), result("c2", edited + 3000)])).toBeUndefined();
    // Fixture test (trang hỏng có chủ ý, kiểm qua bộ test) đổi cũng không tính.
    mkdirSync(join(repo, "test", "fixtures"), { recursive: true });
    writeFileSync(join(repo, "test", "fixtures", "hong.html"), "<p>hỏng có chủ ý</p>");
    expect(stop([...head, use("c4", "Bash", { command: "design-kit check trang --strict" }, edited + 1000), result("c4", Date.now() + 5000)])).toBeUndefined();
    // Sửa và kiểm trong cùng một lệnh: lệnh xong sau lần sửa thì tính là đã kiểm.
    expect(stop([...head, use("c3", "PowerShell", { command: "node sua.mjs; design-kit check trang\\a.html" }, edited - 200), result("c3", edited + 2000)])).toBeUndefined();
    // Tệp đổi trước khi phiên bắt đầu (việc của phiên khác, đã nằm sẵn): không tính.
    const old = [JSON.stringify({ type: "user", timestamp: iso(edited + 10_000), message: { content: "việc khác" } })];
    expect(stop(old)).toBeUndefined();
  });
});

describe("engine download", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("refuses a binary whose sha256 does not match the pinned one, and installs nothing", async () => {
    vi.stubGlobal("fetch", async () => new Response(new Uint8Array([1, 2, 3])));
    const env = { DK_HOME: join(tmp, "home") };
    await expect(downloadEngine(env)).rejects.toThrow(/checksum mismatch/);
    expect(existsSync(dkCache(env))).toBe(false);
    expect(engineAsset()).toMatch(/^impeccable-(windows-x64\.exe|darwin-(x64|arm64)|linux-(x64|arm64))$/);
  });
});

describe("color commands", () => {
  async function run(argv: string[]): Promise<{ out: string; code: number | undefined }> {
    let out = "";
    const prev = process.exitCode;
    process.exitCode = undefined;
    await main({ argv, stdout: { write: (c: string) => (out += c) }, runtime: { env: process.env, home: "", cwd: tmp } });
    const code = process.exitCode as number | undefined;
    process.exitCode = prev;
    return { out, code };
  }
  it("doi-mau writes a token file that still passes every pair, kiem-mau confirms it", async () => {
    const a = await run(["doi-mau", "--huong", "dem", "--nhan", "45", "--trung-tinh", "60", "--ra", "dem.css"]);
    expect(a.out).toContain("pass: 42 pairs");
    expect(readFileSync(join(tmp, "dem.css"), "utf8")).toContain("--trung-tinh 60");
    const b = await run(["kiem-mau", "dem.css", "--huong", "dem"]);
    expect(b.out).toContain("pass: 42 pairs");
  });
  it("doi-mau without --ra is a usage error", async () => {
    const { out, code } = await run(["doi-mau", "--huong", "dem", "--nhan", "45"]);
    expect(out).toContain("--ra is required");
    expect(code).toBe(2);
  });
});
