import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ImpFinding {
  antipattern: string;
  name?: string;
  severity?: string;
  category?: string;
  snippet?: string;
  advisory?: boolean;
}

/** Engine Impeccable: IMPECCABLE_BIN, rồi binary đi kèm skill (như imp-axi). */
export function findImpeccable(env: Record<string, string | undefined>): string | undefined {
  const fromEnv = env["IMPECCABLE_BIN"];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const plat = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux";
  const exe = process.platform === "win32" ? "impeccable.exe" : "impeccable";
  const p = join(homedir(), ".claude", "skills", "impeccable", "scripts", "bin", `${plat}-${process.arch}`, exe);
  return existsSync(p) ? p : undefined;
}

/**
 * `detect --json --viewport WxH <url>`. Engine exit 2 = có phát hiện (không phải lỗi); exit 1 = không quét được.
 * Trả undefined khi engine lỗi (ghi lý do vào `error`).
 */
export function runImpeccable(bin: string, url: string, viewport: string): Promise<{ findings?: ImpFinding[]; error?: string }> {
  return new Promise((done) => {
    const child = spawn(bin, ["detect", "--json", "--viewport", viewport, url], { windowsHide: true, timeout: 240_000, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8").on("data", (d: string) => (out += d));
    child.stderr.setEncoding("utf8").on("data", (d: string) => (err += d));
    child.on("error", (e) => done({ error: e.message }));
    child.on("close", (code) => {
      try {
        const parsed = JSON.parse(out) as ImpFinding[];
        if (code === 1 && parsed.length === 0) return done({ error: (err.trim().split("\n").pop() ?? "scan failed").slice(0, 200) });
        done({ findings: parsed });
      } catch {
        done({ error: `exit ${code}: ${(err.trim().split("\n").pop() ?? "no JSON").slice(0, 200)}` });
      }
    });
  });
}
