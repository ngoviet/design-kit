// Hành vi (JS) của khối mẫu, trong trình duyệt thật. Bố cục, màu, chữ do cổng đo; ở đây là thao tác mà cổng không bấm tới.
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser, startServer } from "../src/browser.js";

const root = join(__dirname, "..");
let browser: Browser;
let server: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => {
  ({ browser } = await launchBrowser(process.env));
  server = await startServer(root);
});
afterAll(async () => {
  await browser.close();
  server.server.close();
});

const open = async (path: string, fn: (page: Page) => Promise<void>, clock = false): Promise<void> => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  try {
    if (clock) await page.clock.install();
    await page.goto(`${server.origin}/blocks/html/${path}`);
    if (clock) await page.clock.pauseAt(new Date(Date.now() + 3_600_000));
    await fn(page);
    expect(errs).toEqual([]);
  } finally {
    await page.close();
  }
};

// CI chạy npm ci ở blocks/react trước bước test; máy chưa cài thì bỏ qua.
describe.skipIf(!existsSync(join(root, "blocks", "react", "node_modules", "vite")) && !process.env["CI"])("react: the dark: variant", () => {
  it("applies when forced dark and when the machine is dark, not when forced light on a dark machine", async () => {
    // Biên dịch index.css thật bằng Vite và Tailwind của blocks/react, kết quả để trong bộ nhớ (không đụng dist). Lớp thử nêu
    // thẳng bằng @source inline, không phụ thuộc khối nào đang dùng dark:.
    const react = join(root, "blocks", "react");
    const load = async (id: string): Promise<Record<string, unknown>> => (await import(pathToFileURL(createRequire(join(react, "package.json")).resolve(id)).href)) as Record<string, unknown>;
    const build = (await load("vite"))["build"] as (o: unknown) => Promise<{ output: Array<{ fileName: string; source?: string }> }>;
    const tailwind = (await load("@tailwindcss/vite"))["default"] as () => unknown;
    const tmp = mkdtempSync(join(tmpdir(), "dk-react-"));
    writeFileSync(join(tmp, "thu.css"), `@import "${join(react, "src", "index.css").replace(/\\/g, "/")}";\n@source inline("dark:line-through");\n`);
    const out = await build({ root: tmp, configFile: false, logLevel: "silent", plugins: [tailwind()], build: { write: false, rollupOptions: { input: join(tmp, "thu.css") } } });
    const css = out.output.filter((f) => f.fileName.endsWith(".css")).map((f) => String(f.source)).join("\n");
    expect(css).toContain("line-through");
    const page = await browser.newPage();
    try {
      const at = async (machine: "light" | "dark", theme?: string): Promise<boolean> => {
        await page.emulateMedia({ colorScheme: machine });
        await page.setContent(`<!doctype html><html${theme ? ` data-theme="${theme}"` : ""}><head><style>${css}</style></head><body><p class="dark:line-through">chữ</p></body></html>`);
        return page.evaluate(() => getComputedStyle(document.querySelector("p")!).textDecorationLine === "line-through");
      };
      expect({
        "máy sáng": await at("light"), "máy tối": await at("dark"),
        "máy sáng, ép tối": await at("light", "dark"), "máy tối, ép tối": await at("dark", "dark"),
        "máy sáng, ép sáng": await at("light", "light"), "máy tối, ép sáng": await at("dark", "light"),
      }).toEqual({ "máy sáng": false, "máy tối": true, "máy sáng, ép tối": true, "máy tối, ép tối": true, "máy sáng, ép sáng": false, "máy tối, ép sáng": false });
    } finally {
      await page.close();
    }
  });
});

