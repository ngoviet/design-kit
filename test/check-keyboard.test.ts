// Phép đo bàn phím (keyboard, tab-trap, skip-link, dialog-focus), giả lập máy người dùng (contrast-more, forced-colors, offline,
// aria-state) và so kiểu focus, thêm 24/11/2026. Gọi thẳng các hàm qua trình duyệt, không qua lệnh check. Mỗi phép đo có trang
// sai và trang đúng trong test/fixtures/: trang đúng gom các ca dễ báo oan.
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser, startServer } from "../src/browser.js";
import { ariaStateWatch, contrastMorePass, type EmulateFinding, forcedColorsPass, offlinePass, registersWorker } from "../src/emulate.js";
import { cycleOf, dialogFocusPass, focusLogWatch, keyboardPass, type KeyboardFinding, tabPass } from "../src/keyboard.js";
import { probeFocus, rememberUnfocused, settleAnimations } from "../src/probe.js";
import { type NetWatch, settlePage, watchNetwork } from "../src/settle.js";
import { runActions, type StepAction } from "../src/steps.js";

const root = resolve(join(__dirname, ".."));
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
let browser: Browser;
let server: Server;
let origin = "";

beforeAll(async () => {
  ({ browser } = await launchBrowser(process.env));
  ({ server, origin } = await startServer(root));
}, 120_000);
afterAll(async () => {
  await browser.close();
  server.close();
});

