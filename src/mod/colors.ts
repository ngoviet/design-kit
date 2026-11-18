// Màu trong cây vẽ của mod: khoá theme (`success`, `subtle`…) đổi theo theme của người dùng; hex/rgb thì cố định;
// tên ANSI (`red`) thì tuỳ bảng 16 màu của terminal. Đo tương phản WCAG 2 và APCA bằng colorjs.io.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Color from "colorjs.io";
import { kitRoot } from "../commands/home.js";
import type { Scheme } from "./tree.js";

export const THEMES_FILE = "data/claude-themes.json";

interface ThemeFile {
  source: string;
  dark: Record<string, string>;
  light: Record<string, string>;
}
let themes: ThemeFile | undefined;
export function loadThemes(): ThemeFile {
  themes ??= JSON.parse(readFileSync(join(kitRoot(), THEMES_FILE), "utf8")) as ThemeFile;
  return themes;
}

/** Nền terminal mặc định để đo (đổi bằng --term-bg). */
export const TERM_BG: Record<Scheme, string> = { dark: "#1e1e1e", light: "#ffffff" };

/**
 * Bảng 16 màu khi mod tô bằng tên (`red`, `greenBright`): Campbell, mặc định của Windows Terminal. Mỗi máy một bảng,
 * nên phát hiện từ màu tên chỉ là ước lượng (ghi rõ trong đầu ra).
 */
export const ANSI: Record<string, string> = {
  black: "#0c0c0c", red: "#c50f1f", green: "#13a10e", yellow: "#c19c00", blue: "#0037da", magenta: "#881798", cyan: "#3a96dd", white: "#cccccc",
  blackBright: "#767676", gray: "#767676", grey: "#767676", redBright: "#e74856", greenBright: "#16c60c", yellowBright: "#f9f1a5",
  blueBright: "#3b78ff", magentaBright: "#b4009e", cyanBright: "#61d6d6", whiteBright: "#f2f2f2",
};
/** Mã SGR 30–37, 90–97 theo thứ tự ở trên. */
export const ANSI16 = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white", "blackBright", "redBright", "greenBright", "yellowBright", "blueBright", "magentaBright", "cyanBright", "whiteBright"];

export type ColorKind = "theme" | "raw" | "named" | "unknown" | "none";
export interface Resolved {
  kind: ColorKind;
  /** Màu CSS dùng để vẽ và đo; không có khi `none` hoặc `unknown`. */
  css?: string;
  /** Giá trị gốc mod ghi. */
  value?: string;
}

const RAW = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\(.*\))$/i;

export function resolveColor(v: unknown, scheme: Scheme): Resolved {
  if (typeof v !== "string" || !v.trim() || v === "transparent") return { kind: "none" };
  const value = v.trim();
  const theme = loadThemes()[scheme];
  if (theme[value]) return { kind: "theme", css: theme[value], value };
  if (RAW.test(value)) return { kind: "raw", css: value, value };
  if (ANSI[value]) return { kind: "named", css: ANSI[value], value };
  return { kind: "unknown", value };
}

export const isRawColor = (v: unknown): v is string => typeof v === "string" && RAW.test(v.trim());

export interface Contrast {
  /** WCAG 2 (1–21). */
  ratio: number;
  /** APCA Lc, trị tuyệt đối (0–108). */
  lc: number;
}
export function contrast(fg: string, bg: string): Contrast {
  const f = new Color(fg);
  const b = new Color(bg);
  // colorjs.io: với APCA, màu gọi hàm là nền, đối số là chữ.
  return { ratio: f.contrast(b, "WCAG21"), lc: Math.abs(b.contrast(f, "APCA")) };
}

/** Trộn `fg` về phía `bg` (chữ mờ SGR 2 trên terminal: coi như 50%). */
export function mix(fg: string, bg: string, amount = 0.5): string {
  return new Color(fg).mix(new Color(bg), amount, { space: "srgb" }).to("srgb").toString({ format: "hex" });
}

const SUGGEST = ["text", "inactive", "subtle", "success", "error", "warning", "claude", "suggestion", "permission", "planMode", "autoAccept", "ide", "merged"];
/** Khoá theme gần màu nhất (ΔE2000, theme tối): gợi ý thay cho hex cứng. */
export function nearestThemeKey(css: string): string {
  const c = new Color(css);
  const dark = loadThemes().dark;
  let best = "text";
  let bestD = Infinity;
  for (const k of SUGGEST) {
    const v = dark[k];
    if (!v) continue;
    const d = c.deltaE(new Color(v), "2000");
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

export const fmtRatio = (r: number): string => `${(Math.floor(r * 100) / 100).toFixed(2)}:1`;
