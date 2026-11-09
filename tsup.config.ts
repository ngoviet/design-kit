import { defineConfig } from "tsup";

export default defineConfig({
  // "bin/design-kit" ⇒ dist/bin/design-kit.js (khớp "bin" trong package.json).
  entry: { "bin/design-kit": "src/bin.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  splitting: true,
  clean: true,
  sourcemap: false,
  dts: false,
  // playwright-core và axe-core giữ ngoài bundle (đọc tệp của chính gói lúc chạy).
  external: ["playwright-core", "axe-core"],
});
