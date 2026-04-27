import { getProxyDomains } from "./museum-config";
import { USER_AGENT } from "./shared";
import type { Env } from "./types";

const proxyDomains = getProxyDomains();

function shouldProxy(imageUrl: string): boolean {
  try {
    const host = new URL(imageUrl).hostname;
    return proxyDomains.has(host) || [...proxyDomains].some((d) => host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

let allowedDomains: Set<string> | null = null;

async function getAllowedDomains(env: Env): Promise<Set<string>> {
  if (allowedDomains) return allowedDomains;

  const domains = new Set<string>(["museumsufer.de", "www.museumsufer.de"]);
  const { results } = await env.DB.prepare("SELECT website_url FROM museums WHERE website_url IS NOT NULL").all<{
    website_url: string;
  }>();

  for (const row of results) {
    try {
      const hostname = new URL(row.website_url).hostname;
      domains.add(hostname);
      if (hostname.startsWith("www.")) domains.add(hostname.slice(4));
      else domains.add(`www.${hostname}`);
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
    imageUrl = decodeURIComponent(encodedUrl).split(/\s+/)[0].trim();
    if (!imageUrl.startsWith("https://") && !imageUrl.startsWith("http://")) return null;

    const origin = new URL(imageUrl).hostname;
    const allowed = await getAllowedDomains(env);
    let isAllowed = allowed.has(origin);
    if (!isAllowed) {
      for (const d of allowed) {
        if (origin.endsWith(`.${d}`)) {
          isAllowed = true;
          break;
        }
      }
    }
    if (!isAllowed) {
      return new Response("Forbidden origin", { status: 403 });
    }
  } catch {
    return new Response("Bad URL", { status: 400 });
  }

  const width = Math.min(parseInt(url.searchParams.get("w") || "", 10) || 0, 2000);

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    let res: Response;

    if (env.FETCH_PROXY_URL && shouldProxy(imageUrl)) {
      const proxyUrl = `${env.FETCH_PROXY_URL}?url=${encodeURIComponent(imageUrl)}`;
      const headers: Record<string, string> = {};
      if (env.FETCH_PROXY_TOKEN) headers.Authorization = `Bearer ${env.FETCH_PROXY_TOKEN}`;
      res = await fetch(proxyUrl, { headers });
    } else {
      const fetchInit: RequestInit = {
        headers: { "User-Agent": USER_AGENT },
      };

      if (width > 0) {
        (fetchInit as RequestInit & { cf: object }).cf = {
          image: { width, fit: "cover", format: "webp", quality: 80 },
        };
      }

      res = await fetch(imageUrl, fetchInit);
    }

    if (!res.ok && width > 0) {
      if (env.FETCH_PROXY_URL) {
        const proxyUrl = `${env.FETCH_PROXY_URL}?url=${encodeURIComponent(imageUrl)}`;
        const headers: Record<string, string> = {};
        if (env.FETCH_PROXY_TOKEN) headers.Authorization = `Bearer ${env.FETCH_PROXY_TOKEN}`;
        res = await fetch(proxyUrl, { headers });
      } else {
        res = await fetch(imageUrl, { headers: { "User-Agent": USER_AGENT } });
      }
    }
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
        "Cache-Control": "public, max-age=2592000, s-maxage=2592000",
        "Access-Control-Allow-Origin": "*",
      },
    });

    cache.put(cacheKey, response.clone());
    return response;
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
