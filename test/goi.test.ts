import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
