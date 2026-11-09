import { existsSync, readFileSync } from "node:fs";
import type { Page } from "playwright-core";
import { fail } from "./errors.js";

/**
 * Trạng thái sau tương tác (lỗi form, bước 3 của trình tự, hộp thoại mở, mẹo lần đầu…).
 * Cổng chỉ đo lần render đầu, nên mỗi trạng thái là một lần nạp trang mới rồi chạy các thao tác của nó,
 * sau đó đo đầy đủ như trang thường. Trạng thái độc lập với nhau: muốn bước 3 thì ghi đủ thao tác đến bước 3.
 */
export interface StepAction {
  click?: string;
  fill?: [string, string];
  check?: string;
  select?: [string, string];
  press?: string | [string, string];
  hover?: string;
  wait?: number;
}
export interface StepState {
  name: string;
  do: StepAction[];
  /** Chỉ đo ở các khổ này (nút Menu chỉ có ở khổ hẹp ⇒ "viewports":[320,390]). */
  viewports?: number[];
}

export const STEPS_FORMAT =
  'Format: [{"name":"loi","do":[{"click":"#gui"}]}], optional "viewports":[320,390] for controls that exist only at some widths. Actions: click <sel>, fill [sel,text], check <sel>, select [sel,value], press <key>|[sel,key], hover <sel>, wait <ms>';

const KINDS = ["click", "fill", "check", "select", "press", "hover", "wait"] as const;
const isSel = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isPair = (v: unknown): v is [string, string] => Array.isArray(v) && v.length === 2 && isSel(v[0]) && typeof v[1] === "string";

/** Đọc trạng thái từ JSON (chuỗi hoặc tệp). Sai định dạng ⇒ VALIDATION_ERROR (exit 2) kèm mẫu. */
export function parseSteps(raw: string, from: string): StepState[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail(`${from}: not valid JSON (${(e as Error).message.split("\n")[0]})`, "VALIDATION_ERROR", [STEPS_FORMAT]);
  }
  if (!Array.isArray(data) || data.length === 0) fail(`${from}: expected a non-empty array of states`, "VALIDATION_ERROR", [STEPS_FORMAT]);
  const names = new Set<string>();
  return data.map((s: unknown, i) => {
    const st = s as { name?: unknown; do?: unknown; viewports?: unknown };
    if (typeof st !== "object" || st === null || typeof st.name !== "string" || !/^[\w-]{1,40}$/.test(st.name)) {
      fail(`${from}: state ${i + 1} needs "name" made of letters, digits, - or _ (no accents)`, "VALIDATION_ERROR", [STEPS_FORMAT]);
    }
    if (names.has(st.name)) fail(`${from}: state name "${st.name}" is used twice`, "VALIDATION_ERROR");
    names.add(st.name);
    if (!Array.isArray(st.do) || st.do.length === 0) fail(`${from}: state "${st.name}" needs a non-empty "do" list`, "VALIDATION_ERROR", [STEPS_FORMAT]);
    const actions = st.do.map((a: unknown, j) => {
      const keys = typeof a === "object" && a !== null ? Object.keys(a) : [];
      const kind = keys[0] as (typeof KINDS)[number] | undefined;
      const v = kind ? (a as Record<string, unknown>)[kind] : undefined;
      const ok =
        keys.length === 1 &&
        kind !== undefined &&
        KINDS.includes(kind) &&
        (kind === "fill" || kind === "select"
          ? isPair(v)
          : kind === "press"
            ? isSel(v) || isPair(v)
            : kind === "wait"
              ? typeof v === "number" && v >= 0 && v <= 10_000
              : isSel(v));
      if (!ok) fail(`${from}: state "${st.name}" action ${j + 1} is not valid: ${JSON.stringify(a).slice(0, 80)}`, "VALIDATION_ERROR", [STEPS_FORMAT]);
      return a as StepAction;
    });
    if (st.viewports === undefined) return { name: st.name, do: actions };
    const vps = st.viewports;
    if (!Array.isArray(vps) || !vps.length || !vps.every((v) => Number.isInteger(v) && v >= 200 && v <= 3000)) {
      fail(`${from}: state "${st.name}" "viewports" must list widths between 200 and 3000`, "VALIDATION_ERROR", [STEPS_FORMAT]);
    }
    return { name: st.name, do: actions, viewports: vps as number[] };
  });
}

/** `--steps` nhận đường dẫn tệp hoặc JSON viết thẳng (bắt đầu bằng `[`). */
export function loadSteps(arg: string, resolvePath: (p: string) => string): StepState[] {
  if (arg.trim().startsWith("[")) return parseSteps(arg, "--steps");
  const p = resolvePath(arg);
  if (!existsSync(p)) fail(`--steps: not found: ${arg}`, "VALIDATION_ERROR", [STEPS_FORMAT]);
  return parseSteps(readFileSync(p, "utf8"), arg);
}

export function describeAction(a: StepAction): string {
  const [k, v] = Object.entries(a)[0] as [string, unknown];
  return `${k} ${Array.isArray(v) ? v.join(" → ") : String(v)}`;
}

/**
 * Chạy thao tác trên trang (bộ chọn của Playwright: CSS đi xuyên open shadow root, `text=…`, `role=button[name="…"]`).
 * Trả về mô tả lỗi của thao tác hỏng đầu tiên, hoặc undefined nếu chạy hết.
 */
export async function runActions(page: Page, actions: StepAction[]): Promise<string | undefined> {
  const timeout = 5000;
  for (const a of actions) {
    try {
      if (a.click !== undefined) await page.click(a.click, { timeout });
      else if (a.fill) await page.fill(a.fill[0], a.fill[1], { timeout });
      else if (a.check !== undefined) await page.check(a.check, { timeout });
      else if (a.select) await page.selectOption(a.select[0], a.select[1], { timeout });
      else if (Array.isArray(a.press)) await page.press(a.press[0], a.press[1], { timeout });
      else if (a.press !== undefined) await page.keyboard.press(a.press);
      else if (a.hover !== undefined) await page.hover(a.hover, { timeout });
      else if (a.wait !== undefined) await page.waitForTimeout(a.wait);
    } catch (e) {
      const msg = (e as Error).message.split("\n")[0]!.replace(/^\w+\.\w+:\s*/, "");
      return `${describeAction(a)} failed: ${msg.slice(0, 140)}`;
    }
  }
  await page.waitForLoadState("networkidle", { timeout }).catch(() => undefined);
  await page.waitForTimeout(300);
  return undefined;
}
