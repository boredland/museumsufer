/**
 * Service worker source. Inlined as a string so the worker can serve it
 * at /sw.js without an extra build step. Cache-first for static assets,
 * network-first for HTML so the calendar always reflects today's data.
 */
export const SERVICE_WORKER_JS = `
const CACHE = 'ft-v1';
const STATIC_ASSETS = [
  '/styles.css',
  '/favicon.svg',
  '/mark.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/og-image.png',
  '/manifest.json',
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){ return cache.addAll(STATIC_ASSETS).catch(function(){}); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML and API
  var accept = req.headers.get('accept') || '';
  var isDoc = req.mode === 'navigate' || accept.includes('text/html') || url.pathname.startsWith('/api/');
  if (isDoc) {
    event.respondWith(
      fetch(req).then(function(res){
        if (res.ok && url.pathname === '/' ) {
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return caches.match(req); })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then(function(cached){
      if (cached) return cached;
      return fetch(req).then(function(res){
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
`.trimStart();
