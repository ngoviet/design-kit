// Tải bản tự host của bốn font (giấy phép SIL OFL 1.1) về tokens/fonts/ và sinh tokens/fonts-local.css.
// Cùng URL với tokens/fonts.css (Google Fonts CSS API), chỉ giữ bộ chữ latin và vietnamese: đủ cho tiếng Việt,
// nhẹ hơn nhiều so với tải mọi bộ chữ. Chạy lại khi đổi font hay độ đậm trong token.
// Dùng: node scripts/tai-font.mjs
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500&display=swap";
const KEEP = new Set(["latin", "vietnamese"]);
// API trả woff2 (và bản biến thiên cho trục opsz) khi user-agent là trình duyệt hiện đại.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const css = await (await fetch(CSS_URL, { headers: { "user-agent": UA } })).text();
const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)].filter((m) => KEEP.has(m[1]));
if (!blocks.length) throw new Error("Google Fonts không trả @font-face nào: kiểm URL hoặc mạng");

const dir = join(root, "tokens", "fonts");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const faces = blocks.map(([, subset, face]) => ({
  subset,
  face,
  family: face.match(/font-family:\s*'([^']+)'/)[1],
  style: face.match(/font-style:\s*(\w+)/)[1],
  weight: Number(face.match(/font-weight:\s*(\d+)/)[1]),
  url: face.match(/url\((https:[^)]+\.woff2)\)/)[1],
}));
// Font biến thiên: nhiều @font-face (mỗi độ đậm một khối) dùng chung một tệp ⇒ đặt tên theo dải độ đậm.
const weightsOf = (url) => faces.filter((f) => f.url === url).map((f) => f.weight);
const files = new Map(); // url → tên tệp
const out = [];
for (const { subset, face, family, style, url } of faces) {
  if (!files.has(url)) {
    const w = weightsOf(url);
    const weight = Math.min(...w) === Math.max(...w) ? `${w[0]}` : `${Math.min(...w)}-${Math.max(...w)}`;
    const name = `${family.toLowerCase().replace(/\s+/g, "-")}-${style}-${weight}-${subset}.woff2`;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    writeFileSync(join(dir, name), buf);
    files.set(url, name);
  }
  out.push(`/* ${subset} */\n${face.replace(url, `fonts/${files.get(url)}`)}`);
}

const header = `/* design-kit · font tự host (thay cho tokens/fonts.css khi không muốn gọi Google Fonts: mạng nội bộ, card Home Assistant,
   trang chạy offline, riêng tư). Sinh bằng: node scripts/tai-font.mjs, không sửa tay.
   Font: Be Vietnam Pro, Literata, Bricolage Grotesque, JetBrains Mono, giấy phép SIL Open Font License 1.1 (tokens/fonts/OFL.txt).
   Chỉ gồm bộ chữ latin và vietnamese. Nạp tệp này ĐẦU TIÊN, như fonts.css. */\n`;
writeFileSync(join(root, "tokens", "fonts-local.css"), header + out.join("\n") + "\n");
writeFileSync(
  join(dir, "OFL.txt"),
  "Be Vietnam Pro, Literata, Bricolage Grotesque và JetBrains Mono được phát hành theo SIL Open Font License, Version 1.1.\n" +
    "Toàn văn giấy phép: https://openfontlicense.org/open-font-license-official-text/\n" +
    "Bản quyền thuộc tác giả của từng font (xem trang của font trên fonts.google.com). Tệp woff2 ở đây là bản tách bộ chữ latin và vietnamese do Google Fonts phục vụ, không chỉnh sửa.\n",
);
const kb = readdirSync(dir).filter((f) => f.endsWith(".woff2")).reduce((s, f) => s + statSync(join(dir, f)).size, 0) / 1024;
console.log(`status: "${files.size} tệp woff2, ${Math.round(kb)} KB, ${out.length} @font-face"\nfile: tokens/fonts-local.css`);
