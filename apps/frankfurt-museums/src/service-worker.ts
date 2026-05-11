import { buildServiceWorkerJs } from "@museumsufer/core";

export const SERVICE_WORKER_JS = buildServiceWorkerJs({
  cacheName: "museumsufer-v2",
  apiCacheName: "museumsufer-api-v2",
  shellUrls: ["/", "/manifest.json"],
  apiPrefixes: ["/api/", "/partial/"],
});
