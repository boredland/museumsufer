import { buildApiCatalog, buildManifest, buildRobotsTxt } from "@museumsufer/core";
import { Hono } from "hono";
import { todayIso } from "../date";
import { MUSEUMS } from "../museum-config";
import { SERVICE_WORKER_JS } from "../service-worker";
import type { Env } from "../types";

const SITE_URL = "https://museumsufer.app";

const OG_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f0eb"/>
  <g transform="translate(180, 175)">
    <circle cx="40" cy="14" r="14" fill="#b45309"/>
    <path d="M 40 42 L 100 110 L -20 110 Z" fill="#1f3a52"/>
    <rect x="-32" y="124" width="144" height="22" fill="#1f3a52"/>
  </g>
  <text x="380" y="265" font-family="system-ui,sans-serif" font-size="84" font-weight="700" fill="#1c1917" letter-spacing="-3">Museumsufer</text>
  <text x="380" y="340" font-family="system-ui,sans-serif" font-size="84" font-weight="300" fill="#1f3a52" letter-spacing="-3">Frankfurt</text>
  <rect x="380" y="380" width="120" height="6" fill="#b45309"/>
  <text x="380" y="430" font-family="system-ui,sans-serif" font-size="28" fill="#57534e">Ausstellungen und Veranstaltungen</text>
  <text x="380" y="468" font-family="system-ui,sans-serif" font-size="28" fill="#57534e">am Frankfurter Museumsufer</text>
  <text x="380" y="555" font-family="system-ui,sans-serif" font-size="22" font-weight="600" fill="#b45309" letter-spacing="2">MUSEUMSUFER.APP</text>
</svg>`;

const MANIFEST = buildManifest({
  name: "Museumsufer Frankfurt",
  shortName: "Museumsufer",
  description: "Ausstellungen & Veranstaltungen am Frankfurter Museumsufer",
  themeColor: "#f5f0eb",
  backgroundColor: "#f5f0eb",
  screenshots: [
    { src: "/ss-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Museumsufer Frankfurt" },
    { src: "/ss-mobile.png", sizes: "390x844", type: "image/png", label: "Museumsufer Frankfurt" },
  ],
});

const LLMS_TXT = `# Museumsufer Frankfurt

> Aggregated exhibitions and events from ~40 museums along Frankfurt's Museumsufer (Museum Embankment).

Contact: feedback@ins.museum
License: Content aggregated from public museum sources. Application code: MIT (github.com/boredland/museumsufer/tree/main/apps/frankfurt-museums)
Source: https://github.com/boredland/museumsufer/tree/main/apps/frankfurt-museums

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
- Data refreshes daily at 06:00 UTC via a GitHub Action that regenerates the bundled scrape data and redeploys the worker
- Translations available via ?lang=en or ?lang=fr query parameter on the API
`;

const API_CATALOG = buildApiCatalog({ apiBase: SITE_URL });
const ROBOTS_TXT = buildRobotsTxt({ siteUrl: SITE_URL });

const app = new Hono<{ Bindings: Env }>();

app.get("/.well-known/api-catalog", (c) =>
  c.body(API_CATALOG, {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=86400",
    },
  }),
);

app.get("/og-image.svg", (c) =>
  c.body(OG_IMAGE, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" } }),
);

app.get("/robots.txt", (c) => c.text(ROBOTS_TXT, { headers: { "Cache-Control": "public, max-age=86400" } }));

app.get("/sitemap.xml", (c) => {
  const today = todayIso();

  // Collect museum slugs to include in sitemap
  const museumSlugs = new Set<string>();
  const groupedSlugs = new Set<string>();

  for (const [slug, config] of Object.entries(MUSEUMS)) {
    if (config.hidden) continue;
    if (config.group) {
      groupedSlugs.add(slug);
    } else {
      museumSlugs.add(slug);
    }
  }

  // Add group slugs (mmk, jmf) instead of their child slugs
  if (groupedSlugs.size > 0) {
    for (const [slug] of Object.entries(MUSEUMS)) {
      if (!groupedSlugs.has(slug) && MUSEUMS[slug].group) {
        museumSlugs.add(MUSEUMS[slug].group!);
      }
    }
  }

  const museumUrls = Array.from(museumSlugs)
    .sort()
    .map(
      (slug) => `  <url>
    <loc>https://museumsufer.app/museum/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="de" href="https://museumsufer.app/museum/${slug}"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://museumsufer.app/museum/${slug}?lang=en"/>
    <xhtml:link rel="alternate" hreflang="fr" href="https://museumsufer.app/museum/${slug}?lang=fr"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://museumsufer.app/museum/${slug}"/>
  </url>`,
    )
    .join("\n");

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
${museumUrls}
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

app.get("/.well-known/*", (c) =>
  c.json({ error: "Not Found", path: new URL(c.req.url).pathname }, 404, {
    "Cache-Control": "public, max-age=3600",
  }),
);

export default app;
