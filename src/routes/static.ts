import { Hono } from "hono";
import { todayIso } from "../date";
import { SERVICE_WORKER_JS } from "../service-worker";
import type { Env } from "../types";

const OG_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f0eb"/>
  <rect x="0" y="0" width="1200" height="6" fill="#b45309"/>
  <text x="600" y="260" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" font-weight="700" fill="#1c1917" letter-spacing="-2">Museumsufer Frankfurt</text>
  <text x="600" y="330" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" fill="#78716c">Ausstellungen &amp; Veranstaltungen</text>
  <text x="600" y="400" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" fill="#b45309">museumsufer.app</text>
  <path d="M564 470 L554 475v2h20V475L564 470zm0 2.26L570.47 475H557.53L564 472.26zM554 487v2h20v-2H554zm2-8v8h2v-8h-2zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2z" fill="#b45309"/>
</svg>`;

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

const app = new Hono<{ Bindings: Env }>();

app.get("/og-image.svg", (c) =>
  c.body(OG_IMAGE, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" } }),
);

app.get("/robots.txt", (c) =>
  c.text("User-agent: *\nAllow: /\n\nSitemap: https://museumsufer.app/sitemap.xml\n", {
    headers: { "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/sitemap.xml", (c) => {
  const today = todayIso();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://museumsufer.app/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://museumsufer.app/?lang=de</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/?lang=en</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/?lang=fr</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/feed.xml</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/feed.ics</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>
  <url><loc>https://museumsufer.app/llms.txt</loc><changefreq>weekly</changefreq></url>
</urlset>`;
  return c.body(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } });
});

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

export default app;
