// Bộ màu cho người dùng chọn (tokens/themes.css, data/themes.json, scripts/themes-lib.mjs).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { describe, expect, it } from "vitest";
import { launchBrowser, startServer } from "../src/browser.js";

const root = join(__dirname, "..");
type Tokens = Record<string, string>;
interface Built { id: string; name: string; mode: string; tokens: Tokens; more: Tokens; relax: Record<string, number> }
interface Lib {
  ROLES: string[];
  POLE_SHIFT: number;
  asHex(v: string): string;
  toOklch(h: string): [number, number, number];
  dE(a: string, b: string): number;
  moreContrast(t: Tokens, mode: string): Tokens;
  buttonPole(accent: string, dark: boolean): { accent: string; on: string; flip: boolean };
  checkSet(b: Built[]): string[];
  loadSeeds(f?: string): Array<{ id: string; name: string; source?: { palette: string; author: string } }>;
  buildAll(s: unknown): Built[];
  checkTheme(t: Tokens, mode: string, relax?: Record<string, number>, level?: "thuong" | "cao"): string[];
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

// Một bộ thử: hạt giống Giấy và mực, đổi màu nhấn.
const withAccent = (id: string, accent: string): unknown => {
  const f = (JSON.parse(readFileSync(join(root, "data", "themes.json"), "utf8")) as Array<{ id: string; light: object; dark: object }>).find((x) => x.id === "flexoki")!;
  return { ...f, id, name: id, light: { ...f.light, accent }, dark: { ...f.dark, accent } };
};
const two = (accent: string): [Built, Built] => lib.buildAll([withAccent("thu", accent)]) as [Built, Built];
const c = (t: Tokens, a: string, b: string): number => lib.wcag(lib.asHex(t[a]!), lib.asHex(t[b]!));
const MORE = /@media \(prefers-contrast: more\) \{\n[\s\S]*?\n\}\n/g;
const STATUS = ["ok", "warn", "bad", "info"];

describe("text on the main button", () => {
  it.each([["yellow", "#facc15"], ["gold", "#eab308"], ["lime", "#a3e635"], ["darker lime", "#84cc16"], ["mint", "#5eead4"], ["emerald", "#34d399"]])("a light accent (%s %s) keeps its color and takes dark text", (_n, accent) => {
    const [l, d] = two(accent);
    expect(l.tokens["accent"]).toBe(accent);
    expect(lib.toOklch(l.tokens["on-accent"]!)[0]).toBeLessThan(0.25);
    expect(c(l.tokens, "on-accent", "accent")).toBeGreaterThanOrEqual(4.6);
    expect(Math.abs(lib.apca(l.tokens["on-accent"]!, accent))).toBeGreaterThanOrEqual(60);
    // Vì sao cần viền: chính màu nhấn không tách khỏi nền sáng.
    expect(c(l.tokens, "accent", "surface")).toBeLessThan(3);
    for (const b of ["bg", "surface", "surface-2"]) expect(c(l.tokens, "accent-border", b)).toBeGreaterThanOrEqual(3);
    // Viền cùng sắc với màu nhấn, không phải một màu khác.
    expect(Math.abs(lib.toOklch(l.tokens["accent-border"]!)[2] - lib.toOklch(accent)[2])).toBeLessThan(12);
    expect(d.tokens["accent-border"]).toBe(d.tokens["accent"]);
    for (const b of [l, d]) {
      expect(lib.checkTheme(b.tokens, b.mode)).toEqual([]);
      expect(lib.checkTheme(b.more, b.mode, {}, "cao")).toEqual([]);
    }
    expect(lib.checkSet([l, d])).toEqual([]);
  });
  it.each([["orange", "#f97316"], ["light orange", "#fb923c"], ["teal", "#14b8a6"], ["pink", "#f472b6"], ["blue", "#2563eb"]])("%s (%s) stays on white text: dark text on it misses Lc 60, or white fits without much of a move", (_n, accent) => {
    const [l, d] = two(accent);
    expect(lib.toOklch(l.tokens["on-accent"]!)[0]).toBeGreaterThan(0.95);
    expect(c(l.tokens, "on-accent", "accent")).toBeGreaterThanOrEqual(4.6);
    expect("accent-border" in l.tokens || "accent-border" in d.tokens).toBe(false);
    expect(lib.checkTheme(l.tokens, "light")).toEqual([]);
  });
  it("decides by measuring: the yellow the old rule turned brown is kept, and the dark mode always has dark text", () => {
    expect(lib.buttonPole("#facc15", false)).toMatchObject({ accent: "#facc15", flip: true });
    expect(lib.buttonPole("#FACC15", false).accent).toBe("#facc15");
    expect(lib.POLE_SHIFT).toBe(0.15);
    for (const a of ["#facc15", "#1d4fa3", "#b91c1c"]) {
      const p = lib.buttonPole(a, true);
      expect({ a, flip: p.flip, dark: lib.toOklch(p.on)[0] < 0.25 }).toEqual({ a, flip: false, dark: true });
    }
  });
  it("accent-border stands in for accent in the 3:1 gate, and only when it is there", () => {
    const [l] = two("#facc15");
    const { "accent-border": line, ...bare } = l.tokens;
    expect(line).toMatch(/^#/);
    expect(lib.checkTheme(bare as Tokens, "light").join(" ")).toMatch(/(^| )accent\/bg 1\.\d+:1/);
    const weak = lib.checkTheme({ ...l.tokens, "accent-border": "#d6b40f" }, "light").join(" ");
    expect(weak).toMatch(/accent-border\/bg/);
    expect(weak).not.toMatch(/(^| )accent\/bg/);
  });
  it("writes accent-border in every block of a theme that needs it, with that mode's own value", () => {
    const plain = lib.themesCss([withAccent("vang", "#facc15")]).replace(MORE, "");
    expect([...plain.matchAll(/--accent-border: (#[0-9a-f]{6});/g)].map((m) => m[1])).toEqual([two("#facc15")[0].tokens["accent-border"], "#facc15", "#facc15"]);
    expect(readFileSync(join(root, "tokens", "themes.css"), "utf8")).not.toMatch(/--accent-border: #/);
  });
});

describe("prefers-contrast: more", () => {
  it("leaves every color of the normal nine themes as it was", () => {
    // Băm của 456 token thường và của phần CSS cũ, tính từ bản trước khi có cực chữ và tương phản cao (24/11/2026). Cố ý đổi hạt
    // giống thì cập nhật hai mã này.
    expect(createHash("sha256").update(JSON.stringify(all.map((b) => [b.id, b.mode, b.tokens]))).digest("hex")).toBe("42b61063f7c7ddcd3dbf9367d7715d9e28a8c3707be0b41e93f19697d88b3a67");
    const old = lib.themesCss(seeds).replace(/^\/\*[\s\S]*?\*\/\n/, "").replace(MORE, "");
    expect(createHash("sha256").update(old).digest("hex")).toBe("b398a739d17fe7863f3952fc3b5985bbbf2ddaf28e1f7b74255cfe7145195536");
  });
  it.each(all.map((b) => [b.id, b.mode, b] as const))("%s %s reaches the higher bars and passes its own gate", (_i, mode, b) => {
    const t = b.more;
    expect(lib.checkTheme(t, mode, b.relax, "cao")).toEqual([]);
    const best = mode === "dark" ? "#ffffff" : "#000000";
    for (const bg of ["bg", "bg-edge", "surface", "surface-2", "accent-soft", ...STATUS.map((s) => `${s}-soft`)]) {
      expect({ bg, ok: c(t, "text", bg) >= Math.min(12, lib.wcag(best, lib.asHex(t[bg]!))) - 0.01 }).toEqual({ bg, ok: true });
    }
    for (const bg of ["bg", "bg-edge", "surface", "surface-2"]) for (const f of ["text-2", "accent-text"]) expect({ f, bg, ok: c(t, f, bg) >= 7 }).toEqual({ f, bg, ok: true });
    for (const s of STATUS) for (const bg of ["bg", "surface", "surface-2", `${s}-soft`]) expect({ s, bg, ok: c(t, s, bg) >= 7 }).toEqual({ s, bg, ok: true });
    for (const f of ["border-strong", "focus", "accent"]) for (const bg of ["bg", "surface", "surface-2"]) expect({ f, bg, ok: c(t, f, bg) >= 4.5 }).toEqual({ f, bg, ok: true });
    expect(c(t, "on-accent", "accent")).toBeGreaterThanOrEqual(7);
    // Chữ đã đọc vẫn tách khỏi chữ chưa đọc; trên nền nhấn nhạt không dưới AA.
    expect(lib.dE(lib.asHex(t["accent-text"]!), lib.asHex(t["text"]!))).toBeGreaterThanOrEqual(0.12);
    expect(c(t, "accent-text", "accent-soft")).toBeGreaterThanOrEqual(4.5);
    // Nền, và mọi thứ không phải chữ hay nét, giữ nguyên.
    for (const k of Object.keys(b.tokens)) if (/^(bg|surface|border$|shadow|nen|font|on-accent|r-)|soft$/.test(k)) expect(t[k]).toBe(b.tokens[k]);
    // Đi xa nền hơn chứ không lùi.
    for (const k of ["text", "text-2", "accent-text", ...STATUS, "border-strong", "focus"]) expect(c(t, k, "bg")).toBeGreaterThanOrEqual(c(b.tokens, k, "bg") - 0.01);
    // Bản thường không qua nổi cổng này: cổng có việc để làm.
    expect(lib.checkTheme(b.tokens, mode, b.relax, "cao").length).toBeGreaterThan(0);
  });
  it("goes as far as 7:1 on the soft accent unless that would hide the karaoke word", () => {
    const at = Object.fromEntries(all.map((b) => [`${b.id} ${b.mode}`, c(b.more, "accent-text", "accent-soft")]));
    const low = Object.entries(at).filter(([, v]) => v < 7).map(([k]) => k);
    expect(low).toEqual(["hoian dark", "kanagawa dark", "everforest dark"]);
    for (const k of low) expect(at[k]).toBeGreaterThanOrEqual(5.7);
  });
  it("uses pure white only where 12:1 takes all of it, or cannot be had", () => {
    const worst = (b: Built): number => Math.min(...["bg", "bg-edge", "surface", "surface-2", "accent-soft", ...STATUS.map((s) => `${s}-soft`)].map((k) => lib.wcag("#ffffff", lib.asHex(b.tokens[k]!))));
    const white = all.filter((b) => b.more["text"] === "#ffffff");
    expect(white.map((b) => `${b.id} ${b.mode}`)).toEqual(all.filter((b) => b.mode === "dark" && worst(b) < 12.3).map((b) => `${b.id} ${b.mode}`));
    expect(white).toHaveLength(8);
    expect(all.filter((b) => b.more["text"] === "#000000")).toEqual([]);
    const e = all.find((b) => b.id === "everforest" && b.mode === "dark")!;
    expect(c(e.more, "text", "accent-soft")).toBeLessThan(12);
    expect(lib.checkTheme({ ...e.more, text: "#f4f4f4" }, "dark", {}, "cao").join(" ")).toMatch(/text\/accent-soft/);
  });
  it("its gate catches each thing that slips back to the normal level", () => {
    const b = all.find((x) => x.id === "gomlam" && x.mode === "light")!;
    const bad = (k: string, v: string): string => lib.checkTheme({ ...b.more, [k]: v }, "light", {}, "cao").join(" ");
    expect(bad("text", "#45536f")).toMatch(/text\/bg 7\.\d+:1.*cần 12:1/);
    expect(bad("text-2", b.tokens["text-2"]!)).toMatch(/text-2\/bg/);
    expect(bad("accent-text", "#3060b4")).toMatch(/accent-text\/surface-2/);
    expect(bad("ok", b.tokens["ok"]!)).toMatch(/ok\/bg/);
    expect(bad("border-strong", "#808a9a")).toMatch(/border-strong\/bg/);
    expect(bad("focus", "#7c8cae")).toMatch(/focus\/bg/);
    expect(bad("accent", "#2d5fb3")).toMatch(/on-accent\/accent/);
    // Nới |Lc| trong data/themes.json chỉ dành cho mức thường.
    const neon = all.find((x) => x.id === "neon" && x.mode === "dark")!;
    expect(lib.checkTheme(neon.tokens, "dark", neon.relax)).toEqual([]);
    expect(lib.checkTheme(neon.more, "dark", { "dark text/bg": 999 }, "cao")).toEqual([]);
  });
  it("raises a weak focus ring, and an accent text that only the plain backgrounds hold back", () => {
    const e = all.find((b) => b.id === "everforest" && b.mode === "dark")!;
    const ring = lib.moreContrast({ ...e.tokens, focus: "#8a9a94" }, "dark");
    for (const b of ["bg", "surface", "surface-2"]) expect(c(ring, "focus", b)).toBeGreaterThanOrEqual(4.5);
    expect(c({ ...e.tokens, focus: "#8a9a94" }, "focus", "surface-2")).toBeLessThan(4.5);
    const t = { ...e.tokens, "accent-soft": "#20262a" };
    expect(c(t, "accent-text", "accent-soft")).toBeGreaterThan(7);
    expect(c(t, "accent-text", "surface-2")).toBeLessThan(7);
    expect(c(lib.moreContrast(t, "dark"), "accent-text", "surface-2")).toBeGreaterThanOrEqual(7);
  });
  it("an accent that is far from its text but close to the background still moves to 4.5:1 as a shape", () => {
    const e = all.find((b) => b.id === "everforest" && b.mode === "dark")!;
    const t = { ...e.tokens, "surface-2": "#4c5a5f", "on-accent": "#000000" };
    expect(c(t, "accent", "surface-2")).toBeLessThan(4);
    expect(c(t, "on-accent", "accent")).toBeGreaterThan(7);
    expect(c(lib.moreContrast(t, "dark"), "accent", "surface-2")).toBeGreaterThanOrEqual(4.5);
  });
  it("a light accent moves its border, not its color", () => {
    const [l, d] = two("#facc15");
    expect(l.more["accent"]).toBe("#facc15");
    for (const b of ["bg", "surface", "surface-2"]) expect(c(l.more, "accent-border", b)).toBeGreaterThanOrEqual(4.5);
    expect(c(l.more, "accent-border", "bg")).toBeGreaterThan(c(l.tokens, "accent-border", "bg"));
    expect(d.more["accent-border"]).toBe(d.more["accent"]);
    expect(lib.checkTheme({ ...l.more, "accent-border": l.tokens["accent-border"]! }, "light", {}, "cao").join(" ")).toMatch(/accent-border\/bg/);
  });
  it("themes.css writes only the tokens that differ, and stays small", () => {
    const css = lib.themesCss(seeds);
    const blocks = [...css.matchAll(MORE)].map((m) => m[0]);
    expect(blocks).toHaveLength(9);
    for (const [i, s] of seeds.entries()) {
      const of = (mode: string): Built => all.find((b) => b.id === s.id && b.mode === mode)!;
      const diff = (b: Built): string[] => Object.keys(b.tokens).filter((k) => b.more[k] !== b.tokens[k]).map((k) => `${k}: ${b.more[k]}`).sort();
      const got = [...blocks[i]!.matchAll(/(\[data-dk\][^{]+) \{\n([^}]*)\}/g)].map((m) => [m[1], [...m[2]!.matchAll(/--([\w-]+: [^;]+);/g)].map((x) => x[1]).sort()]);
      const sel = `[data-dk][data-chu-de="${s.id}"]`;
      expect(got).toEqual([[sel, diff(of("light"))], [`${sel}:not([data-theme="light"])`, diff(of("dark"))], [`${sel}[data-theme="dark"]`, diff(of("dark"))]]);
      expect(diff(of("dark")).length).toBeGreaterThan(0);
      // Cùng màu mà ghi cách khác (oklch, hex) không phải là khác.
      for (const m of ["light", "dark"]) for (const k of Object.keys(of(m).tokens)) if (of(m).more[k] !== of(m).tokens[k]) expect(lib.asHex(of(m).more[k]!)).not.toBe(lib.asHex(of(m).tokens[k]!));
    }
    expect(css.length).toBeLessThan(42_000);
  });
  it("the generator prints both levels for every mode", () => {
    const { out } = run("--kiem");
    expect(out).toContain("9 themes × light/dark × normal/more contrast, 1548 pairs");
    expect(out).toContain("modes[36]{id,mode,contrast,karaoke,accent_border,bad}:");
    for (const b of all) for (const l of ["normal", "more"]) expect(out).toMatch(new RegExp(`\\n  ${b.id},${b.mode},${l},0\\.\\d\\d,-,0\\n`));
    expect(out).toContain("set[0]:");
  });
});

describe("every theme has every role, and no two are the same", () => {
  const neonDark = all.find((b) => b.id === "neon" && b.mode === "dark")!;
  it.each(lib.ROLES)("a missing %s is an error, not a crash", (k) => {
    const rest = { ...neonDark.tokens };
    delete rest[k];
    expect(lib.checkTheme(rest, "dark").join(" ")).toMatch(new RegExp(`thiếu token: ${k}( |$)`));
    expect(lib.checkTheme(rest, "dark", {}, "cao").join(" ")).toContain(`thiếu token: ${k}`);
  });
  it("lists the roles the blocks need", () => {
    expect(lib.ROLES).toEqual(expect.arrayContaining(["bg", "text", "border", "accent-soft", "on-accent", "info-soft", "focus", "shadow-2", "nen-trang", "font-display"]));
    expect(lib.ROLES).toHaveLength(25);
    for (const b of all) expect(lib.ROLES.filter((k) => !b.tokens[k] || !b.more[k])).toEqual([]);
  });
  it("catches a color no pair looks at", () => {
    for (const v of ["#NaNNaNNaN", "red", "oklch(50% 0.1 20)"]) expect(lib.checkTheme({ ...neonDark.tokens, border: v }, "dark", neonDark.relax).join(" ")).toBe("sai màu: border");
  });
  it("a token that one mode has and the other lacks is an error: it would inherit the other mode's value", () => {
    const [l, d] = two("#facc15");
    const without = (b: Built): Built => ({ ...b, tokens: Object.fromEntries(Object.entries(b.tokens).filter(([k]) => k !== "accent-border")) });
    expect(lib.checkSet([l, without(d)])).toEqual(["thu dark: thiếu token mà bản light có: accent-border"]);
    expect(lib.checkSet([without(l), d])).toEqual(["thu light: thiếu token mà bản dark có: accent-border"]);
    expect(lib.checkSet([l])).toEqual(["thu: thiếu bản dark"]);
    expect(lib.checkSet([d])).toEqual(["thu: thiếu bản light"]);
    expect(lib.checkSet(all)).toEqual([]);
  });
  it("two themes with every token the same are an error, however the colors are written; one different color is enough to pass", () => {
    const [l, d] = two("#24837b");
    const copy = (over: Tokens = {}): Built[] => [{ ...l, id: "ban-sao", tokens: { ...l.tokens, ...over } }, { ...d, id: "ban-sao" }];
    expect(lib.checkSet([l, d, ...copy()])).toEqual(["ban-sao: mọi token trùng hệt bộ thu"]);
    expect(lib.checkSet([l, d, ...copy({ info: "#205ea7" })])).toEqual([]);
    const n = all.filter((b) => b.id === "neon");
    const hexed = n.map((b) => ({ ...b, id: "neon2", tokens: Object.fromEntries(Object.entries(b.tokens).map(([k, v]) => [k, lib.asHex(v)])) }));
    expect(lib.checkSet([...n, ...hexed])).toEqual(["neon2: mọi token trùng hệt bộ neon"]);
    // Chỉ trùng một bản thì vẫn là hai bộ.
    expect(lib.checkSet([l, d, { ...l, id: "khac" }, { ...d, id: "khac", tokens: { ...d.tokens, bg: "#111111" } }])).toEqual([]);
  });
  it("the generator refuses them too", () => {
    const dir = join(root, ".design-kit", "test", "mau");
    mkdirSync(dir, { recursive: true });
    const write = (name: string, v: unknown): string => {
      writeFileSync(join(dir, name), JSON.stringify(v));
      return join(dir, name);
    };
    const dup = run(write("trung.json", [withAccent("mot", "#24837b"), withAccent("hai", "#24837b")]), "--kiem");
    expect(dup.code).toBe(1);
    expect(dup.out).toContain("hai: mọi token trùng hệt bộ mot");
    const same = run(write("trung-id.json", [withAccent("mot", "#24837b"), withAccent("mot", "#2563eb")]), "--kiem");
    expect(same.code).toBe(2);
    expect(same.out).toContain("id dùng hai lần: mot");
    const list = JSON.parse(readFileSync(join(root, "data", "themes.json"), "utf8")) as Array<{ dark: { fixed: Tokens } }>;
    const fixed = { ...list[0]!.dark.fixed };
    delete fixed["focus"];
    const lack = run(write("thieu.json", [{ ...list[0], dark: { fixed } }]), "--kiem");
    expect(lack.code).toBe(1);
    expect(lack.out).toContain("thiếu token: focus");
    // Bản thường đạt mà bản tương phản cao không thể đạt (nền màu trạng thái quá sáng): cũng là trượt, và nói rõ ở mức nào.
    const pale = { ...list[0]!.dark.fixed, ok: "#ffffff", "ok-soft": "#666666" };
    const high = run(write("chi-cao.json", [{ ...list[0], dark: { fixed: pale } }]), "--kiem");
    expect(high.code).toBe(1);
    expect(high.out).toContain('status: "fail: 1 of 4 modes');
    expect(high.out).toMatch(/neon,dark,normal,[\d.]+,-,0\n/);
    expect(high.out).toMatch(/neon,dark,more,[\d.]+,-,"ok\/ok-soft 5\.\d+:1/);
    const yellow = run(write("vang.json", [withAccent("vang", "#facc15")]), "--kiem");
    expect(yellow.code).toBe(0);
    expect(yellow.out).toMatch(/vang,light,normal,0\.\d\d,#[0-9a-f]{6},0/);
  });
});

describe("themes in a browser", () => {
  it("picks the right block for contrast × system scheme × forced scheme, and a light accent gets its border", async () => {
    const { browser } = await launchBrowser(process.env);
    const s = await startServer(root);
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
      await page.goto(`${s.origin}/blocks/html/chon-mau.html`);
      const K = ["text", "text-2", "border-strong", "ok", "accent"];
      const of = (mode: string): Built => all.find((b) => b.id === "gomlam" && b.mode === mode)!;
      for (const contrast of ["no-preference", "more"] as const) {
        for (const colorScheme of ["light", "dark"] as const) {
          for (const force of ["", "light", "dark"]) {
            await page.emulateMedia({ contrast, colorScheme });
            const got = await page.evaluate(([f, keys]) => {
              const d = document.documentElement;
              d.dataset["chuDe"] = "gomlam";
              if (f) d.dataset["theme"] = f;
              else delete d.dataset["theme"];
              const cs = getComputedStyle(d);
              return keys.map((k) => cs.getPropertyValue(`--${k}`).trim());
            }, [force, K] as [string, string[]]);
            const b = of(force || colorScheme);
            const want = contrast === "more" ? b.more : b.tokens;
            expect({ contrast, colorScheme, force, got }).toEqual({ contrast, colorScheme, force, got: K.map((k) => want[k]) });
          }
        }
      }
      // Viền nút: trong suốt ở bộ thường, đậm ở bộ vàng; bản tối của bộ vàng không thừa hưởng viền của bản sáng.
      const [l, d] = two("#facc15");
      await page.emulateMedia({ contrast: "no-preference", colorScheme: "light" });
      await page.addStyleTag({ content: lib.themesCss([withAccent("vang", "#facc15")]) });
      const border = (bo: string, che: string): Promise<string> =>
        page.evaluate(([b, t]) => {
          document.documentElement.dataset["chuDe"] = b;
          document.documentElement.dataset["theme"] = t;
          const btn = document.querySelector<HTMLElement>(".btn-primary:not(.skip-link)")!;
          btn.style.transition = "none";
          return getComputedStyle(btn).borderTopColor;
        }, [bo, che] as [string, string]);
      const rgb = (h: string): string => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
      expect(await border("gomlam", "light")).toBe("rgba(0, 0, 0, 0)");
      expect(await border("vang", "light")).toBe(rgb(l.tokens["accent-border"]!));
      expect(await border("vang", "dark")).toBe(rgb(d.tokens["accent"]!));
    } finally {
      await browser.close();
      s.server.close();
    }
  }, 60_000);
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
