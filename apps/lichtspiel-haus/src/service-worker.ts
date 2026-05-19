import { buildServiceWorkerJs } from "@museumsufer/core";

// Note: the prior cache key "lh-v1" collided with lehrhaus. Origin-
// scoped storage saved us at runtime, but the new "lichtspiel-haus-v1"
// is unambiguous and survives a future cache audit. Bumping forces
// every installed PWA to re-precache on next activate.
export const SERVICE_WORKER_JS = buildServiceWorkerJs({
  cacheKey: "lichtspiel-haus-v1",
  staticAssets: [
    "/favicon.svg",
    "/mark.svg",
    "/icon-192.png",
    "/icon-512.png",
    "/icon-192-maskable.png",
    "/icon-512-maskable.png",
    "/og-image.png",
    "/manifest.json",
  ],
  defaultPushTitle: "Heute im Kino",
});
