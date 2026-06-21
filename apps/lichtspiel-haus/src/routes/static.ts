import {
  buildApiCatalog,
  buildManifest,
  buildRobotsTxt,
  cityHost,
  cityMeta,
  cityName,
  cityUrl,
  dateOffset,
  todayIso,
} from "@museumsufer/core";
import { Hono } from "hono";
import { CINEMAS } from "../cinema-config";
import { getAllSeries, getScreeningsInRange } from "../db";
import { getTranslations, localizeTranslations } from "../i18n";
import type { Env } from "../types";

const REPO_URL = "https://github.com/boredland/museumsufer";

const manifestCache = new Map<string, string>();
function manifestFor(city: string): string {
  const cached = manifestCache.get(city);
  if (cached) return cached;
  const tr = localizeTranslations(
    {
      homeDescription:
        "Kinoprogramm in Frankfurt und Umgebung — Arthouse, Programmkino, Repertoire, Filmreihen, Festivals.",
    } as any,
    city,
    "de",
  );
  const manifest = buildManifest({
    name: "lichtspiel.haus",
    shortName: "lichtspiel.haus",
    description: tr.homeDescription,
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
  manifestCache.set(city, manifest);
  return manifest;
}

const llmsCache = new Map<string, string>();
function llmsFor(city: string): string {
  const cached = llmsCache.get(city);
  if (cached) return cached;
  const appUrl = cityUrl("lichtspiel.haus", city);
  const tr = localizeTranslations(
    {
      homeDescription: `Kinoprogramm in Frankfurt und Umgebung — aggregierte Vorstellungen aus ${CINEMAS.length} Spielstätten. Arthouse, Programmkino, Repertoire, Filmreihen, Festivals.`,
    } as any,
    city,
    "de",
  );
  const today = todayIso();
  const series = getAllSeries(today);
  const cinemaLines = CINEMAS.slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((c) => `- ${c.slug}: ${c.name}`)
    .join("\n");
  const seriesLines = series.map((s) => `- ${s.slug}: ${s.name}`).join("\n");
  const txt = `# lichtspiel.haus

> ${tr.homeDescription}

Source: ${REPO_URL}
License: Application code MIT. Screening data aggregated from public cinema sources.

## API

Base URL: ${appUrl}

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
  llmsCache.set(city, txt);
  return txt;
}

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

app.get("/.well-known/api-catalog", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const appUrl = cityUrl("lichtspiel.haus", city);
  return c.body(buildApiCatalog({ apiBase: appUrl }), {
    headers: { "Content-Type": "application/linkset+json", "Cache-Control": "public, max-age=86400" },
  });
});

app.get("/robots.txt", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const appUrl = cityUrl("lichtspiel.haus", city);
  return c.text(buildRobotsTxt({ siteUrl: appUrl }), {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
});

// Window for date pages -- 14 days, matching the rolling window most
// upstream cinema schedules publish. Beyond that the /tag/:date pages
// risk being empty templates; the sitemap audit flagged this as
// thin-content if we stamped 60 days unconditionally.
const SITEMAP_DATE_DAYS = 14;

app.get("/sitemap.xml", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const appUrl = cityUrl("lichtspiel.haus", city);
  const today = todayIso();
  const cinemaUrls = CINEMAS.filter((v) => (v.city ?? "frankfurt") === city)
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((v) => `  <url>\n    <loc>${appUrl}/kino/${v.slug}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  const seriesUrls = getAllSeries(today, city)
    .map((s) => `  <url>\n    <loc>${appUrl}/reihe/${s.slug}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  const dateUrls = Array.from({ length: SITEMAP_DATE_DAYS }, (_, i) => dateOffset(i))
    // Each /tag/:date page's lastmod IS the date itself -- by the time
    // the day arrives the data is settled, before then the page may
    // still be backfilled. Stamping `today` everywhere would be the
    // mass-stamping antipattern Google ignores.
    .map((d) => `  <url>\n    <loc>${appUrl}/tag/${d}</loc>\n    <lastmod>${d}</lastmod>\n  </url>`)
    .join("\n");

  // /film/:id pages -- highest-intent landing pages. Cap to the same
  // 14-day window so the sitemap stays bounded; older screenings have
  // already happened and don't need indexing.
  const horizon = dateOffset(SITEMAP_DATE_DAYS);
  const filmUrls = getScreeningsInRange(today, horizon, { city })
    .map((s) => `  <url>\n    <loc>${appUrl}/film/${s.id}</loc>\n    <lastmod>${s.date}</lastmod>\n  </url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${appUrl}/</loc>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${appUrl}/kinos</loc>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${appUrl}/reihe</loc>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${appUrl}/impressum</loc>
    <lastmod>${today}</lastmod>
  </url>
${dateUrls}
${cinemaUrls}
${seriesUrls}
${filmUrls}
</urlset>`;
  return c.body(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } });
});

app.get("/manifest.json", (c) => {
  const city = c.get("city") ?? "frankfurt";
  return c.body(manifestFor(city), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
  });
});

app.get("/llms.txt", (c) => {
  const city = c.get("city") ?? "frankfurt";
  return c.body(llmsFor(city), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
});

app.get("/.well-known/llms.txt", (c) => {
  const city = c.get("city") ?? "frankfurt";
  return c.body(llmsFor(city), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
});

export default app;
export { REPO_URL };
