import { createImageProxy } from "@museumsufer/core/image-proxy";
import { SCRAPE_DATA } from "./scrape-data";

/**
 * Derived from every `image_url` in the bundled scrape data, so the
 * allow-list stays in sync with whatever the scrapers actually emit.
 * Mirrors `apps/frankfurt-museums/src/image-proxy.ts` — see the
 * project-image-proxy-allowlist note for context.
 */
const ALLOWED_HOSTS: ReadonlySet<string> = (() => {
  const hosts = new Set<string>();
  for (const e of SCRAPE_DATA.events) {
    if (!e.image_url) continue;
    try {
      hosts.add(new URL(e.image_url).hostname);
    } catch {}
  }
  return hosts;
})();

export const { handleImageProxy, imageProxyUrl } = createImageProxy({
  userAgent: "konzert.haus/1.0 (+https://frankfurt.konzert.haus)",
  allowedHosts: ALLOWED_HOSTS,
  passthroughDisallowed: true,
});
