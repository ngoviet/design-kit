import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./": bản build mở được bằng design-kit check dist/<trang>.html (đường dẫn tương đối).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  build: {
    rollupOptions: {
      input: {
        "form-dang-nhap": path.resolve(import.meta.dirname, "form-dang-nhap.html"),
        "trang-thai": path.resolve(import.meta.dirname, "trang-thai.html"),
      },
    },
  },
});
