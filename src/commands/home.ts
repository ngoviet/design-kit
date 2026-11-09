import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCommandArgs } from "../args.js";
import { findImpeccable } from "../impeccable.js";
import type { Runtime } from "../runtime.js";

export const HOME_HELP = `usage: design-kit home
description: Where the kit is, which directions and blocks it holds, and which tools the gate will use. Same as running with no arguments
`;

/** Thư mục gốc của design-kit (chứa tokens/, design/, blocks/), từ dist/bin/ hoặc src/commands/. */
export function kitRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i++) {
    if (existsSync(join(dir, "tokens", "core.css"))) return dir;
    dir = dirname(dir);
  }
  return dir;
}

const list = (dir: string, ext: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)).sort() : [];

export async function homeView(args: string[], rt: Runtime): Promise<Record<string, unknown>> {
  parseCommandArgs("home", args);
  const root = kitRoot();
  const directions = existsSync(join(root, "design")) ? readdirSync(join(root, "design")).sort() : [];
  const html = list(join(root, "blocks", "html"), ".html");
  const react = list(join(root, "blocks", "react", "src", "blocks"), ".tsx");
  const imp = findImpeccable(rt.env);
  const tilde = (p: string) => (p.toLowerCase().startsWith(rt.home.toLowerCase()) ? `~${p.slice(rt.home.length).replace(/\\/g, "/")}` : p);
  return {
    kit: root.replace(/\\/g, "/"),
    directions: directions.length ? directions.map((d) => `${d} (design/${d}/DESIGN.md)`).join(", ") : "0 directions found",
    blocks: `${html.length} html: ${html.join(", ") || "none"}; ${react.length} react: ${react.join(", ") || "none"}`,
    impeccable: imp ? tilde(imp) : "not found: install the impeccable skill or set IMPECCABLE_BIN",
    browser: rt.env["DK_BROWSER"] ? `DK_BROWSER=${rt.env["DK_BROWSER"]}` : "Edge, else Chrome (playwright-core channel)",
    project: `${rt.cwd.replace(/\\/g, "/")}: DESIGN.md ${existsSync(join(rt.cwd, "DESIGN.md")) ? "yes" : "no"}, PRODUCT.md ${existsSync(join(rt.cwd, "PRODUCT.md")) ? "yes" : "no"}`,
    help: [
      "Run `design-kit check <file|dir|url>` before calling a page done",
      ...(existsSync(join(rt.cwd, "DESIGN.md")) ? [] : [`Copy a direction: cp ${root.replace(/\\/g, "/")}/design/<dem|giay|dam>/DESIGN.md ./DESIGN.md`]),
    ],
  };
}
