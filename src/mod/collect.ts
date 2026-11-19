// Thu cây vẽ của một mod: đọc manifest và `claude plugin validate`, chép mod sang thư mục tạm (không cài gì lên máy),
// gắn lớp chặn vào test của mod và thêm test chung, rồi chạy `claude plugin test` mỗi ngôn ngữ một lượt.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fail } from "../errors.js";
import { GENERIC_FILE, genericSource, LINE_TAG, rewriteTestImports, SHIM_FILE, shimSource, type GenericTarget } from "./shim.js";
import type { Drawing } from "./tree.js";

export interface ModInfo {
  dir: string;
  name: string;
  version: string;
  /** Component mod hook qua `ui.render`, theo `claude plugin validate`. requestId "?" là id tính lúc chạy. */
  components: Array<{ component: string; requestId?: string }>;
  /** Giá trị của tuỳ chọn `language` (bỏ `auto`); rỗng nếu mod không có tuỳ chọn này. */
  languages: string[];
  /** Tệp test của mod (đường dẫn tương đối). */
  tests: string[];
}

export interface RunResult {
  run: string;
  pass: number;
  fail: number;
  failures: Array<{ test: string; error: string }>;
  ms: number;
  /** Dòng lỗi khi cả lượt không chạy được (validate hỏng, module không nạp…). */
  broken?: string;
}

export const claudeBin = (env: Record<string, string | undefined>): string => env["CLAUDE_BIN"] ?? "claude";

function runSync(bin: string, args: string[]): { status: number | null; out: string; missing: boolean } {
  let r = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
  // Windows: `claude` cài qua npm là claude.cmd, CreateProcess không chạy được tệp .cmd khi không qua shell.
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT" && process.platform === "win32") {
    r = spawnSync(shellLine(bin, args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120_000, shell: true });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    return { status: r.status, out, missing: r.status !== 0 && /is not recognized|not found/i.test(out) && !/Validating/.test(out) };
  }
  const missing = !!r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT";
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, missing };
}

/** Một dòng lệnh cho shell (đường lùi Windows cho claude.cmd): mỗi đối số trong ngoặc kép. */
const shellLine = (bin: string, args: string[]): string => [bin, ...args].map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ");

function findTests(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...findTests(p, base));
    else if (/\.test\.tsx?$/.test(e.name)) out.push(relative(base, p).replace(/\\/g, "/"));
  }
  return out.sort();
}

