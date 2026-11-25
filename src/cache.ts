import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

/**
 * Bỏ qua trang không đổi (N7 / P8, 19/11/2026). Khoá của một trang là băm của mọi thứ quyết định kết quả trừ nội dung
 * tệp: phiên bản và mã của design-kit, axe, engine Impeccable, trình duyệt, cờ lệnh, trạng thái steps, quy tắc chữ.
 * Nội dung tệp không nằm trong khoá mà nằm trong mục: danh sách mọi tệp cục bộ trang đã nạp ở lần đo trước kèm băm.
 * Kết quả cũ chỉ được dùng khi mọi tệp đó còn nguyên. Tệp trang chỉ nạp ở lần đo này (script tải theo điều kiện mới)
 * sẽ có mặt ở lần sau, vì danh sách lấy từ yêu cầu mạng thật của lần đo.
 * Giới hạn: tài nguyên ngoài máy (CDN, font Google) không được băm; dữ liệu đổi theo giờ cũng không.
 */
export interface CacheEntry<R> {
  deps: Array<{ path: string; sha: string }>;
  shots: string[];
  report: R;
}

export const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");

export function cacheKey(parts: unknown): string {
  return sha(JSON.stringify(parts)).slice(0, 32);
}

/** Băm một tệp; không đọc được (đã xoá) thì undefined. */
export function fileSha(path: string): string | undefined {
  try {
    return statSync(path).isFile() ? sha(readFileSync(path)) : undefined;
  } catch {
    return undefined;
  }
}

/** URL yêu cầu tới máy chủ tĩnh của cổng → đường dẫn tệp dưới gốc phục vụ (thư mục → index.html), hay undefined. */
export function depPath(url: string, origin: string, root: string): string | undefined {
  if (!url.startsWith(`${origin}/`)) return undefined;
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return undefined;
  }
  let full = resolve(root, `.${path}`);
  if (full !== root && !full.startsWith(root.endsWith(sep) ? root : root + sep)) return undefined;
  try {
    if (statSync(full).isDirectory()) full = join(full, "index.html");
  } catch {
    /* tệp không có: vẫn ghi để lần sau thấy nó xuất hiện */
  }
  return full;
}

export function readEntry<R>(dir: string, key: string): CacheEntry<R> | undefined {
  const f = join(dir, `${key}.json`);
  if (!existsSync(f)) return undefined;
  try {
    const e = JSON.parse(readFileSync(f, "utf8")) as { deps?: unknown; shots?: unknown; report?: Record<string, unknown> | null } | null;
    // JSON hợp lệ mà sai hình (tệp sửa tay, ghi dở rồi nối): coi như không có, không làm đổ cả lượt kiểm (25/11/2026).
    const ok = Array.isArray(e?.deps) && (e.deps as Array<Partial<{ path: unknown; sha: unknown }> | null>).every((d) => typeof d?.path === "string" && typeof d.sha === "string")
      && Array.isArray(e.shots) && e.shots.every((s) => typeof s === "string")
      && ["findings", "notes", "assumed"].every((k) => Array.isArray(e.report?.[k]));
    return ok ? (e as unknown as CacheEntry<R>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Mục còn dùng được: mọi tệp phụ thuộc còn đúng băm của nội dung trang đã nhận, tệp trang từng nhận 404 ("missing")
 * vẫn chưa có, mọi ảnh chụp đã ghi còn đó.
 */
export function entryValid(e: CacheEntry<unknown>): boolean {
  return e.deps.length > 0
    && e.deps.every((d) => (d.sha === "missing" ? fileSha(d.path) === undefined : fileSha(d.path) === d.sha))
    && e.shots.every((s) => existsSync(s));
}

/**
 * Ghi mục: `deps` là băm của đúng thân phản hồi trang đã nhận (lấy lúc nhận), hay "missing" khi máy chủ trả ≥ 400.
 * Trước bản sửa 19/11/2026 băm đọc lại tệp lúc job xong, nên tệp sửa giữa lượt đo được ghi băm mới cạnh kết quả cũ, và
 * tệp 404 bị bỏ khỏi danh sách nên tạo tệp sau đó vẫn trúng đệm.
 */
export function writeEntry<R>(dir: string, key: string, deps: Array<{ path: string; sha: string }>, shots: string[], report: R): void {
  const list = [...new Map(deps.map((d) => [d.path, d])).values()];
  if (!list.some((d) => d.sha !== "missing")) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${key}.json`), JSON.stringify({ deps: list, shots, report }));
}