async function on<T>(where: string, f: (page: Page, net: NetWatch) => Promise<T>, html = false): Promise<T> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    const net = watchNetwork(page);
    if (html) await page.setContent(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Thử</title></head><body>${where}</body></html>`);
    else await page.goto(`${origin}/test/fixtures/${where}`, { waitUntil: "load" });
    await settlePage(page, net);
    return await f(page, net);
  } finally {
    await page.close();
  }
}
const ids = (list: Array<KeyboardFinding | EmulateFinding>): string[] => list.map((f) => /#([\w-]+)/.exec(f.where)?.[1] ?? f.where);
const text = (list: Array<KeyboardFinding | EmulateFinding>): string => list.map((f) => `${f.check} ${f.where}: ${f.detail}`).join("\n");

describe("keyboard", () => {
  it("reports every kind of thing a mouse can press and Tab cannot reach, grouped, in shadow roots too", async () => {
    const list = await on("ban-phim-sai.html", (p) => keyboardPass(p, 20));
    expect(list.every((f) => f.check === "keyboard")).toBe(true);
    expect(ids(list)).toEqual(["thuoc-tinh", "trinh-nghe", "con-tro", "khong-href", "nhan-tep", "tab-am", "lua-chon", "hang", 'div.the "Thẻ một"', "trong-bong", "ten-nut", "tab-am-xa", "the-bai"]);
    const t = text(list);
    expect(t).toMatch(/#thuoc-tinh .*has onclick but Tab/);
    expect(t).toMatch(/#trinh-nghe .*has a click listener but Tab/);
    expect(t).toMatch(/#con-tro .*hand cursor/);
    expect(t).toMatch(/div\.the .*\(3 like this\)/);
    expect(t).toMatch(/#nhan-tep .*label of a control that Tab cannot reach/);
    expect(t).toMatch(/the-bam::shadow div#trong-bong/);
  });
  it("caps the list and says how many are left", async () => {
    const list = await on("ban-phim-sai.html", (p) => keyboardPass(p));
    expect(list).toHaveLength(6);
    expect(list[5]!.where).toBe("+8 more");
  });
  it("leaves labels, cards with a link, hidden things, delegated listeners, stopPropagation, drop zones, arrow-key widgets, helper buttons, backdrops, canvas and data-keyboard-ok", async () => {
    expect(text(await on("ban-phim-dung.html", (p) => keyboardPass(p, 30)))).toBe("");
  });
  it("leaves nothing behind on the page", async () => {
    await on("ban-phim-sai.html", async (p) => {
      await keyboardPass(p);
      expect(await p.evaluate(() => "__dkListen" in window)).toBe(false);
    });
  });
  it("a backdrop is left alone only when something else closes the overlay", async () => {
    const lop = (nut: string): string => `<main><h1>Thử</h1></main><div id="phu" style="position:fixed;inset:0" onclick="this.remove()"></div>${nut}`;
    expect(ids(await on(lop('<button type="button">Lưu</button>'), (p) => keyboardPass(p), true))).toEqual(["phu"]);
    expect(await on(lop('<button type="button">Đóng</button>'), (p) => keyboardPass(p), true)).toEqual([]);
    expect(await on(lop('<button type="button" aria-expanded="true">Trình đơn</button>'), (p) => keyboardPass(p), true)).toEqual([]);
    // Nút đóng đang ẩn thì không tính.
    expect(ids(await on(lop('<button type="button" style="display:none">Đóng</button>'), (p) => keyboardPass(p), true))).toEqual(["phu"]);
    // Lớp phủ nhỏ hay có chữ là một nút thật.
    expect(ids(await on('<main><h1>Thử</h1></main><div id="nho" style="position:fixed;left:0;top:0;width:200px;height:60px" onclick="this.remove()"></div><button type="button">Đóng</button>', (p) => keyboardPass(p), true))).toEqual(["nho"]);
    expect(ids(await on('<div id="chu" style="position:fixed;inset:0" onclick="this.remove()">Chạm để bắt đầu</div><button type="button">Đóng</button>', (p) => keyboardPass(p), true))).toEqual(["chu"]);
  });
  it("with a modal dialog open only the dialog is measured", async () => {
    const trang = '<main><div id="sau" onclick="this.dataset.x=1">Phía sau</div></main><dialog id="d" aria-label="Hộp"><div id="trong" onclick="this.dataset.x=1">Trong hộp</div><button>Đóng</button></dialog>';
    const list = await on(trang, async (p) => {
      await p.evaluate(() => (document.getElementById("d") as HTMLDialogElement).showModal());
      return keyboardPass(p);
    }, true);
    expect(ids(list)).toEqual(["trong"]);
  });
  it("a menu or listbox is exempt only while something Tab reaches drives it", async () => {
    const muc = (mo: string): string => `<button type="button" id="mo">Mở</button><div role="menu" ${mo}><div role="menuitem" tabindex="-1" id="m" style="cursor:pointer">Đổi tên</div></div>`;
    expect(ids(await on(muc(""), (p) => keyboardPass(p), true))).toEqual(["m"]);
    expect(await on(muc('tabindex="0"'), (p) => keyboardPass(p), true)).toEqual([]);
    const dangFocus = await on(muc(""), async (p) => {
      await p.evaluate(() => document.getElementById("m")!.focus());
      return keyboardPass(p);
    }, true);
    expect(dangFocus).toEqual([]);
    // Thanh công cụ có nút Tab tới được không miễn cho một khối thường nằm trong nó.
    expect(ids(await on('<div role="toolbar" aria-label="Công cụ"><button type="button">Đậm</button><div id="k" onclick="this.dataset.x=1">Nghiêng</div></div>', (p) => keyboardPass(p), true))).toEqual(["k"]);
  });
  it("a library root that listens for everything is a frame, not a button; a listener on a small block is", async () => {
    const list = await on('<div id="goc"><p>Trang tĩnh</p></div><div id="app"><p>Trang tĩnh</p></div><div id="nut"><p>Bấm vào đây</p></div>', async (p) => {
      await p.evaluate(() => {
        const g = document.getElementById("goc")!;
        for (const t of "click keydown keyup keypress mousedown mouseup mouseover mouseout pointerdown pointerup pointerover pointerout touchstart touchend touchmove wheel scroll input change focusin focusout copy paste cut".split(" ")) g.addEventListener(t, () => undefined);
        for (const id of ["app", "nut"]) document.getElementById(id)!.addEventListener("click", () => undefined);
      });
      return keyboardPass(p);
    }, true);
    expect(ids(list)).toEqual(["nut"]);
  });
  it("a number field elsewhere on the page does not excuse a button taken out of the Tab order", async () => {
    const nut = '<button type="button" tabindex="-1" id="x" style="cursor:pointer">Sao chép</button>';
    expect(ids(await on(`<main><div>${nut}</div><div><input type="number" aria-label="Số"></div></main>`, (p) => keyboardPass(p), true))).toEqual(["x"]);
    expect(await on(`<main><div>${nut}<input type="number" aria-label="Số"></div></main>`, (p) => keyboardPass(p), true)).toEqual([]);
  });
  it("a listener next to a text field is left alone only when it is just a listener", async () => {
    const nghe = (html: string): Promise<KeyboardFinding[]> => on(html, async (p) => {
      await p.evaluate(() => {
        for (const e of Array.from(document.querySelectorAll(".nghe"))) e.addEventListener("click", () => window.scrollTo(0, 0));
      });
      return keyboardPass(p);
    }, true);
    expect(ids(await nghe('<div><span class="nghe" id="kinh">Tìm</span> <input aria-label="Từ khoá"></div><div><span class="nghe" id="xa">Xa ô gõ</span></div>'))).toEqual(["xa"]);
    expect(ids(await nghe('<div><span class="nghe" id="kinh" style="cursor:pointer">Tìm</span> <input aria-label="Từ khoá"></div>'))).toEqual(["kinh"]);
    // Nghe click cạnh một ô tích không phải là đưa con trỏ vào ô gõ.
    expect(ids(await nghe('<div><span class="nghe" id="t">Mở</span> <input type="checkbox" aria-label="Nhớ"></div>'))).toEqual(["t"]);
  });
  it("a custom element with a closed shadow root is not judged from outside", async () => {
    const list = await on('<the-dong id="t" style="display:block;cursor:pointer"></the-dong>', async (p) => {
      await p.evaluate(() => {
        const w = window as unknown as { __dkClosed: WeakSet<Element> };
        w.__dkClosed = new WeakSet([document.getElementById("t")!]);
        document.getElementById("t")!.textContent = "Thẻ";
      });
      return keyboardPass(p);
    }, true);
    expect(list).toEqual([]);
  });
});

describe("tab-trap", () => {
  it("finds the repeating tail, not a natural lap of the page", () => {
    expect(cycleOf([1, 2, 3, 2, 3, 2, 3])).toBe(2);
    expect(cycleOf([1, 2, 3, 4, 2, 3, 4, 2, 3, 4])).toBe(3);
    expect(cycleOf([1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0])).toBe(0);
    expect(cycleOf([5, 5, 5, 5, 5, 5, 5, 5])).toBe(0);
    expect(cycleOf(Array.from({ length: 14 }, () => 5))).toBe(1);
    expect(cycleOf([1, 2, 3, 2, 3])).toBe(0);
  });
  it("reports a region that keeps Tab while the page has other stops", async () => {
    const list = await on("ban-phim-bay-sai.html", tabPass);
    expect(list).toHaveLength(1);
    expect(text(list)).toMatch(/tab-trap button#n1 .*goes round 3 stops only, it cannot reach a#dau .*a#sau/);
  });
  it("leaves date fields, radios, a player, an iframe full of links, and an editor that Esc frees", async () => {
    expect(await on("ban-phim-bay-dung.html", tabPass)).toEqual([]);
  });
  it("an element that eats Tab and does not let go is reported; a modal dialog, data-tab-trap-ok and a page with nothing else are not", async () => {
    const o = (attr = ""): string => `<main ${attr}><p><a href="#a" id="a">Liên kết</a></p><div id="o" tabindex="0" role="application" aria-label="Bảng vẽ" style="height:40px"></div></main>`;
    const an = (p: Page): Promise<void> => p.evaluate(() => document.getElementById("o")!.addEventListener("keydown", (e) => e.key === "Tab" && e.preventDefault()));
    const thu = (html: string): Promise<KeyboardFinding[]> => on(html, async (p) => {
      await an(p);
      return tabPass(p);
    }, true);
    expect(text(await thu(o()))).toMatch(/div#o .*never leaves this element, it cannot reach a#a/);
    expect(await thu(o('data-tab-trap-ok="trò chơi dùng phím Tab"'))).toEqual([]);
    expect(await thu('<main><div id="o" tabindex="0" role="application" aria-label="Bảng vẽ" style="height:40px"></div></main>')).toEqual([]);
    const giu = '<main><a href="#a">Sau hộp</a></main><div role="dialog" aria-modal="true" aria-label="Hộp" id="o"><button id="b1">Một</button><button id="b2">Hai</button></div>';
    const hop = await on(giu, async (p) => {
      await p.evaluate(() => {
        document.getElementById("o")!.addEventListener("keydown", (e) => {
          if (e.key !== "Tab") return;
          e.preventDefault();
          document.getElementById(document.activeElement!.id === "b1" ? "b2" : "b1")!.focus();
        });
      });
      return tabPass(p);
    }, true);
    expect(hop).toEqual([]);
  });
  it("puts the page back: no focus, same scroll, nothing on window", async () => {
    await on("ban-phim-bo-qua-dung.html", async (p) => {
      await p.evaluate(() => window.scrollTo(0, 120));
      await tabPass(p);
      expect(await p.evaluate(() => [document.activeElement === document.body, scrollY, document.body.hasAttribute("tabindex"), "__dkStops" in window])).toEqual([true, 120, false, false]);
    });
  });
});

describe("skip-link", () => {
  it("reports a page without one, with a hidden one, and with one that points nowhere", async () => {
    expect(text(await on("ban-phim-bo-qua-sai.html", tabPass))).toMatch(/skip-link a#logo .*5 navigation links come before <main> and none of the first 3/);
    expect(text(await on("ban-phim-bo-qua-sai.html?kieu=giau", tabPass))).toMatch(/skip-link a#bq .*stays hidden/);
    expect(text(await on("ban-phim-bo-qua-sai.html?kieu=hong", tabPass))).toMatch(/skip-link a#bq .*#khong-co, which is not on the page/);
  });
  it("leaves one that comes third after the logo and slides into view", async () => {
    expect(await on("ban-phim-bo-qua-dung.html", tabPass)).toEqual([]);
  });
  it("asks for one only with five visible links in a nav before main", async () => {
    const trang = (nav: string, sau = ""): string => `${nav}<main><h1>Bài</h1>${sau}</main>`;
    const lk = (n: number, kieu = ""): string => `<nav aria-label="Chính">${Array.from({ length: n }, (_, i) => `<a href="/${i}" ${kieu}>Mục ${i}</a> `).join("")}</nav>`;
    expect(await on(trang(lk(4)), tabPass, true)).toEqual([]);
    expect(await on(trang(lk(5)), tabPass, true)).toHaveLength(1);
    expect(await on(trang(lk(6, 'style="display:none"')), tabPass, true)).toEqual([]);
    expect(await on(trang("", lk(6)), tabPass, true)).toEqual([]);
    expect(await on(trang(`<div data-skip-ok="trang một màn">${lk(6)}</div>`), tabPass, true)).toEqual([]);
    expect(await on(trang(`<div>${lk(6).replace("<nav", "<div").replace("</nav>", "</div>")}</div>`), tabPass, true)).toEqual([]);
    // Đích là main, kể cả khi trong main còn một nav (mục lục).
    expect(await on(`<a href="#nd">Đi tiếp</a>${lk(5)}<main id="nd"><h1>Bài</h1><nav aria-label="Mục lục"><a href="#x">1</a></nav></main>`, tabPass, true)).toEqual([]);
    // Trang đặt sẵn focus ở giữa: vẫn đo từ đầu trang.
    expect(await on(`<a href="#nd">Bỏ qua tới nội dung</a>${lk(5)}<main id="nd"><h1>Bài</h1><input aria-label="Tìm"><a href="/1">1</a> <a href="/2">2</a> <a href="/3">3</a> <a href="/4">4</a></main>`, async (p) => {
      await p.evaluate(() => document.querySelector("input")!.focus());
      return tabPass(p);
    }, true)).toEqual([]);
    // Bốn điểm dừng trước liên kết bỏ qua là quá muộn.
    const muon = `<a href="/l">Logo</a><button>Tìm</button><button>Giỏ</button><a href="#nd">Bỏ qua tới nội dung</a>${lk(5)}<main id="nd"><h1>Bài</h1></main>`;
    expect(await on(muon, tabPass, true)).toHaveLength(1);
    // Đích là một neo đứng giữa nav và main.
    expect(await on(`<a href="#neo">Đi tiếp</a>${lk(5)}<span id="neo"></span><main><h1>Bài</h1></main>`, tabPass, true)).toEqual([]);
    expect(await on(`<a href="#truoc">Đi tiếp</a><span id="truoc"></span>${lk(5)}<main><h1>Bài</h1></main>`, tabPass, true)).toHaveLength(1);
  });
});

describe("dialog-focus", () => {
  const mo = (trang: string, act: StepAction[]): Promise<KeyboardFinding[]> => on(trang, async (p, net) => {
    expect(await runActions(p, act, net, [focusLogWatch])).toBeUndefined();
    return dialogFocusPass(p);
  });
  it("reports focus left behind, Tab that gets out, and Escape that does nothing", async () => {
    const t = text(await mo("ban-phim-hop-sai.html", [{ click: "#mo-ngoai" }]));
    expect(t).toMatch(/div#hop-ngoai "Chọn ngày": focus stays on button#mo-ngoai/);
    expect(t).toMatch(/focus leaves the modal dialog \(Tab → .*; Shift\+Tab → /);
    expect(t).toMatch(/Escape does not close the dialog/);
    // Đóng bằng nút Đóng rồi vẫn phải trả focus.
    expect(t).toMatch(/closing the dialog drops focus to the top of the page, not back to button#mo-ngoai/);
  });
  it("reports focus lost or sent elsewhere on close, and a native dialog that blocks Escape", async () => {
    const roi = await mo("ban-phim-hop-sai.html", [{ click: "#mo-roi" }]);
    expect(roi).toHaveLength(1);
    expect(text(roi)).toMatch(/drops focus to the top of the page, not back to button#mo-roi/);
    const lac = await mo("ban-phim-hop-sai.html", [{ click: "#mo-lac" }]);
    expect(lac).toHaveLength(1);
    expect(text(lac)).toMatch(/moves focus to a#khac .*, not back to button#mo-lac/);
    const kin = await mo("ban-phim-hop-sai.html", [{ click: "#mo-kin" }]);
    expect(kin).toHaveLength(1);
    expect(text(kin)).toMatch(/dialog#hop-kin "Cảnh báo": Escape does not close/);
  });
  it("leaves a native dialog, nested dialogs, an alertdialog, a library dialog with guards and late focus, one opened from a menu or a plain div, and data-dialog-ok", async () => {
    for (const act of [
      [{ click: "#mo-goc" }],
      [{ click: "#mo-goc" }, { click: "#mo-trong" }],
      [{ click: "#mo-hoi" }],
      [{ click: "#mo-thu-vien" }],
      [{ click: "#mo-menu" }, { click: "#mo-tu-menu" }],
      [{ click: "#mo-hoi" }, { click: "#hoi-huy" }, { click: "#mo-div" }],
      [{ click: "#mo-mien" }],
    ] as StepAction[][]) {
      expect(`${JSON.stringify(act)} ${text(await mo("ban-phim-hop-dung.html", act))}`).toBe(`${JSON.stringify(act)} `);
    }
  }, 60_000);
  it("a library dialog without aria-modal is seen through the hidden rest of the page, and is really closed", async () => {
    const trang = (an: string): string => `<main ${an}><button id="sau">Phía sau</button></main><div role="dialog" aria-label="Bộ lọc" id="d"><button id="mot">Một</button></div>`;
    const thu = (an: string): Promise<KeyboardFinding[]> => on(trang(an), async (p) => {
      await p.evaluate(() => document.getElementById("mot")!.focus());
      return dialogFocusPass(p);
    }, true);
    expect(text(await thu('aria-hidden="true"'))).toMatch(/div#d "Bộ lọc": Escape does not close/);
    expect(text(await thu("inert"))).toMatch(/div#d "Bộ lọc": Escape does not close/);
    expect(await thu("")).toEqual([]);
    await on("ban-phim-hop-dung.html", async (p, net) => {
      await runActions(p, [{ click: "#mo-thu-vien" }], net, [focusLogWatch]);
      await dialogFocusPass(p);
      expect(await p.evaluate(() => [document.getElementById("hop-tv")!.hidden, document.activeElement?.id])).toEqual([true, "mo-thu-vien"]);
    });
  });
  it("the nested dialog is the one that gets closed, and its own opener is checked", async () => {
    await on("ban-phim-hop-dung.html", async (p, net) => {
      await runActions(p, [{ click: "#mo-goc" }, { click: "#mo-trong" }], net, [focusLogWatch]);
      await dialogFocusPass(p);
      expect(await p.evaluate(() => [(document.getElementById("hop-goc") as HTMLDialogElement).open, (document.getElementById("hop-trong") as HTMLDialogElement).open, document.activeElement?.id])).toEqual([true, false, "mo-trong"]);
    });
  });
  it("without the hook the opener is unknown, so nothing is asked about returning focus; without a dialog nothing runs", async () => {
    const list = await on("ban-phim-hop-sai.html", async (p, net) => {
      await runActions(p, [{ click: "#mo-roi" }], net);
      return dialogFocusPass(p);
    });
    expect(list).toEqual([]);
    expect(await on("ban-phim-hop-sai.html", dialogFocusPass)).toEqual([]);
  });
  it("a plain dialog that is not modal is not measured", async () => {
    expect(await on('<button id="b">Sau</button><div role="dialog" aria-label="Mẹo">Không modal <button>Đóng</button></div>', dialogFocusPass, true)).toEqual([]);
    expect(await on('<button id="b">Sau</button><dialog open aria-label="Mẹo">Không modal <button>Đóng</button></dialog>', dialogFocusPass, true)).toEqual([]);
  });
});

describe("contrast-more", () => {
  it("reports body text under 7:1 when the page declares prefers-contrast: more, and only body text", async () => {
    const list = await on("may-nguoi-dung-tuong-phan-sai.html", (p) => contrastMorePass(p, axeSource));
    expect(ids(list).sort()).toEqual(["phu", "rat-nhat"]);
    expect(text(list)).toMatch(/contrast-more p#phu .*5\.3\d?:1 with prefers-contrast: more/);
    expect(text(list)).toMatch(/contrast-more p#rat-nhat .*3\.9\d*:1 with/);
  });
  it("leaves a page that keeps the promise, and puts the mode back", async () => {
    await on("may-nguoi-dung-tuong-phan-dung.html", async (p) => {
      expect(await contrastMorePass(p, axeSource)).toEqual([]);
      expect(await p.evaluate(() => [matchMedia("(prefers-contrast: more)").matches, getComputedStyle(document.getElementById("phu")!).color])).toEqual([false, "rgb(107, 107, 107)"]);
    });
  });
  it("does not read an inherited color halfway through a long transition", async () => {
    const css = "body{background:#fff}main,section,p{transition:color 2s}main{color:#6b6b6b}@media (prefers-contrast: more){main{color:#111}}";
    expect(await on(`<style>${css}</style><main><section><p>Chữ thân theo màu của khung ngoài.</p></section></main>`, (p) => contrastMorePass(p, axeSource), true)).toEqual([]);
  });
  it("says nothing when the page does not declare it, or only declares less", async () => {
    const nhat = (css: string): string => `<style>body{background:#fff;color:#6b6b6b}${css}</style><main><p id="p">Chữ thân còn nhạt so với nền trắng.</p></main>`;
    expect(await on(nhat(""), (p) => contrastMorePass(p, axeSource), true)).toEqual([]);
    expect(await on(nhat("@media (prefers-contrast: less) { p { color: #888 } }"), (p) => contrastMorePass(p, axeSource), true)).toEqual([]);
    expect(await on(nhat("@media (prefers-contrast: more) { main { outline-color: #000 } }"), (p) => contrastMorePass(p, axeSource), true)).toHaveLength(1);
    // Khối khai cho thứ trang không có (tệp bộ màu dùng chung, bộ không được chọn): không phải lời hứa của trang này.
    expect(await on(nhat("@media (prefers-contrast: more) { [data-chu-de=x] { color: #000 } }"), (p) => contrastMorePass(p, axeSource), true)).toEqual([]);
    // Khai bằng thuộc tính media của thẻ style, và trong cây bóng.
    expect(await on(`${nhat("")}<style media="(prefers-contrast: more)">main{outline-color:#000}</style>`, (p) => contrastMorePass(p, axeSource), true)).toHaveLength(1);
    expect(await on(`${nhat("")}<style media="(prefers-contrast: more)">[data-chu-de=x]{color:#000}</style>`, (p) => contrastMorePass(p, axeSource), true)).toEqual([]);
    const bong = await on(`${nhat("")}<the-x id="x"></the-x>`, async (p) => {
      await p.evaluate(() => {
        document.getElementById("x")!.attachShadow({ mode: "open" }).innerHTML = "<style>@media (prefers-contrast: more) { b { color: #000 } }</style><b></b>";
      });
      return contrastMorePass(p, axeSource);
    }, true);
    expect(bong).toHaveLength(1);
  });
});

