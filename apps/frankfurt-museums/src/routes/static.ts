import { buildApiCatalog, buildManifest, buildRobotsTxt, cityName, fnv1a } from "@museumsufer/core";
import { Hono } from "hono";
import { CLIENT_SCRIPT } from "../client-script";
import { todayIso } from "../date";
import { MUSEUMS } from "../museum-config";
import { SERVICE_WORKER_JS } from "../service-worker";
import type { Env } from "../types";

const CLIENT_BUNDLE_VERSION = fnv1a(CLIENT_SCRIPT);
export const CLIENT_BUNDLE_HREF = `/client-${CLIENT_BUNDLE_VERSION}.js`;

/** Frankfurt keeps the SEO-primary museumsufer.app host + Museumsufer brand;
 *  other cities use the generic <city>.ins.museum host. */
function appUrlFor(city: string): string {
  return city === "frankfurt" ? "https://museumsufer.app" : `https://${city}.ins.museum`;
}
function brandFor(city: string): string {
  return city === "frankfurt" ? "Museumsufer Frankfurt" : `${city}.ins.museum`;
}

const manifestCache = new Map<string, string>();
function manifestFor(city: string): string {
  const cached = manifestCache.get(city);
  if (cached) return cached;
  const brand = brandFor(city);
  const manifest = buildManifest({
    name: brand,
    shortName: city === "frankfurt" ? "Museumsufer" : cityName(city, "de", "short"),
    description:
      city === "frankfurt"
        ? "Ausstellungen & Veranstaltungen am Frankfurter Museumsufer"
        : `Ausstellungen & Veranstaltungen in ${cityName(city, "de", "full")}s Museen`,
    themeColor: "#f5f0eb",
    backgroundColor: "#f5f0eb",
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
  const appUrl = appUrlFor(city);
  const cityFull = cityName(city, "de", "full");
  const intro =
    city === "frankfurt"
      ? "Aggregated exhibitions and events from ~40 museums along Frankfurt's Museumsufer (Museum Embankment)."
      : `Aggregated exhibitions and events from ${cityFull}'s museums.`;
  const txt = `# ${brandFor(city)}

> ${intro}

Contact: feedback@ins.museum
License: Content aggregated from public museum sources. Application code: MIT (github.com/boredland/museumsufer/tree/main/apps/frankfurt-museums)
Source: https://github.com/boredland/museumsufer/tree/main/apps/frankfurt-museums

This site provides a JSON API for querying museum exhibitions and events in ${cityFull}, Germany.

## API

Base URL: ${appUrl}

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

- API documentation: ${appUrl}/api/docs
- RSS feed (next 7 days): ${appUrl}/feed.xml
- Calendar feed (ICS): ${appUrl}/feed.ics
- OpenAPI spec: ${appUrl}/api/docs/openapi.json

## Notes

- Event content (titles, descriptions) is in German
- Dates use ISO 8601 format (YYYY-MM-DD)
- Times are in 24h format (HH:MM), timezone Europe/Berlin
- Events are available for the next 7 days with the most detail (images, prices, deep links)
- Exhibitions are available for any date (they span weeks/months)
- Data refreshes daily at 06:00 UTC via a GitHub Action that regenerates the bundled scrape data and redeploys the worker
- Translations available via ?lang=en or ?lang=fr query parameter on the API
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
      // Block JSON endpoints from organic indexing. Googlebot will follow
      // the API for crawl-budget reasons otherwise; the spec lives at
      // /api/docs which IS user-facing and stays crawlable.
      disallow: ["/api/day", "/api/events", "/api/exhibitions", "/api/museums", "/api/transit"],
    }),
    { headers: { "Cache-Control": "public, max-age=86400" } },
  ),
);

app.get("/sitemap.xml", (c) => {
  const today = todayIso();
  const city = c.get("city") ?? "frankfurt";
  const appUrl = appUrlFor(city);

  // Collect museum slugs to include in sitemap, scoped to this host's city.
  const museumSlugs = new Set<string>();
  const groupedSlugs = new Set<string>();

  for (const [slug, config] of Object.entries(MUSEUMS)) {
    if (config.hidden) continue;
    if ((config.city ?? "frankfurt") !== city) continue;
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
    <loc>${appUrl}/museum/${slug}</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="de" href="${appUrl}/museum/${slug}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${appUrl}/museum/${slug}?lang=en"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${appUrl}/museum/${slug}?lang=fr"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${appUrl}/museum/${slug}"/>
  </url>`,
    )
    .join("\n");

  // Promoting /?lang=en + /?lang=fr to their own <url> blocks was an
  // anti-pattern -- the hreflang relationship is already expressed
  // inside the / entry, so the locale-variant URLs were competing
  // duplicates per the audit. /impressum is dropped from the sitemap
  // and now ships <meta name="robots" content="noindex"> in its
  // template; it's a legal-boilerplate page with no organic intent.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${appUrl}/</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="de" href="${appUrl}/"/>
    <xhtml:link rel="alternate" hreflang="en" href="${appUrl}/?lang=en"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${appUrl}/?lang=fr"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${appUrl}/"/>
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

app.get(CLIENT_BUNDLE_HREF, (c) =>
  c.body(CLIENT_SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  }),
);

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

app.get("/.well-known/*", (c) =>
  c.json({ error: "Not Found", path: new URL(c.req.url).pathname }, 404, {
    "Cache-Control": "public, max-age=3600",
  }),
);

export default app;
