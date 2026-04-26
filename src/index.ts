import { getEventsForDate, getExhibitionsForDate, handleApi, handleFeeds, proxyImages } from "./api";
import { todayIso } from "./date";
import { scrapeMuseumWebsites } from "./event-scraper";
import { type InitialData, renderPage } from "./frontend";
import { detectLocale } from "./i18n";
import { handleImageProxy } from "./image-proxy";
import { scrape } from "./scraper";
import { SERVICE_WORKER_JS } from "./service-worker";
import { translateEvents, translateFields } from "./translate";
import type { Env } from "./types";

const LLMS_TXT = `# Museumsufer Frankfurt

> Aggregated exhibitions and events from ~40 museums along Frankfurt's Museumsufer (Museum Embankment).

This site provides a JSON API for querying museum exhibitions and events in Frankfurt am Main, Germany.

## API

Base URL: https://museumsufer.app

### Get events and exhibitions for a date

GET /api/day?date=YYYY-MM-DD

Returns JSON: { date, exhibitions[], events[] }
Each exhibition has: title, museum_name, start_date, end_date, image_url, detail_url
Each event has: title, museum_name, date, time, description, detail_url, image_url, price

### Get events only

GET /api/events?date=YYYY-MM-DD

### Get exhibitions only

GET /api/exhibitions?date=YYYY-MM-DD

### Get all museums

GET /api/museums

Returns: name, slug, museumsufer_url, website_url

## Notes

- Event content (titles, descriptions) is in German
- Dates use ISO 8601 format (YYYY-MM-DD)
- Times are in 24h format (HH:MM), timezone Europe/Berlin
- Events are available for the next 7 days with the most detail (images, prices, deep links)
- Exhibitions are available for any date (they span weeks/months)
- Data is refreshed daily at 6am UTC
`;

