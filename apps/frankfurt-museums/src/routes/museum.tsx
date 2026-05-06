import { Hono } from "hono";
import { raw } from "hono/html";
import { CLIENT_SCRIPT } from "../client-script";
import { NavButton, ReportButton, ShareButton } from "../components";
import { dateOffset, todayIso } from "../date";
import { buildLangParam, ContactDialog, Masthead, renderHtmlHead } from "../frontend";
import { dateLocale, detectLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "../i18n";
import { IconSprite } from "../icons";
import { type getMuseumConfig, MUSEUMS } from "../museum-config";
import { translateFields } from "../translate";
import type { Env, Event, Exhibition } from "../types";

interface MuseumRow {
  id: number;
  name: string;
  slug: string;
  opening_hours: string | null;
  website_url: string | null;
  description: string | null;
  image_url: string | null;
}

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
}

function MuseumPage({ locale, museums, config, exhibitions, events, slug }: MuseumPageProps) {
  const tr = getTranslations(locale);

  const primaryMuseum = museums[0];
  const museumName = primaryMuseum.name;
  const abbreviation = config?.abbreviation;
  const description = primaryMuseum.description;
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
          <div class="max-w-[720px] mx-auto pt-10 pb-16 px-5 max-[480px]:pt-8 max-[480px]:pb-12">
            <Masthead locale={locale} tr={tr} />

            <p class="mb-8">
              <a
                href={`/${langParam}`}
                class="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-text-tertiary hover:text-river no-underline"
              >
                {tr.museumBackToAll}
              </a>
            </p>

            {primaryMuseum.image_url && (
              <img
                src={primaryMuseum.image_url}
                alt={`${museumName} Fassade in Frankfurt`}
                loading="lazy"
                class="w-full h-auto rounded mb-8 aspect-video object-cover"
              />
            )}

            <div class="flex items-center justify-between pb-6 border-b border-border mb-6">
              <div class="flex items-center gap-3">
                <NavButton slug={slug} name={museumName} tr={tr} />
                <ShareButton type="museum" id={slug} title={museumName} tr={tr} />
                <ReportButton type="museum" title={museumName} url={canonicalUrl} tr={tr} />
              </div>
              {abbreviation && (
                <p class="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-text-tertiary">{abbreviation}</p>
              )}
            </div>

            <h1 class="font-display italic font-normal leading-[0.95] tracking-[-0.02em] text-text-primary text-[clamp(2rem,6vw,3rem)] mb-2">
              {museumName}
            </h1>

            {primaryMuseum.opening_hours && (
              <section class="mb-6">
                <h2 class="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-text-tertiary mb-2">
                  {tr.museumOpeningHours}
                </h2>
                <p class="leading-relaxed text-sm">{primaryMuseum.opening_hours}</p>
              </section>
            )}

            {description && <p class="mb-6 leading-relaxed text-sm">{description}</p>}

            {primaryMuseum.website_url && (
              <p class="mb-8">
                <a
                  href={primaryMuseum.website_url}
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center justify-center px-4 py-2 text-[0.875rem] font-medium rounded border border-river text-river hover:bg-river hover:text-white transition-colors no-underline"
                >
                  {tr.museumWebsite} ↗
                </a>
              </p>
            )}

            {exhibitions.length > 0 && (
              <section class="mb-8">
                <h2 class="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-text-tertiary mb-4">
                  {tr.museumExhibitions} ({exhibitions.length})
                </h2>
                <div class="space-y-4">
                  {exhibitions.map((ex) => (
                    <div key={ex.id} class="border border-border rounded p-4">
                      {ex.image_url && (
                        <img
                          src={ex.image_url}
                          alt={ex.title}
                          loading="lazy"
                          class="w-full h-auto rounded mb-3 aspect-video object-cover"
                        />
                      )}
                      <p class="font-medium mb-1">{ex.title}</p>
                      {ex.start_date && ex.end_date && (
                        <p class="text-xs text-text-tertiary mb-2">
                          {ex.start_date} – {ex.end_date}
                        </p>
                      )}
                      {ex.description && <p class="text-sm text-text-secondary line-clamp-2 mb-2">{ex.description}</p>}
                      {ex.detail_url && (
                        <a
                          href={ex.detail_url}
                          target="_blank"
                          rel="noopener"
                          class="text-xs text-river hover:underline no-underline"
                        >
                          {tr.details} →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {exhibitions.length === 0 && <p class="mb-8 text-sm text-text-tertiary">{tr.museumNoExhibitions}</p>}

            {events.length > 0 && (
              <section class="mb-8">
                <h2 class="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-text-tertiary mb-4">
                  {tr.museumEvents} – {tr.museumEventsWindow} ({events.length})
                </h2>
                <div class="space-y-4">
                  {events.map((ev) => (
                    <div key={ev.id} class="border border-border rounded p-4">
                      {ev.image_url && (
                        <img
                          src={ev.image_url}
                          alt={ev.title}
                          loading="lazy"
                          class="w-full h-auto rounded mb-3 aspect-video object-cover"
                        />
                      )}
                      <p class="font-medium mb-1">{ev.title}</p>
                      <p class="text-xs text-text-tertiary mb-2">
                        {ev.date} {ev.time && `@ ${ev.time}`}
                      </p>
                      {ev.description && <p class="text-sm text-text-secondary line-clamp-2 mb-2">{ev.description}</p>}
                      {ev.price !== null && ev.price !== undefined && (
                        <p class="text-xs text-text-tertiary mb-2">{ev.price}</p>
                      )}
                      {ev.detail_url && (
                        <a
                          href={ev.detail_url}
                          target="_blank"
                          rel="noopener"
                          class="text-xs text-river hover:underline no-underline"
                        >
                          {tr.details} →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {events.length === 0 && <p class="text-sm text-text-tertiary">{tr.museumNoEvents}</p>}

            <p class="mt-12 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-text-tertiary">
              <a
                href="https://github.com/boredland/museumsufer"
                target="_blank"
                rel="noopener"
                class="hover:text-river no-underline"
              >
                Source
              </a>
            </p>
          </div>

          <ContactDialog tr={tr} />

          <script
            dangerouslySetInnerHTML={{
              __html: `const T = ${JSON.stringify(tr)};
const DATE_LOCALE = ${JSON.stringify(dateLocale(locale))};
const LOCALES = ${JSON.stringify(SUPPORTED_LOCALES)};
const CURRENT_LANG = '${locale}';
const BERLIN_TODAY = '${todayIso()}';
const __INITIAL_DATE__ = null;
${CLIENT_SCRIPT}`,
            }}
          />
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

  // Fetch museums
  const slugsToFetch = groupSlugs || [slug];
  let museums: MuseumRow[] = [];
  for (const s of slugsToFetch) {
    const museum = await c.env.DB.prepare(
      "SELECT id, name, slug, opening_hours, website_url, description, image_url FROM museums WHERE slug = ?",
    )
      .bind(s)
      .first<MuseumRow>();
    if (museum) museums.push(museum);
  }

  if (museums.length === 0) {
    return c.notFound();
  }

  // Translate museum descriptions if not German
  if (locale !== "de") {
    museums = await translateFields(c.env, museums, ["description"] as (keyof MuseumRow)[], locale);
  }

  // Fetch exhibitions and events for all museums in parallel
  const museumIds = museums.map((m) => m.id);
  const [rawExhibitions, rawEvents] = await Promise.all([
    (async () => {
      const placeholders = museumIds.map(() => "?").join(",");
      const result = await c.env.DB.prepare(
        `SELECT id, title, start_date, end_date, description, image_url, detail_url
         FROM exhibitions WHERE museum_id IN (${placeholders}) AND (end_date IS NULL OR end_date >= ?)
         ORDER BY end_date ASC, start_date ASC LIMIT 20`,
      )
        .bind(...museumIds, today)
        .all<ExhibitionRow>();
      return result.results || [];
    })(),
    (async () => {
      const placeholders = museumIds.map(() => "?").join(",");
      const result = await c.env.DB.prepare(
        `SELECT id, title, date, time, end_time, end_date, description, url, detail_url, image_url, price
         FROM events WHERE museum_id IN (${placeholders}) AND date >= ? AND date <= ?
         ORDER BY date ASC, time ASC LIMIT 50`,
      )
        .bind(...museumIds, today, end30)
        .all<EventRow>();
      return result.results || [];
    })(),
  ]);

  // Translate exhibition and event content if not German
  const exhibitions =
    locale === "de"
      ? rawExhibitions
      : await translateFields(c.env, rawExhibitions, ["title", "description"] as (keyof Exhibition)[], locale);
  const events =
    locale === "de"
      ? rawEvents
      : await translateFields(c.env, rawEvents, ["title", "description"] as (keyof Event)[], locale);

  const config = MUSEUMS[slug];
  return c.html(MuseumPage({ locale, museums, config, exhibitions, events, slug }), {
    headers: {
      "Content-Language": locale,
      Vary: "Accept-Language",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
});

export default app;
