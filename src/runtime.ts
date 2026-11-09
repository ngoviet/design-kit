import { homedir } from "node:os";

/** Môi trường chạy (test thay bằng bản giả). */
export interface Runtime {
  env: Record<string, string | undefined>;
  home: string;
  cwd: string;
}

export function defaultRuntime(): Runtime {
  return { env: process.env, home: homedir(), cwd: process.cwd() };
}
