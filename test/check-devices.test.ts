// Phép đo mềm thêm 24/11/2026: khổ màn có chiều cao, phần dính, khoá hướng, tự phát tiếng, tự xin quyền, phóng chữ, giãn
// chữ, đơn vị cỡ chữ, NFC, ngôn ngữ từng phần, đích chạm; và hai chỗ sửa của motion, focus. Mỗi phép đo có trang sai và
// trang đúng trong test/fixtures/: trang đúng gom các ca dễ báo oan.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { launchBrowser } from "../src/browser.js";
import { main } from "../src/cli.js";
import { onloadFinding } from "../src/onload.js";
import { heightFor, lockedOrientation, parseSize, PROFILES, stickyFinding, SWEEP_SIZES } from "../src/sizes.js";
import { watchNetwork } from "../src/settle.js";
import { zoomPass } from "../src/textresize.js";
import { touchFinding } from "../src/touch.js";

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

const BASE = ["--no-impeccable", "--no-shots", "--no-standalone", "--no-copy", "--no-cache", "--schemes", "light", "--full"];
const check = async (page: string, ...extra: string[]): Promise<string> => (await run(["check", `test/fixtures/${page}.html`, ...BASE, ...(extra.length ? extra : ["--viewports", "390,1280x720"])])).out;
const rows = (out: string, id: string): string[] => out.split("\n").filter((l) => new RegExp(`^\\s+(hard|soft),${id},`).test(l));

describe("sizes", () => {
  it("reads a width or WxH, keeps the old heights of the three default widths", () => {
    expect(parseSize("390")).toEqual({ w: 390, h: 844 });
    expect(parseSize("320")).toEqual({ w: 320, h: 720 });
    expect(parseSize("1280")).toEqual({ w: 1280, h: 800 });
    expect(parseSize("1024")).toEqual({ w: 1024, h: 900 });
    expect(parseSize(" 1280x720 ")).toEqual({ w: 1280, h: 720 });
    expect(parseSize("844×390")).toEqual({ w: 844, h: 390 });
    expect(heightFor(2560)).toBe(900);
    for (const bad of ["99", "5000", "390x", "x390", "390x99", "abc", "12.5"]) expect(parseSize(bad)).toBeUndefined();
  });
  it("the devices profile has real heights, and the sweep reaches 2560 with the two low screens", () => {
    expect(PROFILES["devices"]!.sizes.map((s) => `${s.w}x${s.h}`)).toEqual(["320x568", "390x844", "768x1024", "1280x720", "1920x1080"]);
    expect(Math.max(...SWEEP_SIZES.map((s) => s.w))).toBe(2560);
    expect(SWEEP_SIZES).toContainEqual({ w: 640, h: 360 });
    expect(SWEEP_SIZES).toContainEqual({ w: 844, h: 390 });
  });
  it("rejects an unknown profile, a profile with --viewports, a width given twice and a bad --touch", async () => {
    const bad = async (...a: string[]) => run(["check", "test/fixtures/tot.html", ...a]);
    for (const [args, msg] of [
      [["--profile", "tv"], "unknown profile tv"],
      [["--profile", "devices", "--viewports", "390"], "drop --viewports"],
      [["--profile", "devices", "--fresh"], "--profile devices includes --sweep, which needs resize in place: drop --fresh"],
      [["--viewports", "390x844,390x600"], "each width once"],
      [["--viewports", "390x"], "--viewports: widths between"],
      [["--touch", "500"], "--touch must be"],
      [["--engine", "gecko"], "--engine: chromium or webkit"],
    ] as const) {
      const { out, code } = await bad(...args);
      expect(out).toContain(msg);
      expect(code).toBe(2);
    }
  });
  it("defaults stay 320/390/1280, the profile prints its sizes and measures the page at each", async () => {
    const d = await run(["check", "test/fixtures/mo-dan.html", "--no-impeccable", "--no-shots", "--no-standalone", "--no-copy", "--no-cache", "--schemes", "light"]);
    expect(d.out).toContain("light × 320/390/1280 px via");
    const p = await check("mo-dan", "--profile", "devices");
    expect(p).toMatch(/light × 320x568\/390\/768x1024\/1280x720\/1920x1080 px \+ 14 swept sizes via/);
    expect(p).toContain("pass: 1 pages");
  }, 120_000);
});

