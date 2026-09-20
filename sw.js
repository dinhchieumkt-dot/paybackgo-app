/* Bộ nhớ đệm file tĩnh của PaybackGo. KHÔNG bao giờ can thiệp API (khác nguồn) hay request không phải GET. */
const CACHE = 'pbg-static-v1';
const MAX_ASSETS = 80;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  const assets = keys.filter((r) => new URL(r.url).pathname.startsWith('/assets/'));
  for (const r of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) await cache.delete(r);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // File có mã băm trong tên (assets), font, icon: dùng thẳng từ bộ nhớ, chỉ tải khi chưa có.
  if (/^\/(assets|fonts|icons)\//.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { cache.put(req, res.clone()).then(() => trim(cache)); }
      return res;
    })());
    return;
  }

  // Trang HTML: hiện ngay bản đã lưu, đồng thời cập nhật ngầm cho lần sau.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      return (await network) || Response.error();
    })());
  }
});
