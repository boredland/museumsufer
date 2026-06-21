import { buildServiceWorkerJs } from "@museumsufer/core";

export const SERVICE_WORKER_JS = buildServiceWorkerJs({
  cacheKey: "museumsufer-v3",
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
  defaultPushTitle: "Heute im Museumsufer",
});
