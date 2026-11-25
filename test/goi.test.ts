import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
    // Trang phải có thật: tệp đã xoá hay đổi tên thì hook bỏ qua.
    const page = join(tmp, "a.html");
    writeFileSync(page, "<p>trang</p>");
    const tr = join(tmp, "t1.jsonl");
    writeFileSync(tr, [bash("design-kit check a.html"), edit("e1", page)].join("\n"));
    const s = sid();
    const out = JSON.parse(runHook({ hook_event_name: "Stop", session_id: s, transcript_path: tr }));
    expect(out.decision).toBe("block");
    expect(out.reason).toContain("a.html");
    // Cùng lần sửa: không chặn lần nữa; đang tiếp tục vì hook: không chặn
    expect(runHook({ hook_event_name: "Stop", session_id: s, transcript_path: tr })).toBe("");
    expect(runHook({ hook_event_name: "Stop", session_id: sid(), transcript_path: tr, stop_hook_active: true })).toBe("");
    // Đã chạy cổng sau lần sửa: không chặn
    const tr2 = join(tmp, "t2.jsonl");
    writeFileSync(tr2, [edit("e2", page), bash("node dist/bin/design-kit.js check a.html --strict")].join("\n"));
    expect(runHook({ hook_event_name: "Stop", session_id: sid(), transcript_path: tr2 })).toBe("");
    // Chỉ nhắc tới lệnh (grep, lời commit) không phải đã chạy cổng (19/11/2026).
    const tr3 = join(tmp, "t3.jsonl");
    writeFileSync(tr3, [edit("e3", page), bash('grep -n "design-kit check a.html" README.md'), bash("echo nho chay design-kit check a.html")].join("\n"));
    expect(JSON.parse(runHook({ hook_event_name: "Stop", session_id: sid(), transcript_path: tr3 })).decision).toBe("block");
    const tr4 = join(tmp, "t4.jsonl");
    writeFileSync(tr4, [edit("e4", page), bash(`cd x && npx design-kit check a.html; node "${root.replace(/\\/g, "/")}/dist/bin/design-kit.js" check a.html`)].join("\n"));
    expect(runHook({ hook_event_name: "Stop", session_id: sid(), transcript_path: tr4 })).toBe("");
  });

  it("counts every real way of running the gate, and no mention inside quotes or a heredoc", () => {
    // Bảng lệnh của reviewer độc lập (19/11/2026). Sửa .css (không phải .html) để chỉ còn phép dò "đã chạy cổng".
    const line = (content: unknown[]) => JSON.stringify({ type: "assistant", message: { content } });
    const edit = (id: string, file: string) => line([{ type: "tool_use", id, name: "Edit", input: { file_path: file } }]);
    const bash = (cmd: string) => line([{ type: "tool_use", id: "b", name: "Bash", input: { command: cmd } }]);
    const css = join(tmp, "kieu-hook.css");
    writeFileSync(css, "p{color:#111}");
    const stopAfter = (cmd: string) => {
      const tr = join(tmp, `${sid()}.jsonl`);
      writeFileSync(tr, [edit("e", css), bash(cmd)].join("\n"));
      const out = runHook({ hook_event_name: "Stop", session_id: sid(), transcript_path: tr });
      return out ? (JSON.parse(out) as { decision: string }).decision : "allow";
    };
    const runs = [
      "npm exec design-kit check a.html", "npm exec -- design-kit check a.html", "pnpm exec design-kit check a.html",
      "npx -y design-kit@latest check a.html", "FORCE_COLOR=0 design-kit check a.html", "timeout 600 design-kit check a.html",
      " design-kit check a.html", "if design-kit check a.html; then echo ok; fi", "for f in *.html; do design-kit check $f; done",
      "foreach ($f in $x) { design-kit check $f }", "cmd /c design-kit check a.html", "design-kit.cmd check a.html",
      "node --no-warnings dist/bin/design-kit.js check a.html", 'node "D:/my code/dist/bin/design-kit.js" check a.html',
      "& design-kit check a.html", "npx --yes design-kit check a.html", "node .\\dist\\bin\\design-kit.js check a.html",
    ];
    for (const c of runs) expect([c, stopAfter(c)]).toEqual([c, "allow"]);
    const mentions = [
      'git commit -m "fix: a.html; design-kit check a.html passes"', 'rg "check-image|design-kit check a.html" docs',
      'echo "(design-kit check a.html)"', "git commit -F - <<EOF\nsửa\ndesign-kit check a.html --strict: pass\nEOF",
      "echo nho chay design-kit check a.html",
    ];
    for (const c of mentions) expect([c, stopAfter(c)]).toEqual([c, "block"]);
  });

  describe("which page a gate run covers", () => {
    const line = (content: unknown[]) => JSON.stringify({ type: "assistant", message: { content } });
    const proj = mkdtempSync(join(tmpdir(), "dk-trang-"));
    const page = join(proj, "app", "index.html");
    const css = join(proj, "app", "a.css");
    beforeAll(() => {
      for (const f of [page, css, join(proj, "app", "other.html"), join(proj, "khac", "x.html"), join(proj, "khac", "index.html"), join(proj, "du an", "trang chu.html")]) {
        mkdirSync(dirname(f), { recursive: true });
        writeFileSync(f, "x");
      }
    });
    const stopAfter = (cmd: string, file = page) => {
      const tr = join(tmp, `${sid()}.jsonl`);
      writeFileSync(tr, [line([{ type: "tool_use", id: "e", name: "Edit", input: { file_path: file } }]), line([{ type: "tool_use", id: "b", name: "Bash", input: { command: cmd } }])].join("\n"));
      const out = runHook({ hook_event_name: "Stop", session_id: sid(), cwd: proj, transcript_path: tr });
      return out ? (JSON.parse(out) as { decision: string }).decision : "allow";
    };

    // Trước 25/11/2026 hook quét mọi từ của cả lệnh: đối số của cd, ls, giá trị cờ, URL của lệnh khác đều tính là trang đã kiểm.
    it.each([
      "cd app && design-kit check other.html --strict", "design-kit check khac/x.html --shots app", "ls app; design-kit check khac/x.html",
      "design-kit check khac/x.html && start app/index.html", "curl -s http://localhost:3000; design-kit check khac/x.html",
      "cd app; design-kit check --help", "design-kit check app/index.html --help", "cd khac && design-kit check index.html",
      "design-kit check khac/*.html", 'design-kit check "$PWD/khac/x.html"', "design-kit check $ROOT/khac/x.html", "design-kit check khac/x.html > app/index.html",
      "cd app; for f in other.html; do design-kit check $f; done",
    ])("blocks: %s", (c) => expect(stopAfter(c)).toBe("block"));

    it.each([
      "design-kit check app/*.html --strict", "design-kit check **/*.html", "design-kit check app/{index,other}.html", "cd app && design-kit check *.html", "(cd khac && ls); design-kit check app/*.html",
      "env FORCE_COLOR=0 design-kit check app/index.html", "env -u CI $BO A=1 design-kit check app/index.html", "if ! design-kit check app/index.html --strict; then echo hong; fi", "! design-kit check app/index.html",
      'design-kit check "$PWD/app/index.html" --strict', 'design-kit check "${PWD}/app"', 'design-kit check "$(pwd)/app/index.html"', 'design-kit check "$ROOT/app/index.html"',
      "design-kit check --shots out app/index.html", "design-kit check khac/x.html app", "design-kit check khac/x.html; design-kit check app/index.html",
      "cd app && design-kit check index.html", "(cd khac && ls); design-kit check app/index.html", "cd khac && design-kit check ../app/index.html",
      "design-kit check \\\n  app/index.html --strict", "design-kit check app/index.html --strict 2>&1 | tail -20", "design-kit check --strict > ra.txt app/index.html",
      'for f in app/index.html khac/x.html; do design-kit check "$f"; done', 'F=app/index.html; design-kit check "$F"', 'chay() { design-kit check "$@" --strict; }; chay app/index.html',
      'design-kit check "http://localhost:3000/a?x=1&y=2" --strict', "U=http://localhost:3000; design-kit check $U",
    ])("allows: %s", (c) => expect(stopAfter(c)).toBe("allow"));

    // Soát lại bản sửa 25/11/2026.
    it.each([
      ["design-kit check app/index.html # --help", "allow"], ["design-kit check khac/x.html # app/index.html", "block"],
      ['DIR=khac; design-kit check "$DIR/index.html"', "block"], ['DIR=app; design-kit check "$DIR/index.html"', "allow"], ["$d = 'khac'; design-kit check \"$d/index.html\"", "block"],
      ['cd "$ROOT/app" && design-kit check index.html', "allow"], ["cd app; (cd ../khac; ls); design-kit check index.html", "allow"], ['cd khac; cd "$ROOT/app" && design-kit check index.html', "allow"],
    ])("%s: %s", (c, want) => expect(stopAfter(c)).toBe(want));
    it("stays fast on heavy sessions: the hook is killed after 10 s and then blocks nothing", () => {
      for (const c of [`${"env a=b ".repeat(20000)}`, `${"x=1 ".repeat(3000)}\n${'design-kit check "$f"\n'.repeat(300)}`]) {
        const t0 = Date.now();
        expect(stopAfter(c)).toBe("block");
        expect(Date.now() - t0).toBeLessThan(5000);
      }
      const pages = Array.from({ length: 30 }, (_, i) => join(proj, "nhieu", `t${i}.html`));
      mkdirSync(join(proj, "nhieu"), { recursive: true });
      for (const p of pages) writeFileSync(p, "x");
      const cmd = `${Array.from({ length: 60 }, (_, i) => `echo a${i} b${i} c${i} d${i} e${i} f${i} g${i} h${i} i${i}`).join("\n")}\nfor f in dist/*.html; do design-kit check "$f"; done`;
      const tr = join(tmp, `${sid()}.jsonl`);
      writeFileSync(tr, [...pages.map((p, i) => line([{ type: "tool_use", id: `e${i}`, name: "Edit", input: { file_path: p } }])), ...Array.from({ length: 20 }, (_, i) => line([{ type: "tool_use", id: `b${i}`, name: "Bash", input: { command: cmd } }]))].join("\n"));
      const t0 = Date.now();
      expect(runHook({ hook_event_name: "Stop", session_id: sid(), cwd: proj, transcript_path: tr })).toContain("block");
      expect(Date.now() - t0).toBeLessThan(5000);
    });

    it("--help does not count as a run for a source file either, and env or ! in front of the gate does", () => {
      expect(stopAfter("design-kit check --help", css)).toBe("block");
      expect(stopAfter("env FORCE_COLOR=0 design-kit check khac/x.html", css)).toBe("allow");
      expect(stopAfter("design-kit check --help; design-kit check khac/x.html", css)).toBe("allow");
    });
    it("check-image covers what it was given, not what other commands name", () => {
      const icon = join(proj, "icons", "nha.svg");
      mkdirSync(dirname(icon), { recursive: true });
      writeFileSync(icon, "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'/>");
      for (const c of ["ls icons; design-kit check-image khac/a.svg", "design-kit check-image khac --shots icons", "design-kit check-image icons --help"]) expect([c, stopAfter(c, icon)]).toEqual([c, "block"]);
      for (const c of ["design-kit check-image icons/*.svg", "design-kit check-image --kind icon icons"]) expect([c, stopAfter(c, icon)]).toEqual([c, "allow"]);
    });
    it("the command the reminder suggests runs as written, also with spaces in the path", () => {
      const file = join(proj, "du an", "trang chu.html");
      const ctx = JSON.parse(runHook({ hook_event_name: "PostToolUse", session_id: sid(), cwd: proj, tool_input: { file_path: file } })).hookSpecificOutput.additionalContext as string;
      expect(ctx).toContain('`design-kit check "du an/trang chu.html" --strict`');
      expect(stopAfter('design-kit check "du an/trang chu.html" --strict', file)).toBe("allow");
      const img = JSON.parse(runHook({ hook_event_name: "PostToolUse", session_id: sid(), cwd: proj, tool_input: { file_path: join(proj, "du an", "logo.svg") } })).hookSpecificOutput.additionalContext as string;
      expect(img).toContain('design-kit check-image "du an/logo.svg" --strict');
    });
  });

  it("a project inside a folder named build or dist is still a UI project", () => {
    const proj = join(tmp, "build", "shop");
    const ctx = runHook({ hook_event_name: "PostToolUse", session_id: sid(), cwd: proj, tool_input: { file_path: join(proj, "index.html") } });
    expect(ctx).toContain("design-kit check index.html --strict");
    // Còn trong dự án thì dist/ vẫn bị bỏ qua.
    expect(runHook({ hook_event_name: "PostToolUse", session_id: sid(), cwd: proj, tool_input: { file_path: join(proj, "dist", "index.html") } })).toBe("");
    // cwd của phiên nằm ngay trong test/fixtures của repo: fixture vẫn bị bỏ qua (xét theo gốc repo git).
    const fx = join(root, "test", "fixtures");
    expect(runHook({ hook_event_name: "PostToolUse", session_id: sid(), cwd: fx, tool_input: { file_path: join(fx, "tot.html") } })).toBe("");
  });
});

