import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { getEventsInRange, getVenueBySlug } from "../db";
import { escapeHtml, renderEvent, renderFooter, renderGrain, renderHead, renderMasthead } from "../frontend";
import { renderVenueMarkdown, wantsMarkdown } from "../markdown";
import type { Env } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

app.get("/spielort/:slug", (c) => {
  const slug = c.req.param("slug");
  const venue = getVenueBySlug(slug);
  if (!venue) return c.notFound();

  const events = getEventsInRange(todayIso(), dateOffset(60), { venue: slug });

  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderVenueMarkdown(venue, events), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicVenue",
    "@id": `${APP_URL}/spielort/${slug}#venue`,
    name: venue.name,
    url: `${APP_URL}/spielort/${slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.address,
      addressLocality: venue.city,
      addressCountry: "DE",
    },
    geo: { "@type": "GeoCoordinates", latitude: venue.lat, longitude: venue.lon },
    sameAs: venue.website_url,
  };

  const head = renderHead({
    title: `${venue.name} — konzert.haus`,
    description: `Kommende Konzerte bei ${venue.name}. ${events.length} Termin${events.length === 1 ? "" : "e"} in den nächsten 60 Tagen.`,
    canonical: `${APP_URL}/spielort/${slug}`,
    jsonLd,
    extraLinks: [
      { rel: "alternate", type: "text/calendar", href: `/spielort/${slug}/feed.ics`, title: `${venue.name} – iCal` },
      { rel: "alternate", type: "application/json", href: `/api/venues/${slug}`, title: `${venue.name} – JSON` },
    ],
  });

  return c.html(`<!doctype html>
<html lang="de">
<head>
${head}
</head>
<body>
${renderGrain()}
${renderMasthead()}

<main class="programme">
  <section class="venue-hero">
    <p class="venue-hero__kicker">Spielort</p>
    <h2 class="venue-hero__name">${escapeHtml(venue.name)}</h2>
    <p class="venue-hero__address">${escapeHtml(venue.address)}</p>
    <p class="venue-hero__meta">
      <a href="${escapeHtml(venue.website_url)}" target="_blank" rel="noopener">Website ↗</a>
      <a href="/spielort/${venue.slug}/feed.ics">iCal abonnieren</a>
      <a href="/api/venues/${venue.slug}">JSON</a>
    </p>
  </section>

  ${
    events.length === 0
      ? `<div class="empty"><p class="empty__mark">∅</p><p>Noch kein angekündigtes Programm.</p></div>`
      : `<ol class="concerts">${events.map((e, i) => renderEvent(e, { index: i, hideVenue: true })).join("")}</ol>`
  }
</main>

${renderFooter()}
</body>
</html>`);
});

export default app;
