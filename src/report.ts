import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Cách báo (K9, 24/11/2026): mã ngắn ổn định cho mỗi phát hiện, so với lượt trước, đo lại đúng chỗ theo mã, và ảnh chụp đánh số.
 * Vòng sửa của agent trước đây là: đo cả bộ, sửa một chỗ, đo lại cả bộ, rồi tự dò xem dòng nào đã mất. Ý "mã ổn định, đo lại theo
 * mã" theo visual-qa-mcp (MIT), ý "so với lượt trước" và "ảnh đánh số" theo renderlint (MIT); viết lại, không chép mã.
 *
 * Phần trên là hàm thuần và đọc ghi tệp; ba hàm cuối chạy trong trang, tự chứa.
 */
export interface RunFinding {
  id: string;
  gate: "hard" | "soft";
  page: string;
  check: string;
  where: string;
  detail: string;
  /** Như cột `renders`: "light/390", "touch/390", "mobile/390", "load". */
  renders: string[];
}
export interface Run {
  v: 1;
  /** Giờ chạy, ISO. */
  at: string;
  /** Khổ có đo, dạng "390x844". */
  sizes: string[];
  schemes: string[];
  /** Nhãn từng trang và trạng thái đã đo (`PageReport.target`). */
  pages: string[];
  /** Lựa chọn quyết định đo những gì (khổ quét, số điểm dừng Tab, mức chạm, engine): khác nhau thì "vắng" không phải là "đã sửa". */
  opts: string;
  /** Phép đo bị tắt ở lượt này (copy khi --no-copy, impeccable khi thiếu engine…): vắng phát hiện của nó không phải là đã sửa. */
  skipped: string[];
  findings: RunFinding[];
}

// Bỏ i, l, o, u: đọc mã qua điện thoại hay gõ lại không nhầm với 1, 0, v.
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/**
 * Mã 6 ký tự (30 bit) của một phát hiện. Số trong `detail` bị bỏ trước khi băm, nên "14,2px" thành "14,4px" vẫn là cùng một lỗi;
 * cùng lỗi ở hai khổ chỉ khác con số thì chung mã.
 */
export function findingId(f: { page: string; check: string; where: string; detail: string }): string {
  const plain = (s: string): string => s.normalize("NFC").replace(/\d+(?:[.,]\d+)*/g, "#").replace(/\s+/g, " ").trim();
  const where = /^\+\d+ more$/.test(f.where) ? "+# more" : f.where;
  // axe ghi tên luật ở `where` và bộ chọn ở đầu `detail`: bộ chọn là định danh, bỏ số ở đó thì #doan-1 và #doan-2 chung một mã.
  const cut = /^(axe|axe-bp|orientation)$/.test(f.check) ? f.detail.indexOf(": ") : -1;
  const detail = cut > 0 ? f.detail.slice(0, cut) + plain(f.detail.slice(cut)) : plain(f.detail);
  const bits = createHash("sha256").update([f.page.replace(/\\/g, "/"), f.check, where, detail].join("\n")).digest().readUInt32BE(0);
  let id = "";
  for (let i = 0; i < 6; i++) id += ALPHABET[(bits >>> (i * 5)) & 31];
  return id;
}

/** Ghi lượt chạy. Ghi ra tệp tạm rồi đổi tên: hai cổng chạy song song không để lại tệp dở. */
export function saveRun(file: string, run: Run): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(run));
  renameSync(tmp, file);
}

/** Lượt trước, hay undefined khi chưa có, tệp hỏng hoặc khác phiên bản định dạng. */
export function loadRun(file: string): Run | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const r = JSON.parse(readFileSync(file, "utf8")) as Partial<Run> | null;
    const lists = [r?.sizes, r?.schemes, r?.pages, r?.skipped];
    if (r?.v !== 1 || typeof r.at !== "string" || typeof r.opts !== "string" || !lists.every((l) => Array.isArray(l) && l.every((x) => typeof x === "string")) || !Array.isArray(r.findings)) return undefined;
    const ok = r.findings.every((f) => f && typeof f.id === "string" && typeof f.page === "string" && typeof f.check === "string" && typeof f.where === "string" && typeof f.detail === "string" && Array.isArray(f.renders));
    return ok ? (r as Run) : undefined;
  } catch {
    return undefined;
  }
}

export interface RunDiff {
  fixed: RunFinding[];
  added: RunFinding[];
  same: number;
  /** Số trang so được (có ở cả hai lượt). */
  pages: number;
  /** Vì sao không so được gì. */
  why?: string;
}

/** Phép đo còn có nghĩa khi trang không mở được, trắng, hay không tới được trạng thái. */
const ALWAYS = new Set(["render", "steps", "errors", "viewport"]);