describe("forced-colors", () => {
  it("reports controls that only a background, gradient, shadow or pseudo-element marks, and chosen items that only color marks", async () => {
    const list = await on("may-nguoi-dung-ep-mau-sai.html", (p) => forcedColorsPass(p, 10));
    expect(list.filter((f) => /chosen/.test(f.detail)).map((f) => /#([\w-]+)/.exec(f.where)![1])).toEqual(["loc-bat", "tab-1", "tab-vet", "dang-xem"]);
    expect(list.filter((f) => /nothing marks its edge/.test(f.detail)).map((f) => /#([\w-]+)/.exec(f.where)![1])).toEqual(["nut-nen", "nut-dai", "nut-bong", "nut-gia", "o-nen", "the", "the-boc"]);
    expect(text(list)).toMatch(/#tab-1 .*the same as button\.muc "Tuần"/);
  });
  it("leaves transparent borders and outlines, underlines, system colors, forced-color-adjust, wrappers, images, plain-text buttons, weight, ticks, icons and markers", async () => {
    expect(text(await on("may-nguoi-dung-ep-mau-dung.html", (p) => forcedColorsPass(p, 30)))).toBe("");
  });
  it("puts colors back and leaves nothing on window", async () => {
    await on("may-nguoi-dung-ep-mau-sai.html", async (p) => {
      const list = await forcedColorsPass(p);
      expect(list.at(-1)!.where).toBe("+3 more");
      expect(await p.evaluate(() => [matchMedia("(forced-colors: active)").matches, getComputedStyle(document.getElementById("nut-nen")!).backgroundColor, "__dkBefore" in window, "__dkLook" in window])).toEqual([false, "rgb(11, 87, 208)", false, false]);
    });
  });
  it("a switch, a lone pressed button and a custom checkbox drawn with a border are not judged", async () => {
    expect(await on('<style>button{border:1px solid #777;background:#fff}[aria-checked=true],[aria-pressed=true]{background:#cfe2ff}input{appearance:none;width:20px;height:20px;border:1px solid #777;background:#eee}</style><button role="switch" aria-checked="true">Bật</button><button role="switch" aria-checked="false">Tắt</button><div><button aria-pressed="true">Đậm</button></div><input type="checkbox" aria-label="Nhớ">', (p) => forcedColorsPass(p), true)).toEqual([]);
  });
});

describe("offline", () => {
  it("reports a service worker that fails or goes blank with no network", async () => {
    expect(text(await on("may-nguoi-dung-ngoai-tuyen-sai.html", offlinePass))).toMatch(/offline may-nguoi-dung-ngoai-tuyen-sai\.html: .*reloading with no network fails \(net::/);
    expect(text(await on("may-nguoi-dung-ngoai-tuyen-sai.html?kieu=trong", offlinePass))).toMatch(/the page is blank when reloaded with no network/);
  }, 60_000);
  it("leaves an offline page, a shell that fills in late, and turns the network back on", async () => {
    expect(await on("may-nguoi-dung-ngoai-tuyen-dung.html?kieu=dung-muon", offlinePass)).toEqual([]);
    await on("may-nguoi-dung-ngoai-tuyen-dung.html", async (p) => {
      expect(await offlinePass(p)).toEqual([]);
      expect(await p.evaluate(async () => [navigator.onLine, document.querySelector("h1")?.textContent, (await fetch("tot.html")).ok])).toEqual([true, "Bản tin", true]);
    });
  }, 60_000);
  it("a service worker of another path on the same origin is not this page's promise", async () => {
    await on("may-nguoi-dung-ngoai-tuyen-sai.html", async (p) => {
      await p.evaluate(() => navigator.serviceWorker.ready);
      await p.goto(`${origin}/test/fixtures/tot.html`);
      expect(await offlinePass(p)).toEqual([]);
    });
  });
  it("a data: page cannot have one", async () => {
    await on("tot.html", async (p) => {
      await p.goto("data:text/html;charset=utf-8,<h1>Trang rời</h1>");
      expect(await offlinePass(p)).toEqual([]);
    });
  });
  it("a page without a service worker is not reloaded", async () => {
    await on("tot.html", async (p) => {
      await p.evaluate(() => ((window as unknown as { dau: number }).dau = 1));
      expect(await registersWorker(p)).toBe(false);
      expect(await offlinePass(p)).toEqual([]);
      expect(await p.evaluate(() => (window as unknown as { dau?: number }).dau)).toBe(1);
    });
  });
  it("turns the network back on and reloads also after a failure", async () => {
    await on("may-nguoi-dung-ngoai-tuyen-sai.html", async (p) => {
      expect(await registersWorker(p)).toBe(true);
      expect(await offlinePass(p)).toHaveLength(1);
      expect(await p.evaluate(() => [navigator.onLine, document.querySelector("h1")?.textContent])).toEqual([true, "Bản tin"]);
    });
  });
});

describe("aria-state", () => {
  const bam = (trang: string, ...sel: string[]): Promise<EmulateFinding[]> => on(trang, async (p, net) => {
    const aria = ariaStateWatch();
    expect(await runActions(p, sel.map((click) => ({ click })), net, [aria.watch])).toBeUndefined();
    return aria.findings;
  });
  it("reports a state that does not follow the click, for each attribute", async () => {
    const rows = [
      ["#quen", /button#quen .*aria-expanded stays "false"/],
      ["#quen-ctrl", /button#quen-ctrl .*aria-expanded stays "false"/],
      ["#tro-sai", /button#tro-sai .*aria-expanded is "true" while the region it controls \(#v2\) is hidden/],
      ["#nguoc", /button#nguoc .*aria-expanded is "false" after the click showed .*\(#v3\)/],
      ["#nhan-quen", /button#nhan-quen .*aria-pressed stays "false"/],
      ["#chu-quen", /button#chu-quen .*aria-pressed stays "false"/],
      ["#tab-quen-2", /button#tab-quen-2 .*aria-selected stays "false"/],
      ["#tich-quen", /button#tich-quen .*aria-checked stays "false"/],
      ["#mo-menu", /button#mo-menu .*aria-expanded stays "false"/],
      ["#trong-bong", /nut-mo::shadow button#trong-bong .*aria-expanded stays "false"/],
    ] as Array<[string, RegExp]>;
    const list = await bam("may-nguoi-dung-aria-sai.html", ...rows.map((r) => r[0]));
    expect(list).toHaveLength(rows.length);
    rows.forEach(([, want], i) => expect(text([list[i]!])).toMatch(want));
    // Bấm vào con của nút cũng là bấm nút.
    expect(text(await bam("may-nguoi-dung-aria-sai.html", "#nhan-tich"))).toMatch(/button#tich-quen .*aria-checked stays "false"/);
  }, 60_000);
  it("the same finding twice is told once", async () => {
    expect(await bam("may-nguoi-dung-aria-sai.html", "#chu-quen", "#nhan-quen", "#nhan-quen")).toHaveLength(2);
  });
  it("leaves states that follow (also a moment later), a tab or radio pressed again, clocks and live regions, hover and focus styling, an option that closes its list, a close button inside a tab, read-more and data-aria-ok", async () => {
    const sel = "dong-mo dong-mo muon muon yeu-thich tab-1 tab-2 tab-1 r1 khong-lam-gi hover-js lc nut-dong mien xem-them".split(" ").map((s) => `#${s}`);
    expect(text(await bam("may-nguoi-dung-aria-dung.html", ...sel))).toBe("");
  }, 60_000);
  it("the hooks are optional, see every action in order, and a hook that throws does not break the steps", async () => {
    const log: string[] = [];
    await on("may-nguoi-dung-aria-dung.html", async (p, net) => {
      expect(await runActions(p, [{ click: "#tab-2" }], net)).toBeUndefined();
      const err = await runActions(p, [{ click: "#tab-1" }, { hover: "#r1" }], net, [
        { start: async () => void log.push("start"), before: async (_p, a) => void log.push(`before ${Object.keys(a)[0]}`), after: async (_p, a) => void log.push(`after ${Object.keys(a)[0]}`) },
        { start: () => Promise.reject(new Error("x")), before: () => Promise.reject(new Error("x")), after: () => Promise.reject(new Error("x")) },
      ]);
      expect(err).toBeUndefined();
      expect(log).toEqual(["start", "before click", "after click", "before hover", "after hover"]);
      log.length = 0;
      const gay = await runActions(p, [{ click: "css=[" }], net, [{ after: async () => void log.push("after") }]);
      expect(gay).toMatch(/failed/);
      expect(log).toEqual([]);
    });
  }, 60_000);
});

describe("focus style", () => {
  const di = (trang: string, nho = true, html = false): Promise<Record<string, { indicator: boolean; changed: boolean }>> => on(trang, async (p) => {
    if (nho) await p.evaluate(rememberUnfocused);
    const out: Record<string, { indicator: boolean; changed: boolean }> = {};
    for (let i = 0; i < 30; i++) {
      await p.keyboard.press("Tab");
      await p.evaluate(settleAnimations, 600);
      const f = await p.evaluate(probeFocus);
      if (!f) break;
      out[/#([\w-]+)/.exec(f.where)?.[1] ?? f.where] = { indicator: f.indicator, changed: f.changed };
    }
    return out;
  }, html);
  const pick = (r: Record<string, { changed: boolean }>, on: boolean): string[] => Object.keys(r).filter((k) => r[k]!.changed === on);
  it("sees a change in border, background, color, shadow, underline, pseudo-elements, children, the box of a checkbox, a wrapper and shadow roots", async () => {
    const r = await di("focus-kieu-dung.html");
    expect(pick(r, true)).toEqual(["vien", "vien-day", "nen", "nen-nuot", "chu", "gach", "day-gach", "duong", "duong-rong", "dau", "trong-con", "nen-anh", "bong", "vong-goc", "vong-mau", "trong-khung", "o-tich", "o-nhan", "trong-bong"]);
    // Vòng có sẵn lúc chưa focus: chỉ báo cũ vẫn đọc như trước, nhưng không đổi.
    expect(r["xoa"]).toEqual({ indicator: true, changed: false });
    expect(r["vien"]!.indicator).toBe(false);
  }, 60_000);
  it("does not count near-identical colors, under 1px, transparent shadows, white on white, empty pseudo-elements, a group that lights up whole, a pulsing background or a see-through checkbox", async () => {
    const r = await di("focus-kieu-sai.html");
    expect(Object.keys(r)).toHaveLength(13);
    expect(pick(r, true)).toEqual([]);
  }, 60_000);
  it("a change that comes from an endless animation is not a focus style", async () => {
    await on('<style>@keyframes d{from{background:#fff}to{background:#0b57d0}}button{outline:none;border:1px solid #999}#dap{animation:d 1000s infinite linear}</style><button id="dap">Nhấp nháy</button>', async (p) => {
      await p.evaluate(rememberUnfocused);
      await p.evaluate(() => (document.getElementById("dap")!.getAnimations()[0]!.currentTime = 900_000));
      await p.keyboard.press("Tab");
      expect(await p.evaluate(probeFocus)).toMatchObject({ indicator: false, changed: false });
    }, true);
  });
  it("without the baseline nothing is claimed, and the other fields stay as they were", async () => {
    const r = await di("focus-kieu-dung.html", false);
    expect(pick(r, true)).toEqual([]);
    expect(r["bong"]).toEqual({ indicator: true, changed: false });
  }, 60_000);
  it("an element that already has focus has no baseline; a new one added later has none either", async () => {
    const r = await di('<style>button{outline:none;border:1px solid #999}button:focus{background:#0b57d0}</style><button id="truoc" autofocus>Trước</button><button id="sau">Sau</button>', true, true);
    expect(r["sau"]).toEqual({ indicator: false, changed: true });
    await on('<style>button{outline:none;border:1px solid #999}button:focus{background:#0b57d0}</style><button id="dau">Đầu</button>', async (p) => {
      await p.evaluate(() => document.getElementById("dau")!.focus());
      expect(await p.evaluate(rememberUnfocused)).toBe(0);
      expect((await p.evaluate(probeFocus))!.changed).toBe(false);
    }, true);
  });
  it("does not compare across forced colors, color scheme or width", async () => {
    await on('<style>button{outline:none;border:1px solid #999}button:focus{background:#0b57d0}</style><button id="b">Nút</button>', async (p) => {
      await p.evaluate(rememberUnfocused);
      await p.keyboard.press("Tab");
      const now = async (): Promise<boolean> => (await p.evaluate(probeFocus))!.changed;
      expect(await now()).toBe(true);
      await p.emulateMedia({ forcedColors: "active" });
      expect(await now()).toBe(false);
      await p.emulateMedia({ forcedColors: null, colorScheme: "dark" });
      expect(await now()).toBe(false);
      await p.emulateMedia({ colorScheme: "light" });
      expect(await now()).toBe(true);
      await p.setViewportSize({ width: 700, height: 800 });
      expect(await now()).toBe(false);
    }, true);
  });
});
