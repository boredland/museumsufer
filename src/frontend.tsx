import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CLIENT_SCRIPT } from "./client-script";
import { ContentBody, MuseumsSection } from "./components";
import { berlinNow, todayIso } from "./date";
import { dateLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "./i18n";
import { ICON } from "./icons";
import { getMuseumLocations } from "./museum-config";
import { formatDateFull } from "./shared";
import { infoSectionClass, infoSummaryClass, kbdClass, passLinkClass } from "./tw";
import type { EventWithLikes, ExhibitionWithLikes, MuseumInfo } from "./types";

export type { MuseumInfo };

const MUSEUM_LOCATIONS = getMuseumLocations();

export interface InitialData {
  date: string;
  exhibitions: unknown[];
  events: unknown[];
}

const PASS_URLS: Record<Locale, { card: string; ticket: string }> = {
  de: {
    card: "de/eintritt-und-tickets/dauerkarten/museumsufercard/",
    ticket: "de/eintritt-und-tickets/dauerkarten/museumsuferticket/",
  },
  en: {
    card: "en/admission-tickets/season-tickets/museumsufercard/",
    ticket: "en/admission-tickets/season-tickets/museumsuferticket/",
  },
  fr: {
    card: "fr/tickets/tickets-permanentes/museumsufercard/",
    ticket: "fr/tickets/tickets-permanentes/museumsufer-ticket/",
  },
};

function Masthead({ locale, tr }: { locale: Locale; tr: Record<string, string> }) {
  return (
    <header class="mb-12 max-[480px]:mb-9">
      <div class="flex items-center justify-between gap-4 mb-4">
        <p class="section-eyebrow">Frankfurt am Main · 50.10°N 8.68°E</p>
        <LangSwitch locale={locale} />
      </div>
      <h1 class="font-display italic font-normal leading-[0.95] tracking-[-0.02em] text-text-primary text-[clamp(2.6rem,9vw,4rem)]">
        Museumsufer
      </h1>
      <div class="flex items-center gap-3 mt-4">
        <div class="river-band flex-1" aria-hidden="true" />
        <span class="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-text-tertiary shrink-0">
          {tr.subtitle}
        </span>
        <div class="river-band flex-1" aria-hidden="true" />
      </div>
    </header>
  );
}

function LangSwitch({ locale }: { locale: Locale }) {
  return (
    <nav class="flex gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em]" aria-label="Language">
      {SUPPORTED_LOCALES.map((l) => (
        <a
          href={`?lang=${l}`}
          data-lang={l}
          class={`no-underline transition-colors focus-visible:outline-2 focus-visible:outline-river focus-visible:outline-offset-2 ${l === locale ? "text-text-primary" : "text-text-tertiary hover:text-river"}`}
          aria-current={l === locale ? "page" : undefined}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}

function SearchBar({ tr }: { tr: Record<string, string> }) {
  return (
    <div class="search-bar mb-6">
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        width="14"
        height="14"
        aria-hidden="true"
        class="text-text-tertiary shrink-0"
      >
        <path d={ICON.search} />
      </svg>
      <input
        type="search"
        id="search-input"
        autocomplete="off"
        placeholder={tr.searchPlaceholder}
        aria-label={tr.search}
      />
      <button
        type="button"
        id="search-clear"
        class="text-text-tertiary hover:text-river hidden cursor-pointer transition-colors"
        aria-label="Clear search"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
          <path d={ICON.close} />
        </svg>
      </button>
      <kbd class={`${kbdClass} max-[1024px]:hidden`}>⌘K</kbd>
    </div>
  );
}

function PassPromo({ locale, tr }: { locale: Locale; tr: Record<string, string> }) {
  const urls = PASS_URLS[locale];
  const utm = "?utm_source=museumsufer.app&utm_medium=referral&utm_campaign=pass_promo&utm_content=";
  return (
    <aside class="my-12 px-2 py-8 border-y border-border-light text-center">
      <p class="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-text-tertiary mb-3">Card · Ticket</p>
      <p class="font-display italic text-[1.5rem] leading-tight text-text-primary mb-1 max-w-[28ch] mx-auto">
        {tr.passPromo}
      </p>
      <div class="flex justify-center gap-3 mt-5 flex-wrap">
        <a
          href={`https://www.museumsufer.de/${urls.card}${utm}card`}
          target="_blank"
          rel="noopener"
          class={passLinkClass}
        >
          {tr.passCard}
        </a>
        <a
          href={`https://www.museumsufer.de/${urls.ticket}${utm}ticket`}
          target="_blank"
          rel="noopener"
          class={passLinkClass}
        >
          {tr.passTicket}
        </a>
      </div>
    </aside>
  );
}

function RiverNav({
  locale,
  tr,
  activeDate,
  activeRange,
}: {
  locale: Locale;
  tr: Record<string, string>;
  activeDate: string;
  activeRange?: number;
}) {
  const dl = dateLocale(locale);
  const now = berlinNow();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = now.add(i, "day");
    return {
      iso: d.format("YYYY-MM-DD"),
      weekday: i === 0 ? tr.today : d.toDate().toLocaleDateString(dl, { weekday: "short" }),
      day: String(d.date()),
    };
  });

  return (
    <nav class="mb-7" aria-label={tr.dateNav}>
      <div class="relative pb-3">
        <div class="river-band absolute left-2 right-2 bottom-1.5" aria-hidden="true" />
        <div class="relative flex items-end justify-between gap-0.5">
          {days.map((d, i) => (
            <button
              type="button"
              data-date={d.iso}
              class={`date-stop${!activeRange && d.iso === activeDate ? " active" : ""}${i === 0 ? " is-today" : ""}`}
            >
              <span class="stop-day">{d.day}</span>
              <span class="stop-weekday">{d.weekday}</span>
            </button>
          ))}
        </div>
      </div>
      <div class="flex items-center gap-2 mt-5 flex-wrap">
        <button
          type="button"
          id="btn-upcoming"
          data-range="7"
          aria-pressed={activeRange ? "true" : "false"}
          class={`range-pill${activeRange ? " active" : ""}`}
        >
          {tr.upcoming}
        </button>
        <button
          type="button"
          id="btn-near"
          aria-pressed="false"
          aria-label={tr.nearMe}
          title={tr.nearMe}
          class="range-pill"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true">
            <path d={ICON.gps} />
          </svg>
          <span class="max-[480px]:sr-only">{tr.nearMe}</span>
        </button>
      </div>
    </nav>
  );
}

function InfoSection({ summary, children }: { summary: string; children: unknown }) {
  return (
    <details class={infoSectionClass}>
      <summary class={infoSummaryClass}>{summary}</summary>
      <p class="mt-2 leading-relaxed">{children}</p>
    </details>
  );
}

function LlmTip({ tr }: { tr: Record<string, string> }) {
  return (
    <details class="mt-4 py-2.5 px-4 bg-surface rounded-xl shadow-card text-[0.8125rem] text-text-secondary open:[&>summary]:mb-3">
      <summary class="cursor-pointer font-medium text-text-tertiary text-xs uppercase tracking-wide flex items-center gap-1.5">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class="w-3.5 h-3.5 shrink-0">
          <path
            d="M8 1v4M8 11v4M1 8h4M11 8h4M3 3l2.5 2.5M10.5 10.5L13 13M13 3l-2.5 2.5M5.5 10.5L3 13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        {tr.llmTip}
      </summary>
      <div
        class="relative bg-border-light rounded-lg p-3 font-mono text-xs leading-relaxed text-text-primary whitespace-pre-wrap break-words"
        id="llm-prompt"
        data-prompt={tr.llmPrompt}
      >
        {tr.llmPrompt}
        <button
          type="button"
          class="absolute top-2 right-2 bg-surface border border-border rounded px-2 py-1 text-[0.6875rem] font-sans cursor-pointer text-text-secondary transition-colors hover:border-river hover:text-river"
          onclick="copyPrompt()"
          aria-label={tr.copyPrompt}
        >
          {tr.copyPrompt}
        </button>
      </div>
    </details>
  );
}

export function renderPage(
  locale: Locale,
  initialData?: InitialData,
  museums?: Record<string, MuseumInfo>,
  sort?: string,
  range?: number,
): HtmlEscapedString {
  const tr = getTranslations(locale);
  const trJson = JSON.stringify(tr);
  const dlJson = JSON.stringify(dateLocale(locale));
  const localesJson = JSON.stringify(SUPPORTED_LOCALES);
  const initialDataJson = initialData ? JSON.stringify(initialData) : "null";
  const museumsJson = JSON.stringify(museums || {});
  const berlinOffset = getBerlinUtcOffset();
  const eventSchemaJson = initialData ? buildEventSchema(initialData, berlinOffset) : "";
  const websiteSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Museumsufer Frankfurt",
    url: "https://museumsufer.app/",
    description: tr.metaLong,
    inLanguage: ["de", "en", "fr"],
    potentialAction: {
      "@type": "SearchAction",
      target: "https://museumsufer.app/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  });

  const dataInit = `const T = ${trJson};
    const DATE_LOCALE = ${dlJson};
    const LOCALES = ${localesJson};
    const CURRENT_LANG = '${locale}';
    const BERLIN_TODAY = '${todayIso()}';
    const __INITIAL_DATA__ = ${initialDataJson};
    const MUSEUMS = ${museumsJson};`;

  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{tr.pageTitle}</title>
          <meta name="description" content={tr.metaLong} />
          <link rel="canonical" href={`https://museumsufer.app/${locale !== "de" ? `?lang=${locale}` : ""}`} />
          <link rel="alternate" hreflang="de" href="https://museumsufer.app/?lang=de" />
          <link rel="alternate" hreflang="en" href="https://museumsufer.app/?lang=en" />
          <link rel="alternate" hreflang="fr" href="https://museumsufer.app/?lang=fr" />
          <link rel="alternate" hreflang="x-default" href="https://museumsufer.app/" />
          <meta property="og:title" content={tr.pageTitle} />
          <meta property="og:description" content={tr.metaLong} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://museumsufer.app/" />
          <meta property="og:locale" content={locale} />
          <meta property="og:site_name" content="Museumsufer Frankfurt" />
          <meta property="og:image" content="https://museumsufer.app/og-image.png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={tr.pageTitle} />
          <meta name="twitter:description" content={tr.metaLong} />
          <meta name="twitter:image" content="https://museumsufer.app/og-image.png" />
          <link rel="icon" href="/icon-192.png" type="image/png" />
          <link rel="apple-touch-icon" href="/icon-192.png" />
          <link rel="alternate" type="application/rss+xml" title="Museumsufer Frankfurt" href="/feed.xml" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#efe7d8" media="(prefers-color-scheme: light)" />
          <meta name="theme-color" content="#14110e" media="(prefers-color-scheme: dark)" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
            rel="stylesheet"
          />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteSchema }} />
          {eventSchemaJson ? raw(eventSchemaJson) : null}
          <script src="/uFuzzy.iife.min.js" defer />
          <script src="/htmx.min.js" defer />
          <link rel="stylesheet" href="/styles.css" />
        </head>
        <body>
          <a
            href="#content"
            class="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[200] focus:bg-river focus:text-bg focus:py-2 focus:px-4 focus:rounded-br-xl focus:text-sm"
          >
            {tr.skipLink}
          </a>

          <div class="max-w-[720px] mx-auto pt-10 pb-16 px-5 max-[480px]:pt-8 max-[480px]:pb-12">
            <Masthead locale={locale} tr={tr} />

            <RiverNav locale={locale} tr={tr} activeDate={initialData?.date || todayIso()} activeRange={range} />

            <div class="anchor-headline mb-7 mt-8" id="date-label" aria-live="polite">
              {range
                ? tr.upcomingDays.replace("{n}", String(range))
                : initialData
                  ? formatDateFull(initialData.date, dateLocale(locale))
                  : ""}
            </div>

            <SearchBar tr={tr} />

            <div id="search-no-results" class="hidden py-16 px-4 text-center fade-in">
              <div class="empty-state">
                <p>{tr.noResults}</p>
              </div>
            </div>

            <style
              dangerouslySetInnerHTML={{
                __html: "#content>*{opacity:0}.hydrated #content>*{opacity:1;transition:opacity .1s}",
              }}
            />
            <main id="content">
              {initialData ? (
                <ContentBody
                  events={initialData.events as EventWithLikes[]}
                  exhibitions={initialData.exhibitions as ExhibitionWithLikes[]}
                  tr={tr}
                  locale={locale}
                  todayIso={todayIso()}
                  groupByDate={!!range}
                />
              ) : (
                <div class="py-16 px-4 text-center">
                  <div class="river-band mx-auto mb-6 max-w-[200px] opacity-60" aria-hidden="true" />
                  <p class="font-display italic text-xl text-text-tertiary">{tr.loading}…</p>
                </div>
              )}
            </main>

            <PassPromo locale={locale} tr={tr} />

            <MuseumsSection museums={museums || {}} tr={tr} />

            <InfoSection summary={tr.whyTitle}>{tr.whyText}</InfoSection>
            <InfoSection summary={tr.privacyNote}>{tr.privacyText}</InfoSection>
            <LlmTip tr={tr} />

            <footer class="mt-12 pt-6 border-t border-border-light flex flex-col gap-3 max-[480px]:items-stretch">
              <div class="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem]">
                <a
                  href="https://calendar.google.com/calendar/r?cid=webcal://museumsufer.app/feed.ics"
                  target="_blank"
                  rel="noopener"
                  class="text-text-secondary no-underline hover:text-river"
                >
                  {tr.subscribeCal}
                </a>
                <a href="/feed.xml" class="text-text-secondary no-underline hover:text-river">
                  {tr.rssFeed}
                </a>
                <a
                  href="https://github.com/boredland/museumsufer/issues/new?template=missing-event.yml"
                  target="_blank"
                  rel="noopener"
                  class="text-text-secondary no-underline hover:text-river"
                >
                  {tr.missingEvent}
                </a>
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-text-tertiary">
                <a href="/api/docs" class="no-underline hover:text-river">
                  API
                </a>
                <a
                  href="https://github.com/boredland/museumsufer"
                  target="_blank"
                  rel="noopener"
                  class="no-underline hover:text-river"
                >
                  Source
                </a>
                <span class="opacity-60">© Museumsufer Frankfurt</span>
              </div>
            </footer>
          </div>

          <script dangerouslySetInnerHTML={{ __html: dataInit + CLIENT_SCRIPT }} />
        </body>
      </html>
    </>
  ) as unknown as HtmlEscapedString;
}

function getBerlinUtcOffset(): string {
  const now = new Date();
  const utc = now.toLocaleString("en-US", { timeZone: "UTC" });
  const berlin = now.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
  const diff = (new Date(berlin).getTime() - new Date(utc).getTime()) / 3600000;
  return `+${String(Math.floor(diff)).padStart(2, "0")}:00`;
}

function buildEventSchema(data: InitialData, tz: string): string {
  const schemas: Record<string, unknown>[] = [];

  const exhibitions = data.exhibitions as Array<Record<string, unknown>>;
  if (exhibitions) {
    for (const ex of exhibitions.slice(0, 20)) {
      const museum = (ex.museum_name as string) || "";
      const slug = (ex.museum_slug as string) || "";
      const geo = MUSEUM_LOCATIONS[slug];
      const exSchema: Record<string, unknown> = {
        "@type": "ExhibitionEvent",
        name: ex.title,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
      };
      if (ex.start_date) exSchema.startDate = ex.start_date;
      if (ex.end_date) exSchema.endDate = ex.end_date;
      if (ex.description) exSchema.description = ex.description;
      if (ex.detail_url) exSchema.url = ex.detail_url;
      if (ex.image_url) {
        const img = ex.image_url as string;
        exSchema.image = img.startsWith("/") ? `https://museumsufer.app${img}` : img;
      }
      const loc: Record<string, unknown> = { "@type": "Place", name: museum };
      if (geo) {
        loc.geo = { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng };
        loc.address = { "@type": "PostalAddress", addressLocality: "Frankfurt am Main", addressCountry: "DE" };
      }
      exSchema.location = loc;
      const org = { "@type": "Organization", name: museum };
      exSchema.organizer = org;
      exSchema.performer = org;
      exSchema.offers = {
        "@type": "Offer",
        url: ex.detail_url || `https://museumsufer.app/?lang=de`,
        availability: "https://schema.org/InStock",
      };
      schemas.push(exSchema);
    }
  }

  const events = data.events as Array<Record<string, unknown>>;
  if (events) {
    events.slice(0, 20).forEach((ev) => {
      const date = ev.date as string;
      const time = ev.time as string | null;
      const endTime = ev.end_time as string | null;
      const endDate = ev.end_date as string | null;
      const museum = (ev.museum_name as string) || "";
      const slug = (ev.museum_slug as string) || "";
      const geo = MUSEUM_LOCATIONS[slug];

      const startIso = time ? `${date}T${time}:00${tz}` : `${date}T09:00:00${tz}`;
      let endIso: string;
      if (endTime) {
        const ed = endDate || date;
        endIso = `${ed}T${endTime}:00${tz}`;
      } else if (time) {
        const h = (parseInt(time.split(":")[0], 10) + 1) % 24;
        endIso = `${date}T${h.toString().padStart(2, "0")}:${time.split(":")[1]}:00${tz}`;
      } else {
        endIso = `${date}T18:00:00${tz}`;
      }

      const schema: Record<string, unknown> = {
        "@type": "Event",
        name: ev.title,
        startDate: startIso,
        endDate: endIso,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
      };
      if (ev.description) schema.description = ev.description;
      if (ev.detail_url) schema.url = ev.detail_url;
      if (ev.image_url) {
        const img = ev.image_url as string;
        schema.image = img.startsWith("/") ? `https://museumsufer.app${img}` : img;
      }

      const location: Record<string, unknown> = { "@type": "Place", name: museum };
      if (geo) {
        location.geo = { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng };
        location.address = { "@type": "PostalAddress", addressLocality: "Frankfurt am Main", addressCountry: "DE" };
      }
      schema.location = location;

      const org = { "@type": "Organization", name: museum };
      schema.organizer = org;
      schema.performer = org;
      schema.offers = ev.price
        ? {
            "@type": "Offer",
            url: ev.detail_url || ev.url,
            availability: "https://schema.org/InStock",
            description: ev.price,
          }
        : { "@type": "Offer", url: ev.detail_url || ev.url, availability: "https://schema.org/InStock" };

      schemas.push(schema);
    });
  }

  if (schemas.length === 0) return "";
  const wrapper = { "@context": "https://schema.org", "@graph": schemas };
  return `<script type="application/ld+json">${JSON.stringify(wrapper)}</script>`;
}
