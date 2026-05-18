import { todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getAllSeries, getSeriesScreenings } from "../db";
import { Footer, Head, Masthead, Screening } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import type { Env } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

app.get("/reihe/:slug", (c) => {
  const slug = c.req.param("slug");
  const screenings = getSeriesScreenings(slug, todayIso());
  if (screenings.length === 0) return c.notFound();
  const name = screenings[0].series?.name ?? slug;

  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const currentPath = `/reihe/${slug}`;

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${name} — lichtspiel.haus`}
            description={tr.seriesDescription(name, screenings.length)}
            canonical={`${APP_URL}/reihe/${slug}`}
            locale={locale}
            currentPath={currentPath}
            extraLinks={[
              { rel: "alternate", type: "text/calendar", href: `/reihe/${slug}/feed.ics`, title: `${name} – iCal` },
              { rel: "alternate", type: "application/json", href: `/api/series/${slug}`, title: `${name} – JSON` },
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
              <p class="venue-hero__kicker">{tr.seriesKicker}</p>
              <h2 class="venue-hero__name">{name}</h2>
              <p class="venue-hero__meta">
                <a href={`/reihe/${slug}/feed.ics`}>{tr.icalSubscribe}</a>
                <a href={`/api/series/${slug}`}>{tr.jsonLink}</a>
              </p>
            </section>

            <ol class="screenings">
              {screenings.map((s, i) => (
                <Screening key={s.id} s={s} opts={{ index: i }} tr={tr} />
              ))}
            </ol>
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
  const tr = getTranslations(locale);
  const all = getAllSeries(todayIso());
  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${tr.seriesAll} — lichtspiel.haus`}
            description={tr.seriesAll}
            canonical={`${APP_URL}/reihe`}
            locale={locale}
            currentPath="/reihe"
          />
        </head>
        <body>
          <Masthead tr={tr} locale={locale} currentPath="/reihe" />
          <main class="programme">
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
                    <a class="series-index__link" href={`/reihe/${s.slug}`}>
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
