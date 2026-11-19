import { existsSync, readFileSync } from "node:fs";
import { fail } from "./errors.js";

/**
 * Miễn trừ có lý do cho phát hiện mềm (N8 / P11, 19/11/2026). Phát hiện mềm mà người duyệt đã xét là báo nhầm hay cố ý
 * thì ghi vào tệp, kèm lý do, thay cho việc lý do chỉ nằm trong khung chat và phát hiện lặp lại mỗi lần chạy. Luật theo
 * taste-skill (references/gate.md): mỗi mục chỉ một phát hiện, lý do đủ dài, quá 5 mục một trang là dấu hiệu lạm dụng.
 * Không miễn được phát hiện cứng.
 */
export interface Waiver {
  /** Trang như cột `page` in ra, bỏ `?query` và `#trạng thái` (mục áp cho mọi query và trạng thái của trang). */
  page: string;
  check: string;
  /** Cột `where` của phát hiện, khớp đúng. */
  where: string;
  reason: string;
}

export const WAIVER_MIN_REASON = 12;
export const WAIVER_MAX_PER_PAGE = 5;
export const WAIVERS_FORMAT =
  'waivers file: [{"page":"blocks/html/hero.html","check":"standalone","where":"data: URL","reason":"why this soft finding is fine (12+ chars)"}]; soft findings only, at most 5 per page';

export function parseWaivers(text: string, from: string): Waiver[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    fail(`${from}: not valid JSON (${(e as Error).message})`, "VALIDATION_ERROR", [WAIVERS_FORMAT]);
  }
  if (!Array.isArray(raw)) fail(`${from}: must be a JSON array`, "VALIDATION_ERROR", [WAIVERS_FORMAT]);
  return raw.map((w, i) => {
    const o = w as Partial<Record<keyof Waiver, unknown>>;
    for (const k of ["page", "check", "where", "reason"] as const) {
      if (typeof o[k] !== "string" || !(o[k] as string).trim()) fail(`${from}: waiver ${i + 1} needs "${k}"`, "VALIDATION_ERROR", [WAIVERS_FORMAT]);
    }
    if ((o.reason as string).trim().length < WAIVER_MIN_REASON) {
      fail(`${from}: waiver ${i + 1} reason is shorter than ${WAIVER_MIN_REASON} characters: say why the finding is fine`, "VALIDATION_ERROR", [WAIVERS_FORMAT]);
    }
    return { page: (o.page as string).replace(/\\/g, "/").trim(), check: (o.check as string).trim(), where: (o.where as string).trim(), reason: (o.reason as string).trim() };
  });
}

export function loadWaivers(path: string, label: string, required: boolean): Waiver[] {
  if (!existsSync(path)) {
    if (required) fail(`--waivers: not found: ${label}`, "VALIDATION_ERROR", [WAIVERS_FORMAT]);
    return [];
  }
  return parseWaivers(readFileSync(path, "utf8"), label);
}

/** Trang gốc của một nhãn báo cáo: bỏ ` #trạng thái` và `?query`. */
export const pageOf = (label: string): string => label.replace(/ #[^#]*$/, "").replace(/\?[^ ]*$/, "");

export interface WaivableFinding {
  gate: "hard" | "soft";
  check: string;
  where: string;
}

/**
 * Áp miễn trừ lên các báo cáo: gỡ phát hiện mềm khớp khỏi `findings`. Trả các mục đã dùng, mục không khớp gì (để nhắc
 * gỡ), mục bị từ chối (khớp phát hiện cứng) và trang có quá nhiều mục (các mục từ thứ 6 không được dùng).
 */
export function applyWaivers<F extends WaivableFinding>(
  reports: Array<{ target: string; findings: Map<string, F> }>,
  waivers: Waiver[],
): { used: Array<Waiver & { count: number }>; unused: Waiver[]; refused: Waiver[]; tooMany: string[] } {
  const perPage = new Map<string, Waiver[]>();
  for (const w of waivers) perPage.set(w.page, [...(perPage.get(w.page) ?? []), w]);
  const tooMany = [...perPage].filter(([, ws]) => ws.length > WAIVER_MAX_PER_PAGE).map(([p]) => p);
  const active = [...perPage.values()].flatMap((ws) => ws.slice(0, WAIVER_MAX_PER_PAGE));
  const count = new Map<Waiver, number>();
  const refused = new Set<Waiver>();
  for (const r of reports) {
    const page = pageOf(r.target);
    for (const [key, f] of r.findings) {
      const w = active.find((x) => x.page === page && x.check === f.check && x.where === f.where);
      if (!w) continue;
      if (f.gate === "hard") {
        refused.add(w);
        continue;
      }
      r.findings.delete(key);
      count.set(w, (count.get(w) ?? 0) + 1);
    }
  }
  return {
    used: [...count].map(([w, n]) => ({ ...w, count: n })),
    unused: active.filter((w) => !count.has(w) && !refused.has(w)),
    refused: [...refused],
    tooMany,
  };
}
