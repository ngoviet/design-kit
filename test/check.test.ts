import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { impGate } from "../src/commands/check.js";
import { inputZoomFinding } from "../src/zoom.js";
import { isFontSheet, tagAttrs } from "../src/commands/inline.js";
import { pageWeight, paneUrl, weightDetail } from "../src/standalone.js";
import { parseSteps } from "../src/steps.js";
import { applyWaivers, parseWaivers } from "../src/waivers.js";

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

describe("waivers (N8)", () => {
  const f = (gate: "hard" | "soft", check: string, where: string) => ({ gate, check, where });
  const reports = () => [
    { target: "a.html?dk=dem", findings: new Map([["1", f("soft", "standalone", "data: URL")], ["2", f("hard", "axe", "color-contrast")], ["3", f("soft", "guide", "button")]]) },
    { target: "a.html?dk=giay #loi", findings: new Map([["1", f("soft", "standalone", "data: URL")]]) },
  ];
  const w = (check: string, where: string, page = "a.html") => ({ page, check, where, reason: "khối liên kết token theo đường dẫn" });
  it("removes matching soft findings on every query and state of the page, refuses hard ones, reports unused", () => {
    const rs = reports();
    const res = applyWaivers(rs, [w("standalone", "data: URL"), w("axe", "color-contrast"), w("copy", "p", "b.html")]);
    expect(rs[0]!.findings.size).toBe(2);
    expect(rs[1]!.findings.size).toBe(0);
    expect(res.used).toEqual([expect.objectContaining({ check: "standalone", count: 2 })]);
    expect(res.refused.map((x) => x.check)).toEqual(["axe"]);
    expect(res.unused.map((x) => x.page)).toEqual(["b.html"]);
  });
  it("uses only the first 5 waivers of a page and rejects a reason that says nothing", () => {
    const many = Array.from({ length: 6 }, (_, i) => w("guide", `x${i}`));
    expect(applyWaivers(reports(), many).tooMany).toEqual(["a.html"]);
    expect(() => parseWaivers('[{"page":"a.html","check":"guide","where":"b","reason":"ok"}]', "w.json")).toThrow(/shorter than 12/);
    expect(() => parseWaivers('{"page":"a.html"}', "w.json")).toThrow(/JSON array/);
  });
  it("check lists waived findings and drops them from the counts", async () => {
    const file = join(root, ".design-kit", "test", "mien-tru.json");
    mkdirSync(join(root, ".design-kit", "test"), { recursive: true });
    writeFileSync(file, JSON.stringify([{ page: "test/fixtures/tot.html", check: "standalone", where: "data: URL", reason: "trang mẫu liên kết token theo đường dẫn, chỉ chạy qua http" }]));
    const { out } = await run(["check", "test/fixtures/tot.html", ...FAST, "--waivers", ".design-kit/test/mien-tru.json", "--full"]);
    expect(out).toMatch(/waived\[1\]\{page,check,where,findings,reason\}:\n {2}test\/fixtures\/tot\.html,standalone,"data: URL",1,/);
    expect(out).toContain("standalone,soft,ok");
    const missing = await run(["check", "test/fixtures/tot.html", ...FAST, "--waivers", "khong-co.json"]);
    expect(missing.out).toContain("--waivers: not found");
  }, 120_000);
});

describe("cache (N7)", () => {
  it("reuses the result of an unchanged page and measures again when a file it loads changes", async () => {
    const d = join(root, ".design-kit", "test", "dem-test");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "a.html"), '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Đệm</title><link rel="stylesheet" href="kieu.css"></head><body><main><h1>Trang đệm</h1><p>Đoạn chữ thử bộ đệm của cổng.</p></main></body></html>');
    writeFileSync(join(d, "kieu.css"), `body{font:16px/1.6 system-ui;color:#111;background:#fff} /* ${Date.now()} */`);
    const args = ["check", ".design-kit/test/dem-test/a.html", ...FAST, "--full"];
    expect((await run(args)).out).not.toContain("cache:");
    const again = await run(args);
    expect(again.out).toContain("1 of 1 pages unchanged since their last check");
    expect(again.out).toContain("pass: 1 pages");
    // Một tệp trang nạp đổi (CSS, không phải HTML): đo lại.
    writeFileSync(join(d, "kieu.css"), "body{font:11px/1.6 system-ui;color:#111;background:#fff}");
    const changed = await run(args);
    expect(changed.out).not.toContain("cache:");
    expect(changed.out).toMatch(/hard,text-min,.*11\.0px/);
    // Cờ khác là khoá khác; --no-cache luôn đo.
    expect((await run([...args, "--no-cache"])).out).not.toContain("cache:");
  }, 120_000);
});

