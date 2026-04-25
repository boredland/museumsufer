const ALLOWED_ORIGINS = [
  "museumsufer.de",
  "museumfrankfurt.senckenberg.de",
  "www.staedelmuseum.de",
  "www.liebieghaus.de",
  "www.juedischesmuseum.de",
  "dam-online.de",
  "www.dam-online.de",
  "www.dff.film",
  "www.schirn.de",
  "www.mfk-frankfurt.de",
  "www.historisches-museum-frankfurt.de",
  "historisches-museum-frankfurt.de",
  "dommuseum-frankfurt.de",
  "www.stadtgeschichte-ffm.de",
  "www.museumangewandtekunst.de",
  "caricatura-museum.de",
  "www.mmk.art",
  "weltkulturenmuseum.de",
  "www.fkv.de",
  "archaeologisches-museum-frankfurt.de",
];

export async function handleImageProxy(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/img/")) return null;

  const encodedUrl = url.pathname.slice(5);
  if (!encodedUrl) return null;

  let imageUrl: string;
  try {
    imageUrl = decodeURIComponent(encodedUrl);
    if (!imageUrl.startsWith("https://")) return null;
    const origin = new URL(imageUrl).hostname;
    if (!ALLOWED_ORIGINS.some((o) => origin === o || origin.endsWith("." + o))) {
      return new Response("Forbidden origin", { status: 403 });
    }
  } catch {
    return new Response("Bad URL", { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Museumsufer/1.0)" },
    });

    if (!res.ok) {
      return new Response("Upstream error", { status: 502 });
    }

    const contentType = res.headers.get("Content-Type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new Response("Not an image", { status: 400 });
    }

    const body = await res.arrayBuffer();
    const response = new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, s-maxage=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });

    cache.put(cacheKey, response.clone());
    return response;
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
