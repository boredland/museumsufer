/**
 * Build the service-worker source as a string. Served verbatim at /sw.js
 * — no separate build step needed.
 *
 * Strategy:
 *  - Pre-cache `staticAssets` on install (icons, OG image, manifest).
 *  - Navigations + Accept:text/html + /api/* → network-first against
 *    the single cache, with a cached fallback when offline.
 *  - Everything else same-origin → stale-while-revalidate (fonts,
 *    icons, /img/*, /client.js, etc.). The image proxy already sets
 *    immutable cache headers, so SWR is a thin wrapper there.
 *  - Cross-origin or non-GET → SW does not intercept.
 *
 * Plus full push-notification support (push, notificationclick,
 * pushsubscriptionchange with re-subscription against /api/push/key).
 */

export interface ServiceWorkerOptions {
  /** CacheStorage key. Bump the suffix (e.g. v1 → v2) when shipping a
   *  breaking SW change so the `activate` step evicts stale caches.
   *  Keep the app-prefix unique across the org so two installed apps
   *  on the same browser don't accidentally collide. */
  cacheKey: string;
  /** URLs pre-cached on install. Typical: icons, OG image, manifest.
   *  Anything in this list survives offline from the first load. */
  staticAssets?: string[];
  /** Fallback title used in `showNotification` when the push payload
   *  omits one. Defaults to "Update". */
  defaultPushTitle?: string;
}

export function buildServiceWorkerJs(opts: ServiceWorkerOptions): string {
  const cacheKey = JSON.stringify(opts.cacheKey);
  const staticAssets = JSON.stringify(opts.staticAssets ?? ["/manifest.json"]);
  const pushTitle = JSON.stringify(opts.defaultPushTitle ?? "Update");
  return `
const CACHE = ${cacheKey};
const STATIC_ASSETS = ${staticAssets};

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

self.addEventListener('push', function(event){
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  var title = data.title || ${pushTitle};
  var options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'digest',
    renotify: true,
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients){
      for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
          c.navigate(target).catch(function(){});
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('pushsubscriptionchange', function(event){
  event.waitUntil((async function(){
    try {
      var reg = self.registration;
      var keyRes = await fetch('/api/push/key');
      if (!keyRes.ok) return;
      var key = (await keyRes.json()).publicKey;
      var newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
      var schedules = ['morning'];
      if (event.oldSubscription) {
        var meRes = await fetch('/api/push/me?endpoint=' + encodeURIComponent(event.oldSubscription.endpoint));
        if (meRes.ok) {
          var me = await meRes.json();
          if (me.schedules && me.schedules.length) schedules = me.schedules;
        }
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: event.oldSubscription.endpoint })
        });
      }
      var json = newSub.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, schedules: schedules })
      });
    } catch (_) {}
  })());
});

function urlBase64ToUint8Array(s){
  var pad = '='.repeat((4 - s.length % 4) % 4);
  var b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  var bin = atob(b64);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
`.trimStart();
}
