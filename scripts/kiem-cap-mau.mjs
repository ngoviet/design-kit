// Kiểm tương phản mọi cặp màu theo vai trò (WCAG 2), ở cả sáng lẫn tối, kèm gamut sRGB.
// Lõi ở doi-mau-lib.mjs; cách gọi chính là `design-kit kiem-mau`.
// Dùng: node scripts/kiem-cap-mau.mjs                      → kiểm tokens/dem.css, giay.css, dam.css
//       node scripts/kiem-cap-mau.mjs <tệp.css> <hướng>    → kiểm một tệp (ví dụ bản đã đổi màu nhấn)
import { kiemMau } from "./doi-mau-lib.mjs";

const r = process.argv[2] ? kiemMau([[process.argv[2], process.argv[3] ?? "dem"]]) : kiemMau();
console.log(`status: "${r.fails.length ? `${r.fails.length} cặp trượt` : "đạt"} / ${r.total} cặp"`);
if (r.fails.length) console.log(`fails[${r.fails.length}]{huong,mode,pair,wcag}:\n  ` + r.fails.map((f) => `${f.huong},${f.mode},${f.pair},${f.wcag}`).join("\n  "));
process.exitCode = r.fails.length ? 1 : 0;
