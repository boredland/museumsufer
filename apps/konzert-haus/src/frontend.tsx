import {
  buildUtm,
  type CalendarEvent,
  CalendarPopover,
  escapeHtml as coreEscapeHtml,
  digestScheduleLabel,
  HTMX_LIFECYCLE_SCRIPT,
  GERMAN_MONTHS_LONG as MONTHS_LONG,
  POPOVER_POSITIONING_SCRIPT,
  THEME_FOUC_SCRIPT,
  todayIso,
  GERMAN_WEEKDAYS as WEEKDAYS_LONG,
  GERMAN_WEEKDAYS_SHORT as WEEKDAYS_SHORT,
} from "@museumsufer/core";
import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { DateWithCount, DayEvent } from "./db";
import { DEFAULT_LOCALE, getTranslations, type Locale, SUPPORTED_LOCALES, type Translations } from "./i18n";
import { INLINE_CSS } from "./styles-inline";
import type { Genre } from "./types";

export type { DayEvent } from "./db";

export const APP_URL = "https://frankfurt.konzert.haus";
export const REPO_URL = "https://github.com/boredland/museumsufer";

const utm = buildUtm("frankfurt.konzert.haus");

export const GENRE_LABELS: Record<Genre, string> = {
  classical: "Klassik",
  jazz: "Jazz",
  sacred: "Kirchenmusik",
  world: "Weltmusik",
  experimental: "Neue Musik",
  chamber: "Kammermusik",
};

export function genreLabel(g: Genre, tr: Translations): string {
  switch (g) {
    case "classical":
      return tr.genreClassical;
    case "jazz":
      return tr.genreJazz;
    case "sacred":
      return tr.genreSacred;
    case "world":
      return tr.genreWorld;
    case "experimental":
      return tr.genreExperimental;
    case "chamber":
      return tr.genreChamber;
  }
}

function langSuffix(locale: Locale, separator: "?" | "&" = "?"): string {
  return locale === DEFAULT_LOCALE ? "" : `${separator}lang=${locale}`;
}

const GENRE_ORDER: Genre[] = ["classical", "jazz", "chamber", "sacred", "world", "experimental"];

const GENRE_COLOR_VAR: Record<Genre, string> = {
  classical: "var(--velvet)",
  jazz: "var(--amber)",
  sacred: "var(--stained)",
  world: "var(--terra)",
  experimental: "var(--steel)",
  chamber: "var(--salon)",
};

interface PageProps {
  date: string;
  today: string;
  events: DayEvent[];
  dateStrip: DateWithCount[];
  city: string;
  genre?: Genre | null;
  locale: Locale;
  tr: Translations;
  turnstileSiteKey?: string;
}

function dateParts(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    weekday: d.getUTCDay(),
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
    year: d.getUTCFullYear(),
  };
}

function fullGerman(iso: string): string {
  const p = dateParts(iso);
  return `${WEEKDAYS_LONG[p.weekday]}, ${p.day}. ${MONTHS_LONG[p.month]} ${p.year}`;
}

export interface HeadOptions {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  extraLinks?: Array<{ rel: string; href: string; type?: string; title?: string }>;
  turnstileSiteKey?: string;
  locale?: Locale;
  currentPath?: string;
}

export const escapeHtml = coreEscapeHtml;

