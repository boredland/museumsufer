import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getEventsInRange, getVenueBySlug } from "../db";
import { Event, Footer, Grain, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
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

  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const currentPath = `/spielort/${slug}`;
  const addressLocality = venue.city.length ? venue.city[0].toUpperCase() + venue.city.slice(1) : venue.city;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicVenue",
    "@id": `${APP_URL}/spielort/${slug}#venue`,
    name: venue.name,
    url: `${APP_URL}/spielort/${slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.address,
      addressLocality,
      addressCountry: "DE",
    },
    geo: { "@type": "GeoCoordinates", latitude: venue.lat, longitude: venue.lon },
    sameAs: venue.website_url,
  };

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${venue.name} — konzert.haus`}
            description={tr.venueDescription(venue.name, events.length)}
            canonical={`${APP_URL}/spielort/${slug}`}
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
              <p class="venue-hero__address">{venue.address}</p>
              <p class="venue-hero__meta">
                <a href={venue.website_url} target="_blank" rel="noopener">
                  {tr.websiteLink} ↗
                </a>
                <a href={`/spielort/${venue.slug}/feed.ics`}>{tr.icalSubscribe}</a>
                <a href={`/api/venues/${venue.slug}`}>{tr.jsonLink}</a>
              </p>
            </section>

            {events.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">∅</p>
                <p>{tr.emptyVenue}</p>
              </div>
            ) : (
              <ol class="concerts">
                {events.map((e, i) => (
                  <Event key={e.id} e={e} opts={{ index: i, hideVenue: true }} tr={tr} />
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
