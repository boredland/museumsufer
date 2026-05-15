import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getEventsInRange } from "../db";
import { categoryLabel, Event, Footer, Foxing, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import { type Env, parseCategory } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

app.get("/format/:slug", (c) => {
  const category = parseCategory(c.req.param("slug"));
  if (!category) return c.notFound();
  const slug = category;
  const events = getEventsInRange(todayIso(), dateOffset(60), { category });
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const label = categoryLabel(category, tr);
  const currentPath = `/format/${slug}`;

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${label} — lehrhaus`}
            description={tr.categoryDescription(label, events.length)}
            canonical={`${APP_URL}/format/${slug}`}
            locale={locale}
            currentPath={currentPath}
            extraLinks={[
              { rel: "alternate", type: "text/calendar", href: `/format/${slug}/feed.ics`, title: `${label} – iCal` },
            ]}
          />
        </head>
        <body>
          <Foxing />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <main class="programme">
            <section class="venue-hero">
              <p class="venue-hero__kicker">{tr.categoryKicker}</p>
              <h2 class="venue-hero__name">{label}</h2>
              <p class="venue-hero__meta">
                <a href={`/format/${slug}/feed.ics`}>{tr.icalSubscribe}</a>
              </p>
            </section>

            {events.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">⁂</p>
                <p>{tr.emptyCategory(label)}</p>
              </div>
            ) : (
              <ol class="concerts">
                {events.map((e, i) => (
                  <Event key={e.id} e={e} opts={{ index: i }} tr={tr} />
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
