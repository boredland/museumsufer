/**
 * Workers Cache keyed per hostname, for Workers that serve different content
 * on each of their custom domains (`frankfurt.konzert.haus` vs
 * `hamburg.konzert.haus`).
 *
 * Workers Cache leaves the host out of the cache key: one Worker has one
 * cache shared by every domain bound to it, so `/` on any city subdomain
 * served whichever city was cached first. The documented fix is a gateway:
 * an uncached default entrypoint forwards each request through a
 * `ctx.exports` loopback to a cached entrypoint, passing the host in
 * `ctx.props`, which is part of the cache key.
 *
 * Wiring, per app:
 *   const cache = hostKeyedCache(app.fetch, { uncachedHosts: ["konzert.haus"] });
 *   export const HostCache = cache.HostCache;   // name must be exactly this
 *   export default { fetch: cache.fetch, scheduled… };
 * and in wrangler.jsonc: the `enable_ctx_exports` compatibility flag, plus
 * `exports.default.cache.enabled: false` and `exports.HostCache.cache.enabled: true`.
 *
 * Import via "@museumsufer/core/host-cache" only — `cloudflare:workers` does
 * not resolve under Bun, so this must stay out of the barrel.
 */
import { WorkerEntrypoint } from "cloudflare:workers";

type FetchHandler<Env> = (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;

interface HostProps {
  host: string;
}

/** `ctx.exports` as the runtime provides it under `enable_ctx_exports`. The
 *  installed workers-types (default compat entry) predate the field. */
interface LoopbackContext {
  exports: Record<string, (options: { props: HostProps }) => Fetcher>;
}

/** Export name the gateway looks up in `ctx.exports`. */
const ENTRYPOINT = "HostCache";

export function hostKeyedCache<Env>(
  handler: FetchHandler<Env>,
  opts: {
    /** Hosts that must reach the handler uncached — e.g. the bare apex, whose
     *  geo redirect reads the visitor's `request.cf` and differs per visitor. */
    uncachedHosts?: readonly string[];
  } = {},
) {
  const uncached = new Set(opts.uncachedHosts ?? []);

  class HostCache extends WorkerEntrypoint<Env, HostProps> {
    override fetch(request: Request): Response | Promise<Response> {
      return handler(request, this.env, this.ctx);
    }
  }

  function fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    const host = new URL(request.url).host;
    if (uncached.has(host)) return handler(request, env, ctx);
    const loopback = ctx as unknown as LoopbackContext;
    return loopback.exports[ENTRYPOINT]({ props: { host } }).fetch(request);
  }

  return { HostCache, fetch };
}
