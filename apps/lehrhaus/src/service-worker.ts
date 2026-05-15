export const SERVICE_WORKER_JS = `
const CACHE = 'lh-v1';
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

self.addEventListener('push', function(event){
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  var title = data.title || 'Konzerte heute';
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
