import { buildApiCatalog, buildManifest, buildRobotsTxt, dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { CINEMAS } from "../cinema-config";
import { getAllSeries, getScreeningsInRange } from "../db";
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

function buildLlmsTxt(): string {
  const today = todayIso();
  const series = getAllSeries(today);
  const cinemaLines = CINEMAS.slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((c) => `- ${c.slug}: ${c.name}`)
    .join("\n");
  const seriesLines = series.map((s) => `- ${s.slug}: ${s.name}`).join("\n");
  return `# lichtspiel.haus

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

## Cinemas

${cinemaLines}

## Current film series

${seriesLines || "(none active)"}

## Notes

- Content is in German (English available via ?lang=en). Dates: ISO 8601 (YYYY-MM-DD); times: HH:MM Europe/Berlin.
- Versions: OmU = original w/ German subtitles, OmeU = original w/ English subtitles, DF = German-dubbed, OV = original, stumm = silent.
- Data refreshes multiple times daily via a GitHub Action.
`;
}

const API_CATALOG = buildApiCatalog({ apiBase: APP_URL });
const ROBOTS_TXT = buildRobotsTxt({ siteUrl: APP_URL });

const app = new Hono<{ Bindings: Env }>();

app.get("/.well-known/api-catalog", (c) =>
  c.body(API_CATALOG, {
    headers: { "Content-Type": "application/linkset+json", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/robots.txt", (c) => c.text(ROBOTS_TXT, { headers: { "Cache-Control": "public, max-age=86400" } }));

// Window for date pages -- 14 days, matching the rolling window most
// upstream cinema schedules publish. Beyond that the /tag/:date pages
// risk being empty templates; the sitemap audit flagged this as
// thin-content if we stamped 60 days unconditionally.
const SITEMAP_DATE_DAYS = 14;

app.get("/sitemap.xml", (c) => {
  const today = todayIso();
  const cinemaUrls = CINEMAS.slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((v) => `  <url>\n    <loc>${APP_URL}/kino/${v.slug}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  const seriesUrls = getAllSeries(today)
    .map((s) => `  <url>\n    <loc>${APP_URL}/reihe/${s.slug}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  const dateUrls = Array.from({ length: SITEMAP_DATE_DAYS }, (_, i) => dateOffset(i))
    // Each /tag/:date page's lastmod IS the date itself -- by the time
    // the day arrives the data is settled, before then the page may
    // still be backfilled. Stamping `today` everywhere would be the
    // mass-stamping antipattern Google ignores.
    .map((d) => `  <url>\n    <loc>${APP_URL}/tag/${d}</loc>\n    <lastmod>${d}</lastmod>\n  </url>`)
    .join("\n");

  // /film/:id pages -- highest-intent landing pages. Cap to the same
  // 14-day window so the sitemap stays bounded; older screenings have
  // already happened and don't need indexing.
  const horizon = dateOffset(SITEMAP_DATE_DAYS);
  const filmUrls = getScreeningsInRange(today, horizon)
    .map((s) => `  <url>\n    <loc>${APP_URL}/film/${s.id}</loc>\n    <lastmod>${s.date}</lastmod>\n  </url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${APP_URL}/</loc>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${APP_URL}/kinos</loc>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${APP_URL}/reihe</loc>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${APP_URL}/impressum</loc>
    <lastmod>${today}</lastmod>
  </url>
${dateUrls}
${cinemaUrls}
${seriesUrls}
${filmUrls}
</urlset>`;
  return c.body(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } });
});

app.get("/manifest.json", (c) =>
  c.body(MANIFEST, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/llms.txt", (c) =>
  c.body(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/.well-known/llms.txt", (c) =>
  c.body(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  }),
);

export default app;
export { APP_URL, REPO_URL };
