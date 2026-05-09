import { buildServiceWorkerJs } from "@museumsufer/core";

export const SERVICE_WORKER_JS = buildServiceWorkerJs({
  cacheName: "museumsufer-v1",
  apiCacheName: "museumsufer-api-v1",
  shellUrls: ["/", "/manifest.json"],
  apiPrefixes: ["/api/", "/partial/"],
});
