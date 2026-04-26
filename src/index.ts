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

    if (url.pathname === "/screenshot-wide.svg" || url.pathname === "/screenshot-mobile.svg") {
      const wide = url.pathname.includes("wide");
      const w = wide ? 1280 : 390;
      const h = wide ? 720 : 844;
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#f5f0eb"/>
  <rect width="${w}" height="4" fill="#b45309"/>
  <text x="${w / 2}" y="${h * 0.15}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${wide ? 36 : 24}" font-weight="700" fill="#1c1917">Museumsufer Frankfurt</text>
  <text x="${w / 2}" y="${h * 0.15 + (wide ? 30 : 22)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${wide ? 16 : 13}" fill="#78716c">Ausstellungen &amp; Veranstaltungen</text>
  <rect x="${w * 0.08}" y="${h * 0.28}" width="${w * 0.84}" height="${wide ? 36 : 32}" rx="18" fill="white" stroke="#e7e5e4" stroke-width="1.5"/>
  <text x="${w * 0.15}" y="${h * 0.28 + (wide ? 23 : 21)}" font-family="system-ui,sans-serif" font-size="${wide ? 14 : 12}" fill="#a8a29e">Museum, Ausstellung oder Veranstaltung suchen...</text>
  ${[0, 1, 2, 3].map((i) => `<rect x="${w * 0.08}" y="${h * 0.38 + i * (h * 0.13)}" width="${w * 0.84}" height="${h * 0.11}" rx="12" fill="white"/>`).join("\n  ")}
  <text x="${w * 0.13}" y="${h * 0.44}" font-family="system-ui,sans-serif" font-size="${wide ? 15 : 13}" font-weight="500" fill="#1c1917">Nacht der Museen</text>
  <text x="${w * 0.13}" y="${h * 0.44 + 18}" font-family="system-ui,sans-serif" font-size="${wide ? 12 : 11}" fill="#78716c">Städel Museum</text>
  <text x="${w * 0.13}" y="${h * 0.57}" font-family="system-ui,sans-serif" font-size="${wide ? 15 : 13}" font-weight="500" fill="#1c1917">Öffentliche Führung</text>
  <text x="${w * 0.13}" y="${h * 0.57 + 18}" font-family="system-ui,sans-serif" font-size="${wide ? 12 : 11}" fill="#78716c">Historisches Museum Frankfurt</text>
  <text x="${w / 2}" y="${h * 0.95}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#b45309">museumsufer.app</text>
</svg>`,
        { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" } },
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
            { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
            { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
            { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
          ],
          screenshots: [
            {
              src: "/screenshot-wide.svg",
              sizes: "1280x720",
              type: "image/svg+xml",
              form_factor: "wide",
              label: "Museumsufer Frankfurt",
            },
            { src: "/screenshot-mobile.svg", sizes: "390x844", type: "image/svg+xml", label: "Museumsufer Frankfurt" },
          ],
        }),
        {
          headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
        },
      );
    }

    if (url.pathname === "/icon.svg" || url.pathname === "/icon-192.svg" || url.pathname === "/icon-512.svg") {
      const s = url.pathname.includes("512") ? 512 : url.pathname.includes("192") ? 192 : 100;
      const r = Math.round(s * 0.15);
      const cx = s / 2;
      const top = s * 0.25;
      const bot = s * 0.78;
      const colW = s * 0.06;
      const colGap = s * 0.12;
      const cols = [-1.5, -0.5, 0.5, 1.5].map((i) => cx + i * colGap);
      const roofY = top - s * 0.02;
      const baseY = bot + s * 0.02;
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${r}" fill="#f5f0eb"/>
  <rect width="${s}" height="${Math.round(s * 0.02)}" fill="#b45309"/>
  <polygon points="${cx},${top * 0.6} ${cx - s * 0.3},${roofY} ${cx + s * 0.3},${roofY}" fill="#b45309"/>
  <rect x="${cx - s * 0.3}" y="${roofY}" width="${s * 0.6}" height="${s * 0.04}" fill="#b45309"/>
  ${cols.map((x) => `<rect x="${x - colW / 2}" y="${top}" width="${colW}" height="${bot - top}" rx="${colW * 0.2}" fill="#b45309"/>`).join("\n  ")}
  <rect x="${cx - s * 0.32}" y="${baseY}" width="${s * 0.64}" height="${s * 0.04}" fill="#b45309"/>
  <rect x="${cx - s * 0.28}" y="${baseY + s * 0.05}" width="${s * 0.56}" height="${s * 0.03}" fill="#b45309"/>
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
