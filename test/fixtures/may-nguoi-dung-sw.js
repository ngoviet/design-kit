/* global self, fetch, Response, URL */
// Service worker của trang mẫu ngoại tuyến. ?kieu= chọn cách trả lời khi mất mạng:
// qua-mang: chỉ chuyển yêu cầu ra mạng (hỏng); trong: trả trang không có chữ (trắng); bao-ngoai-tuyen: trả lời báo;
// dung-muon: trả vỏ rỗng, script dựng nội dung sau 400 ms.
const kieu = new URL(self.location.href).searchParams.get("kieu");
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
const trang = (than) => new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Ngoại tuyến</title></head><body>${than}</body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  if (kieu === "qua-mang") {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => {
      if (kieu === "trong") return trang('<div id="app"></div>');
      if (kieu === "dung-muon") return trang('<div id="app"></div><script>setTimeout(() => { document.getElementById("app").textContent = "Nội dung đã lưu"; }, 400);</script>');
      return trang("<main><h1>Đang ngoại tuyến</h1><p>Mở lại khi có mạng.</p></main>");
    }),
  );
});
