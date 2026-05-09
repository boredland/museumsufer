import { buildManifest, buildRobotsTxt } from "@museumsufer/core";
import { Hono } from "hono";
import { CATEGORIES } from "../categories";
import { CLIENT_SCRIPT } from "../client-script";
import { todayIso } from "../date";
import { SERVICE_WORKER_JS } from "../service-worker";
import { APP_URL } from "../shared";
import type { Env } from "../types";

const MANIFEST = buildManifest({
  name: "landau.today",
  shortName: "Landau heute",
  description: "Veranstaltungen in Landau in der Pfalz.",
  themeColor: "#f2ead3",
  backgroundColor: "#f2ead3",
});

const ROBOTS_TXT = buildRobotsTxt({ siteUrl: APP_URL });

/** OG card — masthead set in Bodoni-style geometry, hand-drawn so we don't
 *  have to ship a font file or rasterise. Keeps with the wine-label idiom. */
const OG_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f2ead3"/>
  <rect x="80" y="80" width="1040" height="470" fill="none" stroke="#1b1715" stroke-width="2"/>
  <line x1="80" y1="160" x2="1120" y2="160" stroke="#1b1715" stroke-width="1"/>
  <line x1="80" y1="500" x2="1120" y2="500" stroke="#1b1715" stroke-width="1"/>
  <text x="600" y="135" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="700" letter-spacing="6" font-size="34" fill="#1b1715">VERANSTALTUNGSBLATT FÜR DIE SÜDLICHE WEINSTRASSE</text>
  <text x="600" y="320" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="normal" font-weight="700" font-size="200" letter-spacing="-2" fill="#1b1715">Landau<tspan fill="#5c1f2e" font-style="italic" font-weight="400" letter-spacing="-8">&amp;</tspan>heute</text>
  <text x="600" y="395" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-size="36" fill="#5a5048">Konzert · Theater · Tanz · Lesung · Festival · Ausstellung</text>
  <text x="600" y="488" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="700" letter-spacing="6" font-size="22" fill="#5c1f2e">LANDAU.TODAY</text>
</svg>`;

const LLMS_TXT = `# landau.today

> Aggregierter Veranstaltungskalender für Landau in der Pfalz und die Südliche Weinstraße.
> Quellen: Kulturnetz Landau (kulturnetz-landau.de), Stadt Landau (landau.de),
> Stiftung Hambacher Schloss (hambacher-schloss.de),
> RPTU Kaiserslautern-Landau (rptu.de, gefiltert auf Landau),
> Südliche Weinstraße Tourismus (suedlicheweinstrasse.de).

Contact: hello@landau.today
Source: https://github.com/boredland/museumsufer/tree/main/apps/landau-today

## API

Base URL: ${APP_URL}

GET /api/day?date=YYYY-MM-DD&category=<slug>
Returns: { date, count, events: [{ id, title, date, time, end_date, end_time, category, venue, description, detail_url, image_url, price, source }] }

## Feeds

- RSS: ${APP_URL}/feed.xml (next 7 days)
- ICS: ${APP_URL}/feed.ics (next 14 days)
- Per-event ICS: ${APP_URL}/event/<id>.ics

## Categories

${CATEGORIES.map((c) => `- ${c.slug} — ${c.label}`).join("\n")}

## Notes

- All content is in German.
- Times are Europe/Berlin (CET/CEST).
- Data refreshes daily ~06:30 UTC via GitHub Actions.
- Past events are pruned at scrape time.
`;

const app = new Hono<{ Bindings: Env }>();

app.get("/og.svg", (c) =>
  c.body(OG_IMAGE, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" } }),
);

app.get("/robots.txt", (c) => c.text(ROBOTS_TXT, { headers: { "Cache-Control": "public, max-age=86400" } }));

app.get("/manifest.json", (c) =>
  c.body(MANIFEST, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/sw.js", (c) =>
  c.body(SERVICE_WORKER_JS, {
    headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache" },
  }),
);

app.get("/client.js", (c) =>
  c.body(CLIENT_SCRIPT, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  }),
);

app.get("/llms.txt", (c) =>
  c.text(LLMS_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/.well-known/llms.txt", (c) =>
  c.text(LLMS_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  }),
);

app.get("/sitemap.xml", (c) => {
  const today = todayIso();
  const urls = [
    { loc: `${APP_URL}/`, priority: "1.0", changefreq: "daily" },
    ...CATEGORIES.map((cat) => ({
      loc: `${APP_URL}/c/${cat.slug}`,
      priority: "0.8",
      changefreq: "daily",
    })),
    { loc: `${APP_URL}/impressum`, priority: "0.3", changefreq: "yearly" },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `<url>
  <loc>${u.loc}</loc>
  <lastmod>${today}</lastmod>
  <changefreq>${u.changefreq}</changefreq>
  <priority>${u.priority}</priority>
</url>`,
  )
  .join("\n")}
</urlset>`;
  return c.body(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } });
});

app.get("/impressum", (c) =>
  c.html(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Impressum · landau.today</title><link rel="stylesheet" href="/styles.css"></head><body><header class="masthead"><h1><a href="/">Landau<span class="ampersand">&amp;</span>heute</a></h1></header><main class="event-detail" style="padding:0 1rem"><h1>Impressum</h1><p class="body-copy">landau.today ist ein nicht-kommerzielles, redaktionell gepflegtes Verzeichnis öffentlicher Veranstaltungen in Landau in der Pfalz und der Südlichen Weinstraße. Inhalte werden täglich aus den frei zugänglichen Quellen <a href="https://kulturnetz-landau.de" rel="external">kulturnetz-landau.de</a>, <a href="https://www.landau.de/Tourismus-Kultur/Veranstaltungen/" rel="external">landau.de</a>, <a href="https://hambacher-schloss.de" rel="external">hambacher-schloss.de</a>, <a href="https://rptu.de" rel="external">rptu.de</a> (gefiltert auf Landau) und <a href="https://www.suedlicheweinstrasse.de" rel="external">suedlicheweinstrasse.de</a> aggregiert.</p><p class="body-copy">Für Inhalte und Aktualität haften die jeweiligen Originalquellen. Hinweise oder Korrekturen bitte per E-Mail an <a href="mailto:hello@landau.today">hello@landau.today</a>.</p><div class="actions"><a href="/">Zurück</a></div></main></body></html>`,
    200,
    { "Cache-Control": "public, max-age=3600" },
  ),
);

app.get("/.well-known/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;