describe("plugin hook: logos, icons and illustrations", () => {
  const line = (content: unknown[]) => JSON.stringify({ type: "assistant", message: { content } });
  const edit = (id: string, file: string) => line([{ type: "tool_use", id, name: "Edit", input: { file_path: file } }]);
  const bash = (id: string, cmd: string) => line([{ type: "tool_use", id, name: "Bash", input: { command: cmd } }]);

  it("reminds to run check-image on a logo or icon, not on any picture, and keeps its own 15-minute rhythm", () => {
    const s = sid();
    const ctx = (file: string) => {
      const out = runHook({ hook_event_name: "PostToolUse", session_id: s, cwd: tmp, tool_input: { file_path: file } });
      return out ? (JSON.parse(out).hookSpecificOutput.additionalContext as string) : "";
    };
    expect(ctx(join(tmp, "anh", "chup-man-hinh.png"))).toBe("");
    expect(ctx(join(tmp, "brand", "logo.svg"))).toContain("design-kit check-image brand/logo.svg --strict");
    expect(ctx(join(tmp, "icons", "nha.svg"))).toBe(""); // trong 15 phút
    // Nhịp riêng: sửa trang ngay sau đó vẫn được nhắc chạy cổng trang.
    expect(ctx(join(tmp, "trang.html"))).toContain("design-kit check trang.html --strict");
  });

  it("Stop wants check-image on the file or its folder; a page gate or check-image does not stand in for the other", () => {
    const dir = join(tmp, "icons");
    mkdirSync(dir, { recursive: true });
    const icon = join(dir, "icon-nha.svg");
    writeFileSync(icon, "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'/>");
    const page = join(tmp, "b.tsx");
    writeFileSync(page, "export {}");
    const stop = (lines: string[]) => {
      const tr = join(tmp, `${sid()}.jsonl`);
      writeFileSync(tr, lines.join("\n"));
      const out = runHook({ hook_event_name: "Stop", session_id: sid(), cwd: tmp, transcript_path: tr });
      return out ? (JSON.parse(out) as { decision: string; reason: string }) : undefined;
    };
    const r = stop([edit("e1", icon), bash("b1", "design-kit check page.html --strict")]);
    expect(r?.decision).toBe("block");
    expect(r?.reason).toContain("design-kit check-image");
    expect(stop([edit("e1", icon), bash("b1", "design-kit check-image icons/icon-nha.svg --strict")])).toBeUndefined();
    expect(stop([edit("e1", icon), bash("b1", "node dist/bin/design-kit.js check-image icons --strict")])).toBeUndefined();
    // `check-image` không còn khớp nhầm cổng trang (`check\b` khớp cả "check-image").
    expect(stop([edit("e2", page), bash("b2", "design-kit check-image icons")])?.reason).toContain("b.tsx");
    // Tên gần giống ở thư mục khác không phủ tệp này (trước 19/11/2026 so chuỗi con: "footer-icon-nha.svg" chứa "icon-nha.svg").
    expect(stop([edit("e3", icon), bash("b3", "design-kit check-image old/footer-icon-nha.svg")])?.decision).toBe("block");
    expect(stop([edit("e3", icon), bash("b3", "design-kit check-image khac/icons")])?.decision).toBe("block");
    // Tên trơn (chạy sau khi cd vào thư mục) vẫn tính.
    expect(stop([edit("e4", icon), bash("b4", "cd icons && design-kit check-image icon-nha.svg")])).toBeUndefined();
    // Đường dẫn tương đối sau cd, và đường dẫn có dấu cách trong nháy.
    const sau = join(tmp, "nhom anh", "logos");
    mkdirSync(sau, { recursive: true });
    const logo = join(sau, "logo-moi.svg");
    writeFileSync(logo, "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'/>");
    expect(stop([edit("e5", logo), bash("b5", 'cd "nhom anh" && design-kit check-image logos/logo-moi.svg')])).toBeUndefined();
    expect(stop([edit("e6", logo), bash("b6", 'design-kit check-image "nhom anh/logos" --strict')])).toBeUndefined();
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

describe("plugin hook: Claude Code mods", () => {
  // Repo giả có một mod (plugin có hooks/hooks.json, giao diện .tsx trong hooks/ vẽ bằng ui.render) và tools/check.sh.
  const repo = mkdtempSync(join(tmpdir(), "dk-mod-"));
  const mod = join(repo, "plugins", "khung-mod");
  const khung = join(mod, "hooks", "khung.tsx");
  beforeAll(() => {
    const put = (file: string, text: string) => {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    };
    put(join(mod, ".claude-plugin", "plugin.json"), '{ "name": "khung-mod" }');
    put(join(mod, "hooks", "hooks.json"), '{ "modules": ["./register.tsx"] }');
    put(khung, "export const Khung = () => null;");
    put(join(mod, "hooks", "lib", "phu.tsx"), "export const Phu = () => null;");
    put(join(repo, "tools", "check.sh"), "#!/bin/bash\n");
    for (const args of [["init", "-q"], ["config", "user.email", "t@example.invalid"], ["config", "user.name", "t"], ["add", "."], ["commit", "-q", "-m", "init"]]) {
      const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(r.status, r.stderr).toBe(0);
    }
  });

  const remind = (file: string, s = sid()) => {
    const out = runHook({ hook_event_name: "PostToolUse", session_id: s, cwd: repo, tool_input: { file_path: file } });
    return out ? (JSON.parse(out).hookSpecificOutput.additionalContext as string) : "";
  };
  const iso = (ms: number) => new Date(ms).toISOString();
  const t0 = Date.now() - 120_000; // lúc phiên bắt đầu
  const use = (id: string, name: string, input: Record<string, unknown>, at: number) =>
    JSON.stringify({ type: "assistant", timestamp: iso(at), message: { content: [{ type: "tool_use", id, name, input }] } });
  const result = (id: string, at: number) =>
    JSON.stringify({ type: "user", timestamp: iso(at), message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] } });
  const stop = (lines: string[]) => {
    const tr = join(repo, "t.jsonl");
    writeFileSync(tr, [JSON.stringify({ type: "user", timestamp: iso(t0), message: { content: "sửa mod" } }), ...lines].join("\n"));
    const out = runHook({ hook_event_name: "Stop", session_id: sid(), transcript_path: tr, cwd: repo });
    return out ? (JSON.parse(out) as { decision: string; reason: string }) : undefined;
  };

  it("reminds to run claude plugin test on the mod, not the web gate, and keeps web reminders apart", () => {
    const s = sid();
    const ctx = remind(join(mod, "hooks", "lib", "phu.tsx"), s);
    expect(ctx).toContain("mod Claude Code plugins/khung-mod");
    expect(ctx).toContain("claude plugin validate plugins/khung-mod");
    expect(ctx).toContain("claude plugin test plugins/khung-mod");
    expect(ctx).toContain("bash tools/check.sh");
    expect(ctx).toContain("ui.drawn()");
    expect(ctx).toContain("Bản đồ tác vụ chỉ cần khi thêm màn hay khung mới");
    expect(ctx).not.toContain("dist/*.html");
    // Cùng phiên: mod nhắc rồi thì im 15 phút, nhưng trang web sửa ngay sau vẫn được nhắc.
    expect(remind(khung, s)).toBe("");
    expect(remind(join(repo, "web", "trang.html"), s)).toContain("design-kit check web/trang.html --strict");
    // Plugin có hooks/hooks.json nhưng tệp nằm ngoài hooks/ (như khối mẫu của chính design-kit): giao diện web.
    expect(remind(join(root, "blocks", "react", "src", "App.tsx"))).toContain("dist/*.html");
  });

  it("Stop wants claude plugin test on the mod or a parent folder, or the repo's check.sh, after the edit", () => {
    const edit = use("e1", "Edit", { file_path: khung }, t0 + 1000);
    const after = (cmd: string, name = "Bash") => [edit, use("c", name, { command: cmd }, t0 + 2000), result("c", t0 + 3000)];
    const blocked = stop([edit]);
    expect(blocked?.decision).toBe("block");
    expect(blocked?.reason).toContain("plugins/khung-mod/hooks/khung.tsx");
    expect(blocked?.reason).toContain("claude plugin test plugins/khung-mod");
    expect(blocked?.reason).not.toContain("Chạy cổng");
    // Đủ: thư mục mod, thư mục cha, đường dẫn tuyệt đối, cd rồi chạy không nêu thư mục, vòng lặp có biến, check.sh.
    expect(stop(after("claude plugin test plugins/khung-mod 2>&1 | tail -5"))).toBeUndefined();
    expect(stop(after("claude plugin test plugins"))).toBeUndefined();
    expect(stop(after(`claude plugin test "${repo}"`, "PowerShell"))).toBeUndefined();
    expect(stop(after("cd plugins/khung-mod && claude plugin test"))).toBeUndefined();
    expect(stop(after('for m in khung-mod; do claude plugin test "plugins/$m"; done'))).toBeUndefined();
    expect(stop(after("bash tools/check.sh"))).toBeUndefined();
    // Cổng mod của chính design-kit chạy plugin test trên mod: cũng đủ (trước 19/11/2026 bị chặn nhầm).
    expect(stop(after("design-kit check-mod plugins/khung-mod --strict"))).toBeUndefined();
    expect(stop(after("design-kit check-mod plugins/mod-khac"))?.decision).toBe("block");
    // Cờ có giá trị đứng trước thư mục mod: giá trị đó không phải thư mục mod.
    expect(stop(after("design-kit check-mod --shots out plugins/khung-mod --strict"))).toBeUndefined();
    expect(stop(after("design-kit check-mod --widths 60,100 plugins/khung-mod"))).toBeUndefined();
    if (process.platform === "win32") {
      // Git Bash viết C:\x thành /c/x.
      const gitBash = mod.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d: string) => `/${d.toLowerCase()}`);
      expect(stop(after(`claude plugin test ${gitBash}`))).toBeUndefined();
    }
    // Chưa đủ: mod khác, chỉ in trợ giúp, cổng web, chỉ đọc check.sh, test chạy trước lần sửa.
    expect(stop(after("claude plugin test plugins/mod-khac"))?.decision).toBe("block");
    expect(stop(after("claude plugin test --help"))?.decision).toBe("block");
    expect(stop(after("design-kit check web --strict"))?.decision).toBe("block");
    expect(stop(after("cat tools/check.sh"))?.decision).toBe("block");
    expect(stop([use("c", "Bash", { command: "claude plugin test plugins/khung-mod" }, t0 + 500), result("c", t0 + 800), edit])?.decision).toBe("block");
  });

  it("naming the mod's check in a commit message or a grep is not running it", () => {
    // Trước 25/11/2026 chỉ lệnh design-kit check phải đứng đầu đoạn lệnh; claude plugin test và tools/check.sh còn so chuỗi thô.
    const edit = use("e1", "Edit", { file_path: khung }, t0 + 1000);
    const after = (cmd: string) => stop([edit, use("c", "Bash", { command: cmd }, t0 + 2000), result("c", t0 + 3000)])?.decision ?? "allow";
    for (const c of [
      'git commit -m "todo: chua chay claude plugin test"', 'grep -r "claude plugin test" docs', "grep -rn 'x; claude plugin test plugins' docs",
      "git commit -F - <<EOF\nclaude plugin test plugins/khung-mod\nEOF", 'echo "bash tools/check.sh"', "echo bash tools/check.sh", 'grep -n "bash tools/check.sh" README.md',
      'git commit -m "x; design-kit check-mod plugins/khung-mod"', "echo chay claude plugin test plugins/khung-mod",
    ]) expect([c, after(c)]).toEqual([c, "block"]);
    for (const c of [
      "FORCE_COLOR=0 claude plugin test plugins/khung-mod", "timeout 600 claude plugin test plugins/khung-mod", "env A=1 claude plugin test plugins/khung-mod", "if ! claude plugin test plugins; then exit 1; fi",
      "$ra = claude plugin test plugins/khung-mod", "RA=$(claude plugin test plugins/khung-mod 2>&1)", "~/.local/bin/claude.exe plugin test plugins/khung-mod", "cd plugins && claude plugin test ./khung-mod",
      "claude plugin test 'plugins/khung-mod'", "claude plugin validate plugins && claude plugin test \\\n plugins/khung-mod",
      "cd . && ./tools/check.sh", 'bash "tools/check.sh"', 'bash "$ROOT/tools/check.sh"', "set -o pipefail; sh ./tools/check.sh 2>&1 | tail -5",
    ]) expect([c, after(c)]).toEqual([c, "allow"]);
  });

  it("suggests a command that runs when the mod's path has spaces, and accepts it", () => {
    const r = mkdtempSync(join(tmpdir(), "dk-mod-"));
    const m = join(r, "mod cua toi");
    for (const [f, text] of [[join(m, ".claude-plugin", "plugin.json"), "{}"], [join(m, "hooks", "hooks.json"), "{}"], [join(m, "hooks", "ui.tsx"), "export {}"], [join(r, ".git", "x"), ""]] as const) {
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, text);
    }
    const file = join(m, "hooks", "ui.tsx");
    const ctx = JSON.parse(runHook({ hook_event_name: "PostToolUse", session_id: sid(), cwd: r, tool_input: { file_path: file } })).hookSpecificOutput.additionalContext as string;
    expect(ctx).toContain('`claude plugin test "mod cua toi"`');
    const stopIn = (lines: string[]) => {
      writeFileSync(join(r, "t.jsonl"), lines.join("\n"));
      const out = runHook({ hook_event_name: "Stop", session_id: sid(), transcript_path: join(r, "t.jsonl"), cwd: r });
      return out ? (JSON.parse(out) as { reason: string }).reason : "";
    };
    const edit = use("e", "Edit", { file_path: file }, t0 + 1000);
    expect(stopIn([edit])).toContain('`claude plugin test "mod cua toi"`');
    expect(stopIn([edit, use("c", "Bash", { command: 'claude plugin test "mod cua toi"' }, t0 + 2000)])).toBe("");
  });

  it("Stop skips files that no longer exist and sees mod files changed through the shell", () => {
    // Sửa ở thư mục cũ rồi đổi tên mod: tệp cũ không còn, không nêu, không chặn.
    const gone = use("e0", "Write", { file_path: join(repo, "plugins", "ten-cu", "hooks", "pane.tsx") }, t0 + 1000);
    const mv = use("m", "Bash", { command: "git mv plugins/ten-cu plugins/khung-mod" }, t0 + 1500);
    expect(stop([gone, mv])).toBeUndefined();
    // Sửa qua shell (không có Edit trong transcript): git thấy tệp đổi, cần plugin test xong sau lần sửa.
    writeFileSync(khung, "export const Khung = () => 'mới';");
    const edited = statSync(khung).mtimeMs;
    const sed = [gone, mv, use("s", "Bash", { command: "node sua.mjs" }, edited - 500), result("s", edited - 400)];
    const blocked = stop(sed);
    expect(blocked?.reason).toContain("plugins/khung-mod/hooks/khung.tsx");
    expect(blocked?.reason).not.toContain("ten-cu");
    expect(stop([...sed, use("c", "Bash", { command: "claude plugin test plugins/khung-mod" }, edited + 500), result("c", edited + 2000)])).toBeUndefined();
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

  // Engine giả: fetch trả chữ "engine", sha256 của đúng chữ đó được coi là bản ghim. Không tải gì, không đụng ~/.design-kit.
  const PIN = /^ {2}"(impeccable-[^"]+)": "([0-9a-f]{64})"/gm;
  const fakeEngine = async (fsOver: (real: typeof import("node:fs")) => Partial<typeof import("node:fs")>) => {
    const pins = new Map([...readFileSync(join(root, "src", "impeccable.ts"), "utf8").matchAll(PIN)].map((m) => [m[1]!, m[2]!]));
    vi.stubGlobal("fetch", async () => new Response("engine"));
    vi.resetModules();
    vi.doMock("node:crypto", async (orig) => ({
      ...(await orig<typeof import("node:crypto")>()),
      createHash: () => {
        let text = "";
        const h = { update: (b: Buffer) => ((text += b.toString()), h), digest: () => (text === "engine" ? pins.get(engineAsset()) : "0".repeat(64)) };
        return h;
      },
    }));
    vi.doMock("node:fs", async (orig) => {
      const real = await orig<typeof import("node:fs")>();
      return { ...real, ...fsOver(real) };
    });
    try {
      return await import("../src/impeccable.js");
    } finally {
      vi.doUnmock("node:crypto");
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  };
  const home = () => ({ DK_HOME: mkdtempSync(join(tmpdir(), "dk-engine-")) });

  it("two setups at the same time do not take each other's temporary file (25/11/2026)", async () => {
    const env = home();
    // Ngay sau khi setup này ghi tệp tạm, một setup khác (mã tiến trình khác, cùng mã) ghi tệp tạm của nó rồi đổi tên.
    const m = await fakeEngine((real) => ({
      writeFileSync: ((p: string, data: Buffer) => {
        real.writeFileSync(p, data);
        const other = p.replaceAll(String(process.pid), "1");
        real.writeFileSync(other, data);
        real.renameSync(other, dkCache(env));
      }) as typeof writeFileSync,
    }));
    await m.downloadEngine(env);
    expect(readFileSync(dkCache(env), "utf8")).toBe("engine");
    expect(readdirSync(dirname(dkCache(env)))).toHaveLength(1);
  });
  it.each([["already the pinned one", "engine"], ["something else", "engine cũ"], ["missing", undefined]])("an engine that cannot be replaced (running on Windows): %s", async (_n, there) => {
    const env = home();
    if (there !== undefined) {
      mkdirSync(dirname(dkCache(env)), { recursive: true });
      writeFileSync(dkCache(env), there);
    }
    const m = await fakeEngine(() => ({
      renameSync: () => {
        throw Object.assign(new Error("EPERM: operation not permitted, rename"), { code: "EPERM" });
      },
    }));
    if (there === "engine") expect((await m.downloadEngine(env)).path).toBe(dkCache(env));
    else await expect(m.downloadEngine(env)).rejects.toThrow(/EPERM/);
    // Không để lại tệp tạm 20 MB.
    expect(readdirSync(dirname(dkCache(env)))).toHaveLength(there === undefined ? 0 : 1);
  });
});

