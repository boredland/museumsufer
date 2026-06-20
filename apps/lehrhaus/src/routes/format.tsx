import { dateOffset, todayIso } from "@museumsufer/core";
import { AskAi as SharedAskAi } from "@museumsufer/core/ask-ai";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getEventsInRange } from "../db";
import { categoryLabel, Event, Footer, Foxing, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import { type Category, type AppEnv, type Env, parseCategory } from "../types";
import { APP_URL } from "./static";

const app = new Hono<AppEnv>();

/** Per-category editorial lead, surfaced both as the hero copy and as
 *  the schema.org `description`. Audit flagged the format pages as
 *  thin (heading + iCal link only). DE only; EN visitors get the
 *  cinemaDescription template fallback. */
function categoryLead(c: Category, isHamburg: boolean): { de: string; en: string } {
  if (c === "Vortrag") {
    return {
      de: `Wissenschaftsvorträge, Buchvorstellungen und Sachvorträge der ${isHamburg ? "Hamburger" : "Frankfurter"} Akademien, Stiftungen, Forschungseinrichtungen und Bürgerhäuser.`,
      en: `Academic lectures, book launches and informational talks from ${isHamburg ? "Hamburg's" : "Frankfurt's"} academies, foundations, research institutes and civic houses.`,
    };
  }
  if (c === "Lesung") {
    return {
      de: `Lesungen, Autoren-Auftritte und Werkstattgespräche in den ${isHamburg ? "Hamburger" : "Frankfurter"} Literaturhäusern, Buchhandlungen und Akademien.`,
      en: `Readings, author appearances and editorial conversations in ${isHamburg ? "Hamburg's" : "Frankfurt's"} literature houses, bookshops and academies.`,
    };
  }
  return {
    de: `Diskussionen, Streitgespräche und Podien zu Gesellschaft, Politik und Wissenschaft in ${isHamburg ? "Hamburg" : "Frankfurt"}.`,
    en: `Panel debates, conversations and forums on society, politics and scholarship in ${isHamburg ? "Hamburg" : "Frankfurt"}.`,
  };
}

app.get("/format/:slug", (c) => {
  const category = parseCategory(c.req.param("slug"));
  if (!category) return c.notFound();
  const slug = category;
  const city = c.get("city") ?? "frankfurt";
  const isHamburg = city === "hamburg";
  const appUrl = isHamburg ? "https://hamburg.lehr.salon" : "https://frankfurt.lehr.salon";
  const cityName = isHamburg ? "Hamburg" : "Frankfurt am Main";
  const cityShort = isHamburg ? "Hamburg" : "Frankfurt";
  const events = getEventsInRange(todayIso(), dateOffset(60), { city, category });
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const label = categoryLabel(category, tr);
  const currentPath = `/format/${slug}`;
  const lead = categoryLead(category, isHamburg)[locale === "en" ? "en" : "de"];
  // Vortrag = LectureEvent, Lesung = LiteraryEvent, Diskussion =
  // generic Event (no exact subtype exists in schema.org).
  const eventType = category === "Vortrag" ? "EducationEvent" : category === "Lesung" ? "LiteraryEvent" : "Event";

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${appUrl}${currentPath}#collection`,
    name: `${label} in ${cityName}`,
    description: lead,
    url: `${appUrl}${currentPath}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: events.length,
      itemListElement: events.slice(0, 30).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${appUrl}/tag/${e.date}#event-${e.id}`,
        name: e.title,
        item: {
          "@type": eventType,
          name: e.title,
          startDate: e.time ? `${e.date}T${e.time}:00+02:00` : e.date,
        },
      })),
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "lehr.salon", item: appUrl },
      { "@type": "ListItem", position: 2, name: tr.categoryKicker, item: `${appUrl}/format` },
      { "@type": "ListItem", position: 3, name: label },
    ],
  };

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${label} in ${cityName} · lehr.salon`}
            description={lead}
            canonical={`${appUrl}/format/${slug}?lang=${locale}`}
            locale={locale}
            currentPath={currentPath}
            jsonLd={[collectionLd, breadcrumbLd]}
            extraLinks={[
              { rel: "alternate", type: "text/calendar", href: `/format/${slug}/feed.ics`, title: `${label} – iCal` },
            ]}
          />
        </head>
        <body>
          <Foxing />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} city={city} />
          <main class="programme">
            <section class="venue-hero">
              <p class="venue-hero__kicker">{tr.categoryKicker}</p>
              <h2 class="venue-hero__name">{label}</h2>
              <p class="venue-hero__lead">{lead}</p>
              <p class="venue-hero__meta">
                <a href={`/format/${slug}/feed.ics`}>{tr.icalSubscribe}</a>
              </p>
            </section>

            <SharedAskAi
              label="Frag eine KI"
              aria={`Frag eine KI nach ${label}-Terminen in ${cityShort}`}
              prompt={`Welche ${label}-Termine stehen in ${cityName} in den nächsten Wochen an? Quelle: ${appUrl}${currentPath}`}
            />

            {events.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">⁂</p>
                <p>{tr.emptyCategory(label)}</p>
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
