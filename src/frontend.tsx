import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CLIENT_SCRIPT } from "./client-script";
import { ContentBody } from "./components";
import { todayIso } from "./date";
import { dateLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "./i18n";
import { getMuseumLocations } from "./museum-config";
import { escHtml, formatDateFull } from "./shared";
import { PAGE_STYLES } from "./styles";
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

function GithubCorner({ label }: { label: string }) {
  return (
    <a
      href="https://github.com/boredland/museumsufer"
      class="github-corner"
      aria-label={label}
      target="_blank"
      rel="noopener"
    >
      <span class="skip-link">{label}</span>
      <svg width="72" height="72" viewBox="0 0 250 250" aria-hidden="true">
        <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
        <path
          d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"
          fill="currentColor"
          style="transform-origin:130px 106px;"
          class="octo-arm"
        />
        <path
          d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"
          fill="currentColor"
          class="octo-body"
        />
      </svg>
    </a>
  );
}

function LangSwitch({ locale }: { locale: Locale }) {
  return (
    <nav class="lang-switch" aria-label="Language">
      {SUPPORTED_LOCALES.map((l) => (
        <a
          href={`?lang=${l}`}
          class={l === locale ? "active" : undefined}
          aria-current={l === locale ? "page" : undefined}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}

function SearchTrigger({ tr }: { tr: Record<string, string> }) {
  return (
    <button type="button" class="search-trigger" id="search-trigger" onclick="openSearch()">
      <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5" />
        <path d="M13 13l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <span>{tr.searchPlaceholder}</span>
      <kbd class="search-kbd">
        <kbd>Ctrl</kbd>+<kbd>K</kbd>
      </kbd>
    </button>
  );
}

function PassPromo({ locale, tr }: { locale: Locale; tr: Record<string, string> }) {
  const urls = PASS_URLS[locale];
  const utm = "?utm_source=museumsufer.app&utm_medium=referral&utm_campaign=pass_promo&utm_content=";
  return (
    <aside class="pass-promo">
      <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
        <path
          d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
        <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
        <path d="M14.5 9.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <span class="pass-promo-text">{tr.passPromo}</span>
      <span class="pass-promo-links">
        <a href={`https://www.museumsufer.de/${urls.card}${utm}card`} target="_blank" rel="noopener">
          {tr.passCard}
        </a>
        <a href={`https://www.museumsufer.de/${urls.ticket}${utm}ticket`} target="_blank" rel="noopener">
          {tr.passTicket}
        </a>
      </span>
    </aside>
  );
}

function DateNav({ tr }: { tr: Record<string, string> }) {
  return (
    <nav class="date-nav" aria-label={tr.dateNav}>
      <button type="button" id="btn-today" class="active">
        {tr.today}
      </button>
      <button type="button" id="btn-tomorrow">
        {tr.tomorrow}
      </button>
      <button type="button" id="btn-weekend">
        {tr.saturday}
      </button>
      <button type="button" id="btn-sunday">
        {tr.sunday}
      </button>
      <label class="date-picker-label">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
          <path
            d="M5 1v2m6-2v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        <input type="date" id="date-picker" aria-label={tr.pickDate} min="" max="" />
      </label>
      <button type="button" id="btn-near" aria-pressed="false" aria-label={tr.nearMe} title={tr.nearMe}>
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5" />
          <circle cx="8" cy="8" r="1" fill="currentColor" />
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </nav>
  );
}

function SearchDialog({ tr }: { tr: Record<string, string> }) {
  return (
    <dialog class="search-overlay" id="search-overlay" aria-label={tr.search}>
      <div class="search-box">
        <div class="search-input-wrap">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5" />
            <path d="M13 13l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <input
            class="search-input"
            id="search-input"
            type="text"
            placeholder={tr.searchPlaceholder}
            autocomplete="off"
            role="combobox"
            aria-expanded="false"
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={undefined}
          />
          <span class="search-kbd">Esc</span>
        </div>
        <div class="search-results" id="search-results" role="listbox" aria-label={tr.search} />
      </div>
    </dialog>
  );
}

function LlmTip({ tr }: { tr: Record<string, string> }) {
  return (
    <details class="llm-tip">
      <summary>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 1v4M8 11v4M1 8h4M11 8h4M3 3l2.5 2.5M10.5 10.5L13 13M13 3l-2.5 2.5M5.5 10.5L3 13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        {tr.llmTip}
      </summary>
      <div class="llm-tip-prompt" id="llm-prompt" data-prompt={tr.llmPrompt}>
        {tr.llmPrompt}
        <button type="button" class="llm-tip-copy" onclick="copyPrompt()" aria-label={tr.copyPrompt}>
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
): HtmlEscapedString {
  const tr = getTranslations(locale);
  const trJson = JSON.stringify(tr);
  const dlJson = JSON.stringify(dateLocale(locale));
  const localesJson = JSON.stringify(SUPPORTED_LOCALES);
  const initialDataJson = initialData ? JSON.stringify(initialData) : "null";
  const geoJson = JSON.stringify(MUSEUM_LOCATIONS);
  const museumsJson = JSON.stringify(museums || {});
  const berlinOffset = getBerlinUtcOffset();
  const eventSchemaJson = initialData ? buildEventSchema(initialData, berlinOffset) : "";
  const websiteSchema = `{"@context":"https://schema.org","@type":"WebSite","name":"Museumsufer Frankfurt","url":"https://museumsufer.app/","description":"${escHtml(tr.metaLong)}","inLanguage":["de","en","fr"]}`;

  const dataInit = `const T = ${trJson};
    const DATE_LOCALE = ${dlJson};
    const LOCALES = ${localesJson};
    const CURRENT_LANG = '${locale}';
    const __INITIAL_DATA__ = ${initialDataJson};
    const MUSEUM_GEO = ${geoJson};
    const MUSEUMS = ${museumsJson};`;

  return (
    <html lang={locale}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{tr.pageTitle}</title>
        <meta name="description" content={tr.metaLong} />
        <link rel="canonical" href="https://museumsufer.app/" />
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
        <meta property="og:image" content="https://museumsufer.app/og-image.svg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={tr.pageTitle} />
        <meta name="twitter:description" content={tr.metaLong} />
        <meta name="twitter:image" content="https://museumsufer.app/og-image.svg" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="alternate" type="application/rss+xml" title="Museumsufer Frankfurt" href="/feed.xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f5f0eb" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteSchema }} />
        {eventSchemaJson ? raw(eventSchemaJson) : null}
        <script src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js" defer />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&display=swap"
          rel="stylesheet"
          media="print"
          onload="this.media='all'"
        />
        <style dangerouslySetInnerHTML={{ __html: PAGE_STYLES }} />
      </head>
      <body>
        <a href="#content" class="skip-link">
          {tr.skipLink}
        </a>
        <GithubCorner label={tr.githubAria} />

        <div class="container">
          <header>
            <div class="logo">
              <div class="logo-icon">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12 2L2 7v2h20V7L12 2zm0 2.26L18.47 7H5.53L12 4.26zM2 19v2h20v-2H2zm2-8v8h2v-8H6zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2z" />
                </svg>
              </div>
            </div>
            <h1>Museumsufer Frankfurt</h1>
            <p class="subtitle">{tr.subtitle}</p>
            <LangSwitch locale={locale} />
          </header>

          <SearchTrigger tr={tr} />
          <PassPromo locale={locale} tr={tr} />
          <DateNav tr={tr} />

          <p class="date-label" id="date-label" aria-live="polite">
            {initialData ? formatDateFull(initialData.date, dateLocale(locale)) : ""}
          </p>

          <main id="content">
            {initialData ? (
              <ContentBody
                events={initialData.events as EventWithLikes[]}
                exhibitions={initialData.exhibitions as ExhibitionWithLikes[]}
                museums={museums || {}}
                tr={tr}
                locale={locale}
                todayIso={todayIso()}
              />
            ) : (
              <div class="loading">{tr.loading}</div>
            )}
          </main>

          <footer class="site-footer">
            <a
              href="https://calendar.google.com/calendar/r?cid=webcal://museumsufer.app/feed.ics"
              target="_blank"
              rel="noopener"
            >
              {tr.subscribeCal}
            </a>
            <a href="/feed.xml">{tr.rssFeed}</a>
            <a
              href="https://github.com/boredland/museumsufer/issues/new?template=missing-event.yml"
              target="_blank"
              rel="noopener"
            >
              {tr.missingEvent}
            </a>
          </footer>

          <details class="why-section">
            <summary>{tr.whyTitle}</summary>
            <p>{tr.whyText}</p>
          </details>

          <details class="why-section">
            <summary>{tr.privacyNote}</summary>
            <p>{tr.privacyText}</p>
          </details>

          <LlmTip tr={tr} />
        </div>

        <SearchDialog tr={tr} />

        <script dangerouslySetInnerHTML={{ __html: dataInit + CLIENT_SCRIPT }} />
      </body>
    </html>
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
  const events = data.events as Array<Record<string, unknown>>;
  if (!events || events.length === 0) return "";

  const schemas = events.slice(0, 20).map((ev) => {
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
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    };
    schema.endDate = endIso;
    if (ev.description) schema.description = ev.description;
    if (ev.detail_url) schema.url = ev.detail_url;
    if (ev.image_url) schema.image = ev.image_url;

    const location: Record<string, unknown> = { "@type": "Place", name: museum };
    if (geo) {
      location.geo = { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng };
      location.address = { "@type": "PostalAddress", addressLocality: "Frankfurt am Main", addressCountry: "DE" };
    }
    schema.location = location;

    if (ev.price) {
      schema.offers = { "@type": "Offer", price: 0, priceCurrency: "EUR", description: ev.price };
    }

    return schema;
  });

  const wrapper = { "@context": "https://schema.org", "@graph": schemas };
  return `<script type="application/ld+json">${JSON.stringify(wrapper)}</script>`;
}
