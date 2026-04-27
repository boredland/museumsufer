import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { fetchDayData, getMuseumMap, handleApi, handleFeeds } from "./api";
import { ContentBody } from "./components";
import { todayIso } from "./date";
import { scrapeMuseumWebsites } from "./event-scraper";
import { scrapeMuseumExhibitions } from "./exhibition-scraper";
import { type InitialData, renderPage } from "./frontend";
import { dateLocale, detectLocale, getTranslations, type Locale } from "./i18n";
import { handleImageProxy } from "./image-proxy";
import { scrape } from "./scraper";
import { SERVICE_WORKER_JS } from "./service-worker";
import { formatDateFull } from "./shared";
import { translateEvents } from "./translate";
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

const OG_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f0eb"/>
  <rect x="0" y="0" width="1200" height="6" fill="#b45309"/>
  <text x="600" y="260" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" font-weight="700" fill="#1c1917" letter-spacing="-2">Museumsufer Frankfurt</text>
  <text x="600" y="330" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" fill="#78716c">Ausstellungen &amp; Veranstaltungen</text>
  <text x="600" y="400" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" fill="#b45309">museumsufer.app</text>
  <path d="M564 470 L554 475v2h20V475L564 470zm0 2.26L570.47 475H557.53L564 472.26zM554 487v2h20v-2H554zm2-8v8h2v-8h-2zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2z" fill="#b45309"/>
</svg>`;

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://museumsufer.app/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://museumsufer.app/?lang=de</loc><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/?lang=en</loc><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/?lang=fr</loc><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/feed.xml</loc><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/feed.ics</loc><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/llms.txt</loc><changefreq>weekly</changefreq></url>
</urlset>`;

const MANIFEST = JSON.stringify({
  id: "/",
  name: "Museumsufer Frankfurt",
  short_name: "Museumsufer",
  description: "Ausstellungen & Veranstaltungen am Frankfurter Museumsufer",
  start_url: "/",
  display: "standalone",
  background_color: "#f5f0eb",
  theme_color: "#f5f0eb",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
  screenshots: [
    { src: "/ss-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Museumsufer Frankfurt" },
    { src: "/ss-mobile.png", sizes: "390x844", type: "image/png", label: "Museumsufer Frankfurt" },
  ],
});

const app = new Hono<{ Bindings: Env }>();

app.get("/og-image.svg", (c) =>
  c.body(OG_IMAGE, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" } }),
);

app.get("/robots.txt", (c) =>
  c.text(`User-agent: *\nAllow: /\n\nSitemap: https://museumsufer.app/sitemap.xml\n`, {
    headers: { "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/sitemap.xml", (c) =>
  c.body(SITEMAP, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } }),
);

app.get("/sw.js", (c) =>
  c.body(SERVICE_WORKER_JS, {
    headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache" },
  }),
);

app.get("/manifest.json", (c) =>
  c.body(MANIFEST, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/llms.txt", (c) =>
  c.body(LLMS_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/.well-known/llms.txt", (c) =>
  c.body(LLMS_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/img/*", async (c) => {
  const response = await handleImageProxy(c.req.raw, c.env);
  if (response) return response;
  return c.notFound();
});

app.all("/api/*", (c) => {
  const locale = detectLocale(c.req.raw);
  return handleApi(c.req.raw, c.env, locale);
});

const scrapeAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!c.env.SCRAPE_SECRET) return next();
  const auth = c.req.header("Authorization");
  if (auth === `Bearer ${c.env.SCRAPE_SECRET}`) return next();
  return c.json({ error: "unauthorized" }, 401);
});

app.post("/scrape", scrapeAuth, async (c) => c.json(await scrape(c.env)));
app.post("/scrape/exhibitions", scrapeAuth, async (c) => c.json(await scrapeMuseumExhibitions(c.env)));
app.post("/scrape/events", scrapeAuth, async (c) => c.json(await scrapeMuseumWebsites(c.env)));
app.post("/scrape/translate", scrapeAuth, async (c) => c.json(await translateEvents(c.env)));

app.get("/feed.xml", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

app.get("/rss.xml", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

app.get("/feed.ics", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

app.get("/calendar.ics", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

app.get("/partial/content", async (c) => {
  const langParam = c.req.query("lang");
  const locale = (langParam && ["de", "en", "fr"].includes(langParam) ? langParam : detectLocale(c.req.raw)) as Locale;
  const dateParam = c.req.query("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayIso();
  const data = await fetchDayData(c.env, date, locale);
  const tr = getTranslations(locale);

  const html = (
    <>
      <ContentBody events={data.events} exhibitions={data.exhibitions} tr={tr} locale={locale} todayIso={todayIso()} />
      <script type="application/json" id="partial-data" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
    </>
  );

  return c.html(html, {
    headers: {
      "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600",
      "X-Date-Label": formatDateFull(date, dateLocale(locale)),
    },
  });
});

app.get("*", async (c) => {
  const locale = detectLocale(c.req.raw);
  const urlDate = c.req.query("date");
  const date = urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : todayIso();
  let initialData: InitialData | undefined;
  const museums = await getMuseumMap(c.env).catch(() => ({}));
  try {
    initialData = await fetchDayData(c.env, date, locale);
  } catch (e) {
    console.error("Failed to fetch initial data:", e);
  }

  return c.html(renderPage(locale, initialData, museums), {
    headers: {
      "Content-Language": locale,
      Vary: "Accept-Language",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
});

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      scrape(env)
        .catch((e) => console.error("scrape failed:", e))
        .then(() => scrapeMuseumExhibitions(env))
        .catch((e) => console.error("exhibition scrape failed:", e))
        .then(() => scrapeMuseumWebsites(env))
        .catch((e) => console.error("event scrape failed:", e))
        .then(() => translateEvents(env))
        .catch((e) => console.error("translation failed:", e)),
    );
  },
} satisfies ExportedHandler<Env>;
