// Mã TypeScript mà check-mod chép vào bản sao tạm của mod.
//
// Lớp chặn thay cho `claude-code/testing` trong các tệp test của mod: giữ nguyên test/expect/mock/describe/tier,
// nhưng bọc `$.ui.mount`. Mỗi lần test mount một component, lớp chặn mount thêm chính component đó trên từng surface
// và bề rộng cần quét, in `ui.drawn()` thành một dòng `DKTREE {...}`, gỡ ra, rồi mới mount lần gốc cho test.
// `$` của bộ test bị đóng băng (thuộc tính không ghi, không cấu hình được): Proxy bọc thẳng `$` sẽ ném
// "Proxy handler's 'get' result of a non-configurable and non-writable property", nên bọc một đối tượng rỗng
// rồi chuyển tiếp từng thuộc tính sang `$` thật.

export interface ShimConfig {
  /** Nhãn lượt chạy in kèm mỗi dòng: `default` hoặc giá trị language. */
  run: string;
  /** Giá trị `language` ép vào tuỳ chọn của mọi test; null: giữ tuỳ chọn của test. */
  language: string | null;
  /** expect không ném lỗi: lượt ngôn ngữ khác so chữ tiếng Anh sẽ trượt mà vẫn phải đi tiếp để mount. */
  soft: boolean;
  widths: number[];
  surfaces: string[];
}

export const SHIM_FILE = "__dk_shim.ts";
export const GENERIC_FILE = "__dk_generic.test.tsx";
export const LINE_TAG = "DKTREE ";
/** key của hộp rỗng đứng thay phần engine vẽ trong test chung. */
export const ENGINE_KEY = "dk-engine";

export function shimSource(cfg: ShimConfig): string {
  return `// Sinh bởi design-kit check-mod. Không sửa: mỗi lần chạy viết lại.
import * as T from 'claude-code/testing'

const CFG = ${JSON.stringify(cfg)}
let scene = 0
const emit = (o: Record<string, unknown>) => {
  try {
    console.log(${JSON.stringify(LINE_TAG)} + JSON.stringify(o))
  } catch (e) {
    console.log(${JSON.stringify(LINE_TAG)} + JSON.stringify({ ...o, tree: undefined, error: 'tree not serializable: ' + String(e) }))
  }
}
const message = (e: unknown) => String((e as { message?: unknown })?.message ?? e).split('\\n').slice(0, 3).join(' | ')

export const describe = T.describe
export const mock = T.mock
export const tier = T.tier

const softMatchers = (m: any): any =>
  new Proxy({}, {
    get(_t, k) {
      const v = Reflect.get(m, k)
      if (typeof v === 'function') {
        return (...a: unknown[]) => {
          try {
            const r = v.apply(m, a)
            return r && typeof r.then === 'function' ? r.catch(() => undefined) : r
          } catch {
            return undefined
          }
        }
      }
      return v && typeof v === 'object' ? softMatchers(v) : v
    },
  })
const softExpect: any = new Proxy(() => undefined, {
  apply: (_t, _self, args: unknown[]) => softMatchers((T.expect as any)(...args)),
  get: (_t, k) => Reflect.get(T.expect as object, k),
})
export const expect: typeof T.expect = CFG.soft ? softExpect : T.expect

async function sweep(ui: any, target: any, test: string, generic: boolean) {
  const id = ++scene
  const base = { run: CFG.run, test, scene: id, component: target.component, requestId: target.requestId, generic }
  for (const surface of CFG.surfaces) {
    for (const columns of CFG.widths) {
      const props = { ...(target.props ?? {}) }
      if ('bodyColumns' in props) props.bodyColumns = columns
      const viewport = { columns, rows: 40, isFullscreen: target.viewport?.isFullscreen ?? true }
      const one = { ...base, surface, columns, maxRows: typeof props.maxRows === 'number' ? props.maxRows : undefined }
      let m: any
      try {
        m = await ui.mount({ ...target, surface, props, viewport })
        emit({ ...one, tree: await m.drawn() })
      } catch (e) {
        emit({ ...one, error: message(e) })
      }
      try {
        await m?.unmount()
      } catch {}
    }
  }
}

function wrapEngine($: any, test: string, generic: boolean) {
  const ui = $.ui
  const pass = (t: any, k: PropertyKey) => {
    const v = Reflect.get(t, k)
    return typeof v === 'function' ? v.bind(t) : v
  }
  const mount = async (target: any) => {
    await sweep(ui, target, test, generic)
    return ui.mount(target)
  }
  const uiProxy = new Proxy({}, { get: (_t, k) => (k === 'mount' ? mount : pass(ui, k)) })
  return new Proxy({}, { get: (_t, k) => (k === 'ui' ? uiProxy : pass($, k)) })
}

export const test = (name: string, ...rest: any[]) => {
  const body = rest.length >= 2 ? rest[1] : rest[0]
  const opts: any = rest.length >= 2 ? { ...rest[0] } : {}
  if (CFG.language !== null) opts.options = { ...(opts.options ?? {}), language: CFG.language }
  opts.timeoutMs = Math.max(opts.timeoutMs ?? 5000, 120_000)
  const generic = name.startsWith('design-kit generic:')
  T.test(name, opts, ($: any, on: any) => body(wrapEngine($, name, generic), on))
}
`;
}

