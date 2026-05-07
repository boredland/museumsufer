import { Hono } from "hono";
import { todayIso } from "../date";
import { THEATERS } from "../theater-config";
import type { Env } from "../types";

const APP_URL = "https://frankfurt.ins.theater";
const REPO_URL = "https://github.com/boredland/museumsufer";

const MANIFEST = JSON.stringify({
  id: "/",
  name: "Frankfurt Theater",
  short_name: "FT",
  description: "Spielplan der Frankfurter Bühnen — kuratiert nach Tag.",
  start_url: "/",
  display: "standalone",
  background_color: "#F4EFE2",
  theme_color: "#F4EFE2",
  lang: "de",
  icons: [
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
});

const LLMS_TXT = `# Frankfurt Theater

> Spielplan der Frankfurter Bühnen — aggregierte Vorstellungen, Karten und Verfügbarkeiten von ${THEATERS.length} Häusern in Frankfurt am Main, kuratiert nach Tag.

Source: ${REPO_URL}
License: Application code MIT. Performance data aggregated from public theater sources.

This site provides a JSON API for querying theater performances in Frankfurt am Main, Germany.

## API

Base URL: ${APP_URL}

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
GET /performance/{id}/feed.ics — single performance

## Optional

- API documentation: ${APP_URL}/api/docs
- OpenAPI spec: ${APP_URL}/api/docs/openapi.json
- Source: ${REPO_URL}

## Notes

- Content (show titles, subtitles) is in German
- Dates use ISO 8601 (YYYY-MM-DD); times are 24h HH:MM in Europe/Berlin
- Performances list horizon: from today to ~60 days out
- Data is refreshed daily at 5am UTC
- Sold-out performances expose status="sold_out" with no price; cancelled performances expose status="cancelled"
`;

const API_CATALOG = JSON.stringify({
  linkset: [
    {
      anchor: `${APP_URL}/api/`,
      "service-desc": [{ href: `${APP_URL}/api/docs/openapi.json`, type: "application/openapi+json" }],
      "service-doc": [{ href: `${APP_URL}/api/docs`, type: "text/html" }],
      status: [{ href: `${APP_URL}/api/day`, type: "application/json" }],
    },
  ],
});

const app = new Hono<{ Bindings: Env }>();

app.get("/.well-known/api-catalog", (c) =>
  c.body(API_CATALOG, {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=86400",
    },
  }),
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
      "Content-Signal: ai-train=no, search=yes, ai-input=yes",
      "",
      `Sitemap: ${APP_URL}/sitemap.xml`,
      `# LLMs: ${APP_URL}/llms.txt`,
      "",
    ].join("\n"),
    { headers: { "Cache-Control": "public, max-age=86400" } },
  ),
);

app.get("/sitemap.xml", (c) => {
  const today = todayIso();
  const theaterUrls = THEATERS.slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(
      (t) => `  <url>
    <loc>${APP_URL}/theater/${t.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
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
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
${theaterUrls}
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
