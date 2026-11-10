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

  it("measures text shrunk by transform, scale or zoom, through shadow roots and slots", async () => {
    const { out, code } = await run(["check", "test/fixtures/co-gian.html", ...FAST, "--strict", "--full"]);
    expect(out).toContain("text-min,hard,5 hard");
    expect(out).toMatch(/text-min,.*span#co-transform.*7\.2px rendered \(12px × 0\.60\)/);
    expect(out).toMatch(/text-min,.*span#co-scale.*7\.2px rendered/);
    expect(out).toMatch(/text-min,.*span#co-zoom.*7\.2px rendered/);
    expect(out).toMatch(/text-min,.*so-do::shadow span\.lbl.*7\.2px rendered/);
    expect(out).toMatch(/text-min,.*span#co-slot.*7\.2px rendered/);
    expect(out).toMatch(/body-size,.*p#than-co.*12\.8px rendered \(16px × 0\.80\)/);
    // Không co thật thì không báo: để nguyên, chỉ dịch chỗ, xoay, phóng to, transform trên hộp inline,
    // và hiệu ứng mở scale(.5) → 1 đang chạy lúc đo (phải chờ nó xong)
    expect(out).not.toMatch(/#(khong-co|dich|xoay|phong|inline|than-thuong|dang-mo)\b/);
    expect(code).toBe(1);
  }, 120_000);

  it("reports text cut off by ellipsis, line-clamp or overflow, through shadow roots, at the width where it is cut", async () => {
    const { out } = await run(["check", "test/fixtures/cat-chu.html", "--no-impeccable", "--no-shots", "--viewports", "390,1280", "--schemes", "light", "--full"]);
    const rows = out.split("\n").filter((l) => /^\s+soft,text-clip,/.test(l));
    // Dòng phụ của thẻ CRS310 trong shadow root: chỉ bị cắt ở 1280 (cây xếp ngang), như ảnh chụp lan-topo-card v0.8.3
    const sub = rows.filter((l) => l.includes("so-do-cay::shadow div#dong-phu"));
    expect(sub).toHaveLength(1);
    expect(sub[0]).toMatch(/at 1280px by ellipsis: shows \\"6\/10 cổng có link · 5 ph[^"\\]*…\\"/);
    expect(sub[0]).toMatch(/,light\/1280$/);
    expect(rows.some((l) => /p#kep [^\n]*by line-clamp: shows/.test(l))).toBe(true);
    expect(rows.some((l) => /div#hop-co-dinh [^\n]*by overflow hidden: shows/.test(l))).toBe(true);
    expect(rows.some((l) => /div#cat-clip [^\n]*by overflow clip: shows/.test(l))).toBe(true);
    // line-height 1 + overflow hidden: không mất ký tự nào, nhưng mất dấu ("Ổn định" hiện thành "Ön đinh")
    expect(rows.some((l) => /span#nhan-chat [^\n]*by overflow hidden: tops or bottoms of letters cut/.test(l))).toBe(true);
    // Ô ellipsis vừa khít: không có "…", nhưng line-height 1,5 vẫn gọt dấu chồng của "Ổ". Báo đúng cách cắt.
    expect(rows.filter((l) => l.includes("div#vua-khit "))).toEqual([
      expect.stringMatching(/by overflow hidden: tops or bottoms of letters cut in \\"Ổn định cổng tầng hai\\"/),
      expect.stringMatching(/by overflow hidden: tops or bottoms of letters cut/),
    ]);
    // Chữ gán thẳng vào slot, hộp ellipsis nằm trong shadow root của x-chip
    expect(rows.some((l) => /x-chip::shadow span#chip-hop\b[^\n]*by ellipsis: shows \\"Bộ/.test(l))).toBe(true);
    // Không bị cắt thật thì không báo: ô ellipsis đủ chỗ, line-clamp đủ chỗ, sr-only, text-indent âm, ngăn kéo nằm
    // hẳn ngoài khung, cùng kiểu line-height 1 mà chữ không dấu, không chân (mực chữ nằm trong hộp), phần tử absolute
    // thoát khung cắt, chữ dưới mép khung cuộn nằm trong gốc overflow hidden cùng cỡ (ScrollArea)
    expect(rows.filter((l) => /#(ten-ngan|kep-ngan|an-chu|logo|ngan-keo|panel-an|nhan-la|thoat|cuon-goc|cuon-chu)\b/.test(l))).toEqual([]);
    expect(rows.filter((l) => !/#(dong-phu|kep|hop-co-dinh|cat-clip|nhan-chat|vua-khit) |#chip-hop"|,\+1 more,text cut off,light\/1280$/.test(l))).toEqual([]);
  }, 120_000);

  it("a custom checkbox whose visible box draws no focus ring is still reported", async () => {
    const { out } = await run(["check", "test/fixtures/khong-vong.html", ...FAST, "--full"]);
    expect(out).toMatch(/focus,input#nho.*no visible focus ring/);
    expect(out).not.toMatch(/input#gio.*no visible focus ring/);
    expect(out).not.toContain("nobody can see");
  }, 120_000);

  it("a step that cannot be done is a hard failure, and --no-steps skips the file", async () => {
    const bad = await run(["check", "test/fixtures/tot.html", ...FAST, "--steps", '[{"name":"x","do":[{"click":"#khong-co"}]}]']);
    expect(bad.out).toContain('steps,x,"click #khong-co failed');
    const skip = await run(["check", "test/fixtures/buoc.html", ...FAST, "--no-steps"]);
    expect(skip.out).toContain("pass: 1 pages, 0 hard failures");
    expect(skip.out).toContain("none: no steps file");
  }, 120_000);

  it("a blank page fails instead of passing with nothing to measure", async () => {
    const { out, code } = await run(["check", "test/fixtures/trong.html", ...FAST, "--strict", "--full"]);
    expect(out).toContain("fail: 1 of 1");
    expect(out).toMatch(/hard,render,page,"?nothing visible/);
    expect(out).toContain("the-mang");
    expect(out).toMatch(/hard,errors,page,"?uncaught Error: cấu hình hỏng/);
    expect(out).toMatch(/hard,errors,page,"?script failed to load: .*khong-co-tep-nay\.js \(HTTP 404\)/);
    expect(code).toBe(1);
  }, 120_000);

  it("text inside a parent with opacity 0 does not count as visible", async () => {
    const { out, code } = await run(["check", "test/fixtures/an-cha.html", ...FAST, "--strict", "--full"]);
    expect(out).toContain("fail: 1 of 1");
    expect(out).toMatch(/hard,render,page,"?nothing visible/);
    expect(code).toBe(1);
  }, 120_000);

  it("a defined component drawing through a closed shadow root is not a blank page", async () => {
    const { out } = await run(["check", "test/fixtures/bong-dong.html", ...FAST, "--full"]);
    expect(out).not.toContain("nothing visible");
    expect(out).not.toMatch(/(hard|soft),render,/);
  }, 120_000);

  it("a defined light-DOM shell that rendered nothing is still a blank page", async () => {
    const { out, code } = await run(["check", "test/fixtures/vo-rong.html", ...FAST, "--strict", "--full"]);
    expect(out).toContain("fail: 1 of 1");
    expect(out).toMatch(/hard,render,page,"?nothing visible/);
    expect(code).toBe(1);
  }, 120_000);

  it("an unregistered tag with light-DOM children is a note, not a render finding", async () => {
    const { out } = await run(["check", "test/fixtures/goc-app.html", ...FAST, "--full"]);
    expect(out).not.toMatch(/(hard|soft),render,/);
    expect(out).toMatch(/not registered as custom elements .*: app-root/);
  }, 120_000);

  it("waits for content that arrives after the network is idle, then measures it", async () => {
    const { out } = await run(["check", "test/fixtures/cham.html", ...FAST, "--full"]);
    expect(out).toMatch(/text-min,.*p#nho.*10\.0px/);
    expect(out).not.toContain("nothing visible");
    expect(out).toMatch(/content appeared \d+ ms after the network went idle/);
  }, 120_000);

  it("passes a page built on the tokens", async () => {
    const { out, code } = await run(["check", "test/fixtures/tot.html", ...FAST, "--strict"]);
    expect(out).toContain("pass: 1 pages, 0 hard failures");
    expect(code).toBeUndefined();
  }, 120_000);
});
