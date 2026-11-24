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
// Nguồn mã N… của bộ quy tắc mở rộng (24/11/2026): bảng ở mục 6 của tệp trong kho. Chỉ xuất mã mà docs/tieu-chi.md dẫn; dẫn một
// nguồn chưa đọc thật ("từ trí nhớ") là lỗi, vì bảng tiêu chí chỉ nhận nguồn đã đối chiếu câu trích.
const EXT = join(dir, "tai-lieu", "bo-quy-tac-mo-rong-2026-11-24.md");
let nN = 0;
if (existsSync(EXT)) {
  const ext = readFileSync(EXT, "utf8").replace(/\r\n/g, "\n");
  const prefix = { W: "https://raw.githubusercontent.com/w3c/wcag/main/understanding", A: "https://developer.apple.com/tutorials/data/design/human-interface-guidelines", M: "https://developer.mozilla.org/en-US/docs/Web" };
  const rows = new Map();
  for (const m of ext.matchAll(/^\| (N\d+) \| (.*?) \| (.*) \| ([^|]*) \|$/gm)) rows.set(m[1], { name: m[2], quote: m[3], status: m[4].trim() });
  const cited = [...new Set(readFileSync(join(root, "docs", "tieu-chi.md"), "utf8").match(/\bN\d+\b/g) ?? [])].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));
  const bad = cited.filter((c) => !/^đã (đọc|có)/.test(rows.get(c)?.status ?? ""));
  if (bad.length) {
    console.error(`error: "docs/tieu-chi.md dẫn nguồn chưa đọc thật: ${bad.join(", ")}"\ncode: VALIDATION_ERROR`);
    process.exit(1);
  }
  lines.push("", "## Nguồn mã N (bộ quy tắc mở rộng, 24/11/2026)", "", "Câu trích đã đối chiếu nguyên văn với trang gốc khi tải lại ngày 24/11/2026. Trang WCAG \"Understanding\" là bản gốc trên GitHub của W3C.", "", "| Mã | Nguồn | Câu trích |", "| --- | --- | --- |");
  for (const c of cited) {
    const { name, quote } = rows.get(c);
    const full = name.replace(/(^|[ ·,])([WAM])\/([\w./-]+)/g, (_, pre, k, path) => `${pre}${prefix[k]}/${path}`).replace(/ \((A|B)\d-\d\d\)/, "");
    lines.push(`| ${c} | ${cell(full.replace(/(https?:\/\/[^\s,]+)/g, "<$1>"))} | ${cell(quote)} |`);
  }
  nN = cited.length;
}
writeFileSync(join(root, "docs", "nguon.md"), lines.join("\n") + "\n");
console.log(`status: "${sources.length} nguồn, ${claims.length} luận điểm, ${nN} nguồn mã N"\nfile: docs/nguon.md`);
