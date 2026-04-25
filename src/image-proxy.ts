import { Env } from "./types";

let allowedDomains: Set<string> | null = null;

async function getAllowedDomains(env: Env): Promise<Set<string>> {
  if (allowedDomains) return allowedDomains;

  const domains = new Set<string>(["museumsufer.de", "www.museumsufer.de"]);
  const { results } = await env.DB.prepare(
    "SELECT website_url FROM museums WHERE website_url IS NOT NULL"
  ).all<{ website_url: string }>();

  for (const row of results) {
    try {
      const hostname = new URL(row.website_url).hostname;
      domains.add(hostname);
      if (hostname.startsWith("www.")) domains.add(hostname.slice(4));
      else domains.add("www." + hostname);
    } catch {}
  }

  allowedDomains = domains;
  return domains;
}

export async function handleImageProxy(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/img/")) return null;

  const encodedUrl = url.pathname.slice(5);
  if (!encodedUrl) return null;

  let imageUrl: string;
  try {
    imageUrl = decodeURIComponent(encodedUrl);
    if (!imageUrl.startsWith("https://") && !imageUrl.startsWith("http://")) return null;

    const origin = new URL(imageUrl).hostname;
    const allowed = await getAllowedDomains(env);
    const isAllowed = allowed.has(origin) ||
      [...allowed].some((d) => origin.endsWith("." + d));
    if (!isAllowed) {
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
