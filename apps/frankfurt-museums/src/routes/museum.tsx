import { Hono } from "hono";
import { raw } from "hono/html";
import { NavButton, ReportButton, ShareButton } from "../components";
import { dateOffset, todayIso } from "../date";
import { buildLangParam, ContactDialog, Masthead, renderHtmlHead } from "../frontend";
import { detectLocale, getTranslations, type Locale } from "../i18n";
import { IconSprite } from "../icons";
import { type getMuseumConfig, MUSEUMS } from "../museum-config";
import { getEventsForMuseum, getExhibitionsForMuseum, getMuseumBySlug } from "../queries";
import { generateScriptInit } from "../script-init";
import { translateFields } from "../translate";
import type { Env, Event, Exhibition, Museum } from "../types";

type MuseumRow = Museum;
type ExhibitionRow = Exhibition;
type EventRow = Event;

function truncate(text: string | null, length = 160): string {
  if (!text) return "";
  return text.length > length ? `${text.substring(0, length).trim()}…` : text;
}

interface MuseumPageProps {
  locale: Locale;
  museums: MuseumRow[];
  config: ReturnType<typeof getMuseumConfig> | undefined;
  exhibitions: ExhibitionRow[];
  events: EventRow[];
  slug: string;
  currentPath: string;
}

