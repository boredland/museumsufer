import { Hono } from "hono";
import { raw } from "hono/html";
import { NavButton, ReportButton, ShareButton } from "../components";
import { dateOffset, todayIso } from "../date";
import { buildLangParam, ContactDialog, Masthead, renderHtmlHead } from "../frontend";
import { detectLocale, getTranslations, type Locale } from "../i18n";
import { IconSprite } from "../icons";
import { type getMuseumConfig, MUSEUMS, WIKIPEDIA_TITLE_OVERRIDES } from "../museum-config";
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

/** Strip srcset / multi-value garbage from a scraped image URL. Some
 *  museum sites store `<img src="...">` with a srcset-style payload
 *  (e.g. `"foo.jpg 1x,@images/bar.jpg 2x"`) which is invalid in
 *  schema.org `image` fields and fails Google's Rich Results
 *  validator. Take the first URL token. */
function cleanImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const first = url.split(/[\s,]/)[0].trim();
  if (!first || first.startsWith("@")) return undefined;
  if (!first.startsWith("http://") && !first.startsWith("https://")) return undefined;
  return first;
}

/** German Wikipedia article URL for a museum slug, if WIKIPEDIA_TITLE_OVERRIDES
 *  has a match. Used to populate Museum.sameAs as an entity-disambiguation
 *  signal alongside the museum's own website. */
