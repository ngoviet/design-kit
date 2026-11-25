/* global self, fetch, Response, setTimeout */
// Service worker cài lâu (10 giây) rồi mới trả lời báo lúc mất mạng: lúc chưa cài xong thì chưa đo được gì.
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(new Promise((ok) => setTimeout(ok, 10_000)));
});
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response("<!doctype html><h1>Đang ngoại tuyến</h1>", { headers: { "content-type": "text/html; charset=utf-8" } })));
});
