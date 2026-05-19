import { dateOffset, todayIso } from "@museumsufer/core";
import { AskAi as SharedAskAi } from "@museumsufer/core/ask-ai";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getEventsInRange, getVenueBySlug } from "../db";
import { Event, Footer, Grain, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import { renderVenueMarkdown, wantsMarkdown } from "../markdown";
import type { Env } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

// Parse the bundled "<street>, <PLZ> <city>" string into a structured
// PostalAddress. Skips streetAddress entirely when the input has no
// street component (synthesised stubs, media-outlet aggregators) so
// Google's validator doesn't reject "Frankfurt am Main" in the
// streetAddress slot.
function parsePostalAddress(addr: string): {
  "@type": "PostalAddress";
  streetAddress?: string;
  postalCode?: string;
  addressLocality: string;
  addressCountry: "DE";
} {
  const trimmed = (addr ?? "").trim();
  const fallback = {
    "@type": "PostalAddress" as const,
    addressLocality: "Frankfurt am Main",
    addressCountry: "DE" as const,
  };
  if (!trimmed) return fallback;
  const m = trimmed.match(/^(.+?),\s*(\d{4,5})\s+(.+)$/);
  if (!m) return fallback;
  // Sanity check: a real street has a number in it. "Frankfurt am
  // Main" without a number is the city, not a street -- drop it.
  if (!/\d/.test(m[1])) return fallback;
  return {
    "@type": "PostalAddress",
    streetAddress: m[1].trim(),
    postalCode: m[2],
    addressLocality: m[3].trim(),
    addressCountry: "DE",
  };
}

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

  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const currentPath = `/spielort/${slug}`;
  const venueIri = `${APP_URL}/spielort/${slug}#venue`;
  const address = parsePostalAddress(venue.address);
  const sameAs: string[] = [];
  if (venue.website_url) sameAs.push(venue.website_url);
  if (venue.wikidata) sameAs.push(`https://www.wikidata.org/wiki/${venue.wikidata}`);

  const venueLd = {
    "@context": "https://schema.org",
    "@type": "MusicVenue",
    "@id": venueIri,
    name: venue.name,
    url: `${APP_URL}/spielort/${slug}`,
    ...(venue.description && { description: venue.description }),
    address,
    geo: { "@type": "GeoCoordinates", latitude: venue.lat, longitude: venue.lon },
    hasMap: `https://www.google.com/maps?q=${venue.lat},${venue.lon}`,
    containedInPlace: {
      "@type": "City",
      name: "Frankfurt am Main",
      sameAs: "https://www.wikidata.org/wiki/Q1794",
    },
    ...(sameAs.length > 0 && { sameAs }),
    // Surface upcoming concerts as ItemList-style `event` entries so
    // the venue page is rich-result eligible even when the visitor
    // doesn't scroll into the list.
    event: events.slice(0, 20).map((e) => ({
      "@type": "MusicEvent",
      "@id": `${APP_URL}/#event/${e.id}`,
      name: e.title,
      startDate: e.time ? `${e.date}T${e.time}:00+02:00` : e.date,
      location: { "@id": venueIri },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "konzert.haus", item: APP_URL },
      { "@type": "ListItem", position: 2, name: tr.spielortIndexTitle, item: `${APP_URL}/spielort` },
      { "@type": "ListItem", position: 3, name: venue.name },
    ],
  };
  const jsonLd = [venueLd, breadcrumbLd];

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${venue.name} — Konzerte in Frankfurt am Main | konzert.haus`}
            description={venue.description ?? tr.venueDescription(venue.name, events.length)}
            canonical={`${APP_URL}/spielort/${slug}?lang=${locale}`}
            locale={locale}
            currentPath={currentPath}
            jsonLd={jsonLd}
            extraLinks={[
              {
                rel: "alternate",
                type: "text/calendar",
                href: `/spielort/${slug}/feed.ics`,
                title: `${venue.name} – iCal`,
              },
              {
                rel: "alternate",
                type: "application/json",
                href: `/api/venues/${slug}`,
                title: `${venue.name} – JSON`,
              },
            ]}
          />
        </head>
        <body>
          <Grain />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <main class="programme">
            <section class="venue-hero">
              <p class="venue-hero__kicker">{tr.venueKicker}</p>
              <h2 class="venue-hero__name">{venue.name}</h2>
              {venue.address ? <p class="venue-hero__address">{venue.address}</p> : null}
              {venue.description ? <p class="venue-hero__lead">{venue.description}</p> : null}
              <p class="venue-hero__meta">
                <a href={venue.website_url} target="_blank" rel="noopener">
                  {tr.websiteLink} ↗
                </a>
                <a href={`/spielort/${venue.slug}/feed.ics`}>{tr.icalSubscribe}</a>
                <a href={`/api/venues/${venue.slug}`}>{tr.jsonLink}</a>
              </p>
            </section>

            <SharedAskAi label={tr.askAiLabel} aria={tr.askAiAria} prompt={tr.askAiPromptVenue(venue.name)} />

            {events.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">∅</p>
                <p>{tr.emptyVenue}</p>
              </div>
            ) : (
              <ol class="concerts">
                {events.map((e, i) => (
                  <Event key={e.id} e={e} opts={{ index: i, hideVenue: true, locale }} tr={tr} />
                ))}
              </ol>
            )}
          </main>
          <Footer tr={tr} locale={locale} />
        </body>
      </html>
    </>,
    {
      headers: {
        "Content-Language": locale,
        "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
        Vary: "Accept-Language",
      },
    },
  );
});

export default app;