/**
 * So hai lượt. Chỉ so trang có ở cả hai lượt, cùng bộ khổ và chế độ màu, và phép đo không bị tắt ở lượt nào. Trang không chạy lượt
 * này không tính là đã sửa. Trang trắng, không mở được hay không tới được trạng thái thì mọi phát hiện khác của nó biến mất mà
 * chưa ai sửa gì: trang đó chỉ so các phép đo trong ALWAYS.
 */
export function diffRuns(prev: Run, now: Run): RunDiff {
  const differ = (a: string[], b: string[]): boolean => new Set(a).size !== new Set(b).size || a.some((x) => !b.includes(x));
  const none = (why: string): RunDiff => ({ fixed: [], added: [], same: 0, pages: 0, why });
  if (differ(prev.sizes, now.sizes)) return none(`sizes differ (${prev.sizes.join(", ")} then, ${now.sizes.join(", ")} now)`);
  if (differ(prev.schemes, now.schemes)) return none(`color schemes differ (${prev.schemes.join(", ")} then, ${now.schemes.join(", ")} now)`);
  if (prev.opts !== now.opts) return none(`options differ (${prev.opts} then, ${now.opts} now)`);
  const both = new Set(prev.pages.filter((p) => now.pages.includes(p)));
  if (!both.size) return none("no page in common");
  const off = new Set([...prev.skipped, ...now.skipped]);
  const lost = new Set([...prev.findings, ...now.findings].filter((f) => f.gate === "hard" && (f.check === "render" || f.check === "steps")).map((f) => f.page));
  const of = (run: Run): Map<string, RunFinding> =>
    new Map(run.findings.filter((f) => both.has(f.page) && !off.has(f.check) && (!lost.has(f.page) || ALWAYS.has(f.check))).map((f) => [f.id, f]));
  const a = of(prev);
  const b = of(now);
  return {
    fixed: [...a.values()].filter((f) => !b.has(f.id)),
    added: [...b.values()].filter((f) => !a.has(f.id)),
    same: [...a.keys()].filter((id) => b.has(id)).length,
    pages: both.size,
  };
}

export interface RecheckItem {
  /** Nhãn trang, còn `?query`, đã bỏ ` #trạng thái`. */
  page: string;
  state?: string;
  widths: number[];
  schemes: string[];
  /** Phát hiện ở khổ quét (--sweep): khổ đó không nằm trong `widths`, đo lại thì thêm --sweep. */
  sweep?: true;
}

