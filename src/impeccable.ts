import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Engine ghim: phiên bản và sha256 chép từ engine-checksums.txt của Impeccable (skill 4.8.1).
 * Nâng phiên bản: sửa ENGINE_VERSION và bảng dưới theo engine-checksums.txt của bản mới.
 */
export const ENGINE_VERSION = "0.1.19";
const ENGINE_SHA256: Record<string, string> = {
  "impeccable-darwin-arm64": "c35d0b0b250afceb5ab6ee7edfe190a04d76d25c56bac01935a7a1b06d0df818",
  "impeccable-darwin-x64": "df7c2b9cec89df54d1d9722a35aecc48b965dfad190c4ec2e766ce3f7743a544",
  "impeccable-linux-x64": "07b763dc00012e9acf219fe2d2e8980f0810fb8af2e4a41c090107a8351d412f",
  "impeccable-linux-arm64": "73b5662e42f060aba716016c34a7274cc49a998cd0d5da8b84a95d9e4edea729",
  "impeccable-windows-x64.exe": "30427e0cfea383a0adbc5cc554481c3f18337eeabcc4eaf7d9bb48ad2e8b5676",
};
const RELEASES = "https://github.com/pbakaus/impeccable/releases/download";

const plat = (): string => (process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux");
const exeName = (): string => (process.platform === "win32" ? "impeccable.exe" : "impeccable");
/** Tên tệp trên trang release. Windows ARM chạy bản x64 (giả lập), như launcher của Impeccable. */
export function engineAsset(): string {
  const p = plat();
  const arch = p === "windows" ? "x64" : process.arch;
  return `impeccable-${p}-${arch}${p === "windows" ? ".exe" : ""}`;
}
/** Bộ nhớ đệm của design-kit: DK_HOME, mặc định ~/.design-kit. */
export const dkCache = (env: Record<string, string | undefined>): string =>
  join(env["DK_HOME"] ?? join(homedir(), ".design-kit"), "impeccable", ENGINE_VERSION, exeName());

export interface ImpFinding {
  antipattern: string;
  name?: string;
  severity?: string;
  category?: string;
  snippet?: string;
  advisory?: boolean;
}

/**
 * Engine Impeccable, theo thứ tự: IMPECCABLE_BIN; bản đi kèm skill impeccable; bộ nhớ đệm của chính Impeccable
 * (~/.impeccable/bin/<ver>); bộ nhớ đệm của design-kit (`design-kit setup` tải về). Không có ⇒ cổng bỏ qua Impeccable.
 */
export function findImpeccable(env: Record<string, string | undefined>): string | undefined {
  const fromEnv = env["IMPECCABLE_BIN"];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const arch = plat() === "windows" ? "x64" : process.arch;
  const candidates = [
    join(homedir(), ".claude", "skills", "impeccable", "scripts", "bin", `${plat()}-${arch}`, exeName()),
    join(env["IMPECCABLE_HOME"] ?? join(homedir(), ".impeccable"), "bin", ENGINE_VERSION, exeName()),
    dkCache(env),
  ];
  return candidates.find((p) => existsSync(p));
}

/** Tải engine ghim về bộ nhớ đệm của design-kit, kiểm sha256 trước khi đặt vào chỗ. */
export async function downloadEngine(env: Record<string, string | undefined>): Promise<{ path: string; bytes: number; url: string }> {
  const asset = engineAsset();
  const want = ENGINE_SHA256[asset];
  if (!want) throw new Error(`no pinned engine for ${asset}: set IMPECCABLE_BIN to an engine binary`);
  const url = `${RELEASES}/engine-v${ENGINE_VERSION}/${asset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = createHash("sha256").update(buf).digest("hex");
  if (got !== want) throw new Error(`checksum mismatch for ${asset}: got ${got.slice(0, 12)}…, pinned ${want.slice(0, 12)}…; nothing was installed`);
  const path = dkCache(env);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, buf);
  if (process.platform !== "win32") chmodSync(`${path}.tmp`, 0o755);
  renameSync(`${path}.tmp`, path);
  return { path, bytes: buf.length, url };
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
