import { dateOffset, todayIso } from "@museumsufer/core";
import { AskAi as SharedAskAi } from "@museumsufer/core/ask-ai";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getEventsInRange } from "../db";
import { Event, Footer, Grain, genreLabel, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import { type Env, parseGenre } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

app.get("/genre/:slug", (c) => {
  const genre = parseGenre(c.req.param("slug"));
  if (!genre) return c.notFound();
  const slug = genre;
  const events = getEventsInRange(todayIso(), dateOffset(60), { genre });
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const label = genreLabel(genre, tr);
  const currentPath = `/genre/${slug}`;

  // ItemList wrapping every upcoming concert of this genre. /genre/
  // pages previously shipped zero JSON-LD; this gives crawlers + AI
  // assistants a structured catalogue of the rows.
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${APP_URL}${currentPath}#collection`,
    name: `${label} — Konzerte in Frankfurt`,
    description: tr.genreDescription(label, events.length),
    url: `${APP_URL}${currentPath}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: events.length,
      itemListElement: events.slice(0, 30).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${APP_URL}/tag/${e.date}#event-${e.id}`,
        name: e.title,
      })),
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "konzert.haus", item: APP_URL },
      { "@type": "ListItem", position: 2, name: tr.genreIndexTitle, item: `${APP_URL}/genre` },
      { "@type": "ListItem", position: 3, name: label },
    ],
  };

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${label} in Frankfurt am Main — konzert.haus`}
            description={tr.genreDescription(label, events.length)}
            canonical={`${APP_URL}/genre/${slug}?lang=${locale}`}
            locale={locale}
            currentPath={currentPath}
            jsonLd={[collectionLd, breadcrumbLd]}
            extraLinks={[
              { rel: "alternate", type: "text/calendar", href: `/genre/${slug}/feed.ics`, title: `${label} – iCal` },
            ]}
          />
        </head>
        <body>
          <Grain />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <main class="programme">
            <section class="venue-hero">
              <p class="venue-hero__kicker">{tr.genreKicker}</p>
              <h2 class="venue-hero__name">{label}</h2>
              <p class="venue-hero__meta">
                <a href={`/genre/${slug}/feed.ics`}>{tr.icalSubscribe}</a>
              </p>
            </section>

            <SharedAskAi label={tr.askAiLabel} aria={tr.askAiAria} prompt={tr.askAiPromptGenre(label)} />

            {events.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">∅</p>
                <p>{tr.emptyGenre(label)}</p>
              </div>
            ) : (
              <ol class="concerts">
                {events.map((e, i) => (
                  <Event key={e.id} e={e} opts={{ index: i, locale }} tr={tr} />
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
