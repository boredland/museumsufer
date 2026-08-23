/**
 * Edge caching for Worker-rendered HTML.
 *
 * Workers on a custom domain do NOT populate the edge cache from a response's
 * `Cache-Control` alone — the header only reaches the browser, so every request
 * re-runs the handler. Rendering dominates CPU on these apps (serialising a
 * large page costs ~34 ns/byte), so a cache miss is the expensive case and a
 * hit is nearly free.
 *
 * This middleware puts renders into `caches.default` explicitly. Cloudflare's
 * Cache API ignores `Vary`, so anything that changes the body — locale, city,
 * the Berlin date behind "today" — MUST be folded into the cache key by the
 * caller's `key` callback instead. A stale-after-midnight page is the failure
 * mode that `Vary` would have hidden.
 */
interface MinimalCacheContext {
  req: { method: string; url: string; raw: Request };
  res: Response;
  executionCtx: { waitUntil(p: Promise<unknown>): void };
  /** Hono context vars, e.g. the `city` set by cityMiddleware. */
  get(key: string): string | undefined;
}

export interface EdgeCacheOptions {
  /**
   * Cache-key discriminators for everything that varies the body but not the
   * URL. Returned parts are appended to the key URL, so they must cover
   * locale, city and any "today"-style clock dependency.
   */
  key: (c: MinimalCacheContext) => Record<string, string>;
  /** Only cache these path prefixes. A bare "/" matches the homepage exactly. */
  paths: readonly string[];
  /** Edge TTL in seconds. */
  ttl: number;
  /**
   * Build identifier mixed into every key. Entries from a previous deploy
   * become unreachable rather than serving HTML that references an asset URL
   * the new build no longer routes (e.g. a hashed client bundle) — a hard 404
   * for any visitor served a stale page.
   */
  version: string;
}

function matches(pathname: string, paths: readonly string[]): boolean {
  for (const p of paths) {
    if (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

export function edgeCache(opts: EdgeCacheOptions) {
  return async (c: MinimalCacheContext, next: () => Promise<void>) => {
    const url = new URL(c.req.url);
    if (c.req.method !== "GET" || !matches(url.pathname, opts.paths)) return next();

    // A request carrying credentials is not a shared-cache candidate.
    if (c.req.raw.headers.has("authorization") || c.req.raw.headers.has("cookie")) return next();

    const keyUrl = new URL(url);
    keyUrl.searchParams.set("__v", opts.version);
    for (const [k, v] of Object.entries(opts.key(c))) keyUrl.searchParams.set(`__${k}`, v);
    keyUrl.searchParams.sort();
    const cacheKey = new Request(keyUrl.toString(), { method: "GET" });

    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) {
      c.res = new Response(hit.body, hit);
      c.res.headers.set("X-Edge-Cache", "hit");
      return;
    }

    await next();

    const res = c.res;
    if (res.status !== 200 || res.headers.has("set-cookie")) return;

    const cached = res.clone();
    cached.headers.set("Cache-Control", `public, max-age=${opts.ttl}`);
    c.executionCtx.waitUntil(cache.put(cacheKey, cached));
    c.res.headers.set("X-Edge-Cache", "miss");
  };
}
