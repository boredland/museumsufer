import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { CINEMAS } from "../cinema-config";
import { getCinemaBySlug, getScreeningsInRange } from "../db";
import { DateGroupedScreenings, Footer, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import { renderCinemaMarkdown, wantsMarkdown } from "../markdown";
import type { Env } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

app.get("/kino/:slug", (c) => {
  const slug = c.req.param("slug");
  const cinema = getCinemaBySlug(slug);
  if (!cinema) return c.notFound();

  const screenings = getScreeningsInRange(todayIso(), dateOffset(60), { cinema: slug });

  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderCinemaMarkdown(cinema, screenings), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }

  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const currentPath = `/kino/${slug}`;
  const addressLocality = cinema.city.length ? cinema.city[0].toUpperCase() + cinema.city.slice(1) : cinema.city;
  // Parse the bundled "<street>, <PLZ> <city>" string for the
  // PostalAddress block. Falls back gracefully when the format
  // deviates (synthesised cinemas may carry an empty address).
  const addrMatch = (cinema.address ?? "").match(/^(.+?),\s*(\d{4,5})\s+(.+)$/);
  const movieTheaterLd = {
    "@context": "https://schema.org",
    "@type": "MovieTheater",
    "@id": `${APP_URL}/kino/${slug}#cinema`,
    name: cinema.name,
    url: `${APP_URL}/kino/${slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: addrMatch?.[1] ?? cinema.address ?? undefined,
      postalCode: addrMatch?.[2],
      addressLocality: addrMatch?.[3] ?? addressLocality,
      addressCountry: "DE",
    },
    geo: { "@type": "GeoCoordinates", latitude: cinema.lat, longitude: cinema.lon },
    sameAs: cinema.website_url,
    // Surface upcoming screenings on the venue page itself -- gives
    // Google an "event" rich-result surface that's otherwise locked
    // away on individual /film/:id pages.
    event: screenings.slice(0, 20).map((s) => ({
      "@type": "ScreeningEvent",
      "@id": `${APP_URL}/film/${s.id}#screening`,
      name: s.title,
      startDate: s.time ? `${s.date}T${s.time}:00+02:00` : s.date,
      url: `${APP_URL}/film/${s.id}`,
      location: { "@id": `${APP_URL}/kino/${slug}#cinema` },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "lichtspiel.haus", item: APP_URL },
      { "@type": "ListItem", position: 2, name: tr.cinemasIndexTitle, item: `${APP_URL}/kinos` },
      { "@type": "ListItem", position: 3, name: cinema.name },
    ],
  };
  const jsonLd = [movieTheaterLd, breadcrumbLd];

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${cinema.name} — lichtspiel.haus`}
            description={tr.cinemaDescription(cinema.name, screenings.length)}
            canonical={`${APP_URL}/kino/${slug}?lang=${locale}`}
            locale={locale}
            currentPath={currentPath}
            jsonLd={jsonLd}
            extraLinks={[
              {
                rel: "alternate",
                type: "text/calendar",
                href: `/kino/${slug}/feed.ics`,
                title: `${cinema.name} – iCal`,
              },
              {
                rel: "alternate",
                type: "application/json",
                href: `/api/cinemas/${slug}`,
                title: `${cinema.name} – JSON`,
              },
            ]}
          />
        </head>
        <body>
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <main class="programme">
            <p class="back-link">
              <a href={`/kinos?lang=${locale}`}>← {tr.backToCinemasIndex}</a>
            </p>
            <section class="venue-hero">
              <div class="venue-hero__corner" aria-hidden="true">
                <svg viewBox="0 0 80 80" width="80" height="80" role="presentation">
                  <title>corner ornament</title>
                  <path d="M0 0 H80 M0 0 V80" stroke="currentColor" stroke-width="1.5" fill="none" />
                  <rect x="0" y="0" width="14" height="14" fill="currentColor" />
                  <rect x="20" y="0" width="6" height="6" fill="currentColor" />
                  <rect x="32" y="0" width="6" height="6" fill="currentColor" />
                  <rect x="0" y="20" width="6" height="6" fill="currentColor" />
                  <rect x="0" y="32" width="6" height="6" fill="currentColor" />
                </svg>
              </div>
              <p class="venue-hero__kicker">{tr.cinemaKicker}</p>
              <h2 class="venue-hero__name">{cinema.name}</h2>
              {cinema.tagline ? <p class="venue-hero__tagline">{cinema.tagline}</p> : null}
              <p class="venue-hero__address">{cinema.address}</p>
              <p class="venue-hero__meta">
                {cinema.website_url ? (
                  <a href={cinema.website_url} target="_blank" rel="noopener">
                    {tr.websiteLink} ↗
                  </a>
                ) : null}
                <a href={`/kino/${cinema.slug}/feed.ics`}>{tr.icalSubscribe}</a>
                <a href={`/api/cinemas/${cinema.slug}`}>{tr.jsonLink}</a>
              </p>
            </section>

            {screenings.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">∅</p>
                <p>{tr.emptyCinema}</p>
              </div>
            ) : (
              <DateGroupedScreenings screenings={screenings} locale={locale} tr={tr} hideCinema />
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

// /kinos -- venue-directory landing page. Targets "Programmkino
// Frankfurt" and similar venue-finder intents that the audit flagged
// as currently unmatched on the site. Each row carries a
// MovieTheater LocalBusiness JSON-LD block so search engines + AI
// assistants can resolve "which arthouse cinemas are in Frankfurt"
// from a single URL.
app.get("/kinos", (c) => {
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const today = todayIso();
  // Pre-count upcoming screenings per cinema so the row carries a
  // "X screenings in the next 14 days" signal.
  const horizon = dateOffset(14);
  const upcoming = getScreeningsInRange(today, horizon);
  const countBySlug = new Map<string, number>();
  for (const s of upcoming) countBySlug.set(s.cinema_slug, (countBySlug.get(s.cinema_slug) ?? 0) + 1);
  const cinemas = CINEMAS.slice()
    .filter((c) => countBySlug.get(c.slug))
    .sort((a, b) => a.name.localeCompare(b.name));

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${APP_URL}/kinos#collection`,
    name: tr.cinemasIndexTitle,
    description: tr.cinemasIndexLead,
    url: `${APP_URL}/kinos`,
    mainEntity: cinemas.map((cinema) => {
      const addrMatch = (cinema.address ?? "").match(/^(.+?),\s*(\d{4,5})\s+(.+)$/);
      return {
        "@type": "MovieTheater",
        "@id": `${APP_URL}/kino/${cinema.slug}#cinema`,
        name: cinema.name,
        url: `${APP_URL}/kino/${cinema.slug}`,
        address: {
          "@type": "PostalAddress",
          streetAddress: addrMatch?.[1] ?? cinema.address ?? undefined,
          postalCode: addrMatch?.[2],
          addressLocality: addrMatch?.[3] ?? cinema.city.charAt(0).toUpperCase() + cinema.city.slice(1),
          addressCountry: "DE",
        },
        geo: { "@type": "GeoCoordinates", latitude: cinema.lat, longitude: cinema.lon },
        sameAs: cinema.website_url,
      };
    }),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "lichtspiel.haus", item: APP_URL },
      { "@type": "ListItem", position: 2, name: tr.cinemasIndexTitle },
    ],
  };

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${tr.cinemasIndexTitle} — lichtspiel.haus`}
            description={tr.cinemasIndexLead}
            canonical={`${APP_URL}/kinos?lang=${locale}`}
            locale={locale}
            currentPath="/kinos"
            jsonLd={[collectionLd, breadcrumbLd]}
          />
        </head>
        <body>
          <Masthead tr={tr} locale={locale} currentPath="/kinos" />
          <main class="programme">
            <p class="back-link">
              <a href={`/?lang=${locale}`}>← {tr.backToProgramme}</a>
            </p>
            <section class="venue-hero">
              <p class="venue-hero__kicker">{tr.cinemasIndexKicker}</p>
              <h2 class="venue-hero__name">{tr.cinemasIndexTitle}</h2>
              <p class="venue-hero__lead">{tr.cinemasIndexLead}</p>
            </section>
            <ul class="cinemas-index">
              {cinemas.map((cinema) => {
                const count = countBySlug.get(cinema.slug) ?? 0;
                return (
                  <li class="cinemas-index__row" key={cinema.slug}>
                    <a class="cinemas-index__link" href={`/kino/${cinema.slug}?lang=${locale}`}>
                      <span class="cinemas-index__name">{cinema.name}</span>
                      <span class="cinemas-index__count">{tr.upcomingShows(count)}</span>
                    </a>
                    {cinema.address ? <span class="cinemas-index__addr">{cinema.address}</span> : null}
                  </li>
                );
              })}
            </ul>
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