function jsonLdSafe(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export function Head(opts: HeadOptions) {
  const ogImage = opts.ogImage ?? `${APP_URL}/og-image.png`;
  const jsonLdArr = opts.jsonLd ? (Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd]) : [];
  const fontHref =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap";
  return (
    <>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script dangerouslySetInnerHTML={{ __html: THEME_FOUC_SCRIPT }} />
      <title>{opts.title}</title>
      <meta name="description" content={opts.description} />
      <link rel="canonical" href={opts.canonical} />
      <meta property="og:title" content={opts.title} />
      <meta property="og:description" content={opts.description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={opts.canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={opts.locale === "en" ? "en_GB" : opts.locale === "fr" ? "fr_FR" : "de_DE"} />
      {opts.currentPath
        ? SUPPORTED_LOCALES.map((l) => {
            const path = opts.currentPath as string;
            const stripped = path.replace(/[?&]lang=[a-z]{2}/, "").replace(/[?&]$/, "");
            const sep = stripped.includes("?") ? "&" : "?";
            const href = `${APP_URL}${l === DEFAULT_LOCALE ? stripped : `${stripped}${sep}lang=${l}`}`;
            return <link key={`hreflang-${l}`} rel="alternate" hreflang={l} href={href} />;
          })
        : null}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="theme-color" content="#F7F0E7" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/icon-192.png" />
      <link rel="manifest" href="/manifest.json" />
      <link rel="alternate" type="application/json" title="konzert.haus API" href="/api/events" />
      <link rel="alternate" type="text/calendar" title="Programm iCal" href="/feed.ics" />
      {opts.extraLinks?.map((l) => (
        <link key={`${l.rel}-${l.href}`} rel={l.rel} href={l.href} type={l.type} title={l.title} />
      ))}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link rel="stylesheet" href={fontHref} media="print" onload="this.media='all'" />
      <noscript>
        <link rel="stylesheet" href={fontHref} />
      </noscript>
      <style dangerouslySetInnerHTML={{ __html: INLINE_CSS }} />
      <script src="/htmx.min.js" defer></script>
      {opts.turnstileSiteKey ? (
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      ) : null}
      {jsonLdArr.map((j, i) => (
        <script key={`jsonld-${i}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(j) }} />
      ))}
    </>
  );
}

export function Grain() {
  return <div class="grain" aria-hidden="true" />;
}

function LangSwitch({ locale, currentPath, tr }: { locale: Locale; currentPath: string; tr: Translations }) {
  const stripped = currentPath.replace(/[?&]lang=[a-z]{2}/, "").replace(/[?&]$/, "");
  const sep = stripped.includes("?") ? "&" : "?";
  return (
    <nav class="langswitch" aria-label={tr.langSwitchAria}>
      {SUPPORTED_LOCALES.map((l) => {
        const href = l === DEFAULT_LOCALE ? stripped || "/" : `${stripped || "/"}${sep}lang=${l}`;
        return (
          <a
            key={l}
            href={href}
            class={`langswitch__a${l === locale ? " langswitch__a--active" : ""}`}
            aria-current={l === locale ? "page" : undefined}
            hreflang={l}
          >
            {l.toUpperCase()}
          </a>
        );
      })}
    </nav>
  );
}

export function Masthead({ tr, locale, currentPath }: { tr: Translations; locale: Locale; currentPath: string }) {
  return (
    <header class="masthead">
      <a class="masthead__brand" href={`/${langSuffix(locale)}`}>
        <h1 class="wordmark">
          <span class="wordmark__konzert">konzert</span>
          <span class="wordmark__dot">.</span>
          <span class="wordmark__haus">haus</span>
        </h1>
        <p class="tagline">{tr.tagline}</p>
      </a>
      <hr class="masthead__rule" />
      <LangSwitch locale={locale} currentPath={currentPath} tr={tr} />
      <button type="button" class="theme-toggle" data-theme-toggle aria-label={tr.themeToggle} title={tr.themeToggle}>
        <svg class="tt-moon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg
          class="tt-sun"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        >
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4" />
        </svg>
      </button>
    </header>
  );
}

function GenreFilter({
  date,
  active,
  tr,
  locale,
}: {
  date: string;
  active?: Genre | null;
  tr: Translations;
  locale: Locale;
}) {
  const lang = langSuffix(locale);
  const langAmp = langSuffix(locale, "&");
  return (
    <div class="genre-filter">
      <span class="genre-filter__label">{tr.genre}</span>
      <a
        class={`genre-pill ${!active ? "genre-pill--active" : ""}`}
        href={`/tag/${date}${lang}`}
        hx-get={`/partial/programme?date=${date}`}
        hx-target="#programme-content"
        hx-push-url={`/tag/${date}${lang}`}
      >
        {tr.genreAll}
      </a>
      {GENRE_ORDER.map((g) => {
        const href = `/tag/${date}?genre=${g}${langAmp}`;
        return (
          <a
            key={g}
            class={`genre-pill ${active === g ? "genre-pill--active" : ""}`}
            href={href}
            hx-get={`/partial/programme?date=${date}&genre=${g}`}
            hx-target="#programme-content"
            hx-push-url={href}
          >
            <span class="genre-pill__dot" style={`background:${GENRE_COLOR_VAR[g]}`} />
            {genreLabel(g, tr)}
          </a>
        );
      })}
    </div>
  );
}

function DateStrip({
  strip,
  active,
  today,
  tr,
}: {
  strip: DateWithCount[];
  active: string;
  today: string;
  tr: Translations;
}) {
  if (!strip.length) return null;
  return (
    <nav class="datestrip" aria-label={tr.dateStripLabel}>
      <div class="datestrip__inner" id="datestrip">
        {strip.map((d) => {
          const p = dateParts(d.date);
          const isActive = d.date === active;
          const isToday = d.date === today;
          const cls = ["datetile", isActive ? "datetile--active" : "", isToday ? "datetile--today" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <a
              key={d.date}
              class={cls}
              href={`/tag/${d.date}`}
              aria-current={isActive ? "true" : "false"}
              hx-get={`/partial/programme?date=${d.date}`}
              hx-target="#programme-content"
              hx-push-url={`/tag/${d.date}`}
            >
              <span class="datetile__weekday">{WEEKDAYS_SHORT[p.weekday]}</span>
              <span class="datetile__day">{p.day}</span>
              <span class="datetile__month">{MONTHS_LONG[p.month].slice(0, 3)}</span>
              <span class="datetile__count">{d.n}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Germany observes CEST (+02:00) between the last Sunday of March and the
 * last Sunday of October, CET (+01:00) otherwise.
 */
function berlinOffsetFor(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "+01:00";
  const lastSundayUtc = (y: number, m: number): number => {
    const last = new Date(Date.UTC(y, m, 0));
    return last.getUTCDate() - last.getUTCDay();
  };
  const dstStart = lastSundayUtc(year, 3);
  const dstEnd = lastSundayUtc(year, 10);
  if (month > 3 && month < 10) return "+02:00";
  if (month < 3 || month > 10) return "+01:00";
  if (month === 3) return day >= dstStart ? "+02:00" : "+01:00";
  return day < dstEnd ? "+02:00" : "+01:00";
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function buildEventJsonLd(e: DayEvent): Record<string, unknown> {
  const offset = berlinOffsetFor(e.date);
  const startTime = e.time ?? "00:00";
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: e.title,
    startDate: `${e.date}T${startTime}:00${offset}`,
    location: {
      "@type": "MusicVenue",
      name: e.venue.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: e.venue.address,
        addressLocality: capitalize(e.venue.city),
        addressCountry: "DE",
      },
    },
    url: `${APP_URL}/tag/${e.date}#event-${e.id}`,
  };
  const description = e.description ?? e.subtitle ?? e.performers;
  if (description) jsonLd.description = description;
  if (e.end_time && e.time) jsonLd.endDate = `${e.date}T${e.end_time}:00${offset}`;
  if (e.performers) jsonLd.performer = [{ "@type": "PerformingGroup", name: e.performers }];
  if (e.ticket_url) {
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      url: e.ticket_url,
      priceCurrency: "EUR",
      validFrom: todayIso(),
    };
    if (e.price_min != null) offer.price = String(e.price_min);
    jsonLd.offers = offer;
  }
  if (e.image_url) jsonLd.image = e.image_url;
  return jsonLd;
}

export interface EventRowOptions {
  index: number;
  hideVenue?: boolean;
}

function PriceRange({ min, max }: { min?: number | null; max?: number | null }) {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return (
      <>
        {min}
        <span class="dash">–</span>
        {max}
        <span class="cur">€</span>
      </>
    );
  }
  return (
    <>
      {max ?? min}
      <span class="cur">€</span>
    </>
  );
}

export function Event({ e, opts, tr }: { e: DayEvent; opts: EventRowOptions; tr: Translations }) {
  const time = e.time ?? "—";
  const endTime = e.end_time ? `${tr.endTimePrefix} ${e.end_time}` : "";
  const venueRoom = e.venue_room ?? null;
  const titleSource = e.detail_url ?? e.ticket_url ?? null;
  const titleHref = titleSource ? utm(titleSource, "event_title") : null;
  const priceNode = <PriceRange min={e.price_min} max={e.price_max} />;
  const hasPrice = e.price_min != null || e.price_max != null;
  const label = genreLabel(e.genre, tr);
  const reportRegarding = `${e.title} — ${e.venue.name}, ${e.date}${e.time ? ` ${e.time}` : ""}`;
  const reportContext = `${APP_URL}/api/events/${e.id}`;
  const calendarEvent: CalendarEvent = {
    date: e.date,
    time: e.time ?? null,
    end_time: e.end_time ?? null,
    end_date: null,
    title: e.title,
    location: [e.venue.name, venueRoom && venueRoom !== e.venue.name ? venueRoom : null].filter(Boolean).join(", "),
    description: e.subtitle ?? null,
    detail_url: (() => {
      const src = e.detail_url ?? e.ticket_url ?? null;
      return src ? utm(src, "calendar") : null;
    })(),
  };

  const venueLine = opts.hideVenue ? (
    venueRoom ? (
      <p class="concert__venue">
        <span>{venueRoom}</span>
      </p>
    ) : null
  ) : (
    <p class="concert__venue">
      <a href={`/spielort/${e.venue.slug}`}>{e.venue.short_name ?? e.venue.name}</a>
      {venueRoom ? (
        <>
          <span class="concert__venue-sep">/</span>
          <span>{venueRoom}</span>
        </>
      ) : null}
    </p>
  );

  return (
    <li class="concert" id={`event-${e.id}`} style={`--i:${opts.index}`}>
      <script
        type="application/ld+json"
        data-id={String(e.id)}
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(buildEventJsonLd(e)) }}
      />
      <div class="concert__when">
        <span class="concert__time">{time}</span>
        {endTime ? <span class="concert__time-end">{endTime}</span> : null}
      </div>
      <div class="concert__body">
        <span class={`concert__genre concert__genre--${e.genre}`}>{label}</span>
        <h3 class="concert__title">
          {titleHref ? (
            <a href={titleHref} target="_blank" rel="noopener">
              {e.title}
            </a>
          ) : (
            e.title
          )}
        </h3>
        {e.subtitle ? <p class="concert__subtitle">{e.subtitle}</p> : null}
        {e.performers && e.performers !== e.subtitle ? <p class="concert__subtitle">{e.performers}</p> : null}
        {venueLine}
      </div>
      <div class="concert__rail">
        {hasPrice ? (
          <p class="concert__price">{priceNode}</p>
        ) : (
          <p class="concert__price concert__price--free">{tr.freeEntry}</p>
        )}
        <CalendarPopover
          event={calendarEvent}
          popoverId={`cal-${e.id}`}
          icsHref={`/event/${e.id}/feed.ics`}
          buttonClass="icon-btn"
          labels={{ addToCalendar: tr.toCalendar }}
        />
        <button
          type="button"
          class="icon-btn"
          data-report-regarding={reportRegarding}
          data-report-context={reportContext}
          aria-label={tr.reportConcert}
          title={tr.reportConcert}
        >
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
          >
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5v4M8 11h.01" stroke-linecap="round" />
          </svg>
        </button>
        {e.ticket_url ? (
          <a class="action" href={utm(e.ticket_url, "karten")} target="_blank" rel="noopener">
            <span>{tr.ticketsAction}</span>
            <span class="action__arrow" aria-hidden="true">
              →
            </span>
          </a>
        ) : null}
      </div>
    </li>
  );
}

function DigestCue({ tr, locale }: { tr: Translations; locale: Locale }) {
  return (
    <button type="button" class="digest-cue" data-digest-open aria-label={tr.digestTitle}>
      <span class="digest-cue__mark" aria-hidden="true">
        ※
      </span>
      <span class="digest-cue__kicker">{tr.digestKicker}</span>
      <span class="digest-cue__rule" aria-hidden="true" />
      <span class="digest-cue__text">{tr.digestCueText}</span>
      <span class="digest-cue__schedules" aria-hidden="true">
        {digestScheduleLabel(locale)}
      </span>
      <span class="digest-cue__chevron" aria-hidden="true">
        →
      </span>
    </button>
  );
}

function DigestDialog({ tr }: { tr: Translations }) {
  return (
    <dialog id="digest-dialog" class="contact-dialog">
      <form id="digest-form" class="contact-form" novalidate>
        <header class="contact-form__head">
          <h2 class="contact-form__title">{tr.digestTitle}</h2>
          <button type="button" class="contact-form__close" data-digest-close aria-label={tr.digestClose}>
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <path d="M3 3l10 10M13 3L3 13" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        <p class="contact-form__intro">
          Push-Nachrichten direkt aufs Gerät — keine E-Mail, kein Konto. Jederzeit abbestellbar.
        </p>
        <fieldset class="digest-options" aria-label={tr.digestSchedules}>
          <label class="digest-option">
            <input type="checkbox" name="schedule" value="morning" />
            <span class="digest-option__main">
              <span class="digest-option__title">{tr.digestMorning}</span>
              <span class="digest-option__time">07:00</span>
            </span>
            <span class="digest-option__sub">{tr.digestMorningSub}</span>
          </label>
          <label class="digest-option">
            <input type="checkbox" name="schedule" value="afternoon" />
            <span class="digest-option__main">
              <span class="digest-option__title">{tr.digestAfternoon}</span>
              <span class="digest-option__time">17:00</span>
            </span>
            <span class="digest-option__sub">{tr.digestAfternoonSub}</span>
          </label>
          <label class="digest-option">
            <input type="checkbox" name="schedule" value="weekly" />
            <span class="digest-option__main">
              <span class="digest-option__title">{tr.digestSunday}</span>
              <span class="digest-option__time">So 09:00</span>
            </span>
            <span class="digest-option__sub">{tr.digestSundaySub}</span>
          </label>
        </fieldset>
        <details class="digest-filter">
          <summary class="digest-filter__summary">
            <span class="digest-filter__label">{tr.digestFilterLabel}</span>
            <span class="digest-filter__hint">{tr.digestFilterHint}</span>
          </summary>
          <fieldset class="digest-filter__chips" aria-label={tr.genre}>
            {GENRE_ORDER.map((g) => (
              <label key={g} class="digest-chip">
                <input type="checkbox" name="filter-genre" value={g} />
                <span class="digest-chip__dot" style={`background:${GENRE_COLOR_VAR[g]}`} />
                <span class="digest-chip__label">{genreLabel(g, tr)}</span>
              </label>
            ))}
          </fieldset>
        </details>
        <p id="digest-ios-hint" class="contact-form__regarding" hidden>
          <span class="contact-form__regarding-label">iPhone</span>
          <span>
            Tippe »Teilen« und »Zum Home-Bildschirm hinzufügen«. Öffne dann über das App-Icon — erst dann sind
            Push-Nachrichten möglich.
          </span>
        </p>
        <p id="digest-unsupported" class="contact-form__regarding" hidden>
          <span class="contact-form__regarding-label">Browser</span>
          <span>
            Dein Browser unterstützt keine Push-Nachrichten. Probier es in Safari (macOS), Chrome, Firefox oder Edge.
          </span>
        </p>
        <footer class="contact-form__foot">
          <p id="digest-status" class="contact-form__status" hidden aria-live="polite" />
          <button
            type="button"
            id="digest-unsubscribe-all"
            hidden
            class="contact-form__submit"
            style="background:transparent;color:var(--felt-soft);border-color:var(--rule)"
          >
            Alle abbestellen
          </button>
          <button type="submit" id="digest-submit" class="contact-form__submit">
            Abonnieren
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function ContactDialog({ turnstileSiteKey, tr }: { turnstileSiteKey?: string; tr: Translations }) {
  return (
    <dialog id="contact-dialog" class="contact-dialog">
      <form id="contact-form" class="contact-form" novalidate>
        <header class="contact-form__head">
          <h2 class="contact-form__title">{tr.contactTitle}</h2>
          <button type="button" class="contact-form__close" data-contact-close aria-label={tr.digestClose}>
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <path d="M3 3l10 10M13 3L3 13" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        <p class="contact-form__intro">
          Falsche Zeit, fehlendes Konzert, Tippfehler? Wir freuen uns über jeden Hinweis.
        </p>
        <div class="contact-form__regarding" id="contact-regarding" hidden>
          <span class="contact-form__regarding-label">{tr.contactRegarding}</span>
          <span id="contact-regarding-text" />
        </div>
        <label class="contact-form__field">
          <span class="contact-form__label">Kategorie</span>
          <select id="contact-category" name="category" required>
            <option value="Konzert">{tr.contactCategoryConcert}</option>
            <option value="Spielort">{tr.contactCategoryVenue}</option>
            <option value="Allgemein">{tr.contactCategoryGeneral}</option>
          </select>
        </label>
        <label class="contact-form__field">
          <span class="contact-form__label">{tr.contactEmail}</span>
          <input type="email" id="contact-email" name="email" placeholder="dein@email.de" />
        </label>
        <label class="contact-form__field">
          <span class="contact-form__label">{tr.contactMessage}</span>
          <textarea id="contact-message" name="message" required rows={4} placeholder={tr.contactIntro} />
        </label>
        <input type="hidden" id="contact-context" name="context" />
        {turnstileSiteKey ? (
          <div class="cf-turnstile" data-sitekey={turnstileSiteKey} data-size="flexible" data-theme="auto" />
        ) : null}
        <footer class="contact-form__foot">
          <p id="contact-status" class="contact-form__status" hidden aria-live="polite" />
          <button type="submit" id="contact-submit" class="contact-form__submit">
            {tr.contactSend}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

const CLIENT_SCRIPT = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function(){ navigator.serviceWorker.register('/sw.js').catch(function(){}); });
}
(function(){
  var btn = document.querySelector('[data-theme-toggle]');
  if (btn) btn.addEventListener('click', function(){
    var html = document.documentElement;
    var isDark = html.classList.contains('dark');
    html.classList.toggle('dark', !isDark);
    html.classList.toggle('light', isDark);
    try { localStorage.setItem('theme', isDark ? 'light' : 'dark'); } catch(e){}
  });

  // After HTMX swaps in a new programme, re-sync date strip + genre pills to
  // match the URL the swap pushed. Without this, the user clicks a date and
  // sees the highlighted tile stay on yesterday — looks broken even though
  // the content updated.
  function currentDate(){
    var m = location.pathname.match(/^\\/tag\\/(\\d{4}-\\d{2}-\\d{2})/);
    return m ? m[1] : null;
  }
  function currentGenre(){ return new URLSearchParams(location.search).get('genre'); }

  function setAttrIfPresent(el, name, value){ if (el.hasAttribute(name)) el.setAttribute(name, value); }

  function syncDateStrip(){
    var date = currentDate(); if (!date) return;
    var genre = currentGenre();
    var qs = genre ? ('?genre=' + encodeURIComponent(genre)) : '';
    var hxQs = genre ? ('&genre=' + encodeURIComponent(genre)) : '';
    document.querySelectorAll('.datetile').forEach(function(t){
      var tileDate = (t.getAttribute('href') || '').match(/\\/tag\\/(\\d{4}-\\d{2}-\\d{2})/);
      if (!tileDate) return;
      var d = tileDate[1];
      var active = d === date;
      t.classList.toggle('datetile--active', active);
      t.setAttribute('aria-current', active ? 'true' : 'false');
      // Rewrite tile href + hx-* so date navigation preserves genre filter
      t.setAttribute('href', '/tag/' + d + qs);
      setAttrIfPresent(t, 'hx-get', '/partial/programme?date=' + d + hxQs);
      setAttrIfPresent(t, 'hx-push-url', '/tag/' + d + qs);
    });
    var active = document.querySelector('.datetile--active');
    if (active && active.scrollIntoView) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function syncGenreFilter(){
    var date = currentDate(); if (!date) return;
    var genre = currentGenre();
    document.querySelectorAll('.genre-pill').forEach(function(p){
      var href = p.getAttribute('href') || '';
      var pillGenre = (href.match(/[?&]genre=([^&]+)/) || [])[1] || null;
      var active = (genre || null) === (pillGenre ? decodeURIComponent(pillGenre) : null);
      p.classList.toggle('genre-pill--active', active);
      var base = '/tag/' + date;
      var partial = '/partial/programme?date=' + date;
      if (pillGenre){
        p.setAttribute('href', base + '?genre=' + pillGenre);
        setAttrIfPresent(p, 'hx-get', partial + '&genre=' + pillGenre);
        setAttrIfPresent(p, 'hx-push-url', base + '?genre=' + pillGenre);
      } else {
        p.setAttribute('href', base);
        setAttrIfPresent(p, 'hx-get', partial);
        setAttrIfPresent(p, 'hx-push-url', base);
      }
    });
  }

  document.addEventListener('click', function(e){
    var tile = e.target.closest('.datetile');
    if (tile){
      document.querySelectorAll('.datetile--active').forEach(function(el){ el.classList.remove('datetile--active'); el.setAttribute('aria-current', 'false'); });
      tile.classList.add('datetile--active'); tile.setAttribute('aria-current', 'true');
      return;
    }
    var pill = e.target.closest('.genre-pill');
    if (pill){
      document.querySelectorAll('.genre-pill--active').forEach(function(el){ el.classList.remove('genre-pill--active'); });
      pill.classList.add('genre-pill--active');
    }
  });

  document.body.addEventListener('htmx:afterSwap', function(e){
    if (!e.detail || !e.detail.target || e.detail.target.id !== 'programme-content') return;
    syncDateStrip(); syncGenreFilter();
  });
  window.addEventListener('popstate', function(){ syncDateStrip(); syncGenreFilter(); });

  function onReady(){ syncDateStrip(); syncGenreFilter(); }
  if (document.readyState !== 'loading') onReady();
  else document.addEventListener('DOMContentLoaded', onReady);

  // Contact dialog — opens for footer button + per-event report buttons,
  // submits to /api/contact which forwards to email.
  (function(){
    var dlg = document.getElementById('contact-dialog');
    if (!dlg) return;
    var form = document.getElementById('contact-form');
    var category = document.getElementById('contact-category');
    var message = document.getElementById('contact-message');
    var context = document.getElementById('contact-context');
    var regarding = document.getElementById('contact-regarding');
    var regardingText = document.getElementById('contact-regarding-text');
    var status = document.getElementById('contact-status');
    var submit = document.getElementById('contact-submit');

    function open(prefill){
      status.hidden = true; status.textContent = ''; status.className = 'contact-form__status';
      submit.disabled = false; submit.textContent = 'Senden';
      if (prefill && prefill.category) category.value = prefill.category;
      if (prefill && prefill.regarding) {
        regardingText.textContent = prefill.regarding;
        context.value = prefill.context || prefill.regarding;
        regarding.hidden = false;
      } else {
        regarding.hidden = true; regardingText.textContent = '';
        context.value = location.href;
      }
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
      setTimeout(function(){ message.focus(); }, 50);
    }
    function close(){
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    }

    document.addEventListener('click', function(e){
      var openBtn = e.target.closest('[data-contact-open]');
      if (openBtn) { e.preventDefault(); open(null); return; }
      var closeBtn = e.target.closest('[data-contact-close]');
      if (closeBtn) { e.preventDefault(); close(); return; }
      var reportBtn = e.target.closest('[data-report-regarding]');
      if (reportBtn) {
        e.preventDefault();
        open({
          category: 'Konzert',
          regarding: reportBtn.getAttribute('data-report-regarding') || '',
          context: reportBtn.getAttribute('data-report-context') || ''
        });
      }
    });

    dlg.addEventListener('click', function(e){ if (e.target === dlg) close(); });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      submit.disabled = true; submit.textContent = 'Wird gesendet…';
      status.hidden = true;
      var data = new FormData(form);
      var payload = {};
      data.forEach(function(v, k){ payload[k] = v; });
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(r){
        if (!r.ok) throw new Error('submit failed');
        status.textContent = 'Danke — Hinweis ist angekommen.';
        status.className = 'contact-form__status contact-form__status--ok';
        status.hidden = false;
        form.reset();
        setTimeout(close, 1800);
      }).catch(function(){
        status.textContent = 'Senden fehlgeschlagen. Bitte schreib direkt an feedback@konzert.haus.';
        status.className = 'contact-form__status contact-form__status--err';
        status.hidden = false;
        submit.disabled = false; submit.textContent = 'Senden';
      });
    });
  })();

  // Digest dialog — Web Push subscription management
  (function(){
    var dlg = document.getElementById('digest-dialog');
    if (!dlg) return;
    var form = document.getElementById('digest-form');
    var status = document.getElementById('digest-status');
    var submit = document.getElementById('digest-submit');
    var unsubBtn = document.getElementById('digest-unsubscribe-all');
    var iosHint = document.getElementById('digest-ios-hint');
    var unsupported = document.getElementById('digest-unsupported');
    var boxes = form.querySelectorAll('input[name="schedule"]');
    var genreBoxes = form.querySelectorAll('input[name="filter-genre"]');

    function checked(){
      var out = [];
      boxes.forEach(function(b){ if (b.checked) out.push(b.value); });
      return out;
    }
    function setChecked(values){
      boxes.forEach(function(b){ b.checked = values.indexOf(b.value) !== -1; });
    }
    function checkedGenres(){
      var out = [];
      genreBoxes.forEach(function(b){ if (b.checked) out.push(b.value); });
      return out;
    }
    function setGenres(values){
      genreBoxes.forEach(function(b){ b.checked = values.indexOf(b.value) !== -1; });
    }
    function setStatus(msg, kind){
      if (!msg){ status.hidden = true; status.textContent = ''; status.className = 'contact-form__status'; return; }
      status.hidden = false;
      status.textContent = msg;
      status.className = 'contact-form__status' + (kind === 'ok' ? ' contact-form__status--ok' : kind === 'err' ? ' contact-form__status--err' : '');
    }
    function b64ToBytes(s){
      var pad = '='.repeat((4 - s.length % 4) % 4);
      var b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    function iosNonStandalone(){
      var ua = navigator.userAgent || '';
      var isIos = /iP(hone|od|ad)/.test(ua) || (ua.indexOf('Mac') >= 0 && 'ontouchend' in document);
      if (!isIos) return false;
      var standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
      return !standalone;
    }
    function supports(){
      return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }
    function currentSub(){
      return navigator.serviceWorker.ready.then(function(reg){ return reg.pushManager.getSubscription(); });
    }
    function openDialog(){
      setStatus('');
      submit.disabled = false; submit.textContent = 'Abonnieren';
      unsubBtn.hidden = true;
      setChecked([]); setGenres([]);
      iosHint.hidden = true; unsupported.hidden = true;
      if (!supports()){
        if (iosNonStandalone()) iosHint.hidden = false; else unsupported.hidden = false;
        submit.disabled = true;
      } else if (iosNonStandalone()){
        iosHint.hidden = false; submit.disabled = true;
      } else {
        currentSub().then(function(existing){
          if (!existing) return;
          return fetch('/api/push/me?endpoint=' + encodeURIComponent(existing.endpoint))
            .then(function(r){ return r.ok ? r.json() : null; })
            .then(function(me){
              if (me && me.schedules && me.schedules.length){
                setChecked(me.schedules);
                if (me.filters && Array.isArray(me.filters.genres)) setGenres(me.filters.genres);
                submit.textContent = 'Speichern';
                unsubBtn.hidden = false;
              }
            });
        }).catch(function(){});
      }
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }
    function closeDialog(){
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    }
    function submitFlow(){
      var sched = checked();
      submit.disabled = true;
      submit.textContent = sched.length === 0 ? 'Wird abbestellt…' : 'Wird gespeichert…';
      setStatus('');
      currentSub().then(function(existing){
        if (sched.length === 0){
          if (!existing) return null;
          return fetch('/api/push/unsubscribe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: existing.endpoint })
          }).then(function(){ return existing.unsubscribe().catch(function(){}); })
            .then(function(){ return 'unsubscribed'; });
        }
        function withSub(sub){
          var json = sub.toJSON();
          var genres = checkedGenres();
          var filters = genres.length > 0 ? { genres: genres } : null;
          return fetch('/api/push/subscribe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, schedules: sched, filters: filters })
          }).then(function(r){ if (!r.ok) throw new Error('save-failed'); return 'saved'; });
        }
        if (existing) return withSub(existing);
        if (Notification.permission === 'denied') throw new Error('permission-denied');
        var permP = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
        return permP.then(function(p){
          if (p !== 'granted') throw new Error('permission-denied');
          return fetch('/api/push/key').then(function(r){ if (!r.ok) throw new Error('key-failed'); return r.json(); });
        }).then(function(data){
          return navigator.serviceWorker.ready.then(function(reg){
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.publicKey) });
          });
        }).then(withSub);
      }).then(function(outcome){
        setStatus(outcome === 'unsubscribed' ? 'Abbestellt.' : 'Gespeichert.', 'ok');
        if (outcome === 'saved'){ submit.textContent = 'Speichern'; unsubBtn.hidden = false; }
        setTimeout(closeDialog, 1200);
      }).catch(function(err){
        var msg = 'Speichern fehlgeschlagen.';
        if (err && err.message === 'permission-denied') msg = 'Benachrichtigungen wurden blockiert. Erlaube sie in den Browser-Einstellungen.';
        setStatus(msg, 'err');
        submit.disabled = false;
        var resched = checked();
        submit.textContent = resched.length === 0 ? 'Abbestellen' : (unsubBtn.hidden ? 'Abonnieren' : 'Speichern');
      });
    }

    document.addEventListener('click', function(e){
      var openBtn = e.target.closest && e.target.closest('[data-digest-open]');
      if (openBtn){ e.preventDefault(); openDialog(); return; }
      var closeBtn = e.target.closest && e.target.closest('[data-digest-close]');
      if (closeBtn){ e.preventDefault(); closeDialog(); return; }
    });
    dlg.addEventListener('click', function(e){ if (e.target === dlg) closeDialog(); });
    form.addEventListener('submit', function(e){ e.preventDefault(); submitFlow(); });
    unsubBtn.addEventListener('click', function(e){ e.preventDefault(); setChecked([]); submitFlow(); });
    form.addEventListener('change', function(){
      if (submit.disabled) return;
      var sched = checked();
      if (sched.length === 0 && !unsubBtn.hidden) submit.textContent = 'Abbestellen';
      else submit.textContent = unsubBtn.hidden ? 'Abonnieren' : 'Speichern';
    });
  })();
})();
`;

function ClientBehaviors() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `${CLIENT_SCRIPT}\n${POPOVER_POSITIONING_SCRIPT}\n${HTMX_LIFECYCLE_SCRIPT}`,
      }}
    />
  );
}

export function Footer({ tr, locale }: { tr: Translations; locale: Locale }) {
  const lang = langSuffix(locale);
  return (
    <footer class="footer">
      <span class="footer__rule" />
      <p>{tr.homeDescription}</p>
      <div class="footer__actions">
        <button type="button" class="footer__action" data-digest-open aria-label={tr.digestSubscribe}>
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M8 1.5a4 4 0 0 0-4 4v3l-1.5 2.5h11L12 8.5v-3a4 4 0 0 0-4-4z" stroke-linejoin="round" />
            <path d="M6 13a2 2 0 0 0 4 0" stroke-linecap="round" />
          </svg>
          <span>{tr.digestSubscribe}</span>
        </button>
        <button type="button" class="footer__action" data-contact-open aria-label={tr.reportProblem}>
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5v4M8 11h.01" stroke-linecap="round" />
          </svg>
          <span>{tr.reportProblem}</span>
        </button>
      </div>
      <div class="footer__links">
        <a href="/feed.ics">iCal</a>
        <span class="footer__sep">·</span>
        <a href="/feed.rss">RSS</a>
        <span class="footer__sep">·</span>
        <a href="/api/docs">API</a>
        <span class="footer__sep">·</span>
        <a href={`/impressum${lang}`}>{tr.imprint}</a>
        <span class="footer__sep">·</span>
        <a href={REPO_URL} target="_blank" rel="noopener">
          GitHub
        </a>
      </div>
    </footer>
  );
}

export function ProgrammePartial({ date, events, tr }: { date: string; events: DayEvent[]; tr: Translations }) {
  const dp = dateParts(date);
  return (
    <>
      <header class="programme__header">
        <p class="programme__line" />
        <p class="programme__weekday">{WEEKDAYS_LONG[dp.weekday]}</p>
        <h2 class="programme__date">
          <span class="programme__day">{dp.day}.</span>
          <span class="programme__month">{MONTHS_LONG[dp.month]}</span>
          <span class="programme__year">{dp.year}</span>
        </h2>
      </header>
      {events.length === 0 ? (
        <div class="empty">
          <p class="empty__mark">∅</p>
          <p>{tr.emptyTitle}</p>
        </div>
      ) : (
        <ol class="concerts" id="concerts">
          {events.map((e, i) => (
            <Event key={e.id} e={e} opts={{ index: i }} tr={tr} />
          ))}
        </ol>
      )}
    </>
  );
}

const DEFAULT_TR = getTranslations(DEFAULT_LOCALE);

export function renderProgrammePartial(
  date: string,
  events: DayEvent[],
  tr: Translations = DEFAULT_TR,
): HtmlEscapedString {
  return (<ProgrammePartial date={date} events={events} tr={tr} />) as unknown as HtmlEscapedString;
}

export function renderHead(opts: HeadOptions): HtmlEscapedString {
  return (<Head {...opts} />) as unknown as HtmlEscapedString;
}

export function renderFooter(tr: Translations = DEFAULT_TR, locale: Locale = DEFAULT_LOCALE): HtmlEscapedString {
  return (<Footer tr={tr} locale={locale} />) as unknown as HtmlEscapedString;
}

export function renderEvent(e: DayEvent, opts: EventRowOptions, tr: Translations = DEFAULT_TR): HtmlEscapedString {
  return (<Event e={e} opts={opts} tr={tr} />) as unknown as HtmlEscapedString;
}

export function renderPage(props: PageProps): HtmlEscapedString {
  const { date, today, events, dateStrip, genre, locale, tr, turnstileSiteKey } = props;
  const niceDate = niceDateFor(date, locale);
  const currentPath = genre ? `/tag/${date}?genre=${genre}` : `/tag/${date}`;
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`konzert.haus · ${niceDate}`}
            description={tr.homeDescription}
            canonical={`${APP_URL}/tag/${date}${langSuffix(locale)}`}
            locale={locale}
            currentPath={currentPath}
            turnstileSiteKey={turnstileSiteKey}
          />
        </head>
        <body>
          <Grain />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <GenreFilter date={date} active={genre} tr={tr} locale={locale} />
          <DateStrip strip={dateStrip} active={date} today={today} tr={tr} />
          <DigestCue tr={tr} locale={locale} />
          <main class="programme" id="programme">
            <div id="programme-content">
              <ProgrammePartial date={date} events={events} tr={tr} />
            </div>
          </main>
          <Footer tr={tr} locale={locale} />
          <ContactDialog turnstileSiteKey={turnstileSiteKey} tr={tr} />
          <DigestDialog tr={tr} />
          <ClientBehaviors />
        </body>
      </html>
    </>
  ) as unknown as HtmlEscapedString;
}

function niceDateFor(date: string, locale: Locale): string {
  if (locale === "de") return fullGerman(date);
  const d = new Date(`${date}T12:00:00Z`);
  const fmt = locale === "fr" ? "fr-FR" : "en-GB";
  return d.toLocaleDateString(fmt, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
