import { buildApiCatalog, buildManifest, buildRobotsTxt, dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { VENUES } from "../concert-config";
import { type Env, GENRES } from "../types";

const APP_URL = "https://frankfurt.konzert.haus";
const REPO_URL = "https://github.com/boredland/museumsufer";

const MANIFEST = buildManifest({
  name: "konzert.haus",
  shortName: "konzert.haus",
  description: "Konzerte in Frankfurt und Umgebung — Klassik, Jazz, Kammermusik, Kirchenmusik, Weltmusik, Neue Musik.",
  themeColor: "#F7F0E7",
  backgroundColor: "#F7F0E7",
  lang: "de",
  icons: [
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
});

const LLMS_TXT = `# konzert.haus

> Konzerte in Frankfurt und Umgebung — aggregierte Termine aus ${VENUES.length} Spielorten. Klassik, Jazz, Kammermusik, Kirchenmusik, Weltmusik und Neue Musik. Kein Pop, kein Rock.

Source: ${REPO_URL}
License: Application code MIT. Event data aggregated from public venue sources.

## API

Base URL: ${APP_URL}

### Events

GET /api/events?date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD&venue={slug}&genre={genre}&city={city}
Returns events with title, subtitle, performers, date, time, venue, venue_room, genre, price, ticket_url.

GET /api/events/{id}
Single event by stable FNV-1a hash ID.

### Venues

GET /api/venues
Directory of all venues.

### Calendar feeds

GET /feed.ics — next 14 days, all venues
GET /spielort/{slug}/feed.ics — single venue
GET /genre/{slug}/feed.ics — single genre

## Notes

- Content is in German. Dates: ISO 8601 (YYYY-MM-DD); times: HH:MM Europe/Berlin.
- Genres: classical, jazz, sacred, world, experimental, chamber.
- Data refreshes hourly via a GitHub Action.
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
  const venueUrls = VENUES.slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(
      (v) => `  <url>
    <loc>${APP_URL}/spielort/${v.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    )
    .join("\n");
  const genreUrls = GENRES.map(
    (g) => `  <url>
    <loc>${APP_URL}/genre/${g}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`,
  ).join("\n");
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
${venueUrls}
${genreUrls}
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