export function inspectMod(dir: string, env: Record<string, string | undefined>): ModInfo {
  const manifest = join(dir, ".claude-plugin", "plugin.json");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`check-mod: not a folder: ${dir}`, "VALIDATION_ERROR");
  if (!existsSync(manifest)) {
    fail(`check-mod: ${dir} has no .claude-plugin/plugin.json`, "VALIDATION_ERROR", ["Point check-mod at the mod's own folder, the one holding .claude-plugin/ and hooks/"]);
  }
  const m = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string; version?: string; userConfig?: Record<string, { options?: unknown }> };
  const name = m.name ?? basename(dir);
  const bin = claudeBin(env);
  const v = runSync(bin, ["plugin", "validate", dir]);
  if (v.missing) {
    fail(`check-mod: \`${bin}\` not found`, "VALIDATION_ERROR", ["check-mod runs the mod's hooks through Claude Code's own test kit: install Claude Code, or set CLAUDE_BIN to its executable"]);
  }
  if (v.status !== 0) {
    const why = v.out.split(/\r?\n/).filter((l) => /✘|error|Error|fail/i.test(l)).slice(0, 3).join(" | ");
    fail(`check-mod: \`claude plugin validate\` refused ${name}: ${why || `exit ${v.status}`}`, "VALIDATION_ERROR", [`Run \`claude plugin validate ${dir}\` and fix what it reports first`]);
  }
  const components: ModInfo["components"] = [];
  const seen = new Set<string>();
  for (const mm of v.out.matchAll(/ui\.render\{component=(\w+)(?:,\s*requestId=([^}]+))?\}/g)) {
    const key = `${mm[1]}|${mm[2] ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    components.push({ component: mm[1]!, ...(mm[2] ? { requestId: mm[2].trim() } : {}) });
  }
  const opts = m.userConfig?.["language"]?.options;
  const languages = Array.isArray(opts) ? opts.filter((o): o is string => typeof o === "string" && o !== "auto") : [];
  return { dir, name, version: m.version ?? "?", components, languages, tests: findTests(dir) };
}

/** Kết quả `claude plugin test`: các dòng `(pass)`/`(fail)`, dòng lỗi ngay sau `(fail)`. */
export function parseTestOutput(out: string): Omit<RunResult, "run" | "ms"> & { drawings: Drawing[] } {
  const drawings: Drawing[] = [];
  const failures: RunResult["failures"] = [];
  let pass = 0;
  let failN = 0;
  const lines = out.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const at = line.indexOf(LINE_TAG);
    if (at !== -1) {
      try {
        drawings.push(JSON.parse(line.slice(at + LINE_TAG.length)) as Drawing);
      } catch {
        // Dòng bị cắt (stdout quá dài): bỏ, phần còn lại vẫn dùng được.
      }
      continue;
    }
    // Test chung của check-mod không phải test của mod: không đếm.
    if (/^\((pass|fail)\)\s+design-kit generic:/.test(line)) continue;
    if (/^\(pass\)\s/.test(line)) pass++;
    const fm = /^\(fail\)\s+(.*?)(?:\s+\[[\d.]+m?s\])?$/.exec(line);
    if (fm) {
      failN++;
      const next = (lines[i + 1] ?? "").trim();
      failures.push({ test: fm[1]!, error: next.slice(0, 200) });
    }
  }
  return { pass, fail: failN, failures, drawings };
}

export function runAsync(bin: string, args: string[], timeoutMs: number): Promise<{ out: string; code: number | null; missing: boolean }> {
  return new Promise((done) => {
    const go = (shell: boolean) => {
      const chunks: Buffer[] = [];
      // Lần chạy đầu hỏng (ENOENT với claude.cmd trên Windows) vẫn phát "close" một nhịp sau "error". Không chặn thì
      // "close" đó trả kết quả rỗng trước khi lần chạy qua shell xong: cổng báo "pass" mà không test nào chạy.
      let settled = false;
      const p = shell ? spawn(shellLine(bin, args), { shell: true, windowsHide: true }) : spawn(bin, args, { windowsHide: true });
      const timer = setTimeout(() => killTree(p), timeoutMs);
      p.stdout.on("data", (d: Buffer) => chunks.push(d));
      p.stderr.on("data", (d: Buffer) => chunks.push(d));
      p.on("error", (e: NodeJS.ErrnoException) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (e.code === "ENOENT" && !shell && process.platform === "win32") go(true);
        else done({ out: String(e.message), code: null, missing: e.code === "ENOENT" });
      });
      p.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        done({ out: Buffer.concat(chunks).toString("utf8"), code, missing: false });
      });
    };
    go(false);
  });
}

/** Dừng cả cây tiến trình: chạy qua shell thì `kill()` chỉ dừng cmd.exe, claude con vẫn chạy mồ côi. */
function killTree(p: ReturnType<typeof spawn>): void {
  if (process.platform === "win32" && p.pid) spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"], { windowsHide: true });
  else p.kill();
}

export interface CollectOptions {
  widths: number[];
  surfaces: string[];
  /** Lượt ngôn ngữ (ngoài lượt `default`). */
  languages: string[];
  /** false: bỏ test của mod, chỉ chạy cảnh chung. */
  useTests: boolean;
  /** id cho Pane khi validate không biết (requestId=?): mặc định tên mod. */
  paneId?: string;
  env: Record<string, string | undefined>;
  /** Giữ thư mục tạm để xem lại (DK_KEEP=1). */
  keep?: boolean;
}

/** Chép mod, gắn lớp chặn cho một lượt chạy, trả thư mục tạm. */
function prepareCopy(info: ModInfo, cfg: Parameters<typeof shimSource>[0], o: CollectOptions): { root: string; notes: string[] } {
  const notes: string[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "dk-mod-"));
  const root = join(tmp, info.name);
  cpSync(info.dir, root, {
    recursive: true,
    filter: (src) => !relative(info.dir, src).split(/[\\/]/).some((part) => part === "node_modules" || part === ".git"),
  });
  // Lớp chặn đặt cạnh module hook (hooks/), nơi engine chắc chắn biên dịch TypeScript của mod.
  const hooksDir = existsSync(join(root, "hooks")) ? join(root, "hooks") : root;
  writeFileSync(join(hooksDir, SHIM_FILE), shimSource(cfg));
  const importFrom = (fileDir: string) => {
    const rel = relative(fileDir, join(hooksDir, SHIM_FILE.replace(/\.ts$/, ""))).replace(/\\/g, "/");
    return rel.startsWith(".") ? rel : `./${rel}`;
  };
  for (const t of info.tests) {
    const file = join(root, t);
    if (!o.useTests) {
      rmSync(file);
      continue;
    }
    const { source, changed } = rewriteTestImports(readFileSync(file, "utf8"), importFrom(dirname(file)));
    if (changed) writeFileSync(file, source);
    else if (cfg.run === "default") notes.push(`${t}: no value import from claude-code/testing, its mounts are not swept`);
  }
  const targets: GenericTarget[] = info.components.map((c) => ({
    component: c.component,
    ...(c.requestId ? { requestId: c.requestId === "?" ? (o.paneId ?? info.name) : c.requestId } : {}),
  }));
  writeFileSync(join(hooksDir, GENERIC_FILE), genericSource(info.name, targets, importFrom(hooksDir)));
  return { root, notes };
}

export async function collectDrawings(info: ModInfo, o: CollectOptions): Promise<{ drawings: Drawing[]; runs: RunResult[]; notes: string[] }> {
  const bin = claudeBin(o.env);
  const plan: Array<{ run: string; language: string | null; soft: boolean }> = [
    { run: "default", language: null, soft: false },
    ...o.languages.map((l) => ({ run: l, language: l, soft: true })),
  ];
  const notes: string[] = [];
  const results = await Promise.all(
    plan.map(async (p) => {
      const { root, notes: n } = prepareCopy(info, { run: p.run, language: p.language, soft: p.soft, widths: o.widths, surfaces: o.surfaces }, o);
      notes.push(...n);
      const t0 = Date.now();
      const r = await runAsync(bin, ["plugin", "test", root], 600_000);
      const ms = Date.now() - t0;
      if (!o.keep) rmSync(dirname(root), { recursive: true, force: true });
      else notes.push(`kept the copy for run ${p.run}: ${root}`);
      if (r.missing) fail(`check-mod: \`${bin}\` not found`, "VALIDATION_ERROR", ["Install Claude Code, or set CLAUDE_BIN"]);
      const parsed = parseTestOutput(r.out);
      const res: RunResult = { run: p.run, pass: parsed.pass, fail: parsed.fail, failures: parsed.failures, ms };
      if (!parsed.drawings.length && !parsed.pass && !parsed.fail) res.broken = r.out.split(/\r?\n/).filter(Boolean).slice(-3).join(" | ").slice(0, 300) || `no output, exit code ${r.code}`;
      return { res, drawings: parsed.drawings };
    }),
  );
  return { drawings: results.flatMap((r) => r.drawings), runs: results.map((r) => r.res), notes: [...new Set(notes)] };
}
