import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { watchNetwork } from "../src/settle.js";

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe("watchNetwork: wait for the network to go quiet instead of a fixed pause", () => {
  it("returns after the quiet window when nothing is in flight", async () => {
    const net = watchNetwork(new EventEmitter());
    const r = await net.quiet(60, 2000);
    expect(r.capped).toBe(false);
    expect(r.waited).toBeGreaterThanOrEqual(55);
    expect(r.waited).toBeLessThan(400);
  });

  it("waits for a request in flight, then the quiet window", async () => {
    const page = new EventEmitter();
    const net = watchNetwork(page);
    const req = { url: "du-lieu.json" };
    page.emit("request", req);
    expect(net.inflight()).toBe(1);
    setTimeout(() => page.emit("requestfinished", req), 150);
    const r = await net.quiet(60, 2000);
    expect(r.capped).toBe(false);
    expect(r.waited).toBeGreaterThanOrEqual(200);
    expect(net.inflight()).toBe(0);
  });

  it("a request that starts inside the quiet window restarts the window", async () => {
    const page = new EventEmitter();
    const net = watchNetwork(page);
    const second = { url: "chuoi-2.js" };
    setTimeout(() => page.emit("request", second), 40);
    setTimeout(() => page.emit("requestfailed", second), 120);
    const r = await net.quiet(80, 2000);
    expect(r.capped).toBe(false);
    expect(r.waited).toBeGreaterThanOrEqual(195);
  });

  it("gives up at the cap when a request never finishes (a stream, long polling) and says so", async () => {
    const page = new EventEmitter();
    const net = watchNetwork(page);
    page.emit("request", { url: "su-kien" });
    const r = await net.quiet(40, 200);
    expect(r.capped).toBe(true);
    expect(r.waited).toBeGreaterThanOrEqual(195);
    expect(net.inflight()).toBe(1);
    await sleep(0);
  });
});
