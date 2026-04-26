export const SERVICE_WORKER_JS = `
const CACHE_NAME = 'museumsufer-v1';
const SHELL_URLS = ['/', '/manifest.json'];
const API_CACHE = 'museumsufer-api-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirstWithCache(e.request, API_CACHE));
    return;
  }

  if (url.pathname.startsWith('/img/')) {
    e.respondWith(cacheFirstWithNetwork(e.request, CACHE_NAME));
    return;
  }

  if (e.request.mode === 'navigate' || url.pathname === '/') {
    e.respondWith(networkFirstWithCache(e.request, CACHE_NAME));
    return;
  }
});

async function networkFirstWithCache(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
`;
