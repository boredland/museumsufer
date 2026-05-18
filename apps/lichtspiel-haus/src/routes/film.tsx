import { buildUtm, formatLocalisedDateLong } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getScreeningById } from "../db";
import { Footer, Head, Masthead, PosterCard } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import type { Env } from "../types";
import { APP_URL } from "./static";

const utm = buildUtm("frankfurt.lichtspiel.haus");
const app = new Hono<{ Bindings: Env }>();

app.get("/film/:id{[0-9]+}", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const screening = getScreeningById(id);
  if (!screening) return c.notFound();

  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const currentPath = `/film/${id}`;
  const dateLabel = formatLocalisedDateLong(screening.date, locale === "en" ? "en-US" : "de-DE");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ScreeningEvent",
    "@id": `${APP_URL}/film/${id}#screening`,
    name: screening.title,
    description: screening.description ?? screening.subtitle ?? undefined,
    startDate: screening.time ? `${screening.date}T${screening.time}:00+02:00` : screening.date,
    endDate: screening.end_time ? `${screening.date}T${screening.end_time}:00+02:00` : undefined,
    image: screening.image_url ?? undefined,
    workPresented: { "@type": "Movie", name: screening.title, inLanguage: screening.language },
    videoFormat: screening.format,
    location: {
      "@type": "MovieTheater",
      name: screening.cinema.name,
      address: screening.cinema.address,
    },
    offers: screening.ticket_url
      ? {
          "@type": "Offer",
          url: utm(screening.ticket_url, "film-detail"),
          price: screening.price_min,
          priceCurrency: "EUR",
        }
      : undefined,
  };

  const badges: string[] = [];
  if (screening.version) badges.push(screening.version);
  if (screening.format) badges.push(screening.format);
  if (screening.language && screening.language !== "other") badges.push(screening.language.toUpperCase());

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${screening.title} — ${screening.cinema.name} — lichtspiel.haus`}
            description={
              screening.description ?? screening.subtitle ?? `${screening.title} im ${screening.cinema.name}`
            }
            canonical={`${APP_URL}/film/${id}`}
            locale={locale}
            currentPath={currentPath}
            jsonLd={jsonLd}
            ogImage={screening.image_url ?? undefined}
            extraLinks={[
              {
                rel: "alternate",
                type: "text/calendar",
                href: `/film/${id}/feed.ics`,
                title: `${screening.title} – iCal`,
              },
            ]}
          />
        </head>
        <body>
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <main class="film-detail">
            <article class="film-detail__article">
              <p class="film-detail__kicker">{tr.filmKicker}</p>
              <h1 class="film-detail__title">{screening.title}</h1>
              {screening.subtitle ? <p class="film-detail__subtitle">{screening.subtitle}</p> : null}

              <div class="film-detail__grid">
                <div class="film-detail__poster">
                  <PosterCard title={screening.title} imageUrl={screening.image_url} />
                </div>
                <div class="film-detail__meta">
                  <p class="film-detail__when">
                    <span class="film-detail__time">{screening.time ?? "–"}</span>
                    <span class="film-detail__date">{dateLabel}</span>
                  </p>
                  <p class="film-detail__where">
                    <a href={`/kino/${screening.cinema_slug}`}>{screening.cinema.name}</a>
                    {screening.venue_room ? <span class="film-detail__room"> · {screening.venue_room}</span> : null}
                  </p>
                  {badges.length > 0 ? (
                    <ul class="film-detail__badges">
                      {badges.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  {screening.credits ? (
                    <p class="film-detail__credits">
                      <span class="film-detail__credits-label">{tr.creditsLabel}: </span>
                      {screening.credits}
                    </p>
                  ) : null}
                  {screening.series ? (
                    <p class="film-detail__series">
                      <span class="film-detail__series-kicker">{tr.seriesKicker}: </span>
                      <a href={`/reihe/${screening.series.slug}`}>{screening.series.name}</a>
                    </p>
                  ) : null}
                  <div class="film-detail__actions">
                    {screening.ticket_url ? (
                      <a
                        class="film-detail__ticket"
                        href={utm(screening.ticket_url, "film-detail")}
                        target="_blank"
                        rel="noopener"
                      >
                        {tr.ticketsAction} ↗
                      </a>
                    ) : null}
                    <a class="film-detail__calendar" href={`/film/${id}/feed.ics`}>
                      {tr.toCalendar}
                    </a>
                    {screening.detail_url ? (
                      <a
                        class="film-detail__source"
                        href={utm(screening.detail_url, "film-detail")}
                        target="_blank"
                        rel="noopener"
                      >
                        {tr.websiteLink} ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              {screening.description ? <div class="film-detail__description">{screening.description}</div> : null}
            </article>
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
