import { cityMeta, cityUrl, dateOffset, parsePostalAddress, todayIso } from "@museumsufer/core";
import { AskAi as SharedAskAi } from "@museumsufer/core/ask-ai";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getEventsInRange, getSourceBySlug } from "../db";
import { Event, Footer, Foxing, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import { renderSourceMarkdown, wantsMarkdown } from "../markdown";
import type { AppEnv, Env } from "../types";
import { APP_URL } from "./static";

const app = new Hono<AppEnv>();

app.get("/quelle/:slug", (c) => {
  const slug = c.req.param("slug");
  const source = getSourceBySlug(slug);
  if (!source) return c.notFound();

  const city = c.get("city") ?? "frankfurt";
  const meta = cityMeta(city);
  const appUrl = cityUrl("lehr.salon", city);
  const cityName = meta.name;
  const cityShort = meta.short;
  const regionName = meta.region;
  const cityWikidata = meta.wikidata;

  const events = getEventsInRange(todayIso(), dateOffset(60), { city, source: slug });

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
  const sourceIri = `${appUrl}/quelle/${slug}#source`;
  const sameAs: string[] = [];
  if (source.url) sameAs.push(source.url);
  if (source.wikidata) sameAs.push(`https://www.wikidata.org/wiki/${source.wikidata}`);
  const address = parsePostalAddress(source.address, { region: regionName });

  const orgLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": sourceIri,
    name: source.name,
    url: source.url,
    ...(source.description && { description: source.description }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(source.telephone && { telephone: source.telephone }),
    location: {
      "@type": "Place",
      name: source.name,
      ...(address && { address }),
      ...(source.lat != null &&
        source.lon != null && {
          geo: { "@type": "GeoCoordinates", latitude: source.lat, longitude: source.lon },
          hasMap: `https://www.google.com/maps?q=${source.lat},${source.lon}`,
        }),
      containedInPlace: {
        "@type": "City",
        name: cityName,
        sameAs: `https://www.wikidata.org/wiki/${cityWikidata}`,
      },
    },
    // Surface upcoming events so the page is rich-result eligible
    // even before the visitor scrolls.
    event: events.slice(0, 20).map((e) => ({
      "@type": "Event",
      "@id": `${appUrl}/#event/${e.id}`,
      name: e.title,
      startDate: e.time ? `${e.date}T${e.time}:00+02:00` : e.date,
      organizer: { "@id": sourceIri },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "lehr.salon", item: appUrl },
      { "@type": "ListItem", position: 2, name: tr.sourceKicker, item: `${appUrl}/quelle` },
      { "@type": "ListItem", position: 3, name: source.name },
    ],
  };
  const jsonLd = [orgLd, breadcrumbLd];

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${source.name} — Vorträge & Lesungen in ${cityName} · lehr.salon`}
            description={source.description ?? tr.sourceDescription(source.name, events.length)}
            canonical={`${appUrl}/quelle/${slug}?lang=${locale}`}
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
          <Masthead tr={tr} locale={locale} currentPath={currentPath} city={city} />
          <main class="programme">
            <section class="venue-hero">
              <p class="venue-hero__kicker">{tr.sourceKicker}</p>
              <h2 class="venue-hero__name">{source.name}</h2>
              {source.description ? <p class="venue-hero__lead">{source.description}</p> : null}
              <p class="venue-hero__meta">
                <a href={source.url} target="_blank" rel="noopener">
                  {tr.websiteLink} ↗
                </a>
                <a href={`/quelle/${source.slug}/feed.ics`}>{tr.icalSubscribe}</a>
                <a href={`/api/sources/${source.slug}`}>{tr.jsonLink}</a>
              </p>
            </section>

            <SharedAskAi
              label="Frag eine KI"
              aria={`Frag eine KI nach dem Programm der ${source.name}`}
              prompt={`Welche Vorträge, Lesungen oder Diskussionen veranstaltet die ${source.name} in ${cityShort} in den nächsten Wochen? Quelle: ${appUrl}/quelle/${slug}`}
            />

            {events.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">⁂</p>
                <p>{tr.emptySource}</p>
              </div>
            ) : (
              <ol class="concerts">
                {events.map((e, i) => (
                  <Event key={e.id} e={e} opts={{ index: i, hideSource: true, locale }} tr={tr} />
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
