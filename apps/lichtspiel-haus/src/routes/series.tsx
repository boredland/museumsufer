import { cityHost, cityMeta, cityName, cityUrl, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getAllSeries, getSeriesScreenings } from "../db";
import { DateGroupedScreenings, Footer, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations, localizeTranslations } from "../i18n";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

app.get("/reihe/:slug", (c) => {
  const slug = c.req.param("slug");
  const screenings = getSeriesScreenings(slug, todayIso());
  if (screenings.length === 0) return c.notFound();
  const name = screenings[0].series?.name ?? slug;

  const locale = detectLocale(c.req.raw);
  const city = c.get("city") ?? "frankfurt";
  const tr = localizeTranslations(getTranslations(locale), city, locale);
  const currentPath = `/reihe/${slug}`;
  const appUrl = cityUrl("lichtspiel.haus", city);

  // Auto-derived series description -- date span + screening count +
  // host cinemas. Lifts the page from a bare event list to something
  // with at least one self-contained sentence Google + AI assistants
  // can excerpt.
  const cinemaNames = Array.from(new Set(screenings.map((s) => s.cinema.name))).slice(0, 3);
  const firstDate = screenings[0].date;
  const lastDate = screenings[screenings.length - 1].date;
  const lead = tr.seriesLead({
    name,
    count: screenings.length,
    firstDate,
    lastDate,
    cinemas: cinemaNames,
  });
  const description = `${lead} ${tr.seriesDescription(name, screenings.length)}`;

  const eventSeriesLd = {
    "@context": "https://schema.org",
    "@type": "EventSeries",
    "@id": `${appUrl}${currentPath}#series`,
    name,
    description: lead,
    url: `${appUrl}${currentPath}`,
    startDate: firstDate,
    endDate: lastDate,
    location: {
      "@type": "Place",
      name: cinemaNames.join(", "),
      address: { "@type": "PostalAddress", addressLocality: cityName(city, locale, "full"), addressCountry: "DE" },
    },
    subEvent: screenings.slice(0, 20).map((s) => ({
      "@type": "ScreeningEvent",
      "@id": `${appUrl}/film/${s.id}#screening`,
      name: s.title,
      startDate: s.time ? `${s.date}T${s.time}:00+02:00` : s.date,
      url: `${appUrl}/film/${s.id}`,
      location: { "@type": "MovieTheater", name: s.cinema.name },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "lichtspiel.haus", item: appUrl },
      { "@type": "ListItem", position: 2, name: tr.seriesAll, item: `${appUrl}/reihe` },
      { "@type": "ListItem", position: 3, name },
    ],
  };

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${name} — Filmreihe Frankfurt — lichtspiel.haus`}
            description={description}
            canonical={`${appUrl}/reihe/${slug}?lang=${locale}`}
            locale={locale}
            currentPath={currentPath}
            jsonLd={[eventSeriesLd, breadcrumbLd]}
            extraLinks={[
              { rel: "alternate", type: "text/calendar", href: `/reihe/${slug}/feed.ics`, title: `${name} – iCal` },
              { rel: "alternate", type: "application/json", href: `/api/series/${slug}`, title: `${name} – JSON` },
            ]}
          />
        </head>
        <body>
          <Masthead tr={tr} locale={locale} currentPath={currentPath} city={city} />
          <main class="programme">
            <p class="back-link">
              <a href={`/reihe?lang=${locale}`}>← {tr.backToSeriesIndex}</a>
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
              <p class="venue-hero__kicker">{tr.seriesKicker}</p>
              <h2 class="venue-hero__name">{name}</h2>
              <p class="venue-hero__lead">{lead}</p>
              <p class="venue-hero__meta">
                <a href={`/reihe/${slug}/feed.ics`}>{tr.icalSubscribe}</a>
                <a href={`/api/series/${slug}`}>{tr.jsonLink}</a>
              </p>
            </section>

            <DateGroupedScreenings screenings={screenings} locale={locale} tr={tr} />
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

app.get("/reihe", (c) => {
  const locale = detectLocale(c.req.raw);
  const city = c.get("city") ?? "frankfurt";
  const tr = localizeTranslations(getTranslations(locale), city, locale);
  const all = getAllSeries(todayIso());
  const appUrl = cityUrl("lichtspiel.haus", city);
  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${tr.seriesAll} — lichtspiel.haus`}
            description={tr.seriesAll}
            canonical={`${appUrl}/reihe?lang=${locale}`}
            locale={locale}
            currentPath="/reihe"
          />
        </head>
        <body>
          <Masthead tr={tr} locale={locale} currentPath="/reihe" city={city} />
          <main class="programme">
            <p class="back-link">
              <a href={`/?lang=${locale}`}>← {tr.backToProgramme}</a>
            </p>
            <section class="venue-hero">
              <p class="venue-hero__kicker">{tr.seriesKicker}</p>
              <h2 class="venue-hero__name">{tr.seriesAll}</h2>
            </section>
            {all.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">∅</p>
              </div>
            ) : (
              <ul class="series-index">
                {all.map((s) => (
                  <li class="series-index__row" key={s.slug}>
                    <a class="series-index__link" href={`/reihe/${s.slug}?lang=${locale}`}>
                      <span class="series-index__name">{s.name}</span>
                      <span class="series-index__count">{s.count}</span>
                    </a>
                    <span class="series-index__dates">
                      {s.first_date} – {s.last_date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </main>
          <Footer tr={tr} locale={locale} />
        </body>
      </html>
    </>,
    { headers: { "Content-Language": locale, "Cache-Control": "public, max-age=600, s-maxage=1800" } },
  );
});

export default app;
