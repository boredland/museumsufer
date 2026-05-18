/**
 * Edge-cached image proxy. Allowed upstream hosts come from the scrape-data
 * survey for cinema venues. Anything outside the allow-list returns 403.
 *
 * 7-day TTL; CF caches by full URL.
 */

const USER_AGENT = "lichtspiel.haus/1.0 (+https://frankfurt.lichtspiel.haus)";

const ALLOWED_HOSTS = new Set([
  "www.astor-filmlounge.de",
  "astor-filmlounge.de",
  "www.arthouse-kinos.de",
  "www.arthouse-mainz.de",
  "www.orfeos.de",
  "www.dff.film",
  "dff.film",
  "www.filmforum-hoechst.de",
  "www.pupille.org",
  "www.nipponconnection.com",
  "murnau-stiftung.de",
  "www.wiesbaden.de",
  "www.filmpalast-hofheim.de",
  "www.kino-kelkheim.de",
  "www.kronberger-lichtspiele.de",
  "www.kino-alte-muehle.de",
  "www.kino-koeppern.de",
  "www.kino-lichtblick.de",
  "www.rex-kino-darmstadt.de",
  "www.filmkreis.tu-darmstadt.de",
  "tickets.cinetixx.de",
  "www.kinoheld.de",
  // TMDb CDN — used by the hub's poster-enrichment pass for events where
  // the venue scraper didn't carry an image_url.
  "image.tmdb.org",
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
