// Bộ màu cho người dùng chọn (tokens/themes.css, data/themes.json, scripts/themes-lib.mjs).
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { describe, expect, it } from "vitest";
import { launchBrowser, startServer } from "../src/browser.js";

const root = join(__dirname, "..");
interface Built { id: string; name: string; mode: string; tokens: Record<string, string>; relax: Record<string, number> }
interface Lib {
  loadSeeds(f?: string): Array<{ id: string; name: string; source?: { palette: string; author: string } }>;
  buildAll(s: unknown): Built[];
  checkTheme(t: Record<string, string>, mode: string, relax?: Record<string, number>): string[];
  themesCss(s: unknown): string;
  solve(c: string, bg: string[], dark: boolean, cr: number, lc: number): string;
  wcag(a: string, b: string): number;
  apca(a: string, b: string): number;
}
const lib = (await import("../scripts/themes-lib.mjs" as string)) as Lib;
const seeds = lib.loadSeeds();
const all = lib.buildAll(seeds);
const run = (...a: string[]): { out: string; code: number } => {
  try {
    return { out: execFileSync(process.execPath, [join(root, "scripts", "sinh-themes.mjs"), ...a], { cwd: root, encoding: "utf8", stdio: "pipe" }), code: 0 };
  } catch (e) {
    const x = e as { stdout: string; stderr: string; status: number };
    return { out: x.stdout + x.stderr, code: x.status };
  }
};

