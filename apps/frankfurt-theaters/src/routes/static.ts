import {
  buildApiCatalog,
  buildManifest,
  buildRobotsTxt,
  cityAdj,
  cityMeta,
  cityName,
  cityUrl,
  todayIso,
} from "@museumsufer/core";
import { Hono } from "hono";
import { THEATERS } from "../theater-config";
import type { Env } from "../types";

const APEX = "ins.theater";
const APP_URL = "https://frankfurt.ins.theater";
const REPO_URL = "https://github.com/boredland/museumsufer";

/** Per-city canonical origin (frankfurt.ins.theater / hamburg.ins.theater). */
function appUrlFor(city: string): string {
  return cityUrl(APEX, city);
}

const manifestCache = new Map<string, string>();
function manifestFor(city: string): string {
  const cached = manifestCache.get(city);
  if (cached) return cached;
  const brand = `${cityMeta(city).short} Theater`;
  const manifest = buildManifest({
    name: brand,
    shortName: cityMeta(city).short === "Frankfurt" ? "FT" : "HT",
    description: `Spielplan der ${cityAdj(city, "de")} Bühnen — kuratiert nach Tag.`,
    themeColor: "#F4EFE2",
    backgroundColor: "#F4EFE2",
    lang: "de",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/ss-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: brand },
      { src: "/ss-mobile.png", sizes: "390x844", type: "image/png", label: brand },
    ],
  });
  manifestCache.set(city, manifest);
  return manifest;
}

const llmsCache = new Map<string, string>();
function llmsFor(city: string): string {
  const cached = llmsCache.get(city);
  if (cached) return cached;
  const brand = `${cityMeta(city).short} Theater`;
  const cityFull = cityName(city, "de", "full");
  const appUrl = appUrlFor(city);
  const count = THEATERS.filter((t) => (t.city ?? "frankfurt") === city).length;
  const txt = `# ${brand}

> Spielplan der ${cityAdj(city, "de")} Bühnen — aggregierte Vorstellungen, Karten und Verfügbarkeiten von ${count} Häusern in ${cityFull}, kuratiert nach Tag.

Source: ${REPO_URL}
License: Application code MIT. Performance data aggregated from public theater sources.

This site provides a JSON API for querying theater performances in ${cityFull}, Germany.

## API

Base URL: ${appUrl}

### Day overview

GET /api/day?date=YYYY-MM-DD
Returns: { date, performances[] } — every performance scheduled on that date with show, theater, time, venue_room, status (available|sold_out|cancelled), price_min, price_max, ticket_url.

### Theaters

GET /api/theaters
Returns the directory of theaters (slug, name, address, lat, lon, website_url).

GET /api/theater/{slug}
Returns one theater plus its upcoming performances (next 60 days).

### Performances

GET /api/performances?from=YYYY-MM-DD&to=YYYY-MM-DD&theater={slug}
Paginated performance listing. \`from\`/\`to\` default to today / today+14, max range 60 days.

GET /api/performance/{id}
Single performance + its show + its theater.

### Calendar feeds

GET /feed.ics — next 14 days, all theaters
GET /theater/{slug}/feed.ics — single theater
GET /event/{id}/feed.ics — single performance

## Optional

- API documentation: ${appUrl}/api/docs
- OpenAPI spec: ${appUrl}/api/docs/openapi.json
- Source: ${REPO_URL}

## Notes

- Content (show titles, subtitles) is in German
- Dates use ISO 8601 (YYYY-MM-DD); times are 24h HH:MM in Europe/Berlin
- Performances list horizon: from today to ~60 days out
- Data refreshes hourly between 09:00 and 21:00 Europe/Berlin via a GitHub Action that regenerates the bundled scrape data and redeploys the worker
- Sold-out performances expose status="sold_out" with no price; cancelled performances expose status="cancelled"
`;
  llmsCache.set(city, txt);
  return txt;
}

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

app.get("/.well-known/api-catalog", (c) =>
  c.body(buildApiCatalog({ apiBase: appUrlFor(c.get("city") ?? "frankfurt") }), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=86400",
    },
  }),
);

app.get("/robots.txt", (c) =>
  c.text(
    buildRobotsTxt({
      siteUrl: appUrlFor(c.get("city") ?? "frankfurt"),
      // /api/performance/<id> is referenced from TheaterEvent.url ONLY for
      // historical compatibility -- the schema now points at the
      // canonical /theater/<slug> page. Keep the JSON endpoint disallowed
      // so Googlebot doesn't follow + index raw JSON.
      disallow: ["/api/day", "/api/events", "/api/theaters", "/api/performance"],
    }),
    { headers: { "Cache-Control": "public, max-age=86400" } },
  ),
);

app.get("/sitemap.xml", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const appUrl = appUrlFor(city);
  const today = todayIso();
  const theaterUrls = THEATERS.filter((t) => (t.city ?? "frankfurt") === city)
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(
      (t) => `  <url>
    <loc>${appUrl}/theater/${t.slug}</loc>
    <lastmod>${today}</lastmod>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${appUrl}/</loc>
    <lastmod>${today}</lastmod>
  </url>
${theaterUrls}
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
