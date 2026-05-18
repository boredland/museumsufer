import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getCinemaBySlug, getScreeningsInRange } from "../db";
import { Footer, Head, Masthead, Screening } from "../frontend";
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MovieTheater",
    "@id": `${APP_URL}/kino/${slug}#cinema`,
    name: cinema.name,
    url: `${APP_URL}/kino/${slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: cinema.address,
      addressLocality,
      addressCountry: "DE",
    },
    geo: { "@type": "GeoCoordinates", latitude: cinema.lat, longitude: cinema.lon },
    sameAs: cinema.website_url,
  };

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${cinema.name} — lichtspiel.haus`}
            description={tr.cinemaDescription(cinema.name, screenings.length)}
            canonical={`${APP_URL}/kino/${slug}`}
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
              <ol class="screenings">
                {screenings.map((s, i) => (
                  <Screening key={s.id} s={s} opts={{ index: i, hideCinema: true }} tr={tr} />
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
