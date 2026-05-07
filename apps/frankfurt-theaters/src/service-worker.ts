/**
 * Service worker source. Inlined as a string so the worker can serve it at
 * /sw.js without an extra build step.
 *
 * Strategy:
 *  - Network-first for HTML (already), the API, AND /styles.css so CSS
 *    edits land within one navigation. Without this, cache-first served
 *    stale CSS for days because the cache version never changed.
 *  - Stale-while-revalidate for the rest of /public/* (icons, OG image,
 *    fonts) — fast paint from cache, fresh copy in background.
 *  - Cache version bumped to v2 to evict any v1 caches lingering on
 *    returning visitors.
 */
export const SERVICE_WORKER_JS = `
const CACHE = 'ft-v2';
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

function networkFirst(req){
  return fetch(req).then(function(res){
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
    }
    return res;
  }).catch(function(){ return caches.match(req); });
}

function staleWhileRevalidate(req){
  return caches.match(req).then(function(cached){
    var fresh = fetch(req).then(function(res){
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
      }
      return res;
    }).catch(function(){ return cached; });
    return cached || fresh;
  });
}

self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var accept = req.headers.get('accept') || '';
  var isDoc = req.mode === 'navigate' || accept.includes('text/html') || url.pathname.startsWith('/api/');
  // Treat the stylesheet as content-like: edits should land within a single
  // navigation, not be locked to a stale cache for days.
  if (isDoc || url.pathname === '/styles.css') {
    event.respondWith(networkFirst(req));
    return;
  }

  // Stale-while-revalidate for everything else under /public/* — the user
  // gets the cached copy instantly and a fresh one is fetched in the
  // background to populate cache for the next visit.
  event.respondWith(staleWhileRevalidate(req));
});
`.trimStart();
