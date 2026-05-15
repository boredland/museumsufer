import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getEventsInRange, getSourceBySlug } from "../db";
import { Event, Footer, Foxing, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import { renderSourceMarkdown, wantsMarkdown } from "../markdown";
import type { Env } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

app.get("/quelle/:slug", (c) => {
  const slug = c.req.param("slug");
  const source = getSourceBySlug(slug);
  if (!source) return c.notFound();

  const events = getEventsInRange(todayIso(), dateOffset(60), { source: slug });

  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderSourceMarkdown(source, events), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }

  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const currentPath = `/quelle/${slug}`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${APP_URL}/quelle/${slug}#source`,
    name: source.name,
    url: source.url,
    sameAs: source.url,
  };
  if (source.lat != null && source.lon != null) {
    jsonLd.location = {
      "@type": "Place",
      geo: { "@type": "GeoCoordinates", latitude: source.lat, longitude: source.lon },
    };
  }

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${source.name} — lehrhaus`}
            description={tr.sourceDescription(source.name, events.length)}
            canonical={`${APP_URL}/quelle/${slug}`}
            locale={locale}
            currentPath={currentPath}
            jsonLd={jsonLd}
            extraLinks={[
              {
                rel: "alternate",
                type: "text/calendar",
                href: `/quelle/${slug}/feed.ics`,
                title: `${source.name} – iCal`,
              },
              {
                rel: "alternate",
                type: "application/json",
                href: `/api/sources/${slug}`,
                title: `${source.name} – JSON`,
              },
            ]}
          />
        </head>
        <body>
          <Foxing />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <main class="programme">
            <section class="venue-hero">
              <p class="venue-hero__kicker">{tr.sourceKicker}</p>
              <h2 class="venue-hero__name">{source.name}</h2>
              <p class="venue-hero__meta">
                <a href={source.url} target="_blank" rel="noopener">
                  {tr.websiteLink} ↗
                </a>
                <a href={`/quelle/${source.slug}/feed.ics`}>{tr.icalSubscribe}</a>
                <a href={`/api/sources/${source.slug}`}>{tr.jsonLink}</a>
              </p>
            </section>

            {events.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">⁂</p>
                <p>{tr.emptySource}</p>
              </div>
            ) : (
              <ol class="concerts">
                {events.map((e, i) => (
                  <Event key={e.id} e={e} opts={{ index: i, hideSource: true }} tr={tr} />
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