function wikipediaUrl(slug: string): string | undefined {
  const title = WIKIPEDIA_TITLE_OVERRIDES[slug];
  if (!title) return undefined;
  return `https://de.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** Best-effort parser for the free-text `opening_hours` string into a
 *  schema.org OpeningHoursSpecification array. Handles the common
 *  German museum patterns (`Di-So 10-18 Uhr`, `Mi 10-20`, `Mo
 *  geschlossen`); returns an empty array when the format deviates
 *  rather than emitting garbage. */
const DAY_MAP: Record<string, string> = {
  mo: "Monday",
  di: "Tuesday",
  mi: "Wednesday",
  do: "Thursday",
  fr: "Friday",
  sa: "Saturday",
  so: "Sunday",
};
function parseOpeningHours(text: string | null | undefined): Array<Record<string, unknown>> {
  if (!text) return [];
  const out: Array<Record<string, unknown>> = [];
  // Split on common separators -- newlines, semicolons, commas (but
  // not commas inside a Tag-range like "Di-So").
  const segments = text.split(/[\n;]+|,(?!\s*[A-Z][a-z])/);
  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg) continue;
    // Match patterns like "Di-So 10-18", "Mo 14-20", "Sa, So 11:00-18:00",
    // "Di & Do 10-18". Capture the days + the time range.
    const m = seg.match(
      /^([A-Za-z]{2}(?:\s*[-–&]\s*[A-Za-z]{2})*)\s+(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?/,
    );
    if (!m) continue;
    const daysPart = m[1].toLowerCase().replace(/\s+/g, "");
    const opensH = m[2].padStart(2, "0");
    const opensM = m[3] ?? "00";
    const closesH = m[4].padStart(2, "0");
    const closesM = m[5] ?? "00";
    const days: string[] = [];
    if (daysPart.includes("-") || daysPart.includes("–")) {
      const [from, to] = daysPart.split(/[-–]/);
      const order = ["mo", "di", "mi", "do", "fr", "sa", "so"];
      const fi = order.indexOf(from);
      const ti = order.indexOf(to);
      if (fi >= 0 && ti >= 0 && fi <= ti) {
        for (let i = fi; i <= ti; i++) days.push(order[i]);
      }
    } else if (daysPart.includes("&")) {
      for (const d of daysPart.split("&")) if (DAY_MAP[d]) days.push(d);
    } else if (DAY_MAP[daysPart]) {
      days.push(daysPart);
    }
    if (days.length === 0) continue;
    out.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days.map((d) => DAY_MAP[d]),
      opens: `${opensH}:${opensM}`,
      closes: `${closesH}:${closesM}`,
    });
  }
  return out;
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
  const metaDescription = description
    ? truncate(description)
    : `${museumName} — aktuelle Ausstellungen & Veranstaltungen · Museumsufer Frankfurt am Main`;
  // Self-canonical per-locale: each locale points at the URL the user
  // actually visits. Hreflang already declares the cross-locale
  // relationships in renderHtmlHead/buildHreflangsForCanonical.
  const canonicalUrl =
    locale === "de"
      ? `https://museumsufer.app/museum/${slug}`
      : `https://museumsufer.app/museum/${slug}?lang=${locale}`;
  const langParam = buildLangParam(locale);
  const museumIri = `https://museumsufer.app/#museum/${slug}`;

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

  const museumSchemas = museums.map((m) => {
    const cfg = MUSEUMS[m.slug];
    const lat = cfg?.lat ?? 50;
    const lng = cfg?.lng ?? 8;
    const sameAs: string[] = [];
    if (m.website_url) sameAs.push(m.website_url);
    const wiki = wikipediaUrl(m.slug);
    if (wiki) sameAs.push(wiki);
    const cleanedImage = cleanImageUrl(m.image_url);
    return {
      "@context": "https://schema.org",
      "@type": "Museum",
      "@id": `https://museumsufer.app/#museum/${m.slug}`,
      name: m.name,
      ...(abbreviation && { alternateName: abbreviation }),
      ...(m.description && { description: m.description }),
      ...(m.website_url && { url: m.website_url }),
      ...(cleanedImage && { image: cleanedImage }),
      address: {
        "@type": "PostalAddress",
        addressLocality: "Frankfurt am Main",
        addressCountry: "DE",
      },
      geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng },
      hasMap: `https://www.google.com/maps?q=${lat},${lng}`,
      containedInPlace: {
        "@type": "City",
        name: "Frankfurt am Main",
        sameAs: "https://www.wikidata.org/wiki/Q1794",
      },
      ...(parseOpeningHours(m.opening_hours).length > 0 && {
        openingHoursSpecification: parseOpeningHours(m.opening_hours),
      }),
      ...(sameAs.length > 0 && { sameAs }),
    };
  });

  const eventSchemas = events.slice(0, 20).map((ev) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    description: ev.description ?? undefined,
    startDate: ev.date,
    endDate: ev.end_date ?? ev.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(cleanImageUrl(ev.image_url) && { image: cleanImageUrl(ev.image_url) }),
    location: { "@id": museumIri },
    ...(ev.price !== null &&
      ev.price !== undefined && {
        offers: {
          "@type": "Offer",
          price: ev.price,
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
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
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(cleanImageUrl(ex.image_url) && { image: cleanImageUrl(ex.image_url) }),
    location: { "@id": museumIri },
  }));

  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          {renderHtmlHead({
            locale,
            title: `${museumName} – Ausstellungen & Events | Museumsufer Frankfurt am Main`,
            description: metaDescription,
            canonicalUrl,
            ogImage: cleanImageUrl(primaryMuseum.image_url) || "https://museumsufer.app/og-image.png",
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

            {cleanImageUrl(primaryMuseum.image_url) && (
              // Hero image is the LCP element -- drop lazy + set
              // fetchpriority so the browser pulls it on the critical
              // path. Alt text is locale-aware so EN/FR visitors don't
              // see German alt copy.
              <img
                src={cleanImageUrl(primaryMuseum.image_url)}
                alt={
                  locale === "fr"
                    ? `Façade de ${museumName} à Francfort-sur-le-Main`
                    : locale === "en"
                      ? `${museumName} facade in Frankfurt am Main`
                      : `${museumName} Fassade in Frankfurt am Main`
                }
                loading="eager"
                fetchpriority="high"
                decoding="async"
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

  const museumIds = museums.map((m) => m.id);
  const rawExhibitions: ExhibitionRow[] = getExhibitionsForMuseum(museumIds, today);
  const rawEvents: EventRow[] = getEventsForMuseum(museumIds, today, end30);

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
