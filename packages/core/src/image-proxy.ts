/**
 * Edge-cached image proxy shared by five sibling apps (lichtspiel-haus,
 * konzert-haus, lehrhaus, ins-theater, landau-today).
 * museumsufer keeps its own implementation because its allow-list
 * is derived dynamically from the D1 database and it carries a
 * FETCH_PROXY_URL escape hatch the others don't need.
 *
 * Strategy:
 *  - Request shape: `/img/<url-encoded upstream URL>?w=NN`.
 *  - With `?w=NN`: route through wsrv.nl for free resize + WebP
 *    transcode (capped at 2000px to block hostile upscale requests).
 *  - Without `?w=`: fetch the upstream directly with a CF-side 7-day
 *    edge cache.
 *  - Hostname must appear in the allow-list. Off-list hosts get a 403.
 *  - Successful responses are cached on `caches.default` for a year
 *    (immutable) and re-served on subsequent hits.
 *
 * `passthroughDisallowed` flips the behaviour of `imageProxyUrl` when
 * the caller asks for a URL that isn't in the allow-list:
 *  - `false` (default) → returns `undefined` so the caller can render
 *    a styled fallback (PosterCard pattern in lichtspiel-haus). This
 *    is also the safer default with a strict CSP `img-src` directive.
 *  - `true` → returns the original URL unchanged so the renderer keeps
 *    embedding the off-host image (legacy konzert-haus/lehrhaus
 *    pattern; relies on permissive CSP).
 */

export interface ImageProxyOptions {
  /** Sent as the `User-Agent` header on upstream fetches. */
  userAgent: string;
  /** Hostnames we're allowed to proxy. Everything else gets 403. */
  allowedHosts: ReadonlySet<string>;
  /** See module docstring. Defaults to `false`. */
  passthroughDisallowed?: boolean;
}

export interface ImageProxy {
  handleImageProxy(req: Request): Promise<Response | null>;
  imageProxyUrl(originalUrl: string | undefined | null, width?: number): string | undefined;
}

export function createImageProxy(opts: ImageProxyOptions): ImageProxy {
  const { userAgent, allowedHosts, passthroughDisallowed = false } = opts;

  async function handleImageProxy(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const encoded = url.pathname.replace(/^\/img\//, "");
    if (!encoded) return null;

    let target: URL;
    try {
      target = new URL(decodeURIComponent(encoded));
    } catch {
      return new Response("bad url", { status: 400 });
    }
    if (!allowedHosts.has(target.hostname)) return new Response("forbidden host", { status: 403 });

    const width = Math.min(parseInt(url.searchParams.get("w") || "", 10) || 0, 2000);
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), req);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    let upstream: Response;
    try {
      if (width > 0) {
        const wsrv = `https://wsrv.nl/?url=${encodeURIComponent(target.toString())}&w=${width}&output=webp&q=80`;
        upstream = await fetch(wsrv, {
          headers: { "User-Agent": userAgent },
          cf: { cacheTtl: 86400 * 30, cacheEverything: true },
        });
      } else {
        upstream = await fetch(target.toString(), {
          headers: { "User-Agent": userAgent, Accept: "image/*" },
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

  function imageProxyUrl(originalUrl: string | undefined | null, width?: number): string | undefined {
    if (!originalUrl) return undefined;
    try {
      const u = new URL(originalUrl);
      if (!allowedHosts.has(u.hostname)) return passthroughDisallowed ? originalUrl : undefined;
      const base = `/img/${encodeURIComponent(originalUrl)}`;
      return width ? `${base}?w=${width}` : base;
    } catch {
      return undefined;
    }
  }

  return { handleImageProxy, imageProxyUrl };
}
