/**
 * Build a small offline-first service worker as a string. Each app
 * (museums, theaters, landau) had a hand-rolled near-identical SW —
 * now they all call this factory.
 *
 * Cache vocabulary:
 *   - SHELL_URLS get pre-cached on install (shell + manifest + styles).
 *   - `/api/*` paths → network-first (fresh data online, cached fallback offline).
 *   - `/img/*` paths → cache-first (the proxy already long-caches; SW makes
 *     it offline-survivable).
 *   - everything else navigations → network-first against the same
 *     CACHE_NAME so the home / category routes work offline.
 */
export interface ServiceWorkerOptions {
  /** Bumps the cache key when shipping breaking SW changes. */
  cacheName: string;
  /** Separate API cache so we can purge it without nuking the shell. */
  apiCacheName: string;
  /** URLs pre-cached on install. */
  shellUrls?: string[];
  /** Path prefixes treated as "navigation" (network-first against cacheName). */
  navigationPrefixes?: string[];
  /** Path prefixes treated like /api/ — network-first against apiCacheName.
   *  Defaults to ["/api/"]. Add e.g. "/partial/" to also cache htmx swaps. */
  apiPrefixes?: string[];
}

export function buildServiceWorkerJs(opts: ServiceWorkerOptions): string {
  const shell = JSON.stringify(opts.shellUrls ?? ["/", "/manifest.json", "/styles.css"]);
  const navPrefixes = JSON.stringify(opts.navigationPrefixes ?? ["/"]);
  const apiPrefixes = JSON.stringify(opts.apiPrefixes ?? ["/api/"]);
  return `
const CACHE_NAME = ${JSON.stringify(opts.cacheName)};
const API_CACHE = ${JSON.stringify(opts.apiCacheName)};
const SHELL_URLS = ${shell};
const NAV_PREFIXES = ${navPrefixes};
const API_PREFIXES = ${apiPrefixes};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
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
  if (API_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    e.respondWith(networkFirst(e.request, API_CACHE));
    return;
  }
  if (url.pathname.startsWith('/img/')) {
    e.respondWith(cacheFirst(e.request, CACHE_NAME));
    return;
  }
  if (e.request.mode === 'navigate' || NAV_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    e.respondWith(networkFirst(e.request, CACHE_NAME));
    return;
  }
});

async function networkFirst(request, cacheName) {
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

async function cacheFirst(request, cacheName) {
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
}
