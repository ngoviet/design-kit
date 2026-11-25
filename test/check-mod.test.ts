// check-mod từ đầu tới cuối trên test/fixtures/mods/xau: một thanh cố ý mắc mỗi lỗi một lần.
// Cần Claude Code (`claude` hoặc CLAUDE_BIN) để chạy test của mod; máy không có thì bỏ qua phần đó,
// trừ khi DK_REQUIRE_CLAUDE=1 (CI cài Claude Code và đặt biến này): khi ấy thiếu claude là test trượt.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { collectDrawings, inspectMod } from "../src/mod/collect.js";

const root = join(__dirname, "..");
const bin = process.env["CLAUDE_BIN"] ?? "claude";
const hasClaude = (() => {
  let r = spawnSync(bin, ["--version"], { encoding: "utf8" });
  // Windows: claude cài qua npm là claude.cmd, chỉ chạy được qua shell (một chuỗi lệnh, không mảng đối số).
  if (r.error && process.platform === "win32") r = spawnSync(`"${bin}" --version`, { encoding: "utf8", shell: true });
  return r.status === 0 && /Claude Code/.test(r.stdout);
})();
const requireClaude = process.env["DK_REQUIRE_CLAUDE"] === "1";

async function run(argv: string[], env: Record<string, string | undefined> = process.env): Promise<{ out: string; code: number | undefined }> {
  let out = "";
  const prev = process.exitCode;
  process.exitCode = undefined;
  await main({ argv, stdout: { write: (c: string) => (out += c) }, runtime: { env, home: "", cwd: root } });
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

/**
 * Claude giả và một mod rỗng: validate nêu các component, test in sẵn các dòng cho trước. Tệp test chung rỗng thì trả lời
 * như claude thật: một dòng (fail) "declares no test()".
 */
function fakeMod(components: string[], testLines: string[], hang = false): { dir: string; env: Record<string, string | undefined> } {
  const d = mkdtempSync(join(tmpdir(), "dk-gia-"));
  const dir = join(d, "mod-gia");
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  mkdirSync(join(dir, "hooks"));
  writeFileSync(join(dir, ".claude-plugin", "plugin.json"), '{"name":"mod-gia","version":"1.0.0"}');
  writeFileSync(join(dir, "hooks", "hooks.json"), '{"modules":["./register.tsx"]}');
  const script = join(d, "gia.cjs");
  writeFileSync(
    script,
    [
      'const fs = require("node:fs"), path = require("node:path");',
      "const [, , , cmd, dir] = process.argv;",
      'const hooks = path.join(dir, "hooks");',
      'if (cmd === "validate") for (const c of ' + JSON.stringify(components) + ') console.log("hooks: ui.render{component=" + c + "}");',
      "else {",
      '  for (const f of fs.readdirSync(hooks).filter((f) => f.endsWith(".test.tsx"))) {',
      '    if (fs.readFileSync(path.join(hooks, f), "utf8").includes("any[] = []")) console.log("(fail) hooks/" + f + "\\n  error: it declares no test()");',
      "  }",
      "  for (const l of " + JSON.stringify(testLines) + ") console.log(l);",
      ...(hang ? ["  setTimeout(() => {}, 60000);"] : []),
      "}",
    ].join("\n"),
  );
  // Windows: tên trần "claude" đi qua shell tới claude.cmd; nơi khác: tệp chạy được.
  const launcher = join(d, "claude");
  if (process.platform === "win32") writeFileSync(launcher + ".cmd", '@"' + process.execPath + '" "' + script + '" %*\r\n');
  else {
    writeFileSync(launcher, '#!/bin/sh\nexec "' + process.execPath + '" "' + script + '" "$@"\n');
    chmodSync(launcher, 0o755);
  }
  return { dir, env: { ...process.env, CLAUDE_BIN: launcher } };
}

const drawing = (component: string, columns: number, tree: unknown, surface = "terminal") =>
  "DKTREE " + JSON.stringify({ run: "default", test: "t", scene: 1, component, surface, columns, tree });
/** Cột result của một phép đo trong bảng checks. */
const result = (out: string, id: string) => new RegExp("^ {2}" + id + ",(?:hard|soft),(.*)$", "m").exec(out)?.[1];

describe("check-mod with a stand-in claude (25/11/2026)", () => {
  const terminal = ["--no-shots", "--surfaces", "terminal", "--languages", "none", "--strict"];

  it("is a hard failure, not a pass, when the mod hooks ui.render and no drawing came back", async () => {
    const { dir, env } = fakeMod(["AskUserQuestion"], []);
    const { out, code } = await run(["check-mod", dir, ...terminal], env);
    expect(out).toMatch(/^status: "fail: 1 hard/m);
    expect(out).toMatch(/^ {2}hard,mount,"-",AskUserQuestion,/m);
    expect(code).toBe(1);
    // Nói component nào không có props mặc định; tệp test chung rỗng không thành một test hỏng của mod.
    expect(out).toContain("no default props for AskUserQuestion");
    expect(out).not.toContain("declares no test()");
    expect(out).toContain('default,"0 pass, 0 fail"');
  });

  it("is a hard failure too when the mod's module does not load", async () => {
    const { dir, env } = fakeMod(["AbovePrompt"], ['error: Cannot find module "./missing"']);
    const { out, code } = await run(["check-mod", dir, ...terminal], env);
    expect(out).toMatch(/^ {2}hard,mount,"-",AbovePrompt,.*Cannot find module/m);
    expect(code).toBe(1);
  });

  it("keeps passing a mod that drew nothing of its own (next(e)), and one with no ui.render", async () => {
    const blank = fakeMod(["AbovePrompt"], [drawing("AbovePrompt", 80, { type: "Box", children: [{ type: "Box", props: { key: "dk-engine" } }] })]);
    const a = await run(["check-mod", blank.dir, ...terminal], blank.env);
    expect(a.out).toMatch(/^status: "pass: 0 distinct drawings/m);
    expect(a.code).toBeUndefined();
    const none = fakeMod([], []);
    const b = await run(["check-mod", none.dir, ...terminal], none.env);
    expect(b.out).toMatch(/^status: "pass: nothing to check/m);
    expect(b.code).toBeUndefined();
  });

  it("prints skipped for a check this run could not measure", async () => {
    const rows = { type: "Box", props: { flexDirection: "column" }, children: Array.from({ length: 20 }, (_, i) => ({ type: "Text", children: ["row " + i] })) };
    const wideMod = fakeMod(["AskUserQuestion"], [52, 80].map((c) => drawing("AskUserQuestion", c, rows)));
    const wide = await run(["check-mod", wideMod.dir, ...terminal, "--widths", "52,80"], wideMod.env);
    expect(result(wide.out, "ask-rows")).toBe("skipped");
    expect(wide.out).toContain("add 40 to --widths");
    for (const id of ["svg-source", "text-min", "motion", "axe", "svg-terminal"]) expect(result(wide.out, id), id).toBe("skipped");
    for (const id of ["render", "overflow", "rows", "hard-color"]) expect(result(wide.out, id), id).toBe("ok");
    // Có 40 cột trên terminal thì đo thật.
    const narrowMod = fakeMod(["AskUserQuestion"], [40, 52].map((c) => drawing("AskUserQuestion", c, rows)));
    const narrow = await run(["check-mod", narrowMod.dir, ...terminal, "--widths", "40,52"], narrowMod.env);
    expect(result(narrow.out, "ask-rows")).toBe("1 hard");

    const desk = fakeMod(["AskUserQuestion"], [drawing("AskUserQuestion", 40, rows, "desktop")]);
    const d = await run(["check-mod", desk.dir, "--no-shots", "--surfaces", "desktop", "--languages", "none", "--widths", "40"], desk.env);
    for (const id of ["render", "ask-rows", "rows", "svg-terminal", "hard-color"]) expect(result(d.out, id), id).toBe("skipped");
    for (const id of ["svg-source", "text-min", "axe", "overflow"]) expect(result(d.out, id), id).toBe("ok");
  });

  it("says so when the tests were stopped at the time limit: what came back before is only part of the mod", async () => {
    const { dir, env } = fakeMod(["AbovePrompt"], ["(pass) t [1ms]", drawing("AbovePrompt", 80, { type: "Text", children: ["xin chào"] })], true);
    const t0 = Date.now();
    const r = await collectDrawings(inspectMod(dir, env), { widths: [80], surfaces: ["terminal"], languages: [], useTests: true, env, timeoutMs: 3000 });
    expect(Date.now() - t0).toBeLessThan(30_000);
    expect(r.drawings).toHaveLength(1);
    expect(r.notes.join("\n")).toContain("run default: stopped after 3 s, the tests had not finished: only the 1 drawing(s)");
  }, 60_000);

  it("counts drawing lines that came back cut off, instead of dropping them without a word", async () => {
    const ok = drawing("AbovePrompt", 80, { type: "Text", children: ["xin chào"] });
    const { dir, env } = fakeMod(["AbovePrompt"], ["(pass) t [1ms]", ok, ok.slice(0, 60)]);
    const { out } = await run(["check-mod", dir, ...terminal], env);
    expect(out).toContain("run default: 1 drawing line(s) came back cut off and were dropped, not measured");
    const whole = fakeMod(["AbovePrompt"], ["(pass) t [1ms]", ok]);
    const b = (await run(["check-mod", whole.dir, ...terminal], whole.env)).out;
    expect(b).not.toMatch(/cut off and were dropped|stopped after/);
  });

  it("the help says where ask-rows is measured and which components get default props", async () => {
    const { out } = await run(["check-mod", "--help"]);
    expect(out).toMatch(/ask-rows \(an AskUserQuestion tree over 12 rows on the terminal at 40 columns; [^)]*not measured\)/);
    expect(out).toContain("AbovePrompt, Pane and ToolUse");
  });

  it("a plugin.json that does not parse is a usage error, not an unknown crash", async () => {
    for (const bad of [String.fromCharCode(0xfeff) + '{"name":"x"}', "{ nope", "null"]) {
      const { dir, env } = fakeMod(["AbovePrompt"], []);
      writeFileSync(join(dir, ".claude-plugin", "plugin.json"), bad);
      const { out, code } = await run(["check-mod", dir], env);
      expect(out).toContain("VALIDATION_ERROR");
      expect(out).toContain("plugin.json");
      expect(code).toBe(2);
    }
  });

  it.runIf(process.platform === "win32")("runs claude when CLAUDE_BIN names the .cmd file itself", async () => {
    const { dir, env } = fakeMod(["AbovePrompt"], [drawing("AbovePrompt", 80, { type: "Text", children: ["xin chào"] }), "(pass) t [1ms]"]);
    const { out, code } = await run(["check-mod", dir, ...terminal], { ...env, CLAUDE_BIN: env["CLAUDE_BIN"] + ".cmd" });
    expect(out).toMatch(/^status: "pass: 1 distinct drawings/m);
    expect(code).toBeUndefined();
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