describe("themes", () => {
  it("has nine themes, each light and dark, and every pair passes WCAG 2 and APCA", () => {
    expect(seeds.map((s) => s.id)).toEqual(["neon", "flexoki", "gomlam", "rosepine", "sanchoi", "sonmai", "hoian", "kanagawa", "everforest"]);
    expect(all).toHaveLength(18);
    for (const b of all) expect({ id: b.id, mode: b.mode, bad: lib.checkTheme(b.tokens, b.mode, b.relax) }).toEqual({ id: b.id, mode: b.mode, bad: [] });
  });
  it("tokens/themes.css is exactly what the generator writes", () => {
    expect(readFileSync(join(root, "tokens", "themes.css"), "utf8").replace(/\r\n/g, "\n")).toBe(lib.themesCss(seeds));
    expect(run("--kiem").code).toBe(0);
  });
  it("gives the same colors as the Python solver it was ported from", () => {
    const t = (id: string, mode: string) => all.find((b) => b.id === id && b.mode === mode)!.tokens;
    expect(t("flexoki", "light")).toMatchObject({ "accent-text": "#076c65", accent: "#208078", "on-accent": "#f6fefd", "accent-soft": "#d2e2dd", "text-2": "#6c6b66", warn: "#866609" });
    expect(t("rosepine", "dark")["accent-text"]).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("keeps the fixed dark Neon verbatim", () => {
    expect(all.find((b) => b.id === "neon" && b.mode === "dark")!.tokens).toMatchObject({ bg: "oklch(0.181 0.036 266)", accent: "oklch(0.797 0.133 212)", text: "oklch(0.944 0.015 257)" });
  });
  it("the solver moves away from every background until both measures pass", () => {
    const c = lib.solve("#9aa0a6", ["#ffffff", "#eef0f2"], false, 4.6, 60);
    for (const b of ["#ffffff", "#eef0f2"]) {
      expect(lib.wcag(c, b)).toBeGreaterThanOrEqual(4.6);
      expect(Math.abs(lib.apca(c, b))).toBeGreaterThanOrEqual(60);
    }
  });
  it("the check catches a faded text, a karaoke word that does not stand out, and a relaxed pair that is not listed", () => {
    const t = { ...all[0]!.tokens };
    expect(lib.checkTheme({ ...t, text: "#9aa7b0" }, "light").join(" ")).toMatch(/text\/bg/);
    expect(lib.checkTheme({ ...t, "accent-text": t["text"]! }, "light").join(" ")).toMatch(/karaoke: chữ đã đọc/);
    expect(lib.checkTheme({ ...t, "accent-soft": t["surface-2"]! }, "light").join(" ")).toMatch(/karaoke: nền chữ/);
    const neon = all.find((b) => b.id === "neon" && b.mode === "dark")!;
    expect(lib.checkTheme(neon.tokens, "dark").join(" ")).toMatch(/info\/info-soft/);
  });
  it("every third-party palette keeps its copyright notice", () => {
    const notice = readFileSync(join(root, "tokens", "NOTICE-themes.txt"), "utf8");
    for (const s of seeds.filter((x) => x.source)) expect(notice).toContain(s.source!.palette);
    expect(notice.match(/Copyright \(c\) \d{4} /g)).toHaveLength(4);
    expect(notice.match(/Permission is hereby granted/g)).toHaveLength(4);
  });
  it("the picker block offers exactly these themes", () => {
    const html = readFileSync(join(root, "blocks", "html", "chon-mau.html"), "utf8");
    expect([...html.matchAll(/data-mau="([a-z]+)"/g)].map((m) => m[1])).toEqual(seeds.map((s) => s.id));
    for (const s of seeds) expect(html).toContain(`<b>${s.name}</b>`);
    // Script áp màu đứng trước mọi stylesheet, không thì trang chớp sai màu.
    expect(html.indexOf("localStorage.getItem")).toBeGreaterThan(0);
    expect(html.indexOf("localStorage.getItem")).toBeLessThan(html.indexOf("<link rel=\"stylesheet\""));
  });
  it("solves a project's own seeds, and says what is wrong with bad ones", () => {
    const d = join(root, ".design-kit", "test", "mau");
    mkdirSync(d, { recursive: true });
    const one = { ...(JSON.parse(readFileSync(join(root, "data", "themes.json"), "utf8")) as unknown[])[1] as object, id: "cua-toi" };
    writeFileSync(join(d, "mau.json"), JSON.stringify([one]));
    const ok = run(join(d, "mau.json"), "--ra", join(d, "ra.css"));
    expect(ok.code).toBe(0);
    expect(readFileSync(join(d, "ra.css"), "utf8")).toContain('[data-dk][data-chu-de="cua-toi"]');
    expect(run(join(d, "mau.json")).code).toBe(2);
    writeFileSync(join(d, "sai.json"), JSON.stringify([{ id: "x", name: "X", light: { bg: "#fff" }, dark: {} }]));
    const bad = run(join(d, "sai.json"), "--ra", join(d, "x.css"));
    expect(bad.code).toBe(2);
    expect(bad.out).toContain("thiếu hoặc sai hex");
    expect(run("--la").code).toBe(2);
    // Một khoá sai hex, kể cả khoá tuỳ chọn, là lỗi chứ không phải "#NaNNaNNaN" lặng lẽ.
    const seed = one as unknown as { light: Record<string, string> };
    for (const k of ["bg", "border2", "edge", "tren"]) {
      writeFileSync(join(d, "mot.json"), JSON.stringify([{ ...one, light: { ...seed.light, [k]: "#abc" } }]));
      const r = run(join(d, "mot.json"), "--ra", join(d, "x.css"));
      expect({ k, code: r.code }).toEqual({ k, code: 2 });
      expect(r.out).toContain(k);
    }
    // --kiem với tệp đích không có hoặc lệch thì trượt.
    expect(run(join(d, "mau.json"), "--kiem", "--ra", join(d, "khong-co.css")).code).toBe(1);
    expect(run(join(d, "mau.json"), "--kiem", "--ra", join(d, "ra.css")).code).toBe(0);
    writeFileSync(join(d, "lech.css"), "/* khác */");
    expect(run(join(d, "mau.json"), "--kiem", "--ra", join(d, "lech.css")).code).toBe(1);
  });
  it("a broken color never counts as passing", () => {
    expect(lib.checkTheme({ ...all[0]!.tokens, "border-strong": "#NaNNaNNaN" }, "light").join(" ")).toMatch(/border-strong/);
  });
});

describe("the picker block, in a browser", () => {
  const open = async (storage: string | null, fn: (page: Page, errs: string[]) => Promise<void>): Promise<void> => {
    const { browser } = await launchBrowser(process.env);
    const s = await startServer(root);
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 568 } });
      const errs: string[] = [];
      page.on("pageerror", (e) => errs.push(e.message));
      if (storage !== null) await page.addInitScript((v) => { if (!sessionStorage.getItem("da")) { localStorage.setItem("giao-dien", v); sessionStorage.setItem("da", "1"); } }, storage);
      await page.goto(`${s.origin}/blocks/html/chon-mau.html`);
      await fn(page, errs);
    } finally {
      await browser.close();
      s.server.close();
    }
  };
  const state = (page: Page) => page.evaluate(() => ({ bo: document.documentElement.dataset.chuDe ?? "", che: document.documentElement.dataset.theme ?? "", chon: document.querySelector<HTMLInputElement>("input[name=bo]:checked")?.value ?? null, luu: localStorage.getItem("giao-dien") }));

  it("Undo goes back to the theme at the start of the visit, not to one passed through", async () => {
    await open('{"bo":"gomlam","che":"dark"}', async (page, errs) => {
      expect(await state(page)).toMatchObject({ bo: "gomlam", che: "dark", chon: "gomlam" });
      await page.click(".the[data-mau=flexoki]");
      await page.click(".the[data-mau=sonmai]");
      await page.click(".che label:has(input[value=light])");
      expect(await state(page)).toMatchObject({ bo: "sonmai", che: "light" });
      await page.click("#hoan-tac");
      expect(await state(page)).toMatchObject({ bo: "gomlam", che: "dark", chon: "gomlam", luu: '{"bo":"gomlam","che":"dark"}' });
      expect(await page.isHidden("#hoan-tac")).toBe(true);
      expect(errs).toEqual([]);
    });
  }, 60_000);
  it("applies the saved theme before first paint and survives a reload", async () => {
    await open(null, async (page) => {
      await page.click(".the[data-mau=everforest]");
      await page.reload({ waitUntil: "commit" });
      expect(await page.evaluate(() => document.documentElement.dataset.chuDe)).toBe("everforest");
    });
  }, 60_000);
  it("ignores odd saved values: null, broken JSON, wrong types, a theme that no longer exists", async () => {
    for (const v of ["null", "{hong", "5", "[]", '{"bo":7,"che":[]}', '{"bo":"BO HOA","che":"tim"}', '{"bo":"bo-da-xoa","che":"dark"}']) {
      await open(v, async (page, errs) => {
        const s = await state(page);
        expect({ v, bo: s.bo, chon: s.chon }).toEqual({ v, bo: "", chon: "" });
        await page.click(".the[data-mau=neon]");
        await page.click("#hoan-tac");
        expect({ v, bo: (await state(page)).bo, errs }).toEqual({ v, bo: "", errs: [] });
      });
    }
  }, 120_000);
  it("the Undo bar does not cover the card that has focus on a small phone", async () => {
    await open(null, async (page) => {
      await page.click(".the[data-mau=neon]");
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("ArrowDown");
        const covered = await page.evaluate(() => {
          const card = document.activeElement!.closest(".the")!.getBoundingClientRect();
          const bar = document.querySelector(".vua-doi")!.getBoundingClientRect();
          return Math.max(0, Math.min(card.bottom, bar.bottom) - Math.max(card.top, bar.top));
        });
        expect({ i, covered: Math.round(covered) }).toEqual({ i, covered: 0 });
      }
    });
  }, 60_000);
});
