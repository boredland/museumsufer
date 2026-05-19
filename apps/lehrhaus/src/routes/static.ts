import { buildApiCatalog, buildManifest, buildRobotsTxt, dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { SCRAPE_DATA } from "../scrape-data";

const SOURCES = SCRAPE_DATA.sources;

import { CATEGORIES, type Env } from "../types";

const APP_URL = "https://frankfurt.lehr.salon";
const REPO_URL = "https://github.com/boredland/museumsufer";

const MANIFEST = buildManifest({
  name: "lehr.salon",
  shortName: "lehr.salon",
  description:
    "Öffentliche Vorträge, Lesungen und Diskussionen in Frankfurt — täglich aktualisiert aus Universität, Akademien, Stiftungen und Salons.",
  themeColor: "#F2E9D5",
  backgroundColor: "#F2E9D5",
  lang: "de",
  icons: [
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  screenshots: [
    { src: "/ss-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "lehr.salon" },
    { src: "/ss-mobile.png", sizes: "390x844", type: "image/png", label: "lehr.salon" },
  ],
});

const LLMS_TXT = `# lehr.salon

> Öffentliche Vorträge, Lesungen und Diskussionen in Frankfurt — aggregiert aus ${SOURCES.length} Quellen: Polytechnische Gesellschaft, Haus am Dom, Jüdische Gemeinde, FGZ StreitClub, Literaturhaus, Bürgeruniversität, Institut für Sozialforschung, Evangelische Akademie, Sigmund-Freud-Institut, Denkbar, Romanfabrik, DIG Frankfurt, OPEN BOOKS und mehr.

Source: ${REPO_URL}
License: Application code MIT. Event data aggregated from public sources.

## API

Base URL: ${APP_URL}

### Events

GET /api/day?date=YYYY-MM-DD&source={slug}&format={Vortrag|Diskussion|Lesung}
Returns { date, count, events } for one day. Date defaults to today (Europe/Berlin).

GET /api/events?date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD&source={slug}&format={Vortrag|Diskussion|Lesung}
Returns events with title, description, date, time, source, category, language, detail_url.

GET /api/events/{id}
Single event by stable FNV-1a hash ID.

### Sources

GET /api/sources
Directory of all sources (lecture-hosting institutions in Frankfurt).

### Calendar feeds

GET /feed.ics — next 14 days, all sources
GET /quelle/{slug}/feed.ics — single source
GET /format/{slug}/feed.ics — single format (Vortrag / Diskussion / Lesung)

## Notes

- Content is in German. Dates: ISO 8601 (YYYY-MM-DD); times: HH:MM Europe/Berlin.
- Formats: Vortrag (monologic lecture), Diskussion (panel/debate), Lesung (literary reading / book launch).
- Data refreshes multiple times daily via a GitHub Action.
`;

const API_CATALOG = buildApiCatalog({ apiBase: APP_URL });
const ROBOTS_TXT = buildRobotsTxt({
  siteUrl: APP_URL,
  disallow: ["/api/day", "/api/events", "/api/sources", "/api/formats"],
});

const app = new Hono<{ Bindings: Env }>();

app.get("/.well-known/api-catalog", (c) =>
  c.body(API_CATALOG, {
    headers: { "Content-Type": "application/linkset+json", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/robots.txt", (c) => c.text(ROBOTS_TXT, { headers: { "Cache-Control": "public, max-age=86400" } }));

// Most upstream lecture programmes publish a rolling ~2-week
// schedule. Stamping 60 days risks thin-content empty future pages.
const SITEMAP_DATE_DAYS = 14;

app.get("/sitemap.xml", (c) => {
  const today = todayIso();
  const sourceUrls = SOURCES.slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((s) => `  <url>\n    <loc>${APP_URL}/quelle/${s.slug}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  const formatUrls = CATEGORIES.map(
    (c) => `  <url>\n    <loc>${APP_URL}/format/${c}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`,
  ).join("\n");
  // Per-URL lastmod = the date itself, not mass-stamped today.
  const dateUrls = Array.from({ length: SITEMAP_DATE_DAYS }, (_, i) => dateOffset(i))
    .map((d) => `  <url>\n    <loc>${APP_URL}/tag/${d}</loc>\n    <lastmod>${d}</lastmod>\n  </url>`)
    .join("\n");

  // /api/docs dropped (developer reference, no organic intent).
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${APP_URL}/</loc>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${APP_URL}/impressum</loc>
    <lastmod>${today}</lastmod>
  </url>
${dateUrls}
${sourceUrls}
${formatUrls}
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