describe("trinh-tu: the step links", () => {
  const at = (page: Page) =>
    page.evaluate(() => ({
      chu: document.getElementById("buoc-chu")!.textContent,
      buoc: [...document.querySelectorAll<HTMLElement>("[data-step]")].filter((s) => !s.hidden).map((s) => Number(s.dataset["step"])),
      focus: document.activeElement?.id ?? "",
      loi: [...document.querySelectorAll<HTMLElement>(".error-text")].filter((e) => !e.hidden).map((e) => e.id),
    }));
  const spoil = async (page: Page) => {
    await page.click('.steps a[data-to="2"]');
    await page.fill("#ten", "");
    await page.fill("#sdt", "abc");
  };

  it("a link forward stops at the step that is not valid, shows its errors and focuses the first one", async () => {
    await open("trinh-tu.html?buoc=4", async (page) => {
      await spoil(page);
      for (const to of ["3", "4"]) {
        await page.click(`.steps a[data-to="${to}"]`);
        expect({ to, ...(await at(page)) }).toEqual({ to, chu: "Bước 2/4", buoc: [2], focus: "ten", loi: ["ten-loi", "sdt-loi"] });
      }
      // Sửa xong thì đi tiếp được, và gửi được.
      await page.fill("#ten", "Nguyễn Thu Hà");
      await page.fill("#sdt", "0912 345 678");
      await page.click('.steps a[data-to="4"]');
      expect(await at(page)).toMatchObject({ chu: "Bước 4/4", buoc: [4] });
      await page.click("#tiep");
      expect(await at(page)).toMatchObject({ chu: "Hoàn tất", buoc: [5] });
    });
  });
  it("the same from an earlier step: going back is free, jumping over the bad step is not", async () => {
    await open("trinh-tu.html?buoc=4", async (page) => {
      await spoil(page);
      await page.click('.steps a[data-to="1"]');
      expect(await at(page)).toMatchObject({ chu: "Bước 1/4", buoc: [1] });
      await page.click('.steps a[data-to="4"]');
      expect(await at(page)).toEqual({ chu: "Bước 2/4", buoc: [2], focus: "ten", loi: ["ten-loi", "sdt-loi"] });
    });
  });
  it("a link marked aria-disabled does nothing on Enter: after sending, and before a step is reached", async () => {
    await open("trinh-tu.html?buoc=5", async (page) => {
      await page.focus('.steps a[data-to="1"]');
      await page.keyboard.press("Enter");
      expect(await at(page)).toMatchObject({ chu: "Hoàn tất", buoc: [5] });
      expect(new URL(page.url()).hash).toBe("");
    });
    await open("trinh-tu.html", async (page) => {
      await page.focus('.steps a[data-to="3"]');
      await page.keyboard.press("Enter");
      expect(await at(page)).toMatchObject({ chu: "Bước 1/4", buoc: [1] });
    });
  });
  it("Edit on the review step still goes back to the step it names", async () => {
    await open("trinh-tu.html?buoc=4", async (page) => {
      await page.click('#xem-lai button[data-to="3"]');
      expect(await at(page)).toMatchObject({ chu: "Bước 3/4", buoc: [3] });
    });
  });
});

describe("thong-bao: a toast waits while the pointer or the keyboard focus is on it", () => {
  // Đồng hồ giả: 6 giây của thông báo chạy theo lệnh, không chờ thật.
  const toast = async (fn: (page: Page, left: () => Promise<number>) => Promise<void>) =>
    open("thong-bao.html", async (page) => {
      await page.click("[data-kind=undo]");
      await page.mouse.move(5, 5);
      await fn(page, () => page.locator(".toast").count());
    }, true);

  it("closes 6 seconds after it appears when nothing is on it", async () => {
    await toast(async (page, left) => {
      await page.clock.runFor(5_900);
      expect(await left()).toBe(1);
      await page.clock.runFor(200);
      expect(await left()).toBe(0);
    });
  });
  it("the pointer leaving does not restart the clock while focus is still inside", async () => {
    await toast(async (page, left) => {
      await page.hover(".toast");
      await page.clock.runFor(3_000);
      await page.focus(".toast .x");
      await page.mouse.move(5, 5);
      await page.clock.runFor(60_000);
      expect(await left()).toBe(1);
      expect(await page.evaluate(() => !!document.activeElement?.closest(".toast"))).toBe(true);
    });
  });
  it("focus leaving does not restart the clock while the pointer is still on it", async () => {
    await toast(async (page, left) => {
      await page.focus(".toast .x");
      await page.hover(".toast");
      await page.focus("[data-kind=ok]");
      await page.clock.runFor(60_000);
      expect(await left()).toBe(1);
    });
  });
  it("Tab from one button of the toast to the other keeps it open", async () => {
    await toast(async (page, left) => {
      await page.focus(".toast .tools .btn");
      await page.keyboard.press("Tab");
      await page.clock.runFor(60_000);
      expect(await left()).toBe(1);
    });
  });
  it.each(["pointer", "focus", "both"])("once the %s has left, it closes after the time that was left, counted once", async (how) => {
    await toast(async (page, left) => {
      await page.clock.runFor(2_000);
      if (how !== "focus") await page.hover(".toast");
      await page.clock.runFor(1_500);
      if (how !== "pointer") await page.focus(".toast .x");
      await page.clock.runFor(1_500);
      await page.mouse.move(5, 5);
      await page.focus("[data-kind=ok]");
      // Dừng ở giây thứ 2 (chuột, cả hai) hay 3,5 (chỉ focus): còn 4 hay 2,5 giây.
      const rest = how === "focus" ? 2_500 : 4_000;
      await page.clock.runFor(rest - 100);
      expect(await left()).toBe(1);
      await page.clock.runFor(200);
      expect(await left()).toBe(0);
    });
  });
});
