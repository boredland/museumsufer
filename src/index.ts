import { Env } from "./types";
import { handleApi, handleFeeds } from "./api";
import { scrape } from "./scraper";
import { scrapeMuseumWebsites } from "./event-scraper";
import { renderPage } from "./frontend";
import { detectLocale } from "./i18n";

const LLMS_TXT = `# Museumsufer Frankfurt

> Aggregated exhibitions and events from ~40 museums along Frankfurt's Museumsufer (Museum Embankment).

This site provides a JSON API for querying museum exhibitions and events in Frankfurt am Main, Germany.

## API

Base URL: https://museumsufer.jonas-strassel.de

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

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
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

    if (url.pathname === "/manifest.json") {
      return new Response(JSON.stringify({
        name: "Museumsufer Frankfurt",
        short_name: "Museumsufer",
        start_url: "/",
        display: "standalone",
        background_color: "#f5f0eb",
        theme_color: "#f5f0eb",
        icons: [{
          src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛️</text></svg>",
          sizes: "any",
          type: "image/svg+xml",
        }],
      }), {
        headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
      });
    }

    const feedResponse = await handleFeeds(request, env);
    if (feedResponse) return feedResponse;

    if (url.pathname === "/llms.txt" || url.pathname === "/.well-known/llms.txt") {
      return new Response(LLMS_TXT, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
      });
    }

    const locale = detectLocale(request);
    return new Response(renderPage(locale), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Language": locale,
        "Vary": "Accept-Language",
      },
    });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      scrape(env).then(() => scrapeMuseumWebsites(env))
    );
  },
} satisfies ExportedHandler<Env>;
