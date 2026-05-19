import { buildServiceWorkerJs } from "@museumsufer/core";

// Only assets actually shipped under public/ — adding non-existent
// entries would 404 inside cache.addAll() and silently skip ALL
// precaching (the .catch is per-batch, not per-asset).
export const SERVICE_WORKER_JS = buildServiceWorkerJs({
  cacheKey: "landau-today-v3",
  staticAssets: ["/favicon.svg", "/manifest.json"],
  defaultPushTitle: "Heute in Landau",
});
