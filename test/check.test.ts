import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { impGate } from "../src/commands/check.js";
import { parseSteps } from "../src/steps.js";

const root = join(__dirname, "..");

async function run(argv: string[]): Promise<{ out: string; code: number | undefined }> {
  let out = "";
  const prev = process.exitCode;
  process.exitCode = undefined;
  await main({ argv, stdout: { write: (c: string) => (out += c) }, runtime: { env: process.env, home: "", cwd: root } });
  const code = process.exitCode as number | undefined;
  process.exitCode = prev;
  return { out, code };
}

describe("impGate", () => {
  it("slop rules are hard, user-facing quality rules are hard, the rest soft", () => {
    expect(impGate({ antipattern: "gradient-text", category: "slop" })).toBe("hard");
    expect(impGate({ antipattern: "low-contrast", category: "quality" })).toBe("hard");
    expect(impGate({ antipattern: "line-length", category: "quality" })).toBe("soft");
    expect(impGate({ antipattern: "straggler", category: "quality", severity: "advisory" })).toBe("soft");
    // Khẩu vị bảng màu, không phải công năng (A/B đợt 2)
    expect(impGate({ antipattern: "cream-palette", category: "slop" })).toBe("soft");
  });
});

describe("check arguments", () => {
  it("rejects a bad scheme with a usage error", async () => {
    const { out, code } = await run(["check", "test/fixtures/tot.html", "--schemes", "sepia"]);
    expect(out).toContain("--schemes");
    expect(code).toBe(2);
  });
  it("rejects a missing file", async () => {
    const { out, code } = await run(["check", "khong-co.html"]);
    expect(out).toContain("not found");
    expect(code).toBe(2);
  });
  it("rejects a malformed steps list before opening a browser", async () => {
    const { out, code } = await run(["check", "test/fixtures/tot.html", "--steps", '[{"name":"có dấu","do":[{"click":"#a"}]}]']);
    expect(out).toContain("no accents");
    expect(code).toBe(2);
  });
});

describe("parseSteps", () => {
  it("accepts every action kind", () => {
    const s = parseSteps(
      JSON.stringify([{ name: "buoc-3", do: [{ click: "#a" }, { fill: ["#b", "x"] }, { check: "#c" }, { select: ["#d", "1"] }, { press: "Tab" }, { press: ["#e", "Enter"] }, { hover: "#f" }, { wait: 200 }] }]),
      "t",
    );
    expect(s[0]!.do).toHaveLength(8);
  });
  it("rejects unknown actions, empty lists and duplicate names", () => {
    expect(() => parseSteps('[{"name":"a","do":[{"tap":"#a"}]}]', "t")).toThrow(/action 1/);
    expect(() => parseSteps('[{"name":"a","do":[]}]', "t")).toThrow(/non-empty/);
    expect(() => parseSteps('[{"name":"a","do":[{"click":"#a"}]},{"name":"a","do":[{"click":"#b"}]}]', "t")).toThrow(/twice/);
    expect(() => parseSteps('[{"name":"a","do":[{"fill":"#a"}]}]', "t")).toThrow(/action 1/);
  });
});

// Chạy trình duyệt thật (Edge/Chrome). Chậm nên chỉ một khổ, một chế độ.
const FAST = ["--no-impeccable", "--no-shots", "--viewports", "390", "--schemes", "light"];

describe("check on real pages", () => {
  it("finds the planted failures, including inside a shadow root", async () => {
    const { out, code } = await run(["check", "test/fixtures/loi.html", ...FAST, "--strict", "--full"]);
    expect(out).toContain("fail: 1 of 1");
    expect(out).toContain("topo-card::shadow span.lbl");
    expect(out).toContain('lang=\\"en\\"');
    expect(out).toMatch(/overflow,390px/);
    expect(out).toContain("color-contrast");
    expect(out).toContain("still run with prefers-reduced-motion");
    // Dẫn đường kém: mềm, nhưng phải được gọi tên
    expect(out).toContain('name the next step: \\"Tiếp\\"');
    expect(out).toContain("empty state with no next action");
    expect(out).toContain("up-front tour");
    expect(out).toContain("focus lands on an element nobody can see");
    expect(code).toBe(1);
  }, 120_000);

  it("measures a state reached by clicking, read from <page>.steps.json", async () => {
    const { out, code } = await run(["check", "test/fixtures/buoc.html", ...FAST, "--strict", "--full"]);
    expect(out).toContain("fail: 1 of 2 pages have hard failures (1 of them states after steps)");
    expect(out).toMatch(/test\/fixtures\/buoc\.html,pass/);
    expect(out).toMatch(/test\/fixtures\/buoc\.html #loi,fail/);
    expect(out).toMatch(/text-min,.*p#loi.*10\.0px/);
    // Công tắc tuỳ biến (input trong suốt, span vẽ thay) không bị báo nhầm là focus lạc
    expect(out).not.toContain("nobody can see");
    expect(out).not.toContain("no visible focus ring");
    expect(code).toBe(1);
  }, 120_000);

  it("a custom checkbox whose visible box draws no focus ring is still reported", async () => {
    const { out } = await run(["check", "test/fixtures/khong-vong.html", ...FAST, "--full"]);
    expect(out).toMatch(/focus,input#nho.*no visible focus ring/);
    expect(out).not.toContain("nobody can see");
  }, 120_000);

  it("a step that cannot be done is a hard failure, and --no-steps skips the file", async () => {
    const bad = await run(["check", "test/fixtures/tot.html", ...FAST, "--steps", '[{"name":"x","do":[{"click":"#khong-co"}]}]']);
    expect(bad.out).toContain('steps,x,"click #khong-co failed');
    const skip = await run(["check", "test/fixtures/buoc.html", ...FAST, "--no-steps"]);
    expect(skip.out).toContain("pass: 1 pages, 0 hard failures");
    expect(skip.out).toContain("none: no steps file");
  }, 120_000);

  it("passes a page built on the tokens", async () => {
    const { out, code } = await run(["check", "test/fixtures/tot.html", ...FAST, "--strict"]);
    expect(out).toContain("pass: 1 pages, 0 hard failures");
    expect(code).toBeUndefined();
  }, 120_000);
});