/** Props mặc định cho cảnh chung: mount mà không dựng trạng thái nào (thường là màn trống của mod). */
export const DEFAULT_PROPS: Record<string, Record<string, unknown>> = {
  AbovePrompt: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 4, bodyColumns: 120, scroll: { offset: 0, bodyRows: 4 }, view: {} },
  Pane: { title: "", isFocused: false, bodyColumns: 80, placement: "dock", scroll: { offset: 0, bodyRows: 30 }, view: {} },
  ToolUse: { tool_use_id: "dk-generic", tool: "Bash", input: {}, isRunning: false, isErrored: false, isInterrupted: false },
};

export interface GenericTarget {
  component: string;
  requestId?: string;
}

/** Test chung: mỗi component mod hook, mount một lần với props mặc định (lớp chặn lo phần quét). */
export function genericSource(plugin: string, targets: GenericTarget[], shimImport: string): string {
  const list = targets
    .filter((t) => DEFAULT_PROPS[t.component])
    .map((t) => ({ plugin, surface: "terminal", component: t.component, ...(t.requestId ? { requestId: t.requestId } : {}), props: DEFAULT_PROPS[t.component] }));
  return `// Sinh bởi design-kit check-mod: cảnh chung, mỗi component mod hook mount một lần, không dựng trạng thái.
import { test } from '${shimImport}'

const TARGETS: any[] = ${JSON.stringify(list)}
for (const t of TARGETS) {
  test('design-kit generic: ' + t.component, async ($: any, on: any) => {
    // Phần engine tự vẽ (next(e) của mod): một hộp rỗng có key ${JSON.stringify(ENGINE_KEY)}, check-mod bỏ qua khi đo.
    on('ui.render', ($$: any, e: any) => {
      const { Box } = $$.ui.resolve(e)
      return <Box key=${JSON.stringify(ENGINE_KEY)} />
    })
    const ui = await $.ui.mount(t)
    await ui.unmount()
  })
}
`;
}

/** Đổi `import … from 'claude-code/testing'` (import giá trị, không phải `import type`) sang lớp chặn. */
export function rewriteTestImports(source: string, shimImport: string): { source: string; changed: number } {
  let changed = 0;
  const out = source.replace(/^(\s*import\s+)(?!type\b)([^;]*?)\s+from\s+(['"])claude-code\/testing\3/gm, (_m, pre: string, what: string) => {
    changed++;
    return `${pre}${what} from '${shimImport}'`;
  });
  return { source: out, changed };
}
