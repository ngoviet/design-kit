import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fail } from "./errors.js";

/**
 * Engine ghim: phiên bản và sha256 chép từ các tệp <tên>.sha256 của bản phát hành engine-v<phiên bản> (19/11/2026:
 * 0.1.27, ra 18/11/2026; trước đó 0.1.19). Nâng phiên bản: sửa ENGINE_VERSION và bảng dưới theo bản mới.
 */
export const ENGINE_VERSION = "0.1.27";
const ENGINE_SHA256: Record<string, string> = {
  "impeccable-darwin-arm64": "e33578341212fe6ebeed273850b3af0a7f54bbdc5e9fdf03e760aae23482975b",
  "impeccable-darwin-x64": "3ecf11185ad7ea05cfc693ef969eb75ee7aef63f45472bf884e9b9f896a8d052",
  "impeccable-linux-x64": "41d66e945bcdfc560005b61ad0b6b2312b124890039262f2e63322ef2709ccfd",
  "impeccable-linux-arm64": "6ceb6188c80adb4b4fcc0721e677e2124d795b8e243599ad0d7bea33369b2c9c",
  "impeccable-windows-x64.exe": "ba9627d4552bca5666020624d8e994aea8b8b44c46b995e18b5babad0f431fc8",
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
/** Bộ nhớ đệm của design-kit: DK_HOME, mặc định ~/.design-kit (biến rỗng coi như không đặt, không thì thành đường dẫn theo cwd). */
export const dkCache = (env: Record<string, string | undefined>): string =>
  join(env["DK_HOME"] || join(homedir(), ".design-kit"), "impeccable", ENGINE_VERSION, exeName());

export interface ImpFinding {
  antipattern: string;
  name?: string;
  severity?: string;
  category?: string;
  snippet?: string;
  advisory?: boolean;
}

/**
 * Engine Impeccable, theo thứ tự: IMPECCABLE_BIN; bản đã ghim (bộ nhớ đệm của chính Impeccable ~/.impeccable/bin/<ver>,
 * rồi của design-kit, `design-kit setup` tải về và kiểm sha256); cuối cùng bản đi kèm skill impeccable. Trước 19/11/2026
 * bản của skill đứng trước, nên nâng ghim không có tác dụng trên máy đã cài skill (PC1 chạy engine của skill 4.8.1).
 * Không có ⇒ cổng bỏ qua Impeccable. IMPECCABLE_BIN trỏ tệp không có ⇒ báo lỗi như DK_BROWSER, không lặng lẽ dùng engine khác.
 */
export function findImpeccable(env: Record<string, string | undefined>): string | undefined {
  const fromEnv = env["IMPECCABLE_BIN"];
  if (fromEnv) {
    if (!existsSync(fromEnv)) fail(`IMPECCABLE_BIN does not exist: ${fromEnv}`, "VALIDATION_ERROR", ["Unset IMPECCABLE_BIN or point it at an engine binary"]);
    return fromEnv;
  }
  const arch = plat() === "windows" ? "x64" : process.arch;
  const candidates = [
    join(env["IMPECCABLE_HOME"] || join(homedir(), ".impeccable"), "bin", ENGINE_VERSION, exeName()),
    dkCache(env),
    join(homedir(), ".claude", "skills", "impeccable", "scripts", "bin", `${plat()}-${arch}`, exeName()),
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
  const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
  const got = sha256(buf);
  if (got !== want) throw new Error(`checksum mismatch for ${asset}: got ${got.slice(0, 12)}…, pinned ${want.slice(0, 12)}…; nothing was installed`);
  const path = dkCache(env);
  mkdirSync(dirname(path), { recursive: true });
  // Tên riêng mỗi tiến trình: hai setup chạy cùng lúc dùng chung một tệp .tmp thì setup sau mất tệp trước khi đổi tên.
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, buf);
    if (process.platform !== "win32") chmodSync(tmp, 0o755);
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    // Windows không cho thay tệp exe đang chạy (EPERM). Tệp tại chỗ đã đúng bản ghim thì không cần thay.
    if (!existsSync(path) || sha256(readFileSync(path)) !== want) throw e;
  }
  return { path, bytes: buf.length, url };
}

/**
 * `detect --json --viewport WxH <url>`. Engine exit 2 = có phát hiện (không phải lỗi); exit 1 = không quét được. Mã lạ (hỏng giữa
 * chừng, bị giết) kèm `[]` không phải trang sạch.
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
        if (code !== 0 && code !== 2 && parsed.length === 0) return done({ error: (err.trim().split("\n").pop() || (code === 1 ? "scan failed" : `exit ${code} with no findings`)).slice(0, 200) });
        done({ findings: parsed });
      } catch {
        done({ error: `exit ${code}: ${(err.trim().split("\n").pop() || "no JSON").slice(0, 200)}` });
      }
    });
  });
}