describe("engine", () => {
  it("webkit runs when installed, else says how to install it; nothing is downloaded by itself", async () => {
    const { out, code } = await run(["check", "test/fixtures/loi.html", ...BASE, "--viewports", "390", "--engine", "webkit"]);
    if (out.includes("BROWSER_MISSING")) {
      expect(out).toContain("npx playwright install webkit");
      expect(code).not.toBe(0);
      return;
    }
    expect(out).toContain("via webkit (playwright)");
    // Trên WebKit chỉ render và errors còn cứng.
    for (const l of out.split("\n").filter((x) => /^\s+hard,/.test(x))) expect(l).toMatch(/^\s+hard,(render|errors),/);
  }, 120_000);
});

describe("sticky and orientation", () => {
  it("allows 30% of the height, 40% on a low screen", () => {
    const s = (share: number) => ({ share, parts: [{ where: "header", height: 100 }] });
    expect(stickyFinding(s(0.3), 1280, 720)).toBeUndefined();
    expect(stickyFinding(s(0.32), 1280, 720)).toMatch(/take 32% of a 1280x720 screen \(limit 30%\): header 100px/);
    expect(stickyFinding(s(0.39), 844, 390)).toBeUndefined();
    expect(stickyFinding(s(0.35), 900, 470)).toBeUndefined();
    expect(stickyFinding(s(0.35), 900, 480)).toMatch(/limit 30%/);
    expect(stickyFinding(s(0.42), 844, 390)).toMatch(/limit 40%/);
  });
  it("reports bars that stay stuck after scrolling, and a manifest that locks the orientation", async () => {
    const out = await check("man-thap-sai");
    expect(rows(out, "sticky").join("\n")).toMatch(/1280x720,"stuck bars take 40% .*header 120px, div\.loc 72px, footer 96px/);
    expect(rows(out, "orientation").join("\n")).toContain('\\"portrait\\" locks');
  }, 120_000);
  it("the sweep measures stuck bars on low screens too", async () => {
    const out = await check("man-thap-sai", "--viewports", "390", "--sweep");
    expect(rows(out, "sticky").join("\n")).toMatch(/844x390,"stuck bars take 7\d%/);
    expect(rows(out, "sticky").join("\n")).toMatch(/640x360,/);
  }, 120_000);
  it("leaves side columns, decoration, an app shell that scrolls itself, live regions, sticky blocks not stuck yet, a menu opened by a step, and orientation any", async () => {
    const out = await check("man-thap-dung", "--viewports", "390,1280x720", "--steps", '[{"name":"mo","do":[{"click":"#mo"}]}]');
    expect(out).toContain("#mo,");
    expect(out).toContain("sticky,soft,ok");
    expect(out).toContain("orientation,soft,ok");
  }, 120_000);
  it("a sticky bar on a page that does not scroll takes no room; in a shell that scrolls itself, or fixed, it still does (25/11/2026)", async () => {
    const d = join(root, ".design-kit", "test", "dinh-ngan");
    mkdirSync(d, { recursive: true });
    const page = async (name: string, css: string, body: string): Promise<string> => {
      writeFileSync(join(d, `${name}.html`), `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dính</title><style>body{margin:0;font:1rem/1.5 system-ui;color:#111;background:#fff}header{height:300px;background:#dde}h1{margin:0}${css}</style></head><body>${body}</body></html>`);
      return rows((await run(["check", `.design-kit/test/dinh-ngan/${name}.html`, ...BASE, "--viewports", "390x844,1280x720"])).out, "sticky").join("\n");
    };
    const bar = "<header><h1>Đăng nhập</h1></header>";
    expect(await page("ngan", "header{position:sticky;top:0}", `<main>${bar}<p>Trang ngắn hơn một màn.</p></main>`)).toBe("");
    expect(await page("co-dinh", "header{position:fixed;top:0;left:0;right:0}", `${bar}<main style="padding-top:310px"><p>Trang ngắn hơn một màn.</p></main>`)).toContain("stuck bars take");
    expect(await page("vo-cuon", "html,body{height:100%}.vo{height:100vh;overflow:auto}header{position:sticky;top:0}", `<main class="vo">${bar}<p style="height:2400px">Vỏ tự cuộn.</p></main>`)).toContain("stuck bars take");
    // Vỏ app có thanh tiêu đề: thanh dính ở mép khung cuộn (kể cả đệm và viền của nó), không phải ở mép màn.
    const SHELL = "html,body{height:100%}body{display:flex;flex-direction:column}nav{height:56px;flex:none}main{overflow:auto;flex:1;padding:16px 0;border-top:3px solid}header{position:sticky;top:0}";
    const pane = (inner: string): string => `<nav>Ứng dụng</nav><main>${inner}</main>`;
    expect(await page("khung", SHELL, pane(`${bar}<p style="height:2400px">Khung cuộn dưới thanh tiêu đề.</p>`))).toMatch(/header 300px/);
    expect(await page("khung-day", `${SHELL}header{top:auto;bottom:0}`, pane(`<p style="height:2400px">Ô nhắn ở đáy khung.</p>${bar}`))).toMatch(/header 300px/);
    expect(await page("khung-long", SHELL, pane(`<div style="overflow:hidden auto">${bar}</div><p style="height:2400px">Khung không cuộn nằm trong khung cuộn.</p>`))).toBe("");
    // Chưa dính, hay khung nằm trong một trang tự cuộn (cuộn trang thì khung đi theo): không chiếm chỗ.
    expect(await page("khung-chua-dinh", SHELL, pane(`<p style="height:200px">Đoạn đầu.</p>${bar}<p style="height:2400px">Khung cuộn.</p>`))).toBe("");
    expect(await page("khung-trong-trang", ".bang{margin:1000px 0;height:400px;overflow:auto}header{position:sticky;top:0}", `<main><div class="bang">${bar}<p style="height:900px">Bảng dài.</p></div></main>`)).toBe("");
    // Vỏ app: thanh nằm cạnh khung cuộn, không nằm trong nó, nhưng chiếm chỗ suốt lúc đọc.
    expect(await page("vo-canh", "html,body{height:100%}body{display:flex;flex-direction:column}header{position:sticky;top:0;flex:none}main{overflow:auto}", `${bar}<main><p style="height:2400px">Khung cuộn riêng.</p></main>`)).toContain("stuck bars take");
  }, 120_000);
  it("CSS that turns the page back when the device turns is a soft orientation finding (axe css-orientation-lock)", async () => {
    const out = await check("khoa-huong-css", "--viewports", "1280x720");
    expect(rows(out, "orientation").join("\n")).toMatch(/soft,orientation,css-orientation-lock/);
    // Không có khổ điện thoại vẫn đo: bảng không được ghi là bỏ qua.
    expect(out).toMatch(/orientation,soft,"?1 soft/);
    expect(out).toContain("axe,hard,ok");
  }, 120_000);
  it("reads the manifest's orientation, also from broken JSON without failing", () => {
    expect(lockedOrientation('{"orientation":"landscape-primary"}')).toBe("landscape-primary");
    // Tệp có BOM (PowerShell, Notepad ghi): trình duyệt đọc được thì cổng cũng phải đọc (25/11/2026).
    expect(lockedOrientation('\uFEFF{"orientation":"portrait"}')).toBe("portrait");
    for (const m of ['{"orientation":"any"}', "{}", "not json", '{"orientation":3}']) expect(lockedOrientation(m)).toBeUndefined();
  }, 120_000);
});

describe("autoplay and permission", () => {
  it("words each kind", () => {
    expect(onloadFinding({ kind: "sound", what: "audio.play()", at: 40 })).toEqual({ check: "autoplay", where: "audio.play()", detail: expect.stringContaining("40 ms after load") });
    expect(onloadFinding({ kind: "permission", what: "getUserMedia(microphone)", at: 0 }).check).toBe("permission");
  });
  it("reports every way to make sound or ask before any tap, even though the gate's browser blocks the sound", async () => {
    const out = await check("tu-keu-sai", "--viewports", "390");
    const a = rows(out, "autoplay").join("\n");
    for (const w of ["audio.play()", "OscillatorNode.start()", "speechSynthesis.speak()", 'id=\\"nen\\" autoplay']) expect(a).toContain(w);
    const p = rows(out, "permission").join("\n");
    for (const w of ["getUserMedia(microphone)", "Notification.requestPermission()", "geolocation.getCurrentPosition()"]) expect(p).toContain(w);
    expect(rows(out, "autoplay").every((l) => /^\s+soft,/.test(l))).toBe(true);
  }, 120_000);
  it("leaves sound and permission behind a button, muted autoplay, an idle AudioContext, offline rendering and permissions.query", async () => {
    const out = await check("tu-keu-dung", "--viewports", "390");
    expect(out).toContain("autoplay,soft,ok");
    expect(out).toContain("permission,soft,ok");
    // Các bản --fresh (nạp riêng mỗi khổ) đọc cùng một sổ.
    expect(rows(await check("tu-keu-sai", "--viewports", "390,1280", "--fresh"), "permission")).toHaveLength(3);
  }, 120_000);
});

describe("autoplay on an element that is not in the page (25/11/2026)", () => {
  it("reports new Audio(url) with autoplay = true", async () => {
    const r = rows(await check("tieng-roi-sai", "--viewports", "390"), "autoplay");
    expect(r).toHaveLength(1);
    expect(r[0]).toContain('id=\\"nhac-nen\\" autoplay');
  }, 120_000);
  it("leaves one muted after, without a file, switched off again, paused at once, at volume 0, or set behind a button", async () => {
    expect(await check("tieng-roi-dung", "--viewports", "390")).toContain("autoplay,soft,ok");
  }, 120_000);
});

describe("text-zoom, text-spacing, font-unit", () => {
  it("reports px text once per selector, text that spacing cuts, and a viewport-unit font-size", async () => {
    const out = await check("phong-chu-sai");
    expect(rows(out, "text-zoom")).toHaveLength(2);
    expect(rows(out, "text-zoom").join("\n")).toMatch(/p\.nhap,/);
    expect(rows(out, "text-zoom")[0]).toMatch(/p\.px,"text does not follow the reader's font size \(16px → 16px at 200%, 2 elements\)/);
    expect(rows(out, "text-spacing").join("\n")).toMatch(/div#hop-hai-dong .*at 390px/);
    expect(rows(out, "text-spacing").join("\n")).toMatch(/div#hop-hai-dong .*at 1280px/);
    expect(rows(out, "font-unit").join("\n")).toMatch(/h1,.*4vw/);
    // Luật nằm trong tệp @import cũng thấy.
    expect(rows(out, "font-unit").join("\n")).toMatch(/\.nhap,.*4\.2vw/);
    expect(out).toContain("pass: 1 pages");
  }, 120_000);
  it("leaves rem text, a clamp() with a rem part behind a variable, a smaller step on narrow layouts, transition: all, and data-zoom-ok", async () => {
    const out = await check("phong-chu-dung");
    for (const id of ["text-zoom", "text-spacing", "font-unit"]) expect(out).toContain(`${id},soft,ok`);
    // Đo xong phải trả trang về cỡ chữ cũ: motion nạp lại, còn --fresh đo focus trước đó không được báo lỗi.
    const fresh = await check("phong-chu-dung", "--viewports", "390,1280", "--fresh");
    for (const id of ["text-zoom", "text-spacing", "font-unit"]) expect(fresh).toContain(`${id},soft,ok`);
  }, 120_000);
});

describe("nfc and lang-part", () => {
  it("reports letters typed as base + mark (text and alt), Han without lang, and English sentences split across spans", async () => {
    const out = await check("ngon-ngu-sai", "--viewports", "1280");
    expect(rows(out, "nfc").map((l) => l.split(",")[2])).toEqual(["p#roi", '"img[alt]"']);
    const l = rows(out, "lang-part").join("\n");
    expect(l).toMatch(/p#han,.*你好/);
    expect(l).toMatch(/p#anh,.*The children are playing/);
    expect(l).toMatch(/p#anh-2,.*She has been waiting/);
    expect(rows(out, "lang-part")).toHaveLength(3);
  }, 120_000);
  it("leaves precomposed Vietnamese, zh/ja/en spans, product names, addresses, code, data-lang-ok, unaccented Vietnamese and Ω", async () => {
    const out = await check("ngon-ngu-dung", "--viewports", "1280");
    expect(out).toContain("nfc,soft,ok");
    expect(out).toContain("lang-part,soft,ok");
  }, 120_000);
});

describe("touch", () => {
  it("words the size", () => {
    expect(touchFinding({ where: "button", w: 30, h: 30 }, 44)).toMatch(/^30×30 px on a touch screen, want 44×44/);
  });
  it("reports small buttons, low buttons, chips and a bare checkbox; --touch 24 and 0 change the bar", async () => {
    const out = await check("cham-sai", "--viewports", "390");
    expect(rows(out, "touch").map((l) => /#([\w-]+)/.exec(l)?.[1])).toEqual(["dong", "thap", "the-loc", "o-tich", "noi-ngang", "trong-khung"]);
    expect(rows(await check("cham-sai", "--viewports", "390", "--touch", "24"), "touch")).toHaveLength(0);
    expect(await check("cham-sai", "--viewports", "390", "--touch", "0")).toContain("touch,soft,skipped");
    expect(await check("cham-sai", "--viewports", "1280")).toContain("touch,soft,skipped");
  }, 120_000);
  it("measures a tablet width too", async () => {
    expect(rows(await check("cham-sai", "--viewports", "768x1024"), "touch").join("\n")).toContain("touch/768");
  }, 120_000);
  it("leaves 44px targets, ::after that widens the hit area, labels around or for a control, links in a sentence, disabled and hidden ones", async () => {
    expect(await check("cham-dung", "--viewports", "390")).toContain("touch,soft,ok");
  }, 120_000);
});

describe("touch: a label over a 1px checkbox (25/11/2026)", () => {
  it("probes the label's hit area, not the hidden box: the padded label passes, the bare one is reported", async () => {
    expect(rows(await check("nhan-o-giau", "--viewports", "390"), "touch").map((l) => /#([\w-]+)/.exec(l)?.[1])).toEqual(["khong-dem"]);
  }, 120_000);
});

describe("motion and focus, corrected 24/11/2026", () => {
  it("a fade or color change that keeps running with reduced motion is allowed; one that moves things stays hard", async () => {
    expect(await check("mo-dan", "--viewports", "390")).toContain("motion,hard,ok");
    expect(rows(await check("bong-xoay", "--viewports", "390"), "motion")).toHaveLength(1);
  }, 120_000);
  it("motion that does not use transform (background-size) stays hard: only opacity and colors are let through", async () => {
    expect(rows(await check("nen-phong", "--viewports", "390"), "motion").join("\n")).toMatch(/hard,motion,.*phong/);
  }, 120_000);
  it("a ring thinner than 2px is told apart from no ring", async () => {
    const d = join(root, ".design-kit", "test", "vong");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "a.html"), '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vòng</title><style>body{font:1rem/1.6 system-ui;background:#fff;color:#111}button{min-height:44px;font:inherit}#mong:focus{outline:1px solid #000}#mat:focus{outline:none}</style></head><body><main><h1>Vòng focus</h1><button id="mong">Vòng mỏng</button><button id="mat">Mất vòng</button></main></body></html>');
    const { out } = await run(["check", ".design-kit/test/vong/a.html", ...BASE, "--viewports", "390"]);
    expect(rows(out, "focus").join("\n")).toMatch(/button#mong .*thinner than 2px/);
    expect(rows(out, "focus").join("\n")).toMatch(/button#mat .*no visible focus ring/);
  }, 120_000);
  it("after the 200% pass the page is back at its own text size", async () => {
    const { browser } = await launchBrowser(process.env);
    try {
      const page = await browser.newPage();
      const net = watchNetwork(page);
      await page.setContent('<!doctype html><html lang="vi"><body><p id="p" style="font-size:1rem">Chữ theo người đọc</p></body></html>');
      expect(await zoomPass(page, net)).toEqual([]);
      expect(await page.evaluate(() => getComputedStyle(document.getElementById("p")!).fontSize)).toBe("16px");
    } finally {
      await browser.close();
    }
  }, 120_000);
  it("the browser's own focus ring counts as visible", async () => {
    expect(await check("cham-dung", "--viewports", "390")).toContain("focus,soft,ok");
  }, 120_000);
});