/** Từ các mã, những lượt đo đủ để biết chúng đã hết chưa; mã không có trong lượt trước thì liệt kê ở `unknown`. */
export function recheckPlan(run: Run, ids: string[]): { items: RecheckItem[]; unknown: string[] } {
  const items = new Map<string, RecheckItem>();
  const unknown: string[] = [];
  const sizes = run.sizes.map((s) => Number(s.split("x")[0]));
  for (const raw of new Set(ids.map((i) => i.trim().toLowerCase().replace(/^#/, "")).filter(Boolean))) {
    const found = run.findings.filter((f) => f.id === raw);
    if (!found.length) unknown.push(raw);
    for (const f of found) {
      // Nhãn trạng thái là " #tên" ở cuối; "#" trong địa chỉ (định tuyến kiểu /#/trang) không có dấu cách trước nó.
      const m = /^(.*) #([^#]*)$/.exec(f.page);
      const page = m ? m[1]! : f.page;
      const item = items.get(f.page) ?? { page, ...(m ? { state: m[2]! } : {}), widths: [], schemes: [] };
      for (const r of f.renders) {
        const at = /^(light|dark|mobile|touch)\/(\d+)$/.exec(r);
        // "load" hay dạng lạ: không biết ở đâu thì đo lại đủ.
        const widths = at ? [Number(at[2])] : sizes;
        for (const w of widths) {
          if (sizes.includes(w)) item.widths.push(w);
          else item.sweep = true;
        }
        if (!at) item.schemes.push(...run.schemes);
        else item.schemes.push(at[1] === "light" || at[1] === "dark" ? at[1] : (run.schemes[0] ?? "light"));
      }
      items.set(f.page, item);
    }
  }
  for (const it of items.values()) {
    // Khổ quét chạy trên trang đang mở ở khổ rộng nhất.
    if (!it.widths.length) it.widths.push(Math.max(...sizes));
    it.widths = [...new Set(it.widths)].sort((x, y) => x - y);
    it.schemes = run.schemes.filter((s) => it.schemes.includes(s));
  }
  return { items: [...items.values()], unknown };
}

/** Phép đo mà `where` không phải nhãn của một phần tử. */
const NO_PLACE = new Set(["render", "errors", "viewport", "overflow", "lang", "motion", "steps", "impeccable", "long-form", "lcp", "cls", "standalone", "sticky", "orientation", "autoplay", "permission"]);

/** Nhãn đem cho `locateLabels`, hay undefined khi phát hiện nói về cả trang. axe ghi tên luật ở `where`, bộ chọn ở `detail`. */
export function labelOf(f: { check: string; where: string; detail: string }): string | undefined {
  if (NO_PLACE.has(f.check) || /^(page|\+\d+ more|<.*>)$/.test(f.where)) return undefined;
  return f.check === "axe" || f.check === "axe-bp" ? f.detail : f.where;
}

export interface Place {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Tìm phần tử theo nhãn mà các probe in ra, trả ô chữ nhật theo toạ độ tài liệu. Nhãn không tìm thấy thì không có trong kết quả.
 * Nhận: `button#dong "Đóng"`, `span.x "chữ bị cắt ở…"`, `host::shadow tag…`, `svg text "…"`, `img#a[alt]`, `img#a (attribute)`,
 * bộ chọn CSS, và bộ chọn axe (kèm `: lời báo` phía sau, `[host,bộ chọn]` khi xuyên shadow root, dấu nháy đã bị bỏ).
 * Chạy trong trang, tự chứa.
 */
export function locateLabels(labels: string[]): Place[] {
  const norm = (s: string): string => s.normalize("NFC").replace(/\s+/g, " ").trim();
  const all: Array<{ el: Element; host: string }> = [];
  const roots: Array<Document | ShadowRoot> = [];
  const walk = (root: Document | ShadowRoot, host: string): void => {
    roots.push(root);
    for (const el of Array.from(root.querySelectorAll("*"))) {
      all.push({ el, host });
      if (el.shadowRoot) walk(el.shadowRoot, el.tagName.toLowerCase());
    }
  };
  walk(document, "");
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1 && r.right + scrollX > 0 && r.bottom + scrollY > 0 && el.checkVisibility({ checkVisibilityCSS: true });
  };
  const firstClass = (el: Element): string => (typeof el.className === "string" ? (el.className.trim().split(/\s+/)[0] ?? "") : "");
  // Nhãn cắt chữ ở 24, 28 hay 40 ký tự: ngắn hơn 24 (trừ một dấu cách cuối đã bỏ) thì chữ của phần tử phải bằng đúng nó.
  const saysText = (el: Element, t: string): boolean =>
    [el.textContent, el.getAttribute("aria-label"), (el as HTMLInputElement).placeholder, el.getAttribute("title")].some((s) => {
      const c = norm(s ?? "");
      return c === t || (t.length >= 23 && c.startsWith(t)) || (t.endsWith("…") && c.startsWith(t.slice(0, -1).trim()));
    });
  const byLabel = (label: string): Element | undefined => {
    const m = /^(?:([a-z][\w.-]*)::shadow )?([a-z][\w-]*)(#[^\s"]+|\.[^\s"]+)?(?: "([\s\S]*)")?$/.exec(label);
    if (!m) return undefined;
    const [, host, tag, mark, text] = m;
    const t = text === undefined ? undefined : norm(text);
    const fit = all.filter(({ el, host: h }) =>
      el.tagName.toLowerCase() === tag && (host === undefined || h === host) &&
      (!mark || (mark[0] === "#" ? el.id === mark.slice(1) : !el.id && firstClass(el) === mark.slice(1))) &&
      (t === undefined || saysText(el, t)) && visible(el));
    // Nhãn không có tiền tố shadow: ưu tiên phần tử ngoài shadow root (vài probe không ghi tiền tố). Không có id, lớp trong nhãn:
    // ưu tiên phần tử không có cả hai. Lồng nhau cùng chữ: lấy cái trong cùng, nơi có chữ thật.
    const light = host === undefined ? fit.filter((x) => !x.host) : fit;
    const pool = light.length ? light : fit;
    const bare = mark ? pool : pool.filter((x) => !x.el.id && !firstClass(x.el));
    const best = bare.length ? bare : pool;
    return best.find((x) => !best.some((y) => y !== x && x.el.contains(y.el)))?.el;
  };
  const bySelector = (raw: string): Element | undefined => {
    // axe trong báo cáo đã mất dấu nháy kép: input[name=\q\] là input[name="q"].
    const sel = raw.replace(/=\\([^\]]*?)\\\]/g, '="$1"]').replace(/::?(?:before|after|placeholder|marker|first-line|first-letter)\b/g, "").trim();
    const inner = /^\[([^=\]]+,.+)\]$/.exec(sel)?.[1];
    const path = inner ? inner.split(",").map((s) => s.trim()) : [sel];
    let from = roots;
    for (const [i, part] of path.entries()) {
      const found: Element[] = [];
      for (const root of from) {
        try {
          found.push(...Array.from(root.querySelectorAll(part)));
        } catch {
          return undefined;
        }
      }
      if (i === path.length - 1) return found.find(visible);
      from = found.flatMap((e) => (e.shadowRoot ? [e.shadowRoot] : []));
    }
    return undefined;
  };
  const out: Place[] = [];
  for (const label of labels) {
    const clean = label.trim().replace(/ \(attribute\)$/, "").replace(/\[(?:alt|title|aria-label|placeholder|style)\]$/, "").replace(/^svg (?=[a-z])/, "");
    const cut = label.indexOf(": ");
    const el = byLabel(clean) ?? bySelector(clean) ?? (cut > 0 ? bySelector(label.slice(0, cut).trim()) : undefined);
    if (!el || el === document.documentElement || el === document.body) continue;
    const r = el.getBoundingClientRect();
    out.push({ label, x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return out;
}

/** Một khung trên ảnh: số thứ tự và ô theo toạ độ tài liệu. `hard`: tô màu phát hiện cứng. */
export interface Mark {
  n: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hard?: boolean;
}

/**
 * Vẽ khung và số đè lên trang để chụp ảnh. Không đổi bố cục: một lớp phủ absolute cao rộng đúng bằng tài liệu, cắt phần thừa
 * (khung ở mép không làm trang cuộn ngang), không nhận chuột, trong shadow root riêng nên CSS của trang không chạm tới. Lớp phủ là
 * popover để nằm trên cả hộp thoại đang mở. Đặt kiểu bằng CSSOM: CSP không chặn. Chạy trong trang, tự chứa; gọi lại thì vẽ lại.
 */
export function drawMarks(marks: Mark[]): number {
  const w = window as unknown as { __dkMarks?: HTMLElement };
  w.__dkMarks?.remove();
  const de = document.documentElement;
  const W = Math.max(de.scrollWidth, de.clientWidth);
  const H = Math.max(de.scrollHeight, de.clientHeight);
  const host = document.createElement("div");
  const set = (el: HTMLElement, css: Record<string, string>): void => {
    for (const [k, v] of Object.entries(css)) el.style.setProperty(k, v, "important");
  };
  set(host, {
    all: "initial", display: "block", position: "absolute", inset: "0 auto auto 0", margin: "0", padding: "0", border: "0", width: `${W}px`, height: `${H}px`,
    "max-width": "none", "max-height": "none", overflow: "hidden", "pointer-events": "none", background: "transparent", "z-index": "2147483647",
  });
  host.setAttribute("aria-hidden", "true");
  const root = host.attachShadow({ mode: "open" });
  const badges: Array<{ x: number; y: number }> = [];
  for (const m of marks) {
    const color = m.hard ? "#b00020" : "#8a1a9b";
    const x0 = Math.max(0, m.x - 3);
    const y0 = Math.max(0, m.y - 3);
    const box = document.createElement("div");
    set(box, {
      position: "absolute", left: `${x0}px`, top: `${y0}px`, width: `${Math.max(4, Math.min(W, m.x + m.w + 3) - x0)}px`, height: `${Math.max(4, Math.min(H, m.y + m.h + 3) - y0)}px`,
      "box-sizing": "border-box", border: `2px solid ${color}`, "box-shadow": "inset 0 0 0 1px #fff", "border-radius": "3px",
    });
    const badge = document.createElement("div");
    badge.textContent = String(m.n);
    const bw = 10 + 8 * String(m.n).length;
    // Số nằm trên khung; sát mép trên thì nằm trong. Hai số trùng chỗ thì dời sang phải.
    const by = y0 >= 18 ? y0 - 18 : y0;
    let bx = Math.min(x0, Math.max(0, W - bw));
    while (badges.some((b) => Math.abs(b.y - by) < 18 && Math.abs(b.x - bx) < bw) && bx + 2 * bw <= W) bx += bw;
    badges.push({ x: bx, y: by });
    set(badge, {
      position: "absolute", left: `${bx}px`, top: `${by}px`, width: `${bw}px`, height: "18px", font: "700 12px/18px system-ui, sans-serif", color: "#fff", background: color,
      "text-align": "center", "border-radius": "3px", "box-sizing": "border-box",
    });
    root.append(box, badge);
  }
  w.__dkMarks = host;
  de.append(host);
  try {
    host.setAttribute("popover", "manual");
    host.showPopover();
  } catch {
    /* trình duyệt không có popover: vẫn vẽ bằng z-index, chỉ kém hộp thoại đang mở */
  }
  return marks.length;
}

/** Gỡ lớp phủ của drawMarks. */
export function clearMarks(): void {
  const w = window as unknown as { __dkMarks?: HTMLElement };
  w.__dkMarks?.remove();
  delete w.__dkMarks;
}
