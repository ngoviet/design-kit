// Bộ màu cho người dùng chọn (tokens/themes.css, data/themes.json, scripts/themes-lib.mjs).
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
  });
});