describe("paths in home and setup (25/11/2026)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const show = async (argv: string[], env: Record<string, string | undefined>, home: string) => {
    let out = "";
    const prev = process.exitCode;
    await main({ argv, stdout: { write: (c: string) => (out += c) }, runtime: { env: { ...process.env, ...env }, home, cwd: tmp } });
    process.exitCode = prev;
    return /^impeccable: (.*)$/m.exec(out)?.[1]?.replace(/^"|"$/g, "") ?? out;
  };
  it("~ stands for the home folder only, not for a folder whose name starts like it", async () => {
    const at = (name: string) => {
      const f = join(tmp, name, "imp");
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, "");
      return f;
    };
    const nha = join(tmp, "Vok");
    // os.homedir() đọc USERPROFILE (Windows) hay HOME: setup không lấy thư mục nhà từ runtime.
    vi.stubEnv("USERPROFILE", nha);
    vi.stubEnv("HOME", nha);
    const mine = at("Vok");
    const other = at("Vokupt");
    for (const argv of [["home"], ["setup", "--no-browser"]]) {
      expect([argv[0], await show(argv, { IMPECCABLE_BIN: mine }, nha)]).toEqual([argv[0], expect.stringMatching(/~\/imp$/)]);
      expect([argv[0], await show(argv, { IMPECCABLE_BIN: other }, nha)]).toEqual([argv[0], expect.stringMatching(/Vokupt/)]);
    }
    expect(await show(["home"], { IMPECCABLE_BIN: mine }, nha + "/")).toBe("~/imp");
  });
  it("the copy command quotes a kit path with a space in it", async () => {
    const help = async (name: string) => {
      const kit = join(mkdtempSync(join(tmpdir(), "dk-kit-")), name);
      mkdirSync(join(kit, "tokens"), { recursive: true });
      writeFileSync(join(kit, "tokens", "core.css"), "");
      vi.resetModules();
      vi.doMock("node:url", async (orig) => ({ ...(await orig<typeof import("node:url")>()), fileURLToPath: () => join(kit, "src", "commands", "home.ts") }));
      try {
        const { homeView } = await import("../src/commands/home.js");
        const v = await homeView([], { env: {}, home: tmp, cwd: kit });
        return [(v["help"] as string[]).find((h) => h.startsWith("Copy a direction: "))!.slice(18), kit.replace(/\\/g, "/")];
      } finally {
        vi.doUnmock("node:url");
        vi.resetModules();
      }
    };
    const [a, kitA] = await help("bộ kit (2)");
    expect(a).toBe(`cp "${kitA}/design/<dem|giay|dam>/DESIGN.md" ./DESIGN.md`);
    const [b, kitB] = await help("design-kit");
    expect(b).toBe(`cp ${kitB}/design/<dem|giay|dam>/DESIGN.md ./DESIGN.md`);
  });
});

