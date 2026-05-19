/**
 * Edge-cached image proxy. Allowed upstream hosts come from the scrape-data
 * survey (`grep image_url src/scrape-data.ts`). Anything outside the allow-list
 * passes through unchanged.
 *
 * 7-day TTL; CF caches by full URL.
 */

const USER_AGENT = "konzert.haus/1.0 (+https://frankfurt.konzert.haus)";

const ALLOWED_HOSTS = new Set([
  "oper-frankfurt.de",
  "www.alteoper.de",
  "www.brotfabrik.de",
  "www.ensemble-modern.com",
  "www.frankfurter-buergerstiftung.de",
  "www.hfmdk-frankfurt.de",
  "www.hr-bigband.de",
  "www.hr-sinfonieorchester.de",
  "www.jazz-frankfurt.de",
  "www.palmengarten.de",
  "www.rheingau-musik-festival.de",
  "www.romanfabrik.de",
]);

export async function handleImageProxy(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const encoded = url.pathname.replace(/^\/img\//, "");
  if (!encoded) return null;

  let target: URL;
  try {
    target = new URL(decodeURIComponent(encoded));
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(target.hostname)) return new Response("forbidden host", { status: 403 });

  // `?w=NN` routes through wsrv.nl for resize + WebP transcode. Capped
  // at 2000px so a hostile client can't ask for an arbitrary upscale.
  const width = Math.min(parseInt(url.searchParams.get("w") || "", 10) || 0, 2000);
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), req);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let upstream: Response;
  try {
    if (width > 0) {
      const wsrv = `https://wsrv.nl/?url=${encodeURIComponent(target.toString())}&w=${width}&output=webp&q=80&we`;
      upstream = await fetch(wsrv, { headers: { "User-Agent": USER_AGENT } });
    } else {
      upstream = await fetch(target.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
        cf: { cacheTtl: 86400 * 7, cacheEverything: true },
      });
    }
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
  if (!upstream.ok) return new Response("upstream error", { status: 502 });
  const contentType = upstream.headers.get("Content-Type") || "image/jpeg";
  if (!contentType.startsWith("image/")) return new Response("not an image", { status: 400 });

  const body = await upstream.arrayBuffer();
  const responseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    "Access-Control-Allow-Origin": "*",
  };
  const eTag = upstream.headers.get("ETag");
  if (eTag) responseHeaders.ETag = eTag;
  const response = new Response(body, { headers: responseHeaders });
  cache.put(cacheKey, response.clone());
  return response;
}

export function imageProxyUrl(originalUrl: string | undefined | null, width?: number): string | undefined {
  if (!originalUrl) return undefined;
  try {
    const u = new URL(originalUrl);
    if (!ALLOWED_HOSTS.has(u.hostname)) return originalUrl;
    const base = `/img/${encodeURIComponent(originalUrl)}`;
    return width ? `${base}?w=${width}` : base;
  } catch {
    return undefined;
  }
}
