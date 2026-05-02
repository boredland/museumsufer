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
  <g transform="translate(564, 475)">
    <rect x="-30" y="-25" width="60" height="60" rx="10" fill="#b45309"/>
    <g transform="scale(2.2) translate(-12,-14.5)" fill="white">
      <path d="M12 1L2 6v2h20V6L12 1zm0 2.26L18.47 6H5.53L12 3.26zM2 17v2h20v-2H2zm2-7v7h2v-7H6zm4 0v7h2v-7h-2zm4 0v7h2v-7h-2zm4 0v7h2v-7h-2z"/>
    </g>
    <path d="M-26,27 Q-16,23 -6,27 Q4,31 14,27 Q20,24.5 26,27" fill="none" stroke="#93c5fd" stroke-width="3.3" stroke-linecap="round"/>
  </g>
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
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
  screenshots: [
    { src: "/ss-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Museumsufer Frankfurt" },
    { src: "/ss-mobile.png", sizes: "390x844", type: "image/png", label: "Museumsufer Frankfurt" },
  ],
});

const LLMS_TXT = `# Museumsufer Frankfurt

> Aggregated exhibitions and events from ~40 museums along Frankfurt's Museumsufer (Museum Embankment).

Contact: info@jonas-strassel.de
License: Content aggregated from public museum sources. Application code: MIT (github.com/boredland/museumsufer)
Source: https://github.com/boredland/museumsufer

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

## Optional

- API documentation: https://museumsufer.app/api/docs
- RSS feed (next 7 days): https://museumsufer.app/feed.xml
- Calendar feed (ICS): https://museumsufer.app/feed.ics
- OpenAPI spec: https://museumsufer.app/api/docs/openapi.json

## Notes

- Event content (titles, descriptions) is in German
- Dates use ISO 8601 format (YYYY-MM-DD)
- Times are in 24h format (HH:MM), timezone Europe/Berlin
- Events are available for the next 7 days with the most detail (images, prices, deep links)
- Exhibitions are available for any date (they span weeks/months)
- Data is refreshed daily at 6am UTC
- Translations available via ?lang=en or ?lang=fr query parameter on the API
`;

const app = new Hono<{ Bindings: Env }>();

app.get("/og-image.svg", (c) =>
  c.body(OG_IMAGE, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" } }),
);

app.get("/robots.txt", (c) =>
  c.text(
    [
      "User-agent: GPTBot",
      "Allow: /",
      "",
      "User-agent: OAI-SearchBot",
      "Allow: /",
      "",
      "User-agent: ChatGPT-User",
      "Allow: /",
      "",
      "User-agent: ClaudeBot",
      "Allow: /",
      "",
      "User-agent: PerplexityBot",
      "Allow: /",
      "",
      "User-agent: *",
      "Allow: /",
      "",
      "Sitemap: https://museumsufer.app/sitemap.xml",
      "",
    ].join("\n"),
    { headers: { "Cache-Control": "public, max-age=86400" } },
  ),
);

app.get("/sitemap.xml", (c) => {
  const today = todayIso();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://museumsufer.app/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="de" href="https://museumsufer.app/"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://museumsufer.app/?lang=en"/>
    <xhtml:link rel="alternate" hreflang="fr" href="https://museumsufer.app/?lang=fr"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://museumsufer.app/"/>
  </url>
  <url>
    <loc>https://museumsufer.app/?lang=en</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <xhtml:link rel="alternate" hreflang="de" href="https://museumsufer.app/"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://museumsufer.app/?lang=en"/>
    <xhtml:link rel="alternate" hreflang="fr" href="https://museumsufer.app/?lang=fr"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://museumsufer.app/"/>
  </url>
  <url>
    <loc>https://museumsufer.app/?lang=fr</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <xhtml:link rel="alternate" hreflang="de" href="https://museumsufer.app/"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://museumsufer.app/?lang=en"/>
    <xhtml:link rel="alternate" hreflang="fr" href="https://museumsufer.app/?lang=fr"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://museumsufer.app/"/>
  </url>
  <url>
    <loc>https://museumsufer.app/impressum</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
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
