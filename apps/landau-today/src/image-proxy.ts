/**
 * Edge-cached image proxy. Both upstream sources host their images on
 * a known host, so the allow-list is hard-coded — no DB lookup, no
 * per-request validation churn. The path is `/img/<encoded-url>`; the
 * url is `encodeURIComponent`-encoded by the renderer.
 *
 * 7-day TTL; CF caches by full URL.
 */
import { USER_AGENT } from "./shared";

/**
 * Upstream image hosts we proxy. Anything outside this set is served direct
 * (the renderer returns the original URL). Add hosts as scrapers find them —
 * see `bun -e` host frequency check in the README for current counts.
 */
const ALLOWED_HOSTS = new Set([
  "www.landau.de",
  "kulturnetz-landau.de",
  "www.suedlicheweinstrasse.de",
  "www.pfalz.de",
  "hambacher-schloss.de",
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

  const upstream = await fetch(target.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
    cf: { cacheTtl: 86400 * 7, cacheEverything: true },
  });

  if (!upstream.ok) return new Response("upstream error", { status: 502 });

  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", "public, max-age=604800, s-maxage=604800");
  headers.delete("set-cookie");
  return new Response(upstream.body, { status: 200, headers });
}

export function imageProxyUrl(originalUrl: string | undefined): string | undefined {
  if (!originalUrl) return undefined;
  try {
    const u = new URL(originalUrl);
    if (!ALLOWED_HOSTS.has(u.hostname)) return originalUrl;
    return `/img/${encodeURIComponent(originalUrl)}`;
  } catch {
    return undefined;
  }
}
