// Hồi quy (soát 25/11/2026): phép đo trong trang gọi thẳng trên trang nhỏ, cộng vài lỗi của mau, impeccable, home, textresize.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser, startServer } from "../src/browser.js";
import { main } from "../src/cli.js";
import { dkCache, ENGINE_VERSION, findImpeccable, runImpeccable } from "../src/impeccable.js";
import { probeCovered, probeFocus, probePage, probeStandalone, STANDALONE_TOKENS } from "../src/probe.js";
import { runStandalone } from "../src/standalone.js";
import { probeFontUnit } from "../src/textresize.js";

const tmp = mkdtempSync(join(tmpdir(), "dk-hoi-quy-"));
let browser: Browser;
beforeAll(async () => {
  ({ browser } = await launchBrowser(process.env));
}, 60_000);
afterAll(async () => {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
});

async function on<T>(css: string, body: string, use: (p: Page) => Promise<T>, width = 1280): Promise<T> {
  const p = await browser.newPage({ viewport: { width, height: 800 } });
  try {
    await p.setContent('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>t</title><style>body{font:16px/1.5 Arial,sans-serif;margin:24px;color:#111;background:#fff}' + css + "</style></head><body><main>" + body + "</main></body></html>");
    return await use(p);
  } finally {
    await p.close();
  }
}
async function run(argv: string[], env: Record<string, string | undefined> = process.env): Promise<{ out: string; code: number | undefined }> {
  let out = "";
  const prev = process.exitCode;
  process.exitCode = undefined;
  await main({ argv, stdout: { write: (c: string) => (out += c) }, runtime: { env, home: "", cwd: tmp } });
  const code = process.exitCode as number | undefined;
  process.exitCode = prev;
  return { out, code };
}

