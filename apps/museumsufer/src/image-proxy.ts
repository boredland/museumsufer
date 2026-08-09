import { getProxyDomains } from "./museum-config";
import { SCRAPE_DATA } from "./scrape-data";
import { USER_AGENT } from "./shared";
import type { Env } from "./types";

const proxyDomains = getProxyDomains();

// Derived from every image_url in the bundled scrape data, so the allowlist
// stays in sync with whatever the scrapers actually produce. A host that
// isn't in the bundle isn't one of ours, so it's rejected.
const staticAllowedDomains = ((): ReadonlySet<string> => {
  const hosts = new Set<string>();
  const collect = (url: string | null | undefined): void => {
    if (!url) return;
    try {
      hosts.add(new URL(url).hostname);
    } catch {}
  };
  for (const m of SCRAPE_DATA.museums) collect(m.image_url);
  for (const e of SCRAPE_DATA.exhibitions) collect(e.image_url);
  for (const e of SCRAPE_DATA.events) collect(e.image_url);
  return hosts;
})();

function shouldProxy(imageUrl: string): boolean {
  try {
    const host = new URL(imageUrl).hostname;
    return proxyDomains.has(host) || [...proxyDomains].some((d) => host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

// Exact match only. The allowlist is derived from the very image_urls it
// gates, so every legitimate host is already in the set verbatim and the old
// `hostname.endsWith("." + d)` fallback admitted nothing extra — it only
// widened the proxy to every subdomain of every host a scraper had ever
// emitted. That is attacker-reachable in principle: hosts arrive from scraped
// third-party markup, so one venue moving its images to shared hosting
// (`cdn.example.s3.amazonaws.com`, a `*.wordpress.com` tenant) would silently
// turn the proxy into an open fetcher for that whole provider.
export function isDomainAllowed(hostname: string): boolean {
  return staticAllowedDomains.has(hostname);
}

export async function handleImageProxy(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/img/")) return null;

  const encodedUrl = url.pathname.slice(5);
  if (!encodedUrl) return null;

  let imageUrl: string;
  try {
    imageUrl = decodeURIComponent(encodedUrl).split(/\s+/)[0].trim().replace(/&amp;/g, "&");
    if (!imageUrl.startsWith("https://") && !imageUrl.startsWith("http://")) return null;

    const origin = new URL(imageUrl).hostname;
    if (!isDomainAllowed(origin)) {
      return new Response("Forbidden origin", { status: 403 });
    }
  } catch {
    return new Response("Bad URL", { status: 400 });
  }

  const width = Math.min(parseInt(url.searchParams.get("w") || "", 10) || 0, 2000);

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    let res: Response;

    if (width > 0) {
      const wsrv = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=${width}&output=webp&q=80&we`;
      res = await fetch(wsrv, { headers: { "User-Agent": USER_AGENT } });
    } else if (env.FETCH_PROXY_URL && shouldProxy(imageUrl)) {
      const proxyUrl = `${env.FETCH_PROXY_URL}?url=${encodeURIComponent(imageUrl)}`;
      const headers: Record<string, string> = {};
      if (env.FETCH_PROXY_TOKEN) headers.Authorization = `Bearer ${env.FETCH_PROXY_TOKEN}`;
      res = await fetch(proxyUrl, { headers });
    } else {
      res = await fetch(imageUrl, { headers: { "User-Agent": USER_AGENT } });
    }

    if (!res.ok) {
      if (env.FETCH_PROXY_URL) {
        const proxyUrl = `${env.FETCH_PROXY_URL}?url=${encodeURIComponent(imageUrl)}`;
        const headers: Record<string, string> = {};
        if (env.FETCH_PROXY_TOKEN) headers.Authorization = `Bearer ${env.FETCH_PROXY_TOKEN}`;
        res = await fetch(proxyUrl, { headers });
      } else if (width > 0) {
        res = await fetch(imageUrl, { headers: { "User-Agent": USER_AGENT } });
      }
    }
    if (!res.ok) {
      return new Response("Upstream error", { status: 502 });
    }

    const contentType = res.headers.get("Content-Type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new Response("Not an image", { status: 400 });
    }

    const body = await res.arrayBuffer();
    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    };

    // Preserve cache headers from upstream to enable conditional requests
    const eTag = res.headers.get("ETag");
    if (eTag) responseHeaders.ETag = eTag;
    const lastModified = res.headers.get("Last-Modified");
    if (lastModified) responseHeaders["Last-Modified"] = lastModified;

    const response = new Response(body, {
      headers: responseHeaders,
    });

    cache.put(cacheKey, response.clone());
    return response;
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
