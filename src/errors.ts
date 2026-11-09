import { AxiError } from "axi-sdk-js";

// Mã lỗi của tool. SDK chỉ map VALIDATION_ERROR → exit 2; mọi mã khác → exit 1.
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "BROWSER_MISSING" // không tìm thấy Edge/Chrome cho playwright-core
  | "LOAD_FAILED" // trang không mở được (404, lỗi mạng, timeout)
  | "GATE_FAILED" // --strict và có lỗi cổng cứng
  | "IO_ERROR";

export function fail(message: string, code: ErrorCode, help: string[] = []): never {
  throw new AxiError(message, code, help);
}

export { AxiError };
