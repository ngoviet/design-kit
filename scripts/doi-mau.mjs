// Đổi màu nhấn (và sắc nhuốm trung tính) của một hướng theo thương hiệu, tự giữ tương phản.
// Lõi ở doi-mau-lib.mjs; cách gọi chính là `design-kit doi-mau` (cùng tham số).
//
// Dùng: node scripts/doi-mau.mjs --huong dem --nhan 45 [--trung-tinh 60] [--ra du-an/dem.css]
//   --nhan       sắc màu nhấn 0–360 (đỏ 25, cam 45, hổ phách 70, xanh lá 145, ngọc 180, lam 250, tím 300)
//   --trung-tinh sắc nhuốm của nền và chữ (mặc định giữ nguyên); tông ấm 50–70, tông lạnh 240–260
//   --ra         tệp ghi ra (mặc định in ra màn hình)
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { doiMau, HUONG } from "./doi-mau-lib.mjs";

const { values: a } = parseArgs({ options: { huong: { type: "string" }, nhan: { type: "string" }, "trung-tinh": { type: "string" }, ra: { type: "string" } } });
const H = Number(a.nhan);
const N = a["trung-tinh"] === undefined ? undefined : Number(a["trung-tinh"]);
if (!HUONG.includes(a.huong ?? "") || !(H >= 0 && H <= 360) || (N !== undefined && !(N >= 0 && N <= 360))) {
  console.error('error: "cần --huong dem|giay|dam và --nhan 0–360 (tuỳ chọn --trung-tinh 0–360)"\ncode: VALIDATION_ERROR');
  process.exit(2);
}
const r = doiMau({ huong: a.huong, nhan: H, ...(N !== undefined ? { trungTinh: N } : {}) });
if (a.ra) writeFileSync(a.ra, r.css); else process.stdout.write(r.css);
const summary = [
  `status: "${r.check.fails.length ? `${r.check.fails.length} cặp trượt` : "đạt"} / ${r.check.total} cặp"`,
  `accent: "sáng ${r.accent.light}, tối ${r.accent.dark}"`,
  ...(r.check.fails.length ? [`fails[${r.check.fails.length}]{mode,pair,wcag}:`, ...r.check.fails.map((f) => `  ${f.mode},${f.pair},${f.wcag}`)] : []),
  ...(a.ra ? [`help[1]: "Link ${a.ra} thay cho tokens/${a.huong}.css, rồi chạy design-kit check"`] : []),
];
console.error(summary.join("\n"));
process.exitCode = r.check.fails.length ? 1 : 0;
