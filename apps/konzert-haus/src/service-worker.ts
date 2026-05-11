export const SERVICE_WORKER_JS = `
const CACHE = 'kh-v1';
const STATIC_ASSETS = [
  '/favicon.svg',
  '/mark.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
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
  event.respondWith(staleWhileRevalidate(req));
});
`.trimStart();
