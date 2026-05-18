import { buildApiCatalog, buildManifest, buildRobotsTxt, dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { CINEMAS } from "../cinema-config";
import { getAllSeries } from "../db";
import type { Env } from "../types";

const APP_URL = "https://frankfurt.lichtspiel.haus";
const REPO_URL = "https://github.com/boredland/museumsufer";

const MANIFEST = buildManifest({
  name: "lichtspiel.haus",
  shortName: "lichtspiel.haus",
  description: "Kinoprogramm in Frankfurt und Umgebung — Arthouse, Programmkino, Repertoire, Filmreihen, Festivals.",
  themeColor: "#0E0B07",
  backgroundColor: "#0E0B07",
  lang: "de",
  icons: [
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  screenshots: [
    { src: "/ss-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "lichtspiel.haus" },
    { src: "/ss-mobile.png", sizes: "390x844", type: "image/png", label: "lichtspiel.haus" },
  ],
});

const LLMS_TXT = `# lichtspiel.haus

> Kinoprogramm in Frankfurt und Umgebung — aggregierte Vorstellungen aus ${CINEMAS.length} Spielstätten. Arthouse, Programmkino, Repertoire, Filmreihen, Festivals.

Source: ${REPO_URL}
License: Application code MIT. Screening data aggregated from public cinema sources.

## API

Base URL: ${APP_URL}

### Screenings

GET /api/day?date=YYYY-MM-DD&cinema={slug}&series={slug}&city={city}
Returns { date, count, screenings } for one day. Date defaults to today (Europe/Berlin).

GET /api/screenings?date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD&cinema={slug}&series={slug}&city={city}
Returns screenings with title, subtitle, credits, date, time, cinema, venue_room, version (OmU/OmeU/DF/OV/stumm), format (35mm/DCP/16mm/70mm), language, series, price, ticket_url.

GET /api/screenings/{id}
Single screening by stable FNV-1a hash ID.

### Cinemas

GET /api/cinemas
Directory of all cinemas with coordinates and websites.

### Series

GET /api/series
All active film series (Nippon Connection, retrospectives, etc.).

GET /api/series/{slug}
Single series with all upcoming screenings.

### Calendar feeds

GET /feed.ics — next 14 days, all cinemas
GET /kino/{slug}/feed.ics — single cinema
GET /reihe/{slug}/feed.ics — single film series
GET /film/{id}/feed.ics — single screening

## Notes

- Content is in German (English available via ?lang=en). Dates: ISO 8601 (YYYY-MM-DD); times: HH:MM Europe/Berlin.
- Versions: OmU = original w/ German subtitles, OmeU = original w/ English subtitles, DF = German-dubbed, OV = original, stumm = silent.
- Data refreshes multiple times daily via a GitHub Action.
`;

const API_CATALOG = buildApiCatalog({ apiBase: APP_URL });
const ROBOTS_TXT = buildRobotsTxt({ siteUrl: APP_URL });

const app = new Hono<{ Bindings: Env }>();

app.get("/.well-known/api-catalog", (c) =>
  c.body(API_CATALOG, {
    headers: { "Content-Type": "application/linkset+json", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/robots.txt", (c) => c.text(ROBOTS_TXT, { headers: { "Cache-Control": "public, max-age=86400" } }));

app.get("/sitemap.xml", (c) => {
  const today = todayIso();
  const cinemaUrls = CINEMAS.slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(
      (v) => `  <url>
    <loc>${APP_URL}/kino/${v.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    )
    .join("\n");
  const seriesUrls = getAllSeries(today)
    .map(
      (s) => `  <url>
    <loc>${APP_URL}/reihe/${s.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
    )
    .join("\n");
  const dateUrls = Array.from({ length: 60 }, (_, i) => dateOffset(i))
    .map(
      (d) => `  <url>
    <loc>${APP_URL}/tag/${d}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${APP_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${APP_URL}/api/docs</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>${APP_URL}/impressum</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
${dateUrls}
${cinemaUrls}
${seriesUrls}
</urlset>`;
  return c.body(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } });
});

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
export { APP_URL, REPO_URL };
