// Kiểm tương phản mọi cặp màu theo vai trò (WCAG 2), ở cả sáng lẫn tối, kèm gamut sRGB.
// Dùng: node scripts/kiem-cap-mau.mjs                      → kiểm tokens/dem.css, giay.css, dam.css
//       node scripts/kiem-cap-mau.mjs <tệp.css> <hướng>    → kiểm một tệp (ví dụ bản đã đổi màu nhấn)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blocks, checkPairs } from "./mau-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targets = process.argv[2]
  ? [[process.argv[2], process.argv[3] ?? "dem"]]
  : ["dem", "giay", "dam"].map((h) => [join(root, "tokens", `${h}.css`), h]);

let fails = 0, total = 0;
const rows = [];
for (const [file, huong] of targets) {
  const r = checkPairs(blocks(readFileSync(file, "utf8"), huong));
  total += r.total;
  fails += r.fails.length;
  for (const f of r.fails) rows.push(`${huong},${f.mode},${f.pair},${f.wcag}`);
}
console.log(`status: "${fails ? `${fails} cặp trượt` : "đạt"} / ${total} cặp"`);
if (rows.length) console.log(`fails[${rows.length}]{huong,mode,pair,wcag}:\n  ` + rows.join("\n  "));
process.exitCode = fails ? 1 : 0;