describe("text-min: text in an SVG", () => {
  const svg = (id: string, attrs: string, inner: string, wrap = ""): string => '<div style="' + wrap + '"><svg ' + attrs + ">" + inner.replace("<text", '<text id="' + id + '" x="10" y="50"') + "</svg></div>";
  const small = (body: string, css = ""): Promise<string[]> => on(css, body, async (p) => (await p.evaluate(probePage)).textMin.map((h) => /#([\w-]+)/.exec(h.where)![1]! + " " + h.value));

  it("is measured by its own height on screen, not by the width of the drawing", async () => {
    expect(await small(svg("cao", 'viewBox="0 0 100 1000" width="200" height="200"', '<text font-size="40">42</text>'))).toEqual(["cao 8.0px rendered"]);
    expect(await small(svg("vuong", 'viewBox="0 0 1000 1000" width="200" height="200"', '<text font-size="40">42</text>'))).toEqual(["vuong 8.0px rendered"]);
    expect(await small(svg("bep", 'viewBox="0 0 100 800" width="200" height="200" preserveAspectRatio="none"', '<text font-size="40">42</text>'))).toEqual(["bep 10.0px rendered"]);
    expect(await small(svg("nhom", 'viewBox="0 0 400 400" width="200" height="200"', '<g transform="scale(.5)"><text font-size="40">42</text></g>'))).toEqual(["nhom 10.0px rendered"]);
  });
  it("slanted text is as tall as its line, not as long as its slanted stroke", async () => {
    expect(await small(svg("xien", 'viewBox="0 0 400 200" width="400" height="200"', '<text font-size="11" transform="skewX(30)">42</text>'))).toEqual(["xien 11.0px rendered"]);
  });
  it("a scale within half a percent of 1 is 1", async () => {
    expect(await small(svg("gan-1", 'viewBox="0 0 400 400" width="399" height="399"', '<text font-size="12">42</text>'))).toEqual([]);
  });
  it("stays quiet when the text is large enough on screen", async () => {
    const ok = [
      svg("slice", 'viewBox="0 0 100 1000" width="200" height="200" preserveAspectRatio="xMidYMid slice"', '<text font-size="10">42</text>'),
      // Hình kéo lệch trục: chữ xoay đứng, và chữ tự bù lại trục bị bóp.
      svg("xoay-dung", 'viewBox="0 0 100 400" width="200" height="200" preserveAspectRatio="none"', '<text font-size="20" transform="rotate(90 10 50)">42</text>'),
      svg("tu-bu", 'viewBox="0 0 100 800" width="200" height="200" preserveAspectRatio="none"', '<text font-size="14" transform="scale(1 4)">42</text>'),
      svg("xoay-le", 'viewBox="0 0 400 400" width="200" height="200"', '<text font-size="26" transform="rotate(37)">42</text>'),
      svg("html-xoay", 'viewBox="0 0 400 400" width="400" height="400"', '<text font-size="12">42</text>', "transform:rotate(30deg)"),
      svg("nhom-to", 'viewBox="0 0 400 400" width="200" height="200"', '<g transform="scale(2)"><text font-size="14">42</text></g>'),
      svg("long", 'viewBox="0 0 400 400" width="200" height="200"', '<svg viewBox="0 0 40 40" width="400" height="400"><text font-size="3">42</text></svg>'),
      svg("dung-12", 'viewBox="0 0 300 300" width="100" height="100"', '<text font-size="36">42</text>'),
    ];
    for (const s of ok) expect(await small(s)).toEqual([]);
  });
  it("text that is not drawn, or is pulsing, keeps the old measure", async () => {
    const css = "@keyframes nhip{from{transform:scale(.4)}to{transform:scale(.4001)}}.nhip{animation:nhip 2s linear infinite}";
    const ok = [
      svg("an", 'viewBox="0 0 400 400" width="400" height="400"', '<g opacity="0" transform="scale(.5)"><text font-size="16">42</text></g>'),
      svg("thu", 'viewBox="0 0 400 400" width="400" height="400"', '<g transform="scale(0)"><text font-size="16">42</text></g>'),
      svg("kho", 'viewBox="0 0 400 400" width="400" height="400"', '<defs><g id="k" transform="scale(.1)"><text font-size="16">42</text></g></defs><use href="#k" transform="scale(10)"/>'),
      svg("nhip", 'viewBox="0 0 400 400" width="400" height="400"', '<g class="nhip"><text font-size="16">42</text></g>'),
    ];
    for (const s of ok) expect(await small(s, css)).toEqual([]);
  });
});

describe("body-lh and measure: padding is not a line of text", () => {
  const probe = (css: string, body: string): Promise<{ lh: number; measure: number }> => on(css, body, async (p) => {
    const r = await p.evaluate(probePage);
    return { lh: r.bodyTight.length, measure: r.measure.length };
  });
  const LONG = "Đoạn chữ này đủ dài để xuống dòng trong một khung rộng, nên giãn dòng và độ dài dòng đều phải được đo như cũ. ".repeat(3);
  it("a single line with padding and border is not reported", async () => {
    expect(await probe("li{padding:14px 0;line-height:1.3;border-bottom:1px solid}", "<ul><li>Phòng khách</li></ul>")).toEqual({ lh: 0, measure: 0 });
    expect(await probe("p{padding:20px 0;line-height:1.3;transform:scale(1.5);transform-origin:0 0}", "<p>Phòng khách</p>")).toEqual({ lh: 0, measure: 0 });
  });
  it("a single line in a tall row is not reported: min-height, a tall control, a big icon", async () => {
    expect(await probe("li{min-height:56px;line-height:1.3}", "<ul><li>Phòng khách</li></ul>")).toEqual({ lh: 0, measure: 0 });
    expect(await probe("li{display:flex;align-items:center;gap:12px;line-height:1.3}button{height:64px}", "<ul><li><span>Đèn</span> Phòng khách <button>Bật</button></li></ul>")).toEqual({ lh: 0, measure: 0 });
    expect(await probe("li{line-height:1.3}img{height:60px;width:60px}", '<ul><li><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="> Phòng khách, H<sub>2</sub>O, x<sup>2</sup> <b style="font-size:28px">24°</b></li></ul>')).toEqual({ lh: 0, measure: 0 });
    expect(await probe("li{height:56px;line-height:1.3;transform:scale(.6);transform-origin:0 0}", "<ul><li>Phòng khách</li></ul>")).toEqual({ lh: 0, measure: 0 });
  });
  it("two real lines in a tall row still are, however they come about", async () => {
    const two = [
      ["li{min-height:90px;line-height:1.3;width:120px}", "<ul><li>Phòng khách tầng một</li></ul>"],
      ["li{min-height:90px;line-height:1.3}", "<ul><li>Phòng khách<br>Đang bật</li></ul>"],
      ["li{min-height:90px;line-height:1.3}small{display:block}", "<ul><li>Phòng khách <small>Đang bật</small></li></ul>"],
      ["li{display:flex;align-items:center;min-height:90px;line-height:1.3}span{width:90px}", "<ul><li><span>Phòng khách tầng một</span> Bật</li></ul>"],
      ["p{line-height:.8;width:150px}", "<p>Phòng khách tầng một của nhà mình</p>"],
      ["p{line-height:1.3;width:150px;transform:rotate(90deg);margin:150px}", "<p>Phòng khách tầng một của nhà mình</p>"],
      ["p{line-height:1.3;width:150px;transform:scale(.4)}", "<p>Phòng khách tầng một của nhà mình</p>"],
    ] as const;
    for (const [css, body] of two) expect([css, (await probe(css, body)).lh]).toEqual([css, 1]);
    // Chữ đi vào bằng slot không nằm trong cây của khối.
    const slot = await on("the-x{display:block;width:120px}", "<the-x>Phòng khách tầng một của nhà</the-x>", async (p) => {
      await p.evaluate(() => {
        document.querySelector("the-x")!.attachShadow({ mode: "open" }).innerHTML = '<p style="line-height:1.3;margin:0">Ở <slot></slot></p>';
      });
      return (await p.evaluate(probePage)).bodyTight.length;
    });
    expect(slot).toBe(1);
  });
  it("a padded paragraph of several lines still is", async () => {
    expect(await probe("p{padding:30px;border:4px solid;line-height:1.3;width:1100px}", "<p>" + LONG + "</p>")).toEqual({ lh: 1, measure: 1 });
    expect(await probe("p{padding:30px;line-height:1.3;width:300px}", "<p>Hai dòng chữ nằm trong một khung hẹp có đệm rộng</p>")).toEqual({ lh: 1, measure: 0 });
    expect(await probe("p{padding:30px;box-sizing:border-box;line-height:1.3;width:1100px;transform:scale(.8)}", "<p>" + LONG + "</p>")).toEqual({ lh: 1, measure: 1 });
  });
});

describe("guide: an empty message at the top of the page", () => {
  const dead = async (body: string, root = "body"): Promise<string[]> => {
    const p = await browser.newPage();
    try {
      await p.setContent('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>t</title></head><body>' + (root === "body" ? body : "<the-x></the-x>") + "</body></html>");
      if (root !== "body") await p.evaluate((h) => (document.querySelector("the-x")!.attachShadow({ mode: "open" }).innerHTML = h), body);
      return (await p.evaluate(probePage)).emptyDeadEnd.map((h) => h.where);
    } finally {
      await p.close();
    }
  };
  it("is not a dead end when a button stands next to it, directly or in a block", async () => {
    for (const root of ["body", "shadow"]) {
      expect(await dead("<p>Chưa có dữ liệu</p><button>Thêm phòng</button>", root)).toEqual([]);
      expect(await dead('<h2>Phòng</h2><p>Chưa có dữ liệu</p><p>Thêm phòng đầu tiên để xem nhiệt độ.</p><div><a href="#x">Thêm phòng</a></div>', root)).toEqual([]);
    }
  });
  it("is one when the only actions are in the page frame, or far from it", async () => {
    expect(await dead("<p>Chưa có dữ liệu</p>")).toEqual(["p \"Chưa có dữ liệu\""]);
    expect(await dead('<header><a href="/">Trang chủ</a></header><nav><a href="/b">Bài</a></nav><p>Chưa có dữ liệu</p><footer><a href="/c">Liên hệ</a></footer>')).toHaveLength(1);
    expect(await dead('<header><a href="/">Trang chủ</a></header><main><p>Chưa có dữ liệu</p></main>')).toHaveLength(1);
    expect(await dead("<p>Chưa có dữ liệu</p><p>" + "Nội dung khác của trang. ".repeat(30) + "</p><button>Thêm phòng</button>")).toHaveLength(1);
    expect(await dead("<button>Tiếp</button><p>Chưa có dữ liệu</p><div>Khối khác</div><button>Sắp xếp</button>")).toHaveLength(1);
    expect(await dead("<p>Chưa có dữ liệu</p><button hidden>Thêm phòng</button>")).toHaveLength(1);
  });
});

describe("focus inside two shadow roots", () => {
  const card = (extra: string): string =>
    "<outer-card></outer-card><script>customElements.define('inner-card',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<button>Bật đèn</button>'}});customElements.define('outer-card',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<inner-card></inner-card>'}});</script>" + extra;
  const focus = (extra: string): Promise<boolean> => on("outer-card{display:block}.che{position:fixed;inset:0;background:#fff}", card(extra), async (p) => {
    await p.keyboard.press("Tab");
    const f = await p.evaluate(probeFocus);
    expect(f!.where).toContain("Bật đèn");
    return f!.obscured;
  });
  it("is not reported as covered by its own host, and is when something covers it", async () => {
    expect(await focus("")).toBe(false);
    expect(await focus('<div class="che"></div>')).toBe(true);
  });
});

describe("text-covered: alpha of any color function", () => {
  const covered = (bg: string): Promise<number> => on(".s{display:grid;max-width:400px}.s>*{grid-area:1/1}.v{background:" + bg + "}", '<div class="s"><p>Chữ nằm dưới một lớp phủ.</p><div class="v"></div></div>', async (p) => (await p.evaluate(probeCovered)).length);
  it("a see-through veil is not a cover, an opaque one is", async () => {
    for (const bg of ["oklch(1 0 0 / 0)", "color(srgb 1 1 1 / 0.2)", "lab(100 0 0 / 10%)", "oklch(1 0 0 / none)", "rgb(255 255 255 / 0)", "transparent"]) expect([bg, await covered(bg)]).toEqual([bg, 0]);
    for (const bg of ["oklch(1 0 0)", "oklch(1 0 0 / 0.9)", "color(srgb 1 1 1)", "#fff"]) expect([bg, await covered(bg)]).toEqual([bg, 1]);
  });
});

describe("standalone: CSS the page imports from its own <style>", () => {
  async function standalone(head: string): Promise<string> {
    const d = mkdtempSync(join(tmp, "sa-"));
    const body = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>t</title>' + head + "</head><body><main><p>Nội dung</p></main></body></html>";
    writeFileSync(join(d, "page.html"), body);
    writeFileSync(join(d, "site.css"), "p{background:#e6eefc}");
    writeFileSync(join(d, "chu.css"), "@font-face{font-family:X;src:local(Arial)}");
    const { server, origin } = await startServer(d);
    const p = await browser.newPage();
    try {
      await p.goto(origin + "/page.html");
      const a = await p.evaluate(probeStandalone, STANDALONE_TOKENS);
      const r = await runStandalone(browser, join(d, "page.html"), a, true, { width: 1280, height: 800 }, "light");
      return [...r.findings.map((f) => f.detail), ...r.notes].join("\n");
    } finally {
      await p.close();
      server.close();
    }
  }
  it("is reported when it does not load from a file", async () => {
    expect(await standalone('<style>@import url("site.css");</style>')).toContain("loses 1 stylesheet (site.css)");
    expect(await standalone('<style>@import "chu.css";</style>')).toContain("font stylesheets do not load (chu.css)");
  });
  it("is not when the page never had it, or it carries its own CSS", async () => {
    expect(await standalone('<style>@import "thieu.css"; p{color:red}</style>')).toBe("");
    expect(await standalone('<style>@import url("data:text/css,p{color:red}"); p{color:red}</style>')).toBe("");
  });
});

describe("font-unit: a rule on html", () => {
  const units = (css: string): Promise<string[]> => on(css, "<h1>Bảng giá</h1><p>Đoạn chữ</p>", async (p) => (await p.evaluate(probeFontUnit)).map((h) => h.where));
  it("does not hide itself or the rules after it", async () => {
    // Khổ 1280: 1,3vw = 16,64 px, lớn hơn 16 px nên phần theo khung nhìn thắng.
    expect(await units("html{font-size:max(16px,1.3vw)} h1{font-size:6vw}")).toEqual(["html", "h1"]);
    expect(await units(":root{font-size:1.3vw}")).toEqual([":root"]);
  });
  it("a rule on html that loses, or follows the reader, is not reported", async () => {
    expect(await units("html{font-size:1.3vw} html{font-size:100%} h1{font-size:6vw}")).toEqual(["h1"]);
    expect(await units("html{font-size:calc(1rem + 1vw)}")).toEqual([]);
  });
});

describe("color commands: arguments", () => {
  it("doi-mau creates the folder of --ra", async () => {
    const { out } = await run(["doi-mau", "--huong", "giay", "--nhan", "145", "--ra", "src/styles/giay.css"]);
    expect(out).toContain("pass: 42 pairs");
    expect(existsSync(join(tmp, "src", "styles", "giay.css"))).toBe(true);
  });
  it("an empty hue is refused, not read as 0", async () => {
    for (const bad of [["--nhan="], ["--nhan", " "], ["--nhan", "45", "--trung-tinh="]]) {
      const { out, code } = await run(["doi-mau", "--huong", "dem", ...bad, "--ra", "rong.css"]);
      expect(out).toContain("must be a hue between 0 and 360");
      expect(code).toBe(2);
    }
    expect(existsSync(join(tmp, "rong.css"))).toBe(false);
  });
  it("kiem-mau --huong without a file is a usage error; without the flag it checks the kit", async () => {
    const a = await run(["kiem-mau", "--huong", "giay"]);
    expect(a.out).toContain("--huong needs a file");
    expect(a.code).toBe(2);
    expect((await run(["kiem-mau"])).out).toContain("pass: 126 pairs");
  });
});

describe("Impeccable engine", () => {
  it("IMPECCABLE_BIN that does not exist is an error, not another engine in silence", async () => {
    const env = { ...process.env, IMPECCABLE_BIN: join(tmp, "khong-co.exe") };
    expect(() => findImpeccable(env)).toThrow(/IMPECCABLE_BIN does not exist/);
    const setup = await run(["setup", "--no-browser"], env);
    expect(setup.out).toContain("IMPECCABLE_BIN does not exist");
    expect(setup.out).not.toContain("ready");
    expect(setup.code).toBe(2);
    // Màn mở đầu vẫn hiện, ghi rõ chỗ sai.
    const home = await run([], env);
    expect(home.out).toContain("IMPECCABLE_BIN does not exist");
    expect(home.out).toContain("directions:");
    expect(home.code).toBeUndefined();
    // Rỗng coi như không đặt.
    expect(() => findImpeccable({ IMPECCABLE_BIN: "" })).not.toThrow();
  });
  it("an empty DK_HOME or IMPECCABLE_HOME counts as unset", () => {
    expect(dkCache({ DK_HOME: "" })).toBe(dkCache({}));
    const cwd = process.cwd();
    const exe = process.platform === "win32" ? "impeccable.exe" : "impeccable";
    mkdirSync(join(tmp, "bin", ENGINE_VERSION), { recursive: true });
    writeFileSync(join(tmp, "bin", ENGINE_VERSION, exe), "");
    process.chdir(tmp);
    try {
      expect(findImpeccable({ IMPECCABLE_HOME: "" })).not.toBe(join("bin", ENGINE_VERSION, exe));
    } finally {
      process.chdir(cwd);
    }
  });
  it("an unknown exit code with no findings is an error, not a clean page", async () => {
    // Engine giả: chính node, nạp sẵn một tệp in JSON rồi thoát với mã cần thử (chạy được cả Windows lẫn Linux).
    const prev = process.env["NODE_OPTIONS"];
    const fake = async (code: number, json: string): Promise<{ findings?: unknown[]; error?: string }> => {
      const f = join(tmp, "engine-" + code + ".cjs").replace(/\\/g, "/");
      writeFileSync(f, "require('fs').writeSync(1," + JSON.stringify(json) + ");process.exit(" + code + ")");
      process.env["NODE_OPTIONS"] = '--require "' + f + '"';
      try {
        return await runImpeccable(process.execPath, "http://127.0.0.1/", "1280x800");
      } finally {
        if (prev === undefined) delete process.env["NODE_OPTIONS"];
        else process.env["NODE_OPTIONS"] = prev;
      }
    };
    expect(await fake(0, "[]")).toEqual({ findings: [] });
    expect(await fake(2, '[{"antipattern":"a"}]')).toEqual({ findings: [{ antipattern: "a" }] });
    expect((await fake(1, "[]")).error).toBe("scan failed");
    const odd = await fake(101, "[]");
    expect(odd.findings).toBeUndefined();
    expect(odd.error).toMatch(/exit 101/);
  });
});

describe("home", () => {
  it("names every browser the gate tries, in order", async () => {
    const env = { ...process.env, DK_BROWSER: undefined };
    expect((await run([], env)).out).toContain("Edge, else Chrome (playwright-core channel), else Playwright's Chromium");
    expect(readFileSync(join(__dirname, "..", "src", "browser.ts"), "utf8")).toContain('CHANNELS = ["msedge", "chrome"]');
  });
});
