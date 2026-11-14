/* Online-first. Only fixed public assets enter this cache. */
const CACHE = 'inkwell-static-v1';
const PUBLIC = ['/offline.html', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('inkwell-static-') && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET' && event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        return (
          (await caches.match('/offline.html')) ??
          new Response('Inkwell needs an internet connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
          })
        );
      }),
    );
  }
  // Never cache HTML, APIs, auth, RSC, recovery drafts or share capabilities.
});
