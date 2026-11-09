import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { impGate } from "../src/commands/check.js";

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
    expect(code).toBe(1);
  }, 120_000);

  it("passes a page built on the tokens", async () => {
    const { out, code } = await run(["check", "test/fixtures/tot.html", ...FAST, "--strict"]);
    expect(out).toContain("pass: 1 pages, 0 hard failures");
    expect(code).toBeUndefined();
  }, 120_000);
});