describe("inputZoomFinding: when tapping a field makes iOS zoom the page", () => {
  const f = (size: number, extra: Partial<{ type: string; readonly: boolean; disabled: boolean }> = {}) =>
    inputZoomFinding({ where: "input#x", size, type: "text", readonly: false, disabled: false, ...extra });
  it("reports anything under 16px, the size every shipped iOS zooms below", () => {
    expect(f(13)).toMatch(/^13px text: iOS zooms the whole page in/);
    expect(f(15.5)).toMatch(/^15\.5px text/);
    expect(f(14, { type: "select" })).toMatch(/^14px text/);
  });
  it("leaves 16px and up, and disabled fields that cannot take focus", () => {
    expect(f(16)).toBeUndefined();
    expect(f(18)).toBeUndefined();
    expect(f(13, { disabled: true })).toBeUndefined();
  });
  it("still reports a read-only field: a tap focuses it and WebKit still zooms to reveal it", () => {
    expect(f(13, { readonly: true })).toMatch(/^13px text/);
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

describe("inline", () => {
  const tmp = join(root, ".design-kit", "test");
  mkdirSync(tmp, { recursive: true });

  it("tells a font stylesheet from one with rules", () => {
    expect(isFontSheet(readFileSync(join(root, "tokens", "fonts-local.css"), "utf8"))).toBe(true);
    // Google Fonts: URL có dấu ; bên trong
    expect(isFontSheet(readFileSync(join(root, "tokens", "fonts.css"), "utf8"))).toBe(true);
    expect(isFontSheet(readFileSync(join(root, "tokens", "core.css"), "utf8"))).toBe(false);
    expect(isFontSheet('@import url("base.css"); @font-face { font-family: X; src: url(x.woff2) }')).toBe(false);
    expect(isFontSheet("/* rỗng */")).toBe(false);
  });

  it("reads tag attributes with or without quotes", () => {
    const a = tagAttrs(`<link rel=stylesheet href="../a b.css" media='print' disabled>`);
    expect(a.get("rel")).toBe("stylesheet");
    expect(a.get("href")).toBe("../a b.css");
    expect(a.get("media")).toBe("print");
    expect(a.has("disabled")).toBe(true);
  });

  it("puts relative stylesheets into the page in place, keeps font links, and a second run changes nothing", async () => {
    const first = await run(["inline", "test/fixtures/tot.html", "--ra", ".design-kit/test/tot-gop.html"]);
    expect(first.out).toContain('status: "inlined 2 stylesheets, kept 1 font link"');
    const html = readFileSync(join(tmp, "tot-gop.html"), "utf8");
    expect(html).toContain('<style data-dk-inline="../../tokens/core.css">');
    expect(html).toContain('<style data-dk-inline="../../tokens/dem.css">');
    expect(html).not.toContain('href="../../tokens/core.css"');
    expect(html).toContain('<link rel="stylesheet" href="../../tokens/fonts-local.css">');
    // Thứ tự cascade giữ nguyên: token đứng trước <style> của trang
    expect(html.indexOf('data-dk-inline="../../tokens/dem.css"')).toBeLessThan(html.indexOf("body { margin: 0"));
    const again = await run(["inline", ".design-kit/test/tot-gop.html"]);
    expect(again.out).toContain("nothing to inline");
    expect(again.out).toContain("nothing written: no change");
  });

  it("rewrites url() in a nested @import once, relative to the page", async () => {
    const d = join(tmp, "long-nhau");
    mkdirSync(join(d, "css", "sub"), { recursive: true });
    writeFileSync(join(d, "page.html"), '<!doctype html><html lang="vi"><head><link rel="stylesheet" href="css/main.css"></head><body><p>x</p></body></html>');
    writeFileSync(join(d, "css", "main.css"), '@import "sub/a.css";\nbody { background: url(nen.png); }');
    writeFileSync(join(d, "css", "sub", "a.css"), "p { background: url(img.png); }");
    await run(["inline", ".design-kit/test/long-nhau/page.html"]);
    const html = readFileSync(join(d, "page.html"), "utf8");
    expect(html).toContain('url("css/sub/img.png")');
    expect(html).toContain('url("css/nen.png")');
    expect(html).not.toContain("css/css/");
  });

  it("refuses a file that is not a page", async () => {
    const { out, code } = await run(["inline", "tokens/core.css", "--dry-run"]);
    expect(out).toContain("not an .html file");
    expect(code).toBe(2);
  });

  it("encodes the page the way the app's browser pane does and counts base64 fonts", () => {
    expect(paneUrl("<p>Việt</p>")).toBe("data:text/html;charset=utf-8,%3Cp%3EVi%E1%BB%87t%3C%2Fp%3E");
    const w = pageWeight(`<style>@font-face{src:url(data:font/woff2;base64,${"A".repeat(2048)})}</style>`);
    expect(w.fontBytes).toBeGreaterThan(2048);
  });

  it("weighs a page against the pane's 512 KiB limit (measured: 524,288 bytes open, 524,289 do not)", () => {
    expect(weightDetail(400 * 1024, 0)).toBeUndefined();
    expect(weightDetail(450 * 1024, 0)).toMatch(/^450 KB: close to the 512 KiB limit/);
    expect(weightDetail(512 * 1024, 0)).toMatch(/close to/);
    expect(weightDetail(512 * 1024 + 1, 300 * 1024)).toMatch(/^512 KB, 300 KB of it base64 fonts: over 512 KiB .* does not open the file at all/);
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
    // Không bị cắt thật thì không báo: ô ellipsis đủ chỗ, line-clamp đủ chỗ, sr-only, text-indent âm, ngăn kéo nằm
    // hẳn ngoài khung, cùng kiểu line-height 1 mà chữ không dấu, không chân (mực chữ nằm trong hộp), phần tử absolute
    // thoát khung cắt, chữ dưới mép khung cuộn nằm trong gốc overflow hidden cùng cỡ (ScrollArea)
    expect(rows.filter((l) => /#(ten-ngan|kep-ngan|an-chu|logo|ngan-keo|panel-an|nhan-la|thoat|cuon-goc|cuon-chu)\b/.test(l))).toEqual([]);
    expect(rows.filter((l) => !/#(dong-phu|kep|hop-co-dinh|cat-clip|nhan-chat|vua-khit) /.test(l))).toEqual([]);
    expect(rows.filter((l) => /,\+\d+ more,/.test(l))).toEqual([]);
  }, 120_000);

  it("reports text assigned straight into a slot when the box that cuts it is inside the shadow root", async () => {
    const { out } = await run(["check", "test/fixtures/cat-chu-slot.html", "--no-impeccable", "--no-shots", "--viewports", "390,1280", "--schemes", "light", "--full"]);
    const rows = out.split("\n").filter((l) => /^\s+soft,text-clip,/.test(l));
    for (const w of [390, 1280]) {
      const chip = rows.filter((l) => l.includes("x-chip::shadow span#chip-hop") && l.includes(`at ${w}px`));
      expect(chip).toHaveLength(1);
      expect(chip[0]).toMatch(/by ellipsis: shows \\"Bộ[^"\\]*…\\"/);
    }
    expect(rows.filter((l) => l.includes("#chip-ngan"))).toEqual([]);
    expect(rows.filter((l) => /,\+\d+ more,/.test(l))).toEqual([]);
    expect(rows).toHaveLength(2);
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
    // Bản data: URL cũng đợi nội dung đến muộn: không báo nhầm "shows nothing" (19/11/2026).
    expect(out).not.toMatch(/standalone,.*shows nothing/);
  }, 120_000);

  it("standalone: a page that links its CSS by path loses it when opened as a file", async () => {
    const { out, code } = await run(["check", "test/fixtures/tot.html", ...FAST, "--strict", "--full"]);
    expect(out).toContain("standalone,soft,1 soft");
    expect(out).toContain('soft,standalone,"data: URL"');
    expect(out).toContain("loses 2 stylesheets (../../tokens/core.css, ../../tokens/dem.css); tokens --accent");
    expect(out).toContain("design-kit inline <page>");
    // Mềm: không chặn "xong"
    expect(code).toBeUndefined();
  }, 120_000);

  it("standalone: the same page after inline keeps its tokens", async () => {
    await run(["inline", "test/fixtures/tot.html", "--ra", ".design-kit/test/tot-gop.html"]);
    const { out } = await run(["check", ".design-kit/test/tot-gop.html", ...FAST, "--full"]);
    expect(out).not.toContain('standalone,"data: URL"');
    if (process.platform === "win32") expect(out).toContain("standalone,soft,ok");
  }, 120_000);

  // Georgia và Times New Roman là font của Windows: trên Linux (CI) không tái hiện được.
  it.skipIf(process.platform !== "win32")("standalone: a fallback font without Vietnamese letters is named", async () => {
    const { out } = await run(["check", "test/fixtures/du-phong.html", ...FAST, "--full"]);
    expect(out).toMatch(/soft,standalone,"p#than .*come from Times New Roman while the letters around them use Georgia/);
  }, 120_000);

  it("standalone: a page too heavy for the app's browser pane, and --no-standalone skips it", async () => {
    // .design-kit/test/ cũng sâu hai cấp như test/fixtures/: ../../tokens vẫn trỏ đúng.
    const tot = readFileSync(join(root, "test", "fixtures", "tot.html"), "utf8");
    writeFileSync(join(root, ".design-kit", "test", "nang.html"), tot.replace("</body>", `<!-- ${"x".repeat(600 * 1024)} -->\n</body>`));
    const heavy = await run(["check", ".design-kit/test/nang.html", ...FAST, "--full"]);
    expect(heavy.out).toMatch(/soft,standalone,file,"60\d KB: over 512 KiB \(524,288 bytes\) the Claude app's browser pane does not open the file at all/);
    const skip = await run(["check", ".design-kit/test/nang.html", ...FAST, "--no-standalone"]);
    expect(skip.out).toContain("standalone,soft,skipped");
  }, 120_000);

  it("text-covered: text spilling under the next box is reported, through shadow roots; overlays and stretched links are not", async () => {
    const { out } = await run(["check", "test/fixtures/che-chu.html", ...FAST, "--full"]);
    expect(out).toMatch(/soft,text-covered,.*div\.o \\"Camera\\".*covered by div\.o/);
    expect(out).toMatch(/soft,text-covered,.*div\.o \\"Máy_chủ_lưu_trữ\\".*covered by div\.o/);
    expect(out).toMatch(/soft,text-covered,.*khung-so::shadow b \\"23\/26\\".*covered by/);
    // Thanh dính, menu đang mở, liên kết phủ trong suốt, chữ không nhận con trỏ: không báo.
    expect(out).not.toMatch(/text-covered,.*(dinh|duoi-menu|Mở chi tiết|Đoạn chữ trong thẻ|không nhận con trỏ|Đoạn cuối)/);
  }, 120_000);

  it("the narrowest width gets every check, not only overflow", async () => {
    const { out } = await run(["check", "test/fixtures/co-gian.html", "--no-impeccable", "--no-shots", "--viewports", "320", "--schemes", "light", "--full"]);
    expect(out).toMatch(/text-min,.*span#co-transform.*light\/320/);
  }, 120_000);

  it("resize in place: a page that reads the color scheme once at load gets one load per scheme, so dark is really dark", async () => {
    const { out } = await run(["check", "test/fixtures/doc-mau.html", "--no-impeccable", "--no-shots", "--no-standalone", "--viewports", "390,1280", "--full"]);
    expect(out).toContain("each color scheme loaded fresh");
    expect(out).toMatch(/hard,axe,color-contrast,.*dark\/1280 dark\/390/);
    expect(out).not.toMatch(/color-contrast.*light\//);
  }, 120_000);

  it("resize in place: a page laid out by a script that reads the width once is caught by the self-check and measured fresh", async () => {
    const { out } = await run(["check", "test/fixtures/doc-kho.html", "--no-impeccable", "--no-shots", "--no-standalone", "--viewports", "390,1280", "--schemes", "light", "--full"]);
    expect(out).toContain("resize in place not used (layout at 390px after resizing differs from a fresh load)");
    // Nạp mới ở 390 thì bảng 100%: không tràn. Đo trên trang đã đổi khổ sẽ báo tràn nhầm.
    expect(out).toContain("overflow,hard,ok");
  }, 120_000);

  it("--fresh and resize in place give the same findings on a kit block", async () => {
    const args = ["check", "blocks/html/form-dang-nhap.html", "--query", "dk=giay", "--no-impeccable", "--no-shots", "--no-standalone", "--full"];
    const findings = (o: string) => o.slice(o.indexOf("findings"), o.indexOf("notes"));
    const [a, b] = [await run(args), await run([...args, "--fresh"])];
    expect(a.out).not.toContain("resize in place not used");
    expect(findings(a.out)).toBe(findings(b.out));
  }, 120_000);

  it("a .htm page with a strict CSP is checked (axe loads), and line-height exactly 1.2 passes", async () => {
    const { out } = await run(["check", "test/fixtures/csp.htm", "--no-impeccable", "--no-shots", "--no-standalone", "--schemes", "light", "--full"]);
    expect(out).toMatch(/csp\.htm,pass/);
    expect(out).toContain("axe,hard,ok");
    expect(out).toContain("heading-lh,hard,ok");
  }, 120_000);

  it("an infinite animation inside a shadow root that ignores reduced motion is a hard motion failure", async () => {
    const { out } = await run(["check", "test/fixtures/bong-xoay.html", ...FAST, "--full"]);
    expect(out).toMatch(/hard,motion,.*xoay.*prefers-reduced-motion/);
  }, 120_000);

  // Bốn ca reviewer độc lập dựng ra (19/11/2026), mỗi ca từng làm cách đổi khổ tại chỗ cho "pass" trong khi --fresh trượt.
  describe("resize in place: the self-check is not fooled", () => {
    const O = ["--no-impeccable", "--no-shots", "--no-standalone", "--no-copy", "--full"];
    const verdict = (out: string, f: string) => new RegExp(`${f}\\.html,(pass|fail)`).exec(out)?.[1];
    it("a script error that only happens when loaded narrow is reported", async () => {
      const { out } = await run(["check", "test/fixtures/loi-hep.html", "--viewports", "390,1280", ...O]);
      expect(out).toMatch(/hard,errors,page,"uncaught ReferenceError: khoiTaoMenuDiDong/);
    }, 120_000);
    it("an animated body background does not blind the fingerprint", async () => {
      const { out } = await run(["check", "test/fixtures/nen-chay.html", "--viewports", "390,1280", ...O]);
      expect(out).toMatch(/hard,overflow,390px/);
    }, 120_000);
    it("a page that keeps state from a narrow width is redone fresh, so dark at 1280 is measured right", async () => {
      const a = await run(["check", "test/fixtures/an-menu.html", "--viewports", "390,1280", ...O]);
      const b = await run(["check", "test/fixtures/an-menu.html", "--viewports", "390,1280", ...O, "--fresh"]);
      expect(a.out).toContain("after visiting narrower widths differs from the first load");
      expect(verdict(a.out, "an-menu")).toBe(verdict(b.out, "an-menu"));
      expect(a.out).toMatch(/hard,axe,color-contrast,.*dark\/1280/);
    }, 120_000);
    it("with 320 and one wide width the resize is still verified (at the narrowest width)", async () => {
      const { out } = await run(["check", "test/fixtures/doc-kho.html", "--viewports", "320,1280", "--schemes", "light", ...O]);
      expect(out).toContain("layout at 320px after resizing differs from a fresh load");
      expect(out).toContain("overflow,hard,ok");
      expect(out.match(/focus stops inspected at 1280px/g)?.length).toBe(1);
    }, 120_000);
    it("--sweep waits for a width transition before reading overflow", async () => {
      const { out } = await run(["check", "test/fixtures/tran-chuyen.html", "--schemes", "light", "--sweep", ...O]);
      expect(out).toMatch(/hard,overflow,768px/);
    }, 120_000);
  });

  it("pause (WCAG 2.2.2): a marquee that runs forever with no pause control is soft; a spinner or a pause button is fine", async () => {
    const a = await run(["check", "test/fixtures/chay-mai.html", ...FAST, "--full"]);
    expect(a.out).toMatch(/soft,pause,span,"?chay runs forever with no pause or stop control/);
    expect(a.out).not.toMatch(/pause,div\.xoay/);
    const b = await run(["check", "test/fixtures/chay-co-dung.html", ...FAST, "--full"]);
    expect(b.out).toContain("pause,soft,ok");
  }, 120_000);

  it("reveal: text that a scroll reveal never shows with reduced motion is soft; a hover tip and a working reveal are fine", async () => {
    const a = await run(["check", "test/fixtures/hien-dan.html", ...FAST, "--full"]);
    expect(a.out).toMatch(/soft,reveal,h2#phan-1,.*stays invisible/);
    expect(a.out).toMatch(/soft,reveal,h2#phan-2/);
    expect(a.out).not.toMatch(/reveal,span\.meo/);
    const b = await run(["check", "test/fixtures/hien-dan-dung.html", ...FAST, "--full"]);
    expect(b.out).toContain("reveal,soft,ok");
  }, 120_000);

  it("axe-bp: best-practice rules are soft findings of their own, WCAG rules keep their gate", async () => {
    const { out } = await run(["check", "test/fixtures/chay-mai.html", ...FAST, "--full"]);
    expect(out).toMatch(/axe-bp,soft,/);
    expect(out).not.toMatch(/hard,axe-bp/);
  }, 120_000);

  it("--sweep finds overflow that only happens between the default widths", async () => {
    const base = ["check", "test/fixtures/tran-giua.html", "--no-impeccable", "--no-shots", "--no-standalone", "--schemes", "light"];
    expect((await run(base)).out).toContain("overflow,hard,ok");
    const { out } = await run([...base, "--sweep", "--full"]);
    expect(out).toMatch(/hard,overflow,768px,"page is \d+px wide, viewport 768px",light\/768/);
    expect(out).not.toMatch(/overflow,(600|900|1024)px/);
    const both = await run([...base, "--sweep", "--fresh"]);
    expect(both.out).toContain("--sweep needs resize in place");
  }, 120_000);

  it("a page that does not load fails alone; the other pages are still checked", async () => {
    const { out, code } = await run(["check", "test/fixtures/tot.html", "http://127.0.0.1:9/", ...FAST]);
    expect(out).toMatch(/tot\.html,pass/);
    expect(out).toMatch(/hard,.*render,page,"?page did not load/);
    expect(code).toBeUndefined();
    const only = await run(["check", "http://127.0.0.1:9/", ...FAST]);
    expect(only.out).toContain("LOAD_FAILED");
  }, 120_000);

  it("input-zoom: typing fields with small text at phone width are reported, other controls are not", async () => {
    const { out } = await run(["check", "test/fixtures/o-nho.html", ...FAST, "--full"]);
    // Ca rõ ràng ở mọi cách đặt ngưỡng: 13px và 14px bị phóng to, 16px thì không, ô tích không mở bàn phím.
    expect(out).toMatch(/soft,input-zoom,.*input#nho.*13px text: iOS zooms/);
    expect(out).toMatch(/soft,input-zoom,.*select#chon-nho.*14px text: iOS zooms/);
    expect(out).not.toMatch(/input-zoom,.*input#du/);
    expect(out).not.toMatch(/input-zoom,.*input#tich/);
    // 15px vẫn bị phóng trên mọi bản iOS đã phát hành; ô chỉ đọc vẫn nhận focus khi chạm; ô bị khoá thì không.
    expect(out).toMatch(/soft,input-zoom,.*textarea#vua.*15px text: iOS zooms/);
    expect(out).toMatch(/soft,input-zoom,.*input#chi-doc.*13px text: iOS zooms/);
    expect(out).not.toMatch(/input-zoom,.*input#khoa/);
    const wide = await run(["check", "test/fixtures/o-nho.html", "--no-impeccable", "--no-shots", "--viewports", "1280", "--schemes", "light"]);
    expect(wide.out).toContain("input-zoom,soft,skipped");
    // 320 cũng là khổ điện thoại: phép đo chạy ở đó, nên bảng không được ghi "skipped" khi đang có phát hiện.
    const narrow = await run(["check", "test/fixtures/o-nho.html", "--no-impeccable", "--no-shots", "--viewports", "320", "--schemes", "light"]);
    expect(narrow.out).toMatch(/soft,input-zoom,.*input#nho/);
    expect(narrow.out).not.toContain("input-zoom,soft,skipped");
  }, 120_000);

  it("a page without a viewport meta fails: a phone lays it out 980px wide and shrinks it", async () => {
    const { out, code } = await run(["check", "test/fixtures/khong-viewport.html", ...FAST, "--strict", "--full"]);
    expect(out).toContain("fail: 1 of 1");
    expect(out).toMatch(/hard,viewport,.*no <meta name=\\"?viewport\\"?>.*lays out 980px wide/);
    expect(out).toMatch(/16px body text shows at 6\.4px/);
    expect(code).toBe(1);
    // Không có khổ điện thoại nào trong --viewports: không đo, bảng ghi skipped.
    const wide = await run(["check", "test/fixtures/khong-viewport.html", "--no-impeccable", "--no-shots", "--viewports", "1280", "--schemes", "light"]);
    expect(wide.out).toContain("viewport,hard,skipped");
  }, 120_000);

  it("a focus ring drawn only with box-shadow is reported: forced-colors mode removes box-shadow", async () => {
    const { out } = await run(["check", "test/fixtures/vong-bong.html", ...FAST, "--full"]);
    expect(out).toMatch(/focus,.*button#chi-bong.*disappears in forced-colors mode/);
    // Công tắc tuỳ biến: ô thật trong suốt (viền mặc định 1px của nó không ai thấy), vệt bên cạnh chỉ có bóng.
    expect(out).toMatch(/focus,.*input#tu-dong.*disappears in forced-colors mode/);
    // Bóng cộng viền trong suốt (màu hệ thống tô lại viền), và viền thật: không báo.
    expect(out).not.toMatch(/bong-vien-trong.*forced-colors/);
    expect(out).not.toMatch(/input#vien.*forced-colors/);
    expect(out).not.toContain("no visible focus ring");
  }, 120_000);

  it("long-form counts fields a person can see: checkboxes in a closed <details> or a hidden step do not count", async () => {
    // Đóng: 3 ô nhập + 1 công tắc tuỳ biến (ô thật trong suốt vẫn tính). 14 ô tích trong <details> và 6 nhóm radio hidden không tính.
    const closed = await run(["check", "test/fixtures/o-an.html", ...FAST, "--full"]);
    expect(closed.out).toContain("long-form,soft,ok");
    expect(closed.out).not.toContain("fields on one screen");
    // Mở khối nâng cao (?mo=1): 3 + 1 + 14 = 18 ô đang hiện.
    const open = await run(["check", "test/fixtures/o-an.html", ...FAST, "--full", "--query", "mo=1"]);
    expect(open.out).toContain("18 fields on one screen");
  }, 120_000);

  it("passes a page built on the tokens", async () => {
    const { out, code } = await run(["check", "test/fixtures/tot.html", ...FAST, "--strict"]);
    expect(out).toContain("pass: 1 pages, 0 hard failures");
    expect(code).toBeUndefined();
  }, 120_000);
});
