/**
 * Edge-cached image proxy. Allowed upstream hosts come from the scrape-data
 * survey (`grep image_url src/scrape-data.ts`). Anything outside the allow-list
 * passes through unchanged.
 *
 * 7-day TTL; CF caches by full URL.
 */

const USER_AGENT = "frankfurt.ins.theater/1.0 (+https://frankfurt.ins.theater)";

const ALLOWED_HOSTS = new Set([
  "cdn.reservix.com",
  "diekomoedie.de",
  "galli-frankfurt.de",
  "internationales-theater.de",
  "landungsbruecken.org",
  "oper-frankfurt.de",
  "sf-6a25.kxcdn.com",
  "stalburg.de",
  "theaterwillypraml.de",
  "volksbuehne.net",
  "www.diedramatischebuehne.de",
  "www.lempenfieber.de",
  "www.neues-theater.de",
  "www.theater-alte-bruecke.de",
  "www.theaterhaus-frankfurt.de",
  "www.kellertheater-frankfurt.de",
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

export function imageProxyUrl(originalUrl: string | undefined | null): string | undefined {
  if (!originalUrl) return undefined;
  try {
    const u = new URL(originalUrl);
    if (!ALLOWED_HOSTS.has(u.hostname)) return originalUrl;
    return `/img/${encodeURIComponent(originalUrl)}`;
  } catch {
    return undefined;
  }
}
