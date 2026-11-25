// Hồi quy của lệnh inline (soát 25/11/2026): mỗi ca dựng một thư mục tạm, chạy lệnh thật, đọc lại trang đã ghi.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../src/cli.js";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function site(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "dk-inline-"));
  made.push(d);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(d, name)), { recursive: true });
    writeFileSync(join(d, name), body);
  }
  return d;
}
async function inline(cwd: string, ...args: string[]): Promise<{ out: string; code: number | undefined }> {
  let out = "";
  const prev = process.exitCode;
  process.exitCode = undefined;
  await main({ argv: ["inline", ...args], stdout: { write: (c: string) => (out += c) }, runtime: { env: process.env, home: "", cwd } });
  const code = process.exitCode as number | undefined;
  process.exitCode = prev;
  return { out, code };
}
const page = (head: string): string => "<!doctype html><html lang=\"vi\"><head><title>t</title>" + head + "</head><body><p>Đoạn</p></body></html>";
const read = (d: string, f: string): string => readFileSync(join(d, f), "utf8");
/** Các luật trong khối <style> thứ n, bỏ chú thích. */
const styleBody = (html: string, n = 0): string => [...html.matchAll(/<style\b(?:"[^"]*"|[^>"])*>([\s\S]*?)<\/style>/g)][n]![1]!.replace(/\/\*[\s\S]*?\*\//g, "").trim();

describe("inline: tags", () => {
  it("reads a quoted > inside an attribute as part of the tag, and keeps the media condition", async () => {
    const d = site({ "page.html": page('<link rel="stylesheet" href="a.css" media="(width >= 600px)"><link rel="stylesheet" href="b.css" media="(width &gt;= 700px)">'), "a.css": "p{color:red}", "b.css": "p{color:blue}" });
    await inline(d, "page.html", "--ra", "out.html");
    const html = read(d, "out.html");
    expect(html).toContain('<style data-dk-inline="a.css" media="(width >= 600px)">\np{color:red}\n</style><style');
    expect(html).toContain('media="(width &gt;= 700px)">\np{color:blue}');
  });
  it("the same for the page's own <style media>", async () => {
    const d = site({ "page.html": page('<style media="(width >= 600px)">@import "a.css";</style>'), "a.css": "p{color:red}" });
    await inline(d, "page.html");
    expect(read(d, "page.html")).toContain('<style media="(width >= 600px)">\n/* ---- @import a.css ---- */\np{color:red}');
  });
  it("leaves a <link> inside a script string alone", async () => {
    const js = "<script>var s = '<link rel=\"stylesheet\" href=\"a.css\">';</script>";
    const d = site({ "page.html": page('<link rel="stylesheet" href="a.css">' + js), "a.css": "p{color:red}" });
    await inline(d, "page.html", "--ra", "out.html");
    expect(read(d, "out.html")).toContain(js);
    expect(read(d, "out.html").split("p{color:red}")).toHaveLength(2);
  });
  it("leaves an alternate stylesheet as a link (it is off until the reader picks it), rebased for --ra", async () => {
    const link = '<link rel="alternate stylesheet" title="Tối" href="dark.css">';
    const d = site({ "page.html": page('<link rel="stylesheet" href="a.css">' + link), "a.css": "p{color:red}", "dark.css": "body{background:#000}" });
    await inline(d, "page.html", "--ra", "out.html");
    expect(read(d, "out.html")).toContain(link);
    expect(read(d, "out.html")).not.toContain("#000");
    await inline(d, "page.html", "--ra", "sub/out.html");
    expect(read(d, "sub/out.html")).toContain('href="../dark.css"');
  });
  it("a href that is not valid percent-encoding is read as it is", async () => {
    const d = site({ "page.html": page('<link rel="stylesheet" href="100%.css"><link rel="stylesheet" href="a%20b.css">'), "100%.css": "p{color:red}", "a b.css": "p{color:blue}" });
    const { out, code } = await inline(d, "page.html");
    expect(code).toBeUndefined();
    expect(out).toContain("inlined 2 stylesheets");
    expect(read(d, "page.html")).toContain("p{color:red}");
  });
});

describe("inline: @import", () => {
  it("leaves a commented-out @import inside its comment", async () => {
    const d = site({
      "page.html": page('<link rel="stylesheet" href="main.css"><style>/* @import "old.css"; */ i{color:red}</style>'),
      "main.css": '/* @import "old.css"; */\np{color:red}\n/* @import "gone.css"; */\nb{content:"/*"}h1{background:url(x.png)}/* hết */',
      "old.css": "p{background:yellow}",
      "sub/co-san.txt": "",
    });
    const { out } = await inline(d, "page.html", "--ra", "sub/out.html");
    const html = read(d, "sub/out.html");
    expect(html).not.toContain("yellow");
    expect(html).toContain('/* @import "old.css"; */\np{color:red}\n/* @import "gone.css"; */');
    // Dấu "/*" trong chuỗi không mở chú thích: url() phía sau vẫn được viết lại.
    expect(html).toContain('url("../x.png")');
    expect(out).not.toContain("left as is");
    expect(out).toContain("inlined 1 stylesheet");
  });
  it("a comment between @import and its semicolon is not a condition", async () => {
    const d = site({ "page.html": page('<link rel="stylesheet" href="main.css">'), "main.css": '@import "a.css" /* nền; màu */;\nb{color:blue}', "a.css": "p{color:red}" });
    const { out } = await inline(d, "page.html");
    expect(styleBody(read(d, "page.html"))).toBe("p{color:red}\n\nb{color:blue}");
    expect(out).not.toContain("left as is");
  });
  it("moves an absolute @import of a nested file before every rule, and keeps it in its own <style>", async () => {
    const d = site({
      "page.html": page('<link rel="stylesheet" href="main.css"><link rel="stylesheet" href="two.css">'),
      "main.css": '@import "a.css"; @import "b.css";',
      "a.css": "p{color:red}",
      "b.css": '@import url("https://fonts.googleapis.com/css2?family=Lora:wght@400;700");\nh1{font-family:Lora,serif}',
      "two.css": "i{color:blue}",
    });
    await inline(d, "page.html");
    const html = read(d, "page.html");
    expect(styleBody(html)).toMatch(/^@import url\("https:\/\/fonts\.googleapis\.com\/css2\?family=Lora:wght@400;700"\);\s+p\{color:red\}\s+h1\{/);
    expect(styleBody(html, 1)).toBe("i{color:blue}");
    expect(html.match(/@import url/g)).toHaveLength(1);
  });
  it("counts only the imports it merged; nothing merged means nothing written", async () => {
    for (const css of ['@import "missing.css";', '@import "x.css" screen;']) {
      const d = site({ "page.html": page("<style>p{color:red}</style><style>" + css + "\np{color:red}</style>"), "x.css": "h1{color:blue}" });
      const before = read(d, "page.html");
      const { out } = await inline(d, "page.html");
      expect(out).toContain("nothing to inline");
      expect(out).toContain("left as is");
      expect(out).toContain("nothing written: no change");
      expect(read(d, "page.html")).toBe(before);
    }
  });
  it("merges a page's own @import once and says so", async () => {
    const d = site({ "page.html": page('<style>@import "x.css"; @import "missing.css";</style>'), "x.css": "h1{color:blue}" });
    const { out } = await inline(d, "page.html");
    expect(out).toContain("inlined 1 stylesheet");
    expect(read(d, "page.html")).toContain("h1{color:blue}");
    expect((await inline(d, "page.html")).out).toContain("nothing to inline");
  });
});

describe("inline: --ra", () => {
  it("creates the folder", async () => {
    const d = site({ "page.html": page('<link rel="stylesheet" href="a.css">'), "a.css": "p{color:red}" });
    const { out, code } = await inline(d, "page.html", "--ra", "build/moi/report.html");
    expect(out).not.toContain("UNKNOWN");
    expect(code).toBeUndefined();
    expect(read(d, "build/moi/report.html")).toContain("p{color:red}");
    // Chạy thử không tạo gì.
    await inline(d, "page.html", "--ra", "thu/report.html", "--dry-run");
    expect(existsSync(join(d, "thu"))).toBe(false);
  });
  it("rebases url() once in fresh blocks and again when an inlined page moves to another folder", async () => {
    const d = site({ "page.html": page('<link rel="stylesheet" href="css/a.css"><style>i{background:url(css/i.png)}</style>'), "css/a.css": "body{background:url(img/bg.png)}", "css/img/bg.png": "", "sub/co-san.txt": "" });
    await inline(d, "page.html", "--ra", "sub/fresh.html");
    expect(read(d, "sub/fresh.html")).toContain('url("../css/img/bg.png")');
    await inline(d, "page.html", "--ra", "one.html");
    expect(read(d, "one.html")).toContain('url("css/img/bg.png")');
    await inline(d, "one.html", "--ra", "sub/two.html");
    expect(read(d, "sub/two.html")).toContain('url("../css/img/bg.png")');
    expect(read(d, "sub/two.html")).toContain('url("../css/i.png")');
    expect(read(d, "sub/two.html")).toContain('data-dk-inline="css/a.css"');
  });
});
