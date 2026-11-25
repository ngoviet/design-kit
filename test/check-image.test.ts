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

describe("check-image robustness (rà soát 19/11/2026)", () => {
  it("a very thin SVG with only a viewBox is measured, a folder named like an image is skipped, ../ sheets do not collide", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const d = mkdtempSync(join(tmpdir(), "dk-hinh-"));
    // 2000:1: Chrome cho cỡ tự nhiên 300×0, trước kia thành "cannot draw".
    writeFileSync(join(d, "vach.svg"), "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2000 1'><rect width='1000' height='1' fill='#222'/></svg>");
    mkdirSync(join(d, "thu-muc.svg"));
    const { out } = await run(["check-image", d, "--kind", "illustration", "--no-shots"]);
    expect(out).not.toMatch(/vach\.svg.*(decode|zero size|cannot)/);
    expect(out).toMatch(/vach\.svg\\?"?,illustration,[1-9]\d*/);
    expect(out).not.toContain("thu-muc.svg");
    expect(out).not.toContain("EISDIR");
    const { slugOf } = await import("../src/commands/check-image.js");
    expect(slugOf("../logo.svg")).not.toBe(slugOf("logo.svg"));
    expect(slugOf("../../a/b.png")).toBe("up~up~a~b-png");
  }, 60_000);

  it("sheets of Vietnamese file names do not overwrite each other, composed or decomposed (25/11/2026)", async () => {
    const { slugOf } = await import("../src/commands/check-image.js");
    expect(slugOf("img/một.svg")).toBe("img~một-svg");
    for (const form of ["NFC", "NFD"] as const) expect(slugOf("một.svg".normalize(form))).not.toBe(slugOf("mốt.svg".normalize(form)));
    expect(slugOf("a b_c (1).png")).toBe("a_b_c_1_-png");
  });
});

describe("check-image on odd files (25/11/2026)", () => {
  const svg = (attrs: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
  const tmp = async (files: Record<string, string>) => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const d = mkdtempSync(join(tmpdir(), "dk-hinh-"));
    for (const [f, s] of Object.entries(files)) writeFileSync(join(d, f), s);
    return d;
  };

  it("writes one sheet per Vietnamese-named image", async () => {
    const { readdirSync } = await import("node:fs");
    const body = "<circle cx='50' cy='50' r='40' fill='#0a4d8c'/>";
    const d = await tmp({ "một.svg": svg("viewBox='0 0 100 100'", body), "mốt.svg": svg("viewBox='0 0 100 100'", body) });
    await run(["check-image", d, "--shots", join(d, "to")]);
    expect(readdirSync(join(d, "to"))).toHaveLength(2);
  }, 60_000);

  it("does not call a shape under 50% opacity fully transparent", async () => {
    const d = await tmp({
      "faint-logo.svg": svg("viewBox='0 0 240 80'", "<g opacity='0.4'><rect x='4' y='4' width='72' height='72'/></g>"),
      "clear-logo.svg": svg("viewBox='0 0 240 80'", "<rect width='9' height='9' fill='none'/>"),
    });
    const faint = (await run(["check-image", join(d, "faint-logo.svg"), "--no-shots"])).out;
    expect(faint).toMatch(/hard,empty,.*40% opacity/);
    expect(faint).not.toContain("fully transparent");
    expect((await run(["check-image", join(d, "clear-logo.svg"), "--no-shots"])).out).toMatch(/hard,empty,.*fully transparent/);
  }, 60_000);

  it("measures an icon whose width and height disagree with its viewBox undistorted", async () => {
    const body = "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 3'/>";
    const pen = "fill='none' stroke='currentColor' stroke-width='2'";
    const d = await tmp({
      "clock-icon.svg": svg("width='24' height='24' viewBox='0 0 24 24' " + pen, body),
      "wide-icon.svg": svg("width='48' height='24' viewBox='0 0 24 24' " + pen, body),
      // Chỉ có viewBox: cỡ tự nhiên 300×295,5 bị làm tròn, lệch tỉ lệ một chút nhưng lưới vẫn là 20 của viewBox.
      "round-icon.svg": svg("viewBox='0 0 20 19.7' " + pen, "<circle cx='10' cy='10' r='7'/>"),
    });
    const stroke = async (f: string) => {
      const { out } = await run(["check-image", join(d, f), "--no-shots", "--full"]);
      return { out, px: Number(/stroke or shape thickness ([\d.]+) px/.exec(out)?.[1]) };
    };
    const good = await stroke("clock-icon.svg");
    const wide = await stroke("wide-icon.svg");
    expect(Math.abs(wide.px - good.px)).toBeLessThanOrEqual(0.2);
    expect(wide.out).not.toContain("small-size");
    expect(wide.out).toContain("box is 48×24");
    expect((await stroke("round-icon.svg")).out).toContain("px at 20 px");
  }, 60_000);

  it("the help says icons form a set per folder", async () => {
    const { out } = await run(["check-image", "--help"]);
    expect(out).not.toContain("images in one run with kind icon form a set");
    expect(out).toMatch(/icons in the same folder form a set/i);
  });
});
