// Luật của engine Claude Code (types của claude-code, bản 2.1.325) kiểm thẳng trên cây vẽ, không cần dựng hình.
import { svgMotionIssue } from "./desktop.js";
import { describeNode, walk, type DrawNode } from "./tree.js";

export type Gate = "hard" | "soft";
export interface RuleHit {
  gate: Gate;
  check: string;
  where: string;
  detail: string;
}

/** `SvgProps.source`: "at most 131072 characters". */
export const SVG_SOURCE_MAX = 131_072;
/** AskUserQuestion: "at most 12 rows on the terminal and 48 on desktop, vscode and mobile, counted at 40 columns". */
export const ASK_ROWS = { terminal: 12, desktop: 48 } as const;
export const ASK_COLUMNS = 40;

export function engineRules(tree: DrawNode, component: string): RuleHit[] {
  const out: RuleHit[] = [];
  walk(tree, (n) => {
    const p = n.props ?? {};
    if (n.type === "Svg") {
      const src = typeof p["source"] === "string" ? (p["source"] as string) : "";
      if (src.length > SVG_SOURCE_MAX) {
        out.push({ gate: "hard", check: "svg-source", where: describeNode(component, n), detail: `source is ${src.length.toLocaleString("en")} characters; the engine takes at most ${SVG_SOURCE_MAX.toLocaleString("en")}` });
      }
      if (typeof p["alt"] !== "string" || !(p["alt"] as string).trim()) {
        out.push({ gate: "hard", check: "svg-source", where: describeNode(component, n), detail: "no alt: a reader that cannot see it, and a surface without Svg, get nothing" });
      }
      const motion = svgMotionIssue(src);
      if (motion) out.push({ gate: "hard", check: "motion", where: describeNode(component, n), detail: motion });
    }
    // Image/Raster của terminal: điểm ảnh nội tuyến 1–2048 mỗi chiều; tệp hay bộ nhớ dùng chung 1–4096.
    const s = p["source"];
    if ((n.type === "Image" || n.type === "Raster") && s && typeof s === "object") {
      const src = s as Record<string, unknown>;
      const max = "rgba" in src ? 2048 : "format" in src && src["format"] !== "png" ? 4096 : undefined;
      for (const dim of ["width", "height"]) {
        const v = src[dim];
        if (max && typeof v === "number" && (v < 1 || v > max)) {
          out.push({ gate: "hard", check: "raster-size", where: describeNode(component, n), detail: `${dim} ${v} px is outside 1–${max}` });
        }
      }
    }
  });
  return out;
}
