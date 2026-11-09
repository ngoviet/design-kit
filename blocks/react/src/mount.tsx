import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

/** Áp ?dk= và ?theme= giống bản HTML, rồi gắn trang. */
export function mount(node: ReactNode) {
  const q = new URLSearchParams(location.search);
  const d = document.documentElement;
  const k = q.get("dk");
  const t = q.get("theme");
  if (k && /^(dem|giay|dam)$/.test(k)) d.dataset.dk = k;
  if (t === "light" || t === "dark") d.dataset.theme = t;
  createRoot(document.getElementById("root")!).render(<StrictMode>{node}</StrictMode>);
}
