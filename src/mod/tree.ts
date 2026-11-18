// Cây vẽ của mod: thứ `ui.drawn()` của bộ test engine trả về (claude-code/testing), dạng dữ liệu thuần.
// Box, Text, Button, Svg… mỗi nút có `type`, `props`, `children` (chuỗi hoặc nút). Cây không có điểm ảnh: engine
// chỉ cho biết surface được giao vẽ gì, nên check-mod tự dựng lại hình (desktop: HTML, terminal: Ink).
import { createHash } from "node:crypto";

export interface DrawNode {
  type: string;
  props?: Record<string, unknown>;
  children?: Child[];
  /** Engine gắn: plugin vẽ phần này (gốc) và tay cầm của nút bấm. Bỏ khi băm. */
  part?: unknown;
  press?: unknown;
}
export type Child = DrawNode | string;
export type Surface = "terminal" | "desktop";
export type Scheme = "dark" | "light";

/** Một lần vẽ lớp chặn in ra (dòng `DKTREE {...}` của `claude plugin test`). */
export interface Drawing {
  /** Lượt chạy: `default` (tuỳ chọn của test giữ nguyên) hoặc giá trị `language` ép cho cả lượt. */
  run: string;
  test: string;
  /** Lần mount thứ mấy trong lượt chạy: các bề rộng và surface của cùng một lần mount chung một scene. */
  scene: number;
  component: string;
  requestId?: string;
  surface: Surface;
  columns: number;
  maxRows?: number;
  generic?: boolean;
  tree?: DrawNode;
  error?: string;
}

/** Cây không có gì của mod: hộp rỗng đứng thay phần engine (test chung) hoặc hộp rỗng trơn. */
export function isBlank(n: DrawNode): boolean {
  const own = (c: Child): boolean => {
    if (typeof c === "string") return c.trim() !== "";
    if (c.props?.["key"] === "dk-engine") return false;
    if (c.type !== "Box") return true;
    return kids(c).some(own);
  };
  return !own(n);
}

export const isNode =(c: Child | undefined | null): c is DrawNode => typeof c === "object" && c !== null && typeof c.type === "string";

export const kids = (n: DrawNode): Child[] => (Array.isArray(n.children) ? n.children : []);

/** Chữ một nút hiện ra: chuỗi con theo thứ tự, nhãn của Button, alt của Svg. */
export function textOf(c: Child): string {
  if (typeof c === "string") return c;
  if (c.type === "Button" && typeof c.props?.["label"] === "string" && !kids(c).length) return c.props["label"] as string;
  if (c.type === "Svg") return "";
  return kids(c).map(textOf).join("");
}

/** Bỏ phần engine gắn theo từng lần mount (tay cầm nút bấm, plugin) để hai lần vẽ giống nhau băm ra một. */
export function stripVolatile(c: Child): Child {
  if (typeof c === "string") return c;
  const out: DrawNode = { type: c.type };
  if (c.props) out.props = c.props;
  if (c.children) out.children = c.children.map(stripVolatile);
  return out;
}

export const hashTree = (n: DrawNode): string => createHash("sha1").update(JSON.stringify(stripVolatile(n))).digest("hex").slice(0, 12);

/** Duyệt cây, gọi `fn` với nút và các tổ tiên (gần nhất cuối mảng). */
export function walk(n: DrawNode, fn: (node: DrawNode, ancestors: DrawNode[]) => void, ancestors: DrawNode[] = []): void {
  fn(n, ancestors);
  for (const c of kids(n)) if (isNode(c)) walk(c, fn, [...ancestors, n]);
}

const clip = (s: string, n = 40): string => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

/** Nhãn ngắn cho cột `where`: `AbovePrompt › Text "$0.50"`, `Pane › Svg alt="context"`. */
export function describeNode(component: string, n: DrawNode): string {
  if (n.type === "Svg") return `${component} › Svg alt="${clip(String(n.props?.["alt"] ?? ""))}"`;
  const t = textOf(n);
  return t ? `${component} › ${n.type} "${clip(t)}"` : `${component} › ${n.type}`;
}

/**
 * Gộp danh sách bề rộng thành dải theo đúng thứ tự quét: [40,52,64,100] trong quét 40,52,64,78,100 ⇒ "40–64,100".
 */
export function widthRanges(cols: number[], sweep: number[]): string {
  const set = new Set(cols);
  const parts: string[] = [];
  let i = 0;
  while (i < sweep.length) {
    if (!set.has(sweep[i]!)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < sweep.length && set.has(sweep[j + 1]!)) j++;
    parts.push(i === j ? `${sweep[i]}` : `${sweep[i]}–${sweep[j]}`);
    i = j + 1;
  }
  // Bề rộng ngoài danh sách quét (lần mount gốc của test): thêm vào cuối.
  for (const c of [...set].filter((c) => !sweep.includes(c)).sort((a, b) => a - b)) parts.push(String(c));
  return parts.join(",");
}
