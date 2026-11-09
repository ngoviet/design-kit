import { existsSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type FlagSpec, parseCommandArgs } from "../args.js";
import { fail } from "../errors.js";
import type { Runtime } from "../runtime.js";
import { kitRoot } from "./home.js";

/** Lõi màu nằm ở scripts/doi-mau-lib.mjs (cũng dùng cho script chạy tay): nạp lúc chạy, không đóng gói. */
interface MauLib {
  HUONG: string[];
  doiMau(o: { huong: string; nhan: number; trungTinh?: number }): {
    css: string;
    check: { total: number; fails: Array<{ mode: string; pair: string; wcag: string }> };
    accent: { light: string; dark: string };
  };
  kiemMau(targets?: Array<[string, string]>): { total: number; fails: Array<{ huong: string; mode: string; pair: string; wcag: string }> };
}
const lib = async (): Promise<MauLib> => (await import(pathToFileURL(join(kitRoot(), "scripts", "doi-mau-lib.mjs")).href)) as MauLib;

export const DOI_MAU_HELP = `usage: design-kit doi-mau --huong <dem|giay|dam> --nhan <0-360> [--trung-tinh <0-360>] --ra <file.css>
description: Swap a direction's accent hue (and optionally the neutral tint) to fit a brand, keep the structure, then re-solve lightness so every color pair still passes WCAG. Writes a drop-in replacement for tokens/<huong>.css
flags[4]:
  --huong <dem|giay|dam>: direction to start from
  --nhan <0-360>: accent hue (red 25, orange 45, amber 70, green 145, teal 180, blue 250, purple 300)
  --trung-tinh <0-360>: neutral tint hue (warm 50-70, cool 240-260); default keeps the direction's
  --ra <file.css>: output file (link it instead of tokens/<huong>.css)
examples[2]:
  design-kit doi-mau --huong dem --nhan 45 --trung-tinh 60 --ra ./dem.css
  design-kit doi-mau --huong giay --nhan 145 --ra src/styles/giay.css
`;

export const KIEM_MAU_HELP = `usage: design-kit kiem-mau [<file.css> --huong <dem|giay|dam>]
description: Check every role pair (text, accent, status, border, focus) for WCAG 2 contrast and sRGB gamut, light and dark. No file: the kit's three token files
flags[1]:
  --huong <dem|giay|dam>: direction of the file (default dem)
examples[2]:
  design-kit kiem-mau
  design-kit kiem-mau ./dem.css --huong dem
`;

const DOI_FLAGS: Record<string, FlagSpec> = {
  huong: { type: "string", hint: "--huong dem|giay|dam" },
  nhan: { type: "string", hint: "--nhan <0-360>" },
  "trung-tinh": { type: "string", hint: "--trung-tinh <0-360>" },
  ra: { type: "string", hint: "--ra <file.css>" },
};

const hue = (raw: string | undefined, flag: string): number | undefined => {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 360) fail(`--${flag} must be a hue between 0 and 360`, "VALIDATION_ERROR");
  return n;
};

export async function doiMauCommand(args: string[], rt: Runtime): Promise<Record<string, unknown>> {
  const p = parseCommandArgs("doi-mau", args, DOI_FLAGS);
  const m = await lib();
  const huong = p.str("huong");
  if (!huong || !m.HUONG.includes(huong)) fail("--huong must be dem, giay or dam", "VALIDATION_ERROR", ["Run `design-kit doi-mau --help` for usage"]);
  const nhan = hue(p.str("nhan"), "nhan");
  if (nhan === undefined) fail("--nhan is required (accent hue 0-360)", "VALIDATION_ERROR", ["Run `design-kit doi-mau --help` for hue examples"]);
  const ra = p.str("ra");
  if (!ra) fail("--ra is required (where to write the token file)", "VALIDATION_ERROR", [`Example: design-kit doi-mau --huong ${huong} --nhan ${nhan} --ra ./${huong}.css`]);
  const trungTinh = hue(p.str("trung-tinh"), "trung-tinh");
  const r = m.doiMau({ huong, nhan, ...(trungTinh !== undefined ? { trungTinh } : {}) });
  const out = resolve(rt.cwd, ra);
  const existed = existsSync(out);
  writeFileSync(out, r.css);
  const rel = relative(rt.cwd, out).replace(/\\/g, "/") || out;
  if (r.check.fails.length) process.exitCode = 1;
  return {
    status: r.check.fails.length ? `fail: ${r.check.fails.length} of ${r.check.total} pairs below WCAG` : `pass: ${r.check.total} pairs`,
    file: `${rel}${existed ? " (overwritten)" : ""}`,
    accent: `light ${r.accent.light}, dark ${r.accent.dark}`,
    ...(r.check.fails.length ? { fails: r.check.fails } : {}),
    help: [`Link ${rel} instead of tokens/${huong}.css (after tokens/fonts.css and tokens/core.css), then run design-kit check`],
  };
}

export async function kiemMauCommand(args: string[], rt: Runtime): Promise<Record<string, unknown>> {
  const p = parseCommandArgs("kiem-mau", args, { huong: DOI_FLAGS["huong"]! }, { min: 0, max: 1, usage: "[<file.css>]" });
  const m = await lib();
  const file = p.positionals[0];
  const huong = p.str("huong") ?? "dem";
  if (!m.HUONG.includes(huong)) fail("--huong must be dem, giay or dam", "VALIDATION_ERROR");
  if (file && !existsSync(resolve(rt.cwd, file))) fail(`not found: ${file}`, "VALIDATION_ERROR");
  const r = file ? m.kiemMau([[resolve(rt.cwd, file), huong]]) : m.kiemMau();
  if (r.fails.length) process.exitCode = 1;
  return {
    status: r.fails.length ? `fail: ${r.fails.length} of ${r.total} pairs below WCAG` : `pass: ${r.total} pairs`,
    checked: file ? `${file} as ${huong}` : "tokens/dem.css, tokens/giay.css, tokens/dam.css",
    fails: r.fails.length ? r.fails : "0 failing pairs",
  };
}