const python = ["python3", "python"].find((p) => /^Python 3/.test(spawnSync(p, ["--version"], { encoding: "utf8" }).stdout ?? ""));
describe.skipIf(!python)("A/B page script", () => {
  it("takes the folder with or without a slash at the end (25/11/2026)", () => {
    // Bản chép script trong thư mục tạm (nó ghi theo chỗ nó nằm), PIL giả: không cần Pillow.
    const d = mkdtempSync(join(tmpdir(), "dk-ab-"));
    const put = (f: string, text: string) => {
      mkdirSync(dirname(join(d, f)), { recursive: true });
      writeFileSync(join(d, f), text);
    };
    put("scripts/tao-trang-ab.py", readFileSync(join(root, "scripts", "tao-trang-ab.py"), "utf8"));
    put("gia/PIL/__init__.py", "");
    put("gia/PIL/Image.py", ["import builtins", "class Im:", "    width = height = 10", "    crop = lambda self, b: self", "    convert = lambda self, m: self", "    def save(self, p, **k):", "        builtins.open(p, 'w').close()", "def open(p):", "    builtins.open(p).close()", "    return Im()"].join("\n"));
    put(".folio/danh-gia-ab.html", '<title>Chấm mù A/B</title><main class="wrap">');
    put("eval/dot1/.khoa.json", '{"de":{"X":"a","Y":"b"}}');
    for (const s of ["a", "b"]) for (const n of ["light-1280", "light-390", "dark-390"]) put(`eval/dot1/.shots/eval~dot1~de~${s}~index/${n}.png`, "x");
    for (const dot of ["eval/dot1", "eval/dot1/", ...(process.platform === "win32" ? ["eval\\dot1\\"] : [])]) {
      const anh = join(d, ".folio", "anh");
      rmSync(anh, { recursive: true, force: true });
      const r = spawnSync(python!, [join(d, "scripts", "tao-trang-ab.py"), dot, "t.html", "T", "de:Ten:mo ta"], { encoding: "utf8", env: { ...process.env, PYTHONPATH: join(d, "gia"), PYTHONUTF8: "1" } });
      expect([dot, r.status, r.stderr]).toEqual([dot, 0, ""]);
      expect([dot, readdirSync(anh), readdirSync(join(anh, "dot1")).length]).toEqual([dot, ["dot1"], 6]);
    }
  });
});

