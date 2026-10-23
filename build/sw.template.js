// Happy PDF offline support. Generated at build time; do not edit dist/sw.js.
const VERSION = '__VERSION__';
const BASE = '__BASE__';
const PRECACHE = __PRECACHE__;
const CACHE = `happy-pdf-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('happy-pdf-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Only our own files. Nothing else is ever cached or touched.
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === 'navigate') {
    // Pages: fresh when online, the cached app when offline.
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(request, { ignoreSearch: true, ignoreVary: true })) || caches.match(BASE, { ignoreVary: true })),
    );
    return;
  }
  // Files with a content hash never change: cache first, then keep anything new for next time.
  // ignoreVary: servers often send "Vary: Origin", and scripts loaded as modules carry an Origin
  // header that the precache requests did not, so a strict match would miss while offline.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
