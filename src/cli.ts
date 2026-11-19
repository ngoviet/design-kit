import { runAxiCli, type AxiCliCommand } from "axi-sdk-js";
import { homeView } from "./commands/home.js";
import { COMMANDS, DESCRIPTION, topLevelHelp } from "./registry.js";
import { defaultRuntime, type Runtime } from "./runtime.js";
import { VERSION } from "./version.js";

export interface MainOptions {
  argv?: string[];
  stdout?: { write: (chunk: string) => unknown };
  runtime?: Runtime;
}

/** Mảng help rỗng thì bỏ hẳn (TOON in "help: []" là token thừa). */
function dropEmptyHelp(out: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(out["help"]) && out["help"].length === 0) {
    const { help: _help, ...rest } = out;
    void _help;
    return rest;
  }
  return out;
}

/** Giá trị của `--fields a,b` (hay `--fields=a,b`) trong đối số, nếu có. */
export function fieldsArg(args: string[]): string[] | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const v = a === "--fields" ? args[i + 1] : a.startsWith("--fields=") ? a.slice(9) : undefined;
    if (v !== undefined) return v.split(",").map((f) => f.trim()).filter(Boolean);
  }
  return undefined;
}

/**
 * `--fields`: mọi bảng (mảng đối tượng) trong kết quả chỉ giữ các cột được nêu. Bảng không có cột nào trong danh sách
 * thì giữ nguyên (không biến bảng thành các dòng rỗng). Trước 19/11/2026 cờ được nhận mà không lệnh nào dùng.
 */
export function projectFields(out: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const keep = new Set(fields);
  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(out)) {
    const rows = Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x)) ? (v as Array<Record<string, unknown>>) : undefined;
    if (rows && rows.some((row) => Object.keys(row).some((c) => keep.has(c)))) {
      res[k] = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([c]) => keep.has(c))));
    } else res[k] = v;
  }
  return res;
}

export async function main(options: MainOptions = {}): Promise<void> {
  const rt = options.runtime ?? defaultRuntime();
  const commands: Record<string, AxiCliCommand<undefined>> = {
    home: async (args) => ({ description: DESCRIPTION, ...(await homeView(args, rt)) }),
  };
  for (const [name, spec] of Object.entries(COMMANDS)) {
    if (spec.run) {
      commands[name] = async (args) => {
        const out = dropEmptyHelp(await spec.run!(args, rt));
        const fields = fieldsArg(args);
        return fields?.length ? projectFields(out, fields) : out;
      };
    }
  }
  await runAxiCli({
    description: DESCRIPTION,
    version: VERSION,
    ...(options.argv ? { argv: options.argv } : {}),
    ...(options.stdout ? { stdout: options.stdout } : {}),
    topLevelHelp: topLevelHelp(),
    getCommandHelp: (command) => COMMANDS[command]?.help,
    home: async () => ({ description: DESCRIPTION, ...(await homeView([], rt)) }),
    commands,
  });
}