function MuseumPage({ locale, museums, config, exhibitions, events, slug, currentPath }: MuseumPageProps) {
  const tr = getTranslations(locale);

  const primaryMuseum = museums[0];
  const museumName = primaryMuseum.name;
  const abbreviation = config?.abbreviation;
  const description = primaryMuseum.description ?? null;
  const metaDescription = truncate(description);
  const canonicalUrl = `https://museumsufer.app/museum/${slug}`;
  const langParam = buildLangParam(locale);

  // Build JSON-LD schemas
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Museumsufer Frankfurt",
        item: "https://museumsufer.app/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: museumName,
        item: canonicalUrl,
      },
    ],
  };

  const museumSchemas = museums.map((m) => ({
    "@context": "https://schema.org",
    "@type": "Museum",
    "@id": `https://museumsufer.app/#museum/${m.slug}`,
    name: m.name,
    ...(abbreviation && { alternateName: abbreviation }),
    ...(m.description && { description: m.description }),
    ...(m.website_url && { url: m.website_url }),
    ...(m.image_url && { image: m.image_url }),
    address: {
      "@type": "PostalAddress",
      addressLocality: "Frankfurt am Main",
      addressCountry: "DE",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: MUSEUMS[m.slug]?.lat ?? 50,
      longitude: MUSEUMS[m.slug]?.lng ?? 8,
    },
    ...(m.website_url && { sameAs: [m.website_url] }),
  }));

  const eventSchemas = events.slice(0, 20).map((ev) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    description: ev.description ?? undefined,
    startDate: ev.date,
    endDate: ev.end_date ?? ev.date,
    ...(ev.image_url && { image: ev.image_url }),
    location: {
      "@type": "Place",
      name: primaryMuseum.name,
    },
    ...(ev.price !== null &&
      ev.price !== undefined && {
        offers: {
          "@type": "Offer",
          price: ev.price,
        },
      }),
  }));

  const exhibitionSchemas = exhibitions.slice(0, 20).map((ex) => ({
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    name: ex.title,
    description: ex.description ?? undefined,
    startDate: ex.start_date ?? undefined,
    endDate: ex.end_date ?? undefined,
    ...(ex.image_url && { image: ex.image_url }),
    location: {
      "@type": "Place",
      name: primaryMuseum.name,
    },
  }));

  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          {renderHtmlHead({
            locale,
            title: `${museumName} – Museumsufer Frankfurt`,
            description: metaDescription || museumName,
            canonicalUrl,
            ogImage: primaryMuseum.image_url || "https://museumsufer.app/og-image.png",
            jsonSchemas: [
              { name: "breadcrumb", json: JSON.stringify(breadcrumb) },
              ...museumSchemas.map((schema, i) => ({ name: `museum-${i}`, json: JSON.stringify(schema) })),
              ...eventSchemas.map((schema, i) => ({ name: `event-${i}`, json: JSON.stringify(schema) })),
              ...exhibitionSchemas.map((schema, i) => ({ name: `exhibition-${i}`, json: JSON.stringify(schema) })),
            ],
          })}
          <meta name="robots" content="index,follow" />
        </head>
        <body>
          <IconSprite />
          <div class="page">
            <Masthead locale={locale} tr={tr} currentPath={currentPath} />

            <p class="museum-detail__back">
              <a href={`/${langParam}`} class="museum-detail__back-link">
                {tr.museumBackToAll}
              </a>
            </p>

            {primaryMuseum.image_url && (
              <img
                src={primaryMuseum.image_url}
                alt={`${museumName} Fassade in Frankfurt`}
                loading="lazy"
                class="museum-detail__hero"
              />
            )}

            <div class="museum-detail__actions-row">
              <div class="museum-detail__actions">
                <NavButton slug={slug} name={museumName} tr={tr} />
                <ShareButton type="museum" id={slug} title={museumName} tr={tr} />
                <ReportButton type="museum" title={museumName} url={canonicalUrl} tr={tr} />
              </div>
              {abbreviation && <p class="museum-detail__abbrev">{abbreviation}</p>}
            </div>

            <h1 class="museum-detail__title">{museumName}</h1>

            {primaryMuseum.opening_hours && (
              <section class="museum-detail__section">
                <h2 class="museum-detail__section-title museum-detail__section-title--short">
                  {tr.museumOpeningHours}
                </h2>
                <p class="museum-detail__body">{primaryMuseum.opening_hours}</p>
              </section>
            )}

            {description && <p class="museum-detail__body">{description}</p>}

            {primaryMuseum.website_url && (
              <p class="museum-detail__back">
                <a href={primaryMuseum.website_url} target="_blank" rel="noopener" class="museum-detail__website-btn">
                  {tr.museumWebsite} ↗
                </a>
              </p>
            )}

            {exhibitions.length > 0 && (
              <section class="museum-detail__section">
                <h2 class="museum-detail__section-title">
                  {tr.museumExhibitions} ({exhibitions.length})
                </h2>
                <div class="museum-detail__list">
                  {exhibitions.map((ex) => (
                    <div key={ex.id} class="museum-detail__item">
                      {ex.image_url && (
                        <img src={ex.image_url} alt={ex.title} loading="lazy" class="museum-detail__item-img" />
                      )}
                      <p class="museum-detail__item-title">{ex.title}</p>
                      {ex.start_date && ex.end_date && (
                        <p class="museum-detail__item-dates">
                          {ex.start_date} – {ex.end_date}
                        </p>
                      )}
                      {ex.description && <p class="museum-detail__item-desc">{ex.description}</p>}
                      {ex.detail_url && (
                        <a href={ex.detail_url} target="_blank" rel="noopener" class="museum-detail__item-link">
                          {tr.details} →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {exhibitions.length === 0 && <p class="museum-detail__empty">{tr.museumNoExhibitions}</p>}

            {events.length > 0 && (
              <section class="museum-detail__section">
                <h2 class="museum-detail__section-title">
                  {tr.museumEvents} – {tr.museumEventsWindow} ({events.length})
                </h2>
                <div class="museum-detail__list">
                  {events.map((ev) => (
                    <div key={ev.id} class="museum-detail__item">
                      {ev.image_url && (
                        <img src={ev.image_url} alt={ev.title} loading="lazy" class="museum-detail__item-img" />
                      )}
                      <p class="museum-detail__item-title">{ev.title}</p>
                      <p class="museum-detail__item-dates">
                        {ev.date} {ev.time && `@ ${ev.time}`}
                      </p>
                      {ev.description && <p class="museum-detail__item-desc">{ev.description}</p>}
                      {ev.price !== null && ev.price !== undefined && (
                        <p class="museum-detail__item-dates">{ev.price}</p>
                      )}
                      {ev.detail_url && (
                        <a href={ev.detail_url} target="_blank" rel="noopener" class="museum-detail__item-link">
                          {tr.details} →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {events.length === 0 && <p class="museum-detail__empty">{tr.museumNoEvents}</p>}

            <p class="museum-detail__source">
              <a
                href="https://github.com/boredland/museumsufer/tree/main/apps/frankfurt-museums"
                target="_blank"
                rel="noopener"
                class="museum-detail__source-link"
              >
                Source
              </a>
            </p>
          </div>

          <ContactDialog tr={tr} />

          <script dangerouslySetInnerHTML={{ __html: generateScriptInit({ locale }) }} />
        </body>
      </html>
    </>
  );
}

const app = new Hono<{ Bindings: Env }>();

// Map of group slugs to their component slugs
const GROUPS: Record<string, string[]> = {
  mmk: [
    "museum-mmk-museum-mmk-fuer-moderne-kunst",
    "tower-mmk-museum-mmk-fuer-moderne-kunst",
    "zollamt-mmk-museum-mmk-fuer-moderne-kunst",
  ],
  jmf: ["juedisches-museum-frankfurt", "juedisches-museum-museum-judengasse-frankfurt"],
};

app.get("/museum/:slug", async (c) => {
  const slug = c.req.param("slug");
  const locale = detectLocale(c.req.raw);
  const today = todayIso();
  const end30 = dateOffset(30);

  // Check if this is a group slug
  const groupSlugs = GROUPS[slug];
  if (!groupSlugs) {
    // Regular slug: check if it exists and if it's hidden or belongs to a group
    const config = MUSEUMS[slug];
    if (!config || config.hidden) {
      return c.notFound();
    }
    if (config.group) {
      // Redirect to the group slug
      const lang = new URL(c.req.url).searchParams.get("lang");
      return c.redirect(`/museum/${config.group}${lang ? `?lang=${lang}` : ""}`, 301);
    }
  }

  // Pull museum(s), exhibitions, events straight from the bundled
  // SCRAPE_DATA. Group slugs (mmk / jmf) fan out to multiple museums;
  // exhibitions + events are concatenated then sorted at the end.
  const slugsToFetch = groupSlugs || [slug];
  let museums: MuseumRow[] = [];
  for (const s of slugsToFetch) {
    const m = getMuseumBySlug(s);
    if (m) museums.push(m);
  }
  if (museums.length === 0) {
    return c.notFound();
  }

  if (locale !== "de") {
    museums = await translateFields(c.env, museums, ["description"] as (keyof MuseumRow)[], locale);
  }

  const rawExhibitions: ExhibitionRow[] = museums
    .flatMap((m) => getExhibitionsForMuseum(m.id, today))
    .sort(
      (a, b) =>
        (a.end_date ?? "9999-99-99").localeCompare(b.end_date ?? "9999-99-99") ||
        (a.start_date ?? "9999-99-99").localeCompare(b.start_date ?? "9999-99-99"),
    )
    .slice(0, 20);
  const rawEvents: EventRow[] = museums
    .flatMap((m) => getEventsForMuseum(m.id, today, end30))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
    .slice(0, 50);

  const exhibitions =
    locale === "de"
      ? rawExhibitions
      : await translateFields(c.env, rawExhibitions, ["title", "description"] as (keyof Exhibition)[], locale);
  const events =
    locale === "de"
      ? rawEvents
      : await translateFields(c.env, rawEvents, ["title", "description"] as (keyof Event)[], locale);

  const config = MUSEUMS[slug];
  const reqUrl = new URL(c.req.url);
  const currentPath = reqUrl.pathname + reqUrl.search;
  return c.html(MuseumPage({ locale, museums, config, exhibitions, events, slug, currentPath }), {
    headers: {
      "Content-Language": locale,
      Vary: "Accept-Language",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
});

export default app;
