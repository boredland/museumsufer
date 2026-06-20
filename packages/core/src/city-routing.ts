import type { MiddlewareHandler } from "hono";
import { type CitySlug, CITIES, DEFAULT_CITY, nearestCity } from "./cities";

export interface CityMiddlewareOptions {
  /** Bare apex domain for the vertical, e.g. "lehr.salon" or "ins.museum". */
  readonly apex: string;
  /** Default city used for unknown subdomains and plain apex redirects. */
  readonly defaultCity?: CitySlug;
  /**
   * Hosts that resolve to a fixed city WITHOUT redirecting — used to keep an
   * SEO-primary host on its own domain (e.g. museumsufer.app → frankfurt).
   */
  readonly aliasHosts?: Readonly<Record<string, CitySlug>>;
  /**
   * What to do when the bare apex is hit:
   *  - "redirect" (default): 301 to `<defaultCity>.<apex>`.
   *  - "geo": 301 to the nearest city's subdomain using Cloudflare edge
   *    geolocation (cf.latitude/longitude, then cf.city), defaulting otherwise.
   */
  readonly apexBehavior?: "redirect" | "geo";
}

type CityVars = { Variables: { city: string } };

/**
 * Host → city routing for a single-Worker, multi-city vertical.
 *
 * Replaces the per-app inline middleware that was copy-pasted (with drift)
 * across lehrhaus, lichtspiel-haus, konzert-haus, theaters and museums. Sets
 * `c.var.city` on every request; redirects the bare apex to a canonical
 * `<city>.<apex>` subdomain.
 */
export function cityMiddleware(opts: CityMiddlewareOptions): MiddlewareHandler<CityVars> {
  const { apex } = opts;
  const defaultCity = opts.defaultCity ?? DEFAULT_CITY;
  const aliasHosts = opts.aliasHosts ?? {};
  const apexBehavior = opts.apexBehavior ?? "redirect";
  const suffix = `.${apex}`;

  return async (c, next) => {
    const host = (c.req.header("host") ?? "").toLowerCase();

    // Alias hosts (e.g. museumsufer.app) resolve to a city without redirect,
    // preserving the host's own canonical URL.
    const alias = aliasHosts[host];
    if (alias) {
      c.set("city", alias);
      return next();
    }

    // Bare apex → redirect to a canonical city subdomain.
    if (host === apex) {
      const url = new URL(c.req.url);
      const target = apexBehavior === "geo" ? geoCity(c, defaultCity) : defaultCity;
      return c.redirect(`https://${target}.${apex}${url.pathname}${url.search}`, 301);
    }

    // `<city>.<apex>` → use the prefix when it's a known city, else default.
    const prefix = host.endsWith(suffix) ? host.slice(0, -suffix.length) : "";
    c.set("city", prefix in CITIES ? prefix : defaultCity);
    await next();
  };
}

/** Nearest city from Cloudflare edge geolocation, defaulting when absent. */
function geoCity(c: { req: { raw: Request } }, fallback: CitySlug): CitySlug {
  const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf;
  if (cf?.latitude && cf?.longitude) {
    return nearestCity(Number(cf.latitude), Number(cf.longitude));
  }
  const cfCity = typeof cf?.city === "string" ? cf.city.toLowerCase() : "";
  return cfCity in CITIES ? (cfCity as CitySlug) : fallback;
}
