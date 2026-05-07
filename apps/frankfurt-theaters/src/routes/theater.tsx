import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { type DayPerformance, getPerformancesInRange } from "../db";
import {
  buildPerformanceJsonLd,
  escapeHtml,
  renderClientScript,
  renderFooter,
  renderGrain,
  renderHead,
  renderMasthead,
  renderPerformance,
} from "../frontend";
import { renderTheaterMarkdown, wantsMarkdown } from "../markdown";
import { THEATERS } from "../theater-config";
import type { Env } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

app.get("/theater/:slug", async (c) => {
  const slug = c.req.param("slug");
  const config = THEATERS.find((t) => t.slug === slug);
  if (!config) return c.notFound();

  const today = todayIso();
  const performances = await getPerformancesInRange(c.env.DB, today, dateOffset(60), slug);

  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderTheaterMarkdown(config, performances), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "PerformingArtsTheater",
      "@id": `${APP_URL}/theater/${slug}#theater`,
      name: config.name,
      url: `${APP_URL}/theater/${slug}`,
      address: config.address
        ? {
            "@type": "PostalAddress",
            streetAddress: config.address,
            addressLocality: "Frankfurt am Main",
            addressCountry: "DE",
          }
        : undefined,
      geo:
        config.lat && config.lon
          ? { "@type": "GeoCoordinates", latitude: config.lat, longitude: config.lon }
          : undefined,
      sameAs: config.website_url ?? undefined,
      hasOfferCatalog:
        performances.length > 0
          ? {
              "@type": "OfferCatalog",
              name: `Spielplan ${config.name}`,
              numberOfItems: performances.length,
            }
          : undefined,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Frankfurt Theater", item: APP_URL },
        { "@type": "ListItem", position: 2, name: config.name, item: `${APP_URL}/theater/${slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Vorstellungen — ${config.name}`,
      numberOfItems: performances.length,
      itemListElement: performances.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: buildPerformanceJsonLd(p),
      })),
    },
  ];

  const head = renderHead({
    title: `${config.name} — Spielplan · Frankfurt Theater`,
    description: `Aktueller Spielplan und Karten für ${config.name} in Frankfurt am Main. ${performances.length} kommende Vorstellung${
      performances.length === 1 ? "" : "en"
    }.`,
    canonical: `${APP_URL}/theater/${slug}`,
    ogImage: `${APP_URL}/theater/${slug}/og.svg`,
    jsonLd,
    extraLinks: [
      { rel: "alternate", type: "text/calendar", href: `/theater/${slug}/feed.ics`, title: `${config.name} – iCal` },
      { rel: "alternate", type: "application/json", href: `/api/theater/${slug}`, title: `${config.name} – JSON` },
    ],
  });

  return c.html(`<!doctype html>
<html lang="de">
<head>
${head}
</head>
<body>
${renderGrain()}
${renderMasthead({ sublabel: "Frankfurter Bühnen, kuratiert nach Tag." })}

<main class="programme programme--theater">
  <header class="theater-hero">
    <p class="theater-hero__line"></p>
    <p class="theater-hero__kicker">Spielplan</p>
    <h2 class="theater-hero__name">${escapeHtml(config.name)}</h2>
    ${config.address ? `<p class="theater-hero__address">${escapeHtml(config.address)}</p>` : ""}
    <p class="theater-hero__meta">
      ${config.website_url ? `<a href="${escapeHtml(config.website_url)}" target="_blank" rel="noopener">Website ↗</a>` : ""}
      <a href="/theater/${slug}/feed.ics">iCal abonnieren</a>
      <a href="/api/theater/${slug}">JSON</a>
    </p>
  </header>

  ${
    performances.length === 0
      ? `<div class="empty">
           <p class="empty__mark">∅</p>
           <p>Noch kein angekündigtes Programm.</p>
         </div>`
      : renderGrouped(performances)
  }
</main>

${renderFooter()}

${renderClientScript()}
</body>
</html>`);
});

function renderGrouped(performances: DayPerformance[]): string {
  // Group by date — only render dates that actually have a performance.
  // (Audit found we were rendering 60 dates with ~23 empty stretches.)
  const byDate = new Map<string, DayPerformance[]>();
  for (const p of performances) {
    const arr = byDate.get(p.date);
    if (arr) arr.push(p);
    else byDate.set(p.date, [p]);
  }
  const groups: string[] = [];
  let i = 0;
  const monthNames = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];
  const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  for (const [date, perfs] of byDate) {
    if (!perfs.length) continue;
    const dp = new Date(`${date}T12:00:00Z`);
    const wk = weekdays[dp.getUTCDay()];
    const month = monthNames[dp.getUTCMonth()];
    const day = dp.getUTCDate();
    groups.push(`<section class="theater-day">
      <header class="theater-day__head">
        <p class="theater-day__weekday">${wk}</p>
        <h3 class="theater-day__date">${day}. ${month}</h3>
      </header>
      <ol class="performances" role="list">
        ${perfs.map((p) => renderPerformance(p, { index: i++, hideTheater: true })).join("")}
      </ol>
    </section>`);
  }
  return groups.join("\n");
}

export default app;
