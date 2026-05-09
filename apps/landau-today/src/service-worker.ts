import { buildServiceWorkerJs } from "@museumsufer/core";

/** Service-worker source served at /sw.js. The shape (network-first
 *  for shell + API, cache-first for /img/) lives in @museumsufer/core;
 *  per-app-ness reduces to picking unique cache names + the navigation
 *  prefixes the SW should treat as "home routes". */
export const SERVICE_WORKER_JS = buildServiceWorkerJs({
  cacheName: "landau-today-v1",
  apiCacheName: "landau-today-api-v1",
  shellUrls: ["/", "/manifest.json", "/styles.css"],
  navigationPrefixes: ["/", "/c/"],
});
