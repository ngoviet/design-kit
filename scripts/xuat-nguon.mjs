// Xuất bằng chứng của bộ tiêu chí (kho tri thức research-hub) thành docs/nguon.md, để repo tự mang nguồn của mình.
// Kho vẫn là bản gốc: sửa ở kho (research-axi kb …), rồi chạy lại script này.
// Dùng: node scripts/xuat-nguon.mjs [thư-mục-kb]   (mặc định $RESEARCH_KB, rồi D:/code/research-hub/kb)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOPIC = "tieu-chuan-va-cach-huong-dan-ai-lam-giao-dien-web-dep-de-dun";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kb = process.argv[2] ?? process.env.RESEARCH_KB ?? "D:/code/research-hub/kb";
const dir = join(kb, TOPIC);
if (!existsSync(join(dir, "claims.jsonl"))) {
  console.error(`error: "không thấy kho: ${dir}"\ncode: VALIDATION_ERROR\nhelp[1]: "Truyền thư mục kb: node scripts/xuat-nguon.mjs <kb>"`);
  process.exit(2);
}
const jsonl = (f) => readFileSync(join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const sources = jsonl("sources.jsonl");
const claims = jsonl("claims.jsonl");
const readme = readFileSync(join(dir, "README.md"), "utf8");
const conclusion = (readme.split(/^## Kết luận\s*$/m)[1] ?? "").split(/^## /m)[0].trim();
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

const lines = [
  "# Nguồn của bộ tiêu chí",
  "",
  `Bản xuất từ kho tri thức (\`research-hub/kb/${TOPIC}\`) ngày ${new Date().toISOString().slice(0, 10)}, bằng \`node scripts/xuat-nguon.mjs\`. **Không sửa tay**: sửa ở kho rồi xuất lại.`,
  "",
  "Mã `s…` là nguồn, `c…` là luận điểm. `docs/tieu-chi.md` trích các mã này. Câu trích đã được kiểm lại bằng `research-axi kb verify` (so với trang gốc).",
  "",
];
if (conclusion) lines.push("## Kết luận của chủ đề", "", conclusion, "");
lines.push("## Luận điểm", "", "| Mã | Luận điểm | Nguồn | Câu trích |", "| --- | --- | --- | --- |");
for (const c of claims) {
  const ev = c.evidence ?? [];
  const src = ev.map((e) => `${e.stance === "refute" ? "bác: " : ""}${e.source}`).join(", ");
  const quotes = ev.filter((e) => e.quote).map((e) => `“${cell(e.quote)}”`).join(" ");
  lines.push(`| ${c.id} | ${cell(c.text)} | ${src} | ${quotes} |`);
}
lines.push("", "## Nguồn", "", "| Mã | Loại | Tiêu đề | Ghi chú |", "| --- | --- | --- | --- |");
for (const s of sources) lines.push(`| ${s.id} | ${s.kind ?? ""} | [${cell(s.title)}](${s.url}) | ${cell(s.note)} |`);
writeFileSync(join(root, "docs", "nguon.md"), lines.join("\n") + "\n");
console.log(`status: "${sources.length} nguồn, ${claims.length} luận điểm"\nfile: docs/nguon.md`);