function checkScrapeAuth(request: Request, env: Env): Response | null {
  if (!env.SCRAPE_SECRET) return null;
  const auth = request.headers.get("Authorization");
  if (auth === `Bearer ${env.SCRAPE_SECRET}`) return null;
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/og-image.svg") {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f0eb"/>
  <rect x="0" y="0" width="1200" height="6" fill="#b45309"/>
  <text x="600" y="260" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" font-weight="700" fill="#1c1917" letter-spacing="-2">Museumsufer Frankfurt</text>
  <text x="600" y="330" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" fill="#78716c">Ausstellungen &amp; Veranstaltungen</text>
  <text x="600" y="400" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" fill="#b45309">museumsufer.app</text>
  <path d="M564 470 L554 475v2h20V475L564 470zm0 2.26L570.47 475H557.53L564 472.26zM554 487v2h20v-2H554zm2-8v8h2v-8h-2zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2z" fill="#b45309"/>
</svg>`,
        { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" } },
      );
    }

    if (url.pathname === "/robots.txt") {
      return new Response(`User-agent: *\nAllow: /\n\nSitemap: https://museumsufer.app/sitemap.xml\n`, {
        headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" },
      });
    }

    if (url.pathname === "/sitemap.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://museumsufer.app/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n  <url><loc>https://museumsufer.app/?lang=de</loc><changefreq>daily</changefreq></url>\n  <url><loc>https://museumsufer.app/?lang=en</loc><changefreq>daily</changefreq></url>\n  <url><loc>https://museumsufer.app/?lang=fr</loc><changefreq>daily</changefreq></url>\n  <url><loc>https://museumsufer.app/feed.xml</loc><changefreq>daily</changefreq></url>\n  <url><loc>https://museumsufer.app/feed.ics</loc><changefreq>daily</changefreq></url>\n  <url><loc>https://museumsufer.app/llms.txt</loc><changefreq>weekly</changefreq></url>\n</urlset>`,
        { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } },
      );
    }

    if (url.pathname.startsWith("/img/")) {
      const imgResponse = await handleImageProxy(request, env);
      if (imgResponse) return imgResponse;
    }

    if (url.pathname.startsWith("/api/")) {
      const locale = detectLocale(request);
      return handleApi(request, env, locale);
    }

    if (url.pathname === "/scrape" && request.method === "POST") {
      const denied = checkScrapeAuth(request, env);
      if (denied) return denied;
      const result = await scrape(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/scrape/events" && request.method === "POST") {
      const denied = checkScrapeAuth(request, env);
      if (denied) return denied;
      const result = await scrapeMuseumWebsites(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/scrape/translate" && request.method === "POST") {
      const denied = checkScrapeAuth(request, env);
      if (denied) return denied;
      const result = await translateEvents(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/sw.js") {
      return new Response(SERVICE_WORKER_JS, {
        headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache" },
      });
    }

    if (url.pathname === "/manifest.json") {
      return new Response(
        JSON.stringify({
          id: "/",
          name: "Museumsufer Frankfurt",
          short_name: "Museumsufer",
          description: "Ausstellungen & Veranstaltungen am Frankfurter Museumsufer",
          start_url: "/",
          display: "standalone",
          background_color: "#f5f0eb",
          theme_color: "#f5f0eb",
          icons: [
            {
              src: "/icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "/icon-192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
            },
            {
              src: "/icon-512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
            },
          ],
        }),
        {
          headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
        },
      );
    }

    if (url.pathname === "/icon.svg" || url.pathname === "/icon-192.svg" || url.pathname === "/icon-512.svg") {
      const size = url.pathname.includes("512") ? 512 : url.pathname.includes("192") ? 192 : 100;
      const fontSize = Math.round(size * 0.8);
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="#f5f0eb"/>
  <rect width="${size}" height="${Math.round(size * 0.04)}" fill="#b45309"/>
  <text x="${size / 2}" y="${size * 0.65}" text-anchor="middle" font-size="${fontSize}">🏛️</text>
</svg>`,
        { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" } },
      );
    }

    const feedResponse = await handleFeeds(request, env);
    if (feedResponse) return feedResponse;

    if (url.pathname === "/llms.txt" || url.pathname === "/.well-known/llms.txt") {
      return new Response(LLMS_TXT, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
      });
    }

    const locale = detectLocale(request);
    let initialData: InitialData | undefined;
    try {
      const date = todayIso();
      const [rawExhibitions, rawEvents] = await Promise.all([
        getExhibitionsForDate(env, date),
        getEventsForDate(env, date),
      ]);
      const exhibitions = proxyImages(rawExhibitions);
      const events = proxyImages(rawEvents);
      let finalExh: unknown[] = exhibitions;
      let finalEv: unknown[] = events;
      if (locale !== "de") {
        const [trExh, trEv] = await Promise.all([
          translateFields(env, exhibitions, ["title"], locale),
          translateFields(env, events, ["title", "description"], locale),
        ]);
        finalExh = trExh.map((item, i) => {
          const orig = exhibitions[i] as unknown as Record<string, unknown>;
          const cur = item as unknown as Record<string, unknown>;
          return cur.title !== orig.title ? { ...cur, translated: true } : cur;
        });
        finalEv = trEv.map((item, i) => {
          const orig = events[i] as unknown as Record<string, unknown>;
          const cur = item as unknown as Record<string, unknown>;
          return cur.title !== orig.title || cur.description !== orig.description ? { ...cur, translated: true } : cur;
        });
      }
      initialData = { date, exhibitions: finalExh, events: finalEv };
    } catch {}

    return new Response(renderPage(locale, initialData), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Language": locale,
        Vary: "Accept-Language",
      },
    });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      scrape(env)
        .catch((e) => console.error("scrape failed:", e))
        .then(() => scrapeMuseumWebsites(env))
        .catch((e) => console.error("event scrape failed:", e))
        .then(() => translateEvents(env))
        .catch((e) => console.error("translation failed:", e)),
    );
  },
} satisfies ExportedHandler<Env>;
