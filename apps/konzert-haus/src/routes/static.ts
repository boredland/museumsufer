import {
  buildApiCatalog,
  buildManifest,
  buildRobotsTxt,
  cityScreenshots,
  cityUrl,
  coordServesCity,
  dateOffset,
  localizeCityText,
  todayIso,
} from "@museumsufer/core";
import { Hono } from "hono";
import { VENUES } from "../concert-config";
import { type Env, GENRES } from "../types";

const APP_URL = "https://frankfurt.konzert.haus";
const REPO_URL = "https://github.com/boredland/museumsufer";
const APEX = "konzert.haus";

/** Per-city canonical origin (frankfurt.konzert.haus / hamburg.konzert.haus). */
function appUrlFor(city: string): string {
  return cityUrl(APEX, city);
}

const MANIFEST_BASE_DESCRIPTION =
  "Konzerte in Frankfurt und Umgebung — Klassik, Jazz, Kammermusik, Kirchenmusik, Weltmusik, Neue Musik.";

const manifestCache = new Map<string, string>();
function manifestFor(city: string): string {
  const cached = manifestCache.get(city);
  if (cached) return cached;
  const manifest = buildManifest({
    name: "konzert.haus",
    shortName: "konzert.haus",
    // Manifest is German-only (lang: "de"); localize the city name accordingly.
    description: localizeCityText(MANIFEST_BASE_DESCRIPTION, city, "de"),
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
    screenshots: cityScreenshots({ city, label: "konzert.haus" }),
  });
  manifestCache.set(city, manifest);
  return manifest;
}

const llmsCache = new Map<string, string>();
function llmsFor(city: string): string {
  const cached = llmsCache.get(city);
  if (cached) return cached;
  const intro = localizeCityText(
    `Konzerte in Frankfurt und Umgebung — aggregierte Termine aus ${VENUES.length} Spielorten. Klassik, Jazz, Kammermusik, Kirchenmusik, Weltmusik und Neue Musik. Kein Pop, kein Rock.`,
    city,
    "de",
  );
  const txt = `# konzert.haus

> ${intro}

Source: ${REPO_URL}
License: Application code MIT. Event data aggregated from public venue sources.

## API

Base URL: ${appUrlFor(city)}

### Events

GET /api/day?date=YYYY-MM-DD&venue={slug}&genre={genre}&city={city}
Returns { date, count, events } for one day. Date defaults to today (Europe/Berlin).

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
  llmsCache.set(city, txt);
  return txt;
}

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

app.get("/.well-known/api-catalog", (c) =>
  c.body(buildApiCatalog({ apiBase: appUrlFor(c.get("city") ?? "frankfurt") }), {
    headers: { "Content-Type": "application/linkset+json", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/robots.txt", (c) =>
  c.text(
    buildRobotsTxt({
      siteUrl: appUrlFor(c.get("city") ?? "frankfurt"),
      // Block JSON endpoints from organic indexing -- developers reach
      // them via /api/docs, but Googlebot shouldn't index raw JSON.
      disallow: ["/api/day", "/api/events", "/api/venues", "/api/genres"],
    }),
    { headers: { "Cache-Control": "public, max-age=86400" } },
  ),
);

// Match the rolling window most upstream venue feeds publish. 60 days
// risked thin-content pages on empty future dates; 14 matches the
// realistic schedule horizon for most concert houses.
const SITEMAP_DATE_DAYS = 14;

app.get("/sitemap.xml", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const appUrl = appUrlFor(city);
  const today = todayIso();
  const venueUrls = VENUES.filter((v) => coordServesCity(v.lat, v.lon, city))
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((v) => `  <url>\n    <loc>${appUrl}/spielort/${v.slug}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  const genreUrls = GENRES.map(
    (g) => `  <url>\n    <loc>${appUrl}/genre/${g}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`,
  ).join("\n");
  // Per-URL lastmod = the date itself; mass-stamping `today` is the
  // antipattern Google ignores.
  const dateUrls = Array.from({ length: SITEMAP_DATE_DAYS }, (_, i) => dateOffset(i))
    .map((d) => `  <url>\n    <loc>${appUrl}/tag/${d}</loc>\n    <lastmod>${d}</lastmod>\n  </url>`)
    .join("\n");

  // /api/docs is the developer reference UI -- intentionally excluded
  // (no organic intent; would waste crawl budget).
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${appUrl}/</loc>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${appUrl}/impressum</loc>
    <lastmod>${today}</lastmod>
  </url>
${dateUrls}
${venueUrls}
${genreUrls}
</urlset>`;
  return c.body(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } });
});

app.get("/manifest.json", (c) =>
  c.body(manifestFor(c.get("city") ?? "frankfurt"), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/llms.txt", (c) =>
  c.body(llmsFor(c.get("city") ?? "frankfurt"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/.well-known/llms.txt", (c) =>
  c.body(llmsFor(c.get("city") ?? "frankfurt"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  }),
);

export default app;
export { APP_URL, REPO_URL };
