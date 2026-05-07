/**
 * Service worker source. Inlined as a string so the worker can serve it at
 * /sw.js without an extra build step.
 *
 * Strategy:
 *  - CSS is now inlined in <head> (see styles-inline.ts) so /styles.css
 *    is no longer requested on page load. We drop it from the precache
 *    list — keeping it would just waste bandwidth on install.
 *  - Network-first for HTML and the API.
 *  - Stale-while-revalidate for the rest of /public/* (icons, OG image,
 *    fonts) — fast paint from cache, fresh copy in background.
 *  - Cache version bumped to v3 to evict the v2 cache that still held the
 *    pre-inline /styles.css entry.
 */
export const SERVICE_WORKER_JS = `
const CACHE = 'ft-v3';
const STATIC_ASSETS = [
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
  if (isDoc) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Stale-while-revalidate for everything else under /public/* — the user
  // gets the cached copy instantly and a fresh one is fetched in the
  // background to populate cache for the next visit.
  event.respondWith(staleWhileRevalidate(req));
});
`.trimStart();
