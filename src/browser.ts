import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import type { Browser } from "playwright-core";
import { fail } from "./errors.js";

/** Kênh trình duyệt có sẵn trên máy: không tải Chromium riêng (Playwright Python từng lệch phiên bản). */
const CHANNELS = ["msedge", "chrome"] as const;

export async function launchBrowser(env: Record<string, string | undefined>): Promise<{ browser: Browser; via: string }> {
  const { chromium } = await import("playwright-core");
  const exe = env["DK_BROWSER"];
  if (exe) {
    if (!existsSync(exe)) fail(`DK_BROWSER does not exist: ${exe}`, "BROWSER_MISSING", ["Unset DK_BROWSER or point it at chrome.exe / msedge.exe"]);
    return { browser: await chromium.launch({ executablePath: exe }), via: exe };
  }
  const errors: string[] = [];
  for (const channel of CHANNELS) {
    try {
      return { browser: await chromium.launch({ channel }), via: channel };
    } catch (e) {
      errors.push(`${channel}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  fail(`no browser found (${errors.join("; ")})`, "BROWSER_MISSING", [
    "Install Microsoft Edge or Google Chrome, or set DK_BROWSER to a Chromium executable",
  ]);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ico": "image/x-icon",
};

/** Gốc phục vụ tệp cục bộ: thư mục cha gần nhất có .git / package.json, để `../../tokens/x.css` vẫn tải được. */
export function serveRoot(file: string): string {
  let dir = dirname(resolve(file));
  for (;;) {
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, "package.json"))) return dir;
    const up = dirname(dir);
    if (up === dir) return dirname(resolve(file));
    dir = up;
  }
}

/** Máy chủ tĩnh tối giản trên 127.0.0.1 (cổng ngẫu nhiên): URL http thật cho cả trình duyệt lẫn Impeccable. */
export async function startServer(root: string): Promise<{ server: Server; origin: string }> {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
      let full = resolve(root, `.${path}`);
      if (full !== root && !full.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      if ((await stat(full)).isDirectory()) full = join(full, "index.html");
      const body = await readFile(full);
      res.writeHead(200, { "content-type": TYPES[extname(full).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { server, origin: `http://127.0.0.1:${port}` };
}

export function urlFor(origin: string, root: string, file: string): string {
  return `${origin}/${relative(root, resolve(file)).split(sep).map(encodeURIComponent).join("/")}`;
}
