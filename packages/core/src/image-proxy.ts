/**
 * Edge-cached image proxy shared by five sibling apps (lichtspiel-haus,
 * konzert-haus, lehrhaus, ins-theater, landau-today).
 * museumsufer keeps its own implementation because its allow-list
 * is derived dynamically from the D1 database and it carries a
 * FETCH_PROXY_URL escape hatch the others don't need.
 *
 * Strategy:
 *  - Request shape: `/img/<url-encoded upstream URL>?w=NN`.
 *  - With `?w=NN`: rewrite to `/cdn-cgi/image/width=NN,format=webp,quality=80/<upstream>`
 *    so Cloudflare Image Resizing handles transform + cache at the edge.
 *  - Without `?w=`: fetch the upstream directly with a CF-side 7-day
 *    edge cache.
 *  - Hostname must appear in the allow-list. Off-list hosts get a 403.
 *  - Successful non-resize responses are cached on `caches.default` for a year.
 *
 * `passthroughDisallowed` flips the behaviour of `imageProxyUrl` when
 * the caller asks for a URL that isn't in the allow-list:
 *  - `false` (default) → returns `undefined` so the caller can render
 *    a styled fallback (PosterCard pattern in lichtspiel-haus).
 *  - `true` → returns the original URL unchanged so the renderer keeps
 *    embedding the off-host image (legacy konzert-haus/lehrhaus pattern).
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
        // Try Cloudflare Image Resizing first (works when "Resize images
        // from any origin" is enabled on the zone). Falls back to direct
        // fetch if CF returns cf-not-resized (403) for external URLs.
        const cfImg = `/cdn-cgi/image/width=${width},format=webp,quality=80/${target.toString()}`;
        upstream = await fetch(new URL(cfImg, url).toString(), {
          headers: { "User-Agent": userAgent },
        });
        if (!upstream.ok) {
          upstream = await fetch(target.toString(), {
            headers: { "User-Agent": userAgent, Accept: "image/*" },
            cf: { cacheTtl: 86400 * 7, cacheEverything: true },
          });
        }
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
