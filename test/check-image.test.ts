// check-image từ đầu tới cuối trên test/fixtures/hinh: mỗi hình mẫu cố ý mắc (hoặc tránh) một nhóm lỗi.
// Chạy trình duyệt thật (Edge, Chrome, hoặc Chromium của Playwright trên CI); chỉ so loại phát hiện và mức điểm, không
// so con số chính xác, vì khử răng cưa khác nhau giữa các trình duyệt.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";

const root = join(__dirname, "..");

async function run(argv: string[]): Promise<{ out: string; code: number | undefined }> {
  let out = "";
  const prev = process.exitCode;
  process.exitCode = undefined;
  await main({ argv, stdout: { write: (c: string) => (out += c) }, runtime: { env: process.env, home: "", cwd: root } });
  const code = process.exitCode as number | undefined;
  process.exitCode = prev;
  return { out, code };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Dòng của một ảnh trong bảng images: file,kind,score,grade,hard,soft. */
function row(out: string, file: string): { score: number; grade: string; hard: number; soft: number } {
  const line = out.split("\n").find((l) => l.startsWith(`  test/fixtures/hinh/${file},`) && /,\d+,(good|fair|weak|poor),\d+,\d+$/.test(l));
  if (!line) throw new Error(`no row for ${file} in:\n${out}`);
  const [score, grade, hard, soft] = line.split(",").slice(-4);
  return { score: Number(score), grade: grade!, hard: Number(hard), soft: Number(soft) };
}
const finding = (gate: string, file: string, check: string) => new RegExp(`^ {2}${gate},test/fixtures/hinh/${esc(file)},${check},`, "m");

describe("check-image arguments", () => {
  it("rejects a file that is not an image", async () => {
    const { out, code } = await run(["check-image", "package.json"]);
    expect(out).toContain("not an image this command reads");
    expect(code).toBe(2);
  });
  it("rejects an unknown kind", async () => {
    const { out, code } = await run(["check-image", "test/fixtures/hinh/logo-tot.svg", "--kind", "banner"]);
    expect(out).toContain("--kind");
    expect(code).toBe(2);
  });
});

describe("check-image on the fixtures", () => {
  it("scores each fixture where its faults put it, and finds each fault", async () => {
    const { out, code } = await run(["check-image", "test/fixtures/hinh", "test/fixtures/hinh/icons", "--no-shots", "--full", "--strict"]);
    expect(out).toMatch(/^status: "fail: 2 of 13 images have hard failures"/m);
    expect(code).toBe(1);

    // Logo tốt: hai màu phẳng, nổi trên cả nền sáng lẫn tối, không chi tiết mảnh ở 32 px.
    expect(row(out, "logo-tot.svg").grade).toBe("good");
    // Logo xấu: chữ sống, thiếu viewBox, vòng nét 0,6, chuyển sắc, nhiều màu, hai màu kề nhau cùng độ sáng.
    expect(row(out, "logo-xau.svg").grade).toBe("poor");
    for (const c of ["svg-text", "svg-viewbox", "small-size", "mono", "palette"]) expect(out).toMatch(finding("soft", "logo-xau.svg", c));
    // Logo lưu JPEG: nên là SVG, và JPEG không hợp với hình phẳng.
    expect(out).toMatch(finding("soft", "logo-jpeg.jpg", "vector"));
    expect(out).toMatch(finding("soft", "logo-jpeg.jpg", "format"));
    // SVG có script: cứng, điểm tối đa 49.
    expect(out).toMatch(finding("hard", "bieu-tuong-doc.svg", "svg-unsafe"));
    expect(row(out, "bieu-tuong-doc.svg").score).toBeLessThanOrEqual(49);
    // Icon nét 0,5 px: mất hết ở chính cỡ của nó.
    expect(out).toMatch(finding("hard", "icon-manh.svg", "small-size"));
    // Icon maskable: hình tràn ra ngoài vòng an toàn 40%.
    expect(out).toMatch(finding("soft", "app-maskable.svg", "frame"));
    // Minh hoạ: bản phóng to bị nhoè, bản xuất thẳng thì sắc.
    expect(out).toMatch(finding("soft", "minh-hoa-mo.png", "sharpness"));
    expect(row(out, "minh-hoa-sac.png").grade).toBe("good");
    expect(row(out, "minh-hoa-mo.png").score).toBeLessThan(row(out, "minh-hoa-sac.png").score);

    // Bộ icon (một thư mục): chuông nét 1 px và sao tô đặc lệch khỏi bộ nét 2 px; nét 1 px ở toạ độ nguyên thì nhoè.
    // Mỗi thư mục là một bộ: icons/ (5 icon) và thư mục cha (3 icon lẻ) không trộn vào nhau.
    expect(out).toMatch(/^sets\[2\]\{folder,icons,consistency,median,outliers\}:$/m);
    expect(out).toMatch(/^ {2}test\/fixtures\/hinh\/icons,5,/m);
    // Icon ứng dụng có nền riêng giữ màu thương hiệu: không bị khuyên currentColor.
    expect(out).not.toMatch(finding("soft", "app-maskable.svg", "color"));
    expect(out).toMatch(finding("soft", "icons/chuong.svg", "set"));
    expect(out).toMatch(finding("soft", "icons/chuong.svg", "pixel-grid"));
    expect(out).toMatch(finding("soft", "icons/sao.svg", "set"));
    expect(out).toMatch(finding("soft", "icons/sao.svg", "color"));
    expect(out).toMatch(finding("soft", "icons/sao.svg", "frame"));
    for (const f of ["nha.svg", "tim-kiem.svg", "lich.svg"]) expect(row(out, `icons/${f}`).grade).toBe("good");
    expect(out).not.toMatch(finding("soft", "icons/nha.svg", "set"));
  });

  it("saves a contact sheet per image and one per icon set", async () => {
    const dir = join(root, ".design-kit", "test-shots-images");
    rmSync(dir, { recursive: true, force: true });
    const { out } = await run(["check-image", "test/fixtures/hinh/icons", "--shots", ".design-kit/test-shots-images"]);
    expect(out).toMatch(/^status: "pass: 5 images/m);
    expect(existsSync(join(dir, "test~fixtures~hinh~icons~nha-svg.png"))).toBe(true);
    expect(existsSync(join(dir, "set-test~fixtures~hinh~icons.png"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("--min-score turns a low score into exit 1 without --strict", async () => {
    const { out, code } = await run(["check-image", "test/fixtures/hinh/logo-xau.svg", "--no-shots", "--min-score", "60"]);
    expect(out).toMatch(/^status: "fail: 1 of 1 images score under 60"/m);
    expect(code).toBe(1);
  });
});