describe("DESIGN.md", () => {
  it("measures line length the way the tokens do, never in ch (wrong for Vietnamese)", () => {
    for (const h of ["dem", "giay", "dam"]) expect(readFileSync(join(root, "design", h, "DESIGN.md"), "utf8")).not.toMatch(/\d+ch\b/);
    const giay = readFileSync(join(root, "design", "giay", "DESIGN.md"), "utf8");
    const measure = /--measure:\s*([^;]+);/.exec(readFileSync(join(root, "tokens", "core.css"), "utf8"))![1];
    expect(giay.split(`\`var(--measure)\` (${measure})`)).toHaveLength(3);
  });
});

describe("font download script", () => {
  // Chạy bản chép của script trong thư mục tạm (nó ghi theo chỗ nó nằm), với fetch giả: không đụng tokens/fonts thật, không cần mạng.
  const FACE = (n: number) => `/* latin */\n@font-face { font-family: 'Phong ${n}'; font-style: normal; font-weight: 400; src: url(https://f.invalid/${n}.woff2) format('woff2'); }\n`;
  const go = (fetchBody: string) => {
    const d = mkdtempSync(join(tmpdir(), "dk-font-"));
    mkdirSync(join(d, "scripts"));
    mkdirSync(join(d, "tokens", "fonts"), { recursive: true });
    writeFileSync(join(d, "tokens", "fonts", "cu.woff2"), "cũ");
    writeFileSync(join(d, "tokens", "fonts-local.css"), "/* cũ */");
    writeFileSync(join(d, "scripts", "tai-font.mjs"), readFileSync(join(root, "scripts", "tai-font.mjs")));
    writeFileSync(join(d, "gia.mjs"), `const FACES = ${JSON.stringify(FACE(1) + FACE(2))};\nglobalThis.fetch = async (u) => { ${fetchBody} };\n`);
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(join(d, "gia.mjs")).href, join(d, "scripts", "tai-font.mjs")], { encoding: "utf8" });
    return { code: r.status, out: r.stdout + r.stderr, files: readdirSync(join(d, "tokens", "fonts")).sort(), css: readFileSync(join(d, "tokens", "fonts-local.css"), "utf8"), tokens: readdirSync(join(d, "tokens")).sort() };
  };
  const WOFF = 'new Response(Buffer.from("wOF2" + u))';
  const CSS_OK = 'if (String(u).includes("googleapis")) return new Response(FACES);';

  it("replaces the folder once every file has arrived", () => {
    const r = go(`${CSS_OK} return ${WOFF};`);
    expect(r.out).toContain("2 tệp woff2");
    expect(r).toMatchObject({ code: 0, files: ["OFL.txt", "phong-1-normal-400-latin.woff2", "phong-2-normal-400-latin.woff2"], tokens: ["fonts", "fonts-local.css"] });
    expect(r.css).toContain("url(fonts/phong-2-normal-400-latin.woff2)");
  });
  it.each([
    ["the network drops halfway", `${CSS_OK} if (String(u).includes("2.woff2")) throw new TypeError("fetch failed"); return ${WOFF};`],
    ["a font answers with an error page", `${CSS_OK} if (String(u).includes("2.woff2")) return new Response("<html>429</html>", { status: 429 }); return ${WOFF};`],
    ["a font answers 200 with something that is not a font", `${CSS_OK} if (String(u).includes("2.woff2")) return new Response("<html>đăng nhập wifi</html>"); return ${WOFF};`],
    ["the stylesheet answers with an error", "return new Response(FACES, { status: 500 });"],
  ])("leaves the fonts that are there alone when %s", (_n, body) => {
    const r = go(body);
    expect({ code: r.code, files: r.files, css: r.css, tokens: r.tokens }).toEqual({ code: 1, files: ["cu.woff2"], css: "/* cũ */", tokens: ["fonts", "fonts-local.css"] });
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
  it.each([["dem", 250], ["giay", 240], ["dam", 40]] as const)("doi-mau --trung-tinh also moves the shadows of %s (hue %i)", async (huong, goc) => {
    const shadows = (css: string) => [...css.matchAll(/--shadow-\d:[^;]*oklch\(([^)]*)\)/g)].map((m) => m[1]!);
    const old = shadows(readFileSync(join(root, "tokens", `${huong}.css`), "utf8"));
    expect(old.filter((s) => s.includes(` ${goc} /`))).toHaveLength(2);
    await run(["doi-mau", "--huong", huong, "--nhan", "145", "--trung-tinh", "60", "--ra", `bong-${huong}.css`]);
    // Bóng đen của bản tối không có sắc: giữ nguyên.
    expect(shadows(readFileSync(join(tmp, `bong-${huong}.css`), "utf8"))).toEqual(old.map((s) => s.replace(` ${goc} /`, " 60 /")));
  });
  it("doi-mau stays inside sRGB at hues where rounding used to push chroma out (dem 20, 250)", async () => {
    for (const h of ["20", "250"]) {
      const a = await run(["doi-mau", "--huong", "dem", "--nhan", h, "--ra", `dem-${h}.css`]);
      expect(a.out).toContain("pass: 42 pairs");
    }
  });
  it("kiem-mau with the wrong --huong says which block is missing", async () => {
    const { out, code } = await run(["kiem-mau", join(root, "tokens", "dem.css"), "--huong", "giay"]);
    expect(out).toContain('no [data-dk=\\"giay\\"] block in the file');
    expect(out).toContain("VALIDATION_ERROR");
    expect(code).toBe(2);
  });
  it("doi-mau without --ra is a usage error", async () => {
    const { out, code } = await run(["doi-mau", "--huong", "dem", "--nhan", "45"]);
    expect(out).toContain("--ra is required");
    expect(code).toBe(2);
  });
});
