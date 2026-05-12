import {
  buildFaqPageSchema,
  buildHreflangAlternates,
  buildLangParam as coreBuildLangParam,
  digestScheduleLabel,
  type FaqItem,
  LLM_SERVICES,
  THEME_FOUC_SCRIPT,
} from "@museumsufer/core";
import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { ContentBody, MuseumsSection } from "./components";
import { berlinNow, todayIso } from "./date";
import { dateLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "./i18n";
import { ICON, IconSprite } from "./icons";
import { getMuseumConfig, getMuseumLocations } from "./museum-config";
import { getAllMuseums } from "./queries";
import { generateScriptInit } from "./script-init";
import { formatDateFull } from "./shared";
import { INLINE_CSS } from "./styles-inline";
import type { EventWithLikes, ExhibitionWithLikes, MuseumInfo } from "./types";

/** Theme initialization script to prevent flash of unstyled content */
export const THEME_SCRIPT = THEME_FOUC_SCRIPT;

/** Generates language parameter string for URLs */
export function buildLangParam(locale: Locale): string {
  return coreBuildLangParam(locale, "de");
}

export type { MuseumInfo };

const MUSEUM_LOCATIONS = getMuseumLocations();

export interface InitialData {
  date: string;
  exhibitions: unknown[];
  events: unknown[];
}

/** Options for rendering the HTML head */
interface HtmlHeadOptions {
  locale: Locale;
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  jsonSchemas?: Array<{ name: string; json: string }>;
  twitterCard?: "summary_large_image" | "summary";
  turnstileSiteKey?: string;
}

/**
 * Build hreflang alternates from a canonical URL by extracting the path
 * and delegating to the shared core builder. Preserves every non-`lang`
 * query param and dedupes `?lang=`.
 */
function buildHreflangsForCanonical(canonicalUrl: string): Array<{ hreflang: string; href: string }> {
  const u = new URL(canonicalUrl);
  const currentPath = u.pathname + (u.search || "");
  return buildHreflangAlternates({
    currentPath,
    appUrl: u.origin,
    supported: SUPPORTED_LOCALES,
    fallback: "de",
  });
}

/** Renders the HTML head with meta tags, fonts, stylesheets, and structured data */
export function renderHtmlHead(options: HtmlHeadOptions) {
  const {
    locale,
    title,
    description,
    canonicalUrl,
    ogImage = "https://museumsufer.app/og-image.png",
    jsonSchemas = [],
    twitterCard = "summary_large_image",
    turnstileSiteKey,
  } = options;

  const hreflangs = buildHreflangsForCanonical(canonicalUrl);

  return (
    <>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {hreflangs.map((h) => (
        <link key={h.hreflang} rel="alternate" hreflang={h.hreflang} href={h.href} />
      ))}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:locale" content={locale === "en" ? "en_GB" : locale === "fr" ? "fr_FR" : "de_DE"} />
      <meta property="og:site_name" content="Museumsufer Frankfurt" />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
      <link rel="apple-touch-icon" href="/icon-192.png" />
      <meta name="theme-color" content="#efe7d8" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#14110e" media="(prefers-color-scheme: dark)" />
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link
        rel="preload"
        as="style"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
        onload="this.onload=null;this.rel='stylesheet'"
      />
      <noscript>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
        />
      </noscript>
      {jsonSchemas.map((schema) => (
        <script key={schema.name} type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema.json }} />
      ))}
      {/* Turnstile is lazy-loaded via window.__loadTurnstile() on dialog open — see TURNSTILE_LAZY_LOAD_SCRIPT in client-script.ts. */}
      <style dangerouslySetInnerHTML={{ __html: INLINE_CSS }} />
    </>
  );
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

function Mark({ class: cls }: { class?: string }) {
  return (
    <svg viewBox="0 0 96 80" role="img" aria-label="Museumsufer" class={cls} xmlns="http://www.w3.org/2000/svg">
      <circle cx="48" cy="10" r="5" fill="#b45309" />
      <g fill="currentColor">
        <path d="M 48 20 L 84 58 L 12 58 Z" />
        <rect x="4" y="66" width="88" height="10" />
      </g>
    </svg>
  );
}

/** Masthead with logo, location, theme toggle, and language switcher */
export function Masthead({ locale, tr }: { locale: Locale; tr: Record<string, string> }) {
  return (
    <header class="masthead">
      <div class="masthead__head">
        <div class="masthead__brand">
          <Mark class="masthead__mark" />
          <p class="section-eyebrow masthead__location">Frankfurt am Main · 50.10°N 8.68°E</p>
        </div>
        <div class="masthead__actions">
          <ThemeToggle tr={tr} />
          <LangSwitch locale={locale} tr={tr} />
        </div>
      </div>
      <h1 class="masthead__title">Museumsufer</h1>
      <div class="masthead__band-row">
        <div class="river-band" aria-hidden="true" />
        <span class="masthead__band-label">{tr.subtitle}</span>
        <div class="river-band" aria-hidden="true" />
      </div>
    </header>
  );
}

function ThemeToggle({ tr }: { tr: Record<string, string> }) {
  return (
    <button type="button" id="theme-toggle" class="theme-toggle" title={tr.switchTheme} aria-label={tr.switchTheme}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="theme-toggle__icon"
        aria-hidden="true"
      >
        <path
          class="theme-toggle__moon"
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
          fill="currentColor"
          stroke="none"
        />
        <circle class="theme-toggle__sun" cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
        <path
          class="theme-toggle__sun"
          d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          stroke="currentColor"
        />
      </svg>
    </button>
  );
}

function LangSwitch({ locale, tr }: { locale: Locale; tr: Record<string, string> }) {
  return (
    <nav class="langswitch" aria-label={tr.langSwitchAria}>
      {SUPPORTED_LOCALES.map((l) => (
        <a
          href={`?lang=${l}`}
          data-lang={l}
          class={`langswitch__link${l === locale ? " langswitch__link--active" : ""}`}
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
    <div class="search-bar">
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true" class="search-bar__icon">
        <path d={ICON.search} />
      </svg>
      <input
        type="search"
        id="search-input"
        autocomplete="off"
        placeholder={tr.searchPlaceholder}
        aria-label={tr.search}
      />
      <button type="button" id="search-clear" class="search-clear" aria-label={tr.clearSearch}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
          <path d={ICON.close} />
        </svg>
      </button>
      <kbd class="kbd kbd--desktop">⌘K</kbd>
    </div>
  );
}

function PassPromo({ locale, tr }: { locale: Locale; tr: Record<string, string> }) {
  const urls = PASS_URLS[locale];
  const utm = "?utm_source=museumsufer.app&utm_medium=referral&utm_campaign=pass_promo&utm_content=";
  return (
    <aside class="pass-promo">
      <p class="pass-promo__kicker">Card · Ticket</p>
      <p class="pass-promo__line">{tr.passPromo}</p>
      <div class="pass-promo__actions">
        <a href={`https://www.museumsufer.de/${urls.card}${utm}card`} target="_blank" rel="noopener" class="pass-link">
          {tr.passCard}
        </a>
        <a
          href={`https://www.museumsufer.de/${urls.ticket}${utm}ticket`}
          target="_blank"
          rel="noopener"
          class="pass-link"
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
  dateCounts,
}: {
  locale: Locale;
  tr: Record<string, string>;
  activeDate: string;
  activeRange?: number;
  /** Per-day event counts for the visible window. */
  dateCounts: Array<{ date: string; count: number }>;
}) {
  const dl = dateLocale(locale);
  const todayIsoStr = berlinNow().format("YYYY-MM-DD");
  // The bundle is already capped at +90 days at scrape time; use whatever
  // the queries layer surfaces. Always include today even if no events,
  // so the strip's "is-today" anchor is present.
  const stops = [...dateCounts];
  if (!stops.find((s) => s.date === todayIsoStr)) {
    stops.unshift({ date: todayIsoStr, count: 0 });
    stops.sort((a, b) => a.date.localeCompare(b.date));
  }
  const days = stops.map((s) => {
    const d = berlinNow();
    const [y, m, dd] = s.date.split("-").map(Number);
    const date = d
      .year(y)
      .month(m - 1)
      .date(dd);
    const isToday = s.date === todayIsoStr;
    return {
      iso: s.date,
      weekday: isToday ? tr.today : date.toDate().toLocaleDateString(dl, { weekday: "short" }),
      day: String(date.date()),
      month: date.toDate().toLocaleDateString(dl, { month: "short" }),
      count: s.count,
      isToday,
    };
  });

  return (
    <nav class="rivernav" aria-label={tr.dateNav}>
      <div id="river-strip" class="river-strip">
        <div class="river-strip__inner">
          <div class="river-strip__rail">
            {days.map((d) => (
              <button
                type="button"
                data-date={d.iso}
                class={`date-stop${!activeRange && d.iso === activeDate ? " active" : ""}${d.isToday ? " is-today" : ""}`}
              >
                <span class="stop-weekday">{d.weekday}</span>
                <span class="stop-day">{d.day}</span>
                <span class="stop-month">{d.month}</span>
                <span class="stop-count">{d.count > 0 ? d.count : ""}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div class="range-row">
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
          <span class="near-label">{tr.nearMe}</span>
        </button>
      </div>
    </nav>
  );
}

function AskAI({ tr }: { tr: Record<string, string> }) {
  return (
    <section class="ask-ai" aria-label={tr.llmTip}>
      <span class="ask-ai__label">{tr.llmTip}</span>
      <div class="ask-ai__list">
        {LLM_SERVICES.map((s) => (
          <a
            href={s.buildUrl(tr.llmPrompt)}
            target="_blank"
            rel="noopener"
            aria-label={s.name}
            title={s.name}
            class="ask-ai__link"
            style={`color:${s.color}`}
          >
            <svg aria-hidden="true" class="ask-ai__icon">
              <use href={`#i-${s.id}`} />
            </svg>
          </a>
        ))}
      </div>
    </section>
  );
}

/** Digest subscription dialog — Web Push opt-in with schedule picker */
export function DigestDialog({ tr }: { tr: Record<string, string> }) {
  const museumOptions = getAllMuseums()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  return (
    <dialog id="digest-dialog" class="dialog">
      <form id="digest-form" class="dialog__form">
        <div class="dialog__head">
          <h2 class="dialog__title">{tr.digestTitle}</h2>
          <button type="button" data-digest-close aria-label={tr.contactClose} class="dialog__close">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <path d={ICON.close} />
            </svg>
          </button>
        </div>

        <p class="dialog__intro">{tr.digestIntro}</p>

        <fieldset class="digest-options" aria-label={tr.digestTitle}>
          <label class="digest-option">
            <input type="checkbox" name="schedule" value="morning" class="digest-option__radio" />
            <span class="digest-option__label">
              <span class="digest-option__name">{tr.digestSchedMorning}</span>
              <span class="digest-option__time">{tr.digestSchedMorningTime}</span>
            </span>
            <span class="digest-option__desc">{tr.digestSchedMorningDesc}</span>
          </label>
          <label class="digest-option">
            <input type="checkbox" name="schedule" value="afternoon" class="digest-option__radio" />
            <span class="digest-option__label">
              <span class="digest-option__name">{tr.digestSchedAfternoon}</span>
              <span class="digest-option__time">{tr.digestSchedAfternoonTime}</span>
            </span>
            <span class="digest-option__desc">{tr.digestSchedAfternoonDesc}</span>
          </label>
          <label class="digest-option">
            <input type="checkbox" name="schedule" value="weekly" class="digest-option__radio" />
            <span class="digest-option__label">
              <span class="digest-option__name">{tr.digestSchedWeekly}</span>
              <span class="digest-option__time">{tr.digestSchedWeeklyTime}</span>
            </span>
            <span class="digest-option__desc">{tr.digestSchedWeeklyDesc}</span>
          </label>
        </fieldset>

        <details class="digest-filter">
          <summary class="digest-filter__summary">
            <span class="digest-filter__label">
              <span class="digest-filter__caret">▸</span>
              {tr.digestFilterLabel}
            </span>
            <span class="digest-filter__hint">{tr.digestFilterHint}</span>
          </summary>
          <fieldset class="digest-filter__list" aria-label={tr.digestFilterLabel}>
            {museumOptions.map((m) => (
              <label key={m.slug} class="digest-filter__chip">
                <input type="checkbox" name="filter-museum" value={m.slug} class="digest-filter__chip-input" />
                <span>{m.name}</span>
              </label>
            ))}
          </fieldset>
        </details>

        <div id="digest-ios-hint" hidden class="dialog__hint" dangerouslySetInnerHTML={{ __html: tr.digestIosHint }} />

        <div id="digest-unsupported" hidden class="dialog__error">
          {tr.digestUnsupported}
        </div>

        <div class="dialog__footer">
          <p id="digest-status" hidden class="dialog__status" aria-live="polite" />
          <button type="button" id="digest-unsubscribe-all" hidden class="btn-link">
            {tr.digestUnsubAll}
          </button>
          <button type="submit" id="digest-submit" class="btn-primary">
            {tr.digestSubscribe}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** Contact dialog for submitting feedback, missing events, or museum corrections */
export function ContactDialog({ tr, turnstileSiteKey }: { tr: Record<string, string>; turnstileSiteKey?: string }) {
  return (
    <dialog id="contact-dialog" class="dialog dialog--wide">
      <form id="contact-form" class="dialog__form">
        <div class="dialog__head">
          <h2 class="dialog__title">{tr.contactTitle}</h2>
          <button type="button" data-contact-close aria-label={tr.contactClose} class="dialog__close">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <path d={ICON.close} />
            </svg>
          </button>
        </div>

        <div id="contact-regarding" hidden class="dialog__regarding">
          <span class="dialog__regarding-kicker">{tr.contactRegarding}</span>
          <span id="contact-regarding-text" class="dialog__regarding-text" />
        </div>

        <label class="field">
          <span class="field__label">{tr.contactCategoryLabel}</span>
          <select id="contact-category" name="category" required class="field__select">
            <option value={tr.contactCategoryEvent}>{tr.contactCategoryEvent}</option>
            <option value={tr.contactCategoryInstitution}>{tr.contactCategoryInstitution}</option>
            <option value={tr.contactCategoryFeedback}>{tr.contactCategoryFeedback}</option>
          </select>
        </label>

        <label class="field">
          <span class="field__label">{tr.contactEmailLabel}</span>
          <input
            type="email"
            id="contact-email"
            name="email"
            required
            placeholder={tr.contactEmailPlaceholder}
            class="field__input"
          />
        </label>

        <label class="field">
          <span class="field__label">{tr.contactMessageLabel}</span>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={4}
            placeholder={tr.contactMessagePlaceholder}
            class="field__textarea"
          />
        </label>

        <input type="hidden" id="contact-context" name="context" />

        {turnstileSiteKey ? (
          <div class="cf-turnstile" data-sitekey={turnstileSiteKey} data-size="flexible" data-theme="auto" />
        ) : null}

        <div class="dialog__footer">
          <p id="contact-status" hidden class="dialog__status" aria-live="polite" />
          <button type="submit" id="contact-submit" class="btn-primary">
            {tr.contactSubmit}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function AboutSection({ tr }: { tr: Record<string, string> }) {
  return (
    <section class="about">
      <h2 class="about__title">{tr.aboutHeading}</h2>
      <p class="about__body">{tr.introText}</p>
    </section>
  );
}

function faqItems(tr: Record<string, string>): FaqItem[] {
  return [
    { q: tr.faq1Q, a: tr.faq1A },
    { q: tr.faq2Q, a: tr.faq2A },
    { q: tr.faq3Q, a: tr.faq3A },
    { q: tr.faq4Q, a: tr.faq4A },
    { q: tr.faq5Q, a: tr.faq5A },
    { q: tr.faq6Q, a: tr.faq6A },
    { q: tr.faq7Q, a: tr.faq7A },
    { q: tr.faq8Q, a: tr.faq8A },
  ];
}

function FaqSection({ tr }: { tr: Record<string, string> }) {
  const items = faqItems(tr);
  return (
    <section class="faq">
      <header class="faq__head">
        <span class="faq__kicker">{tr.faqTitle}</span>
        <span class="faq__rule" aria-hidden="true" />
        <span class="faq__count">01 — {String(items.length).padStart(2, "0")}</span>
      </header>
      <div class="faq__list">
        {items.map((item, i) => (
          <details class="faq__item" open={i === 0}>
            <summary class="faq__row">
              <span class="faq__num">{String(i + 1).padStart(2, "0")}</span>
              <h3 class="faq__q">{item.q}</h3>
              <span class="faq-toggle" aria-hidden="true" />
            </summary>
            <p class="faq__a">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Renders the complete landing page with all sections, schemas, and interactivity */
export function renderPage(
  locale: Locale,
  initialData?: InitialData,
  museums?: Record<string, MuseumInfo>,
  _sort?: string,
  range?: number,
  dateCounts: Array<{ date: string; count: number }> = [],
  turnstileSiteKey?: string,
): HtmlEscapedString {
  const tr = getTranslations(locale);
  const berlinOffset = getBerlinUtcOffset();
  const eventSchemaJson = initialData ? buildEventSchema(initialData, berlinOffset) : "";
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://museumsufer.app/#publisher",
    name: "Jonas Strassel",
    email: "feedback@ins.museum",
    url: "https://museumsufer.app/impressum",
    sameAs: ["https://github.com/boredland"],
  };
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://museumsufer.app/#org",
    name: "Museumsufer Frankfurt",
    url: "https://museumsufer.app/",
    logo: { "@type": "ImageObject", url: "https://museumsufer.app/og-image.png", width: 1200, height: 630 },
    founder: { "@id": "https://museumsufer.app/#publisher" },
    sameAs: ["https://github.com/boredland/museumsufer/tree/main/apps/frankfurt-museums"],
  };
  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": "https://museumsufer.app/#webapp",
    name: "Museumsufer Frankfurt",
    url: "https://museumsufer.app/",
    description: tr.metaLong,
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "All",
    inLanguage: ["de", "en", "fr"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    publisher: { "@id": "https://museumsufer.app/#org" },
  };
  const websiteSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Museumsufer Frankfurt",
    url: "https://museumsufer.app/",
    description: tr.metaLong,
    dateModified: todayIso(),
    inLanguage: ["de", "en", "fr"],
    publisher: { "@id": "https://museumsufer.app/#org" },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://museumsufer.app/?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  });
  const publisherSchema = JSON.stringify(personSchema);
  const orgSchemaJson = JSON.stringify(orgSchema);
  const webAppSchemaJson = JSON.stringify(webAppSchema);
  const faqSchema = JSON.stringify(buildFaqPageSchema(faqItems(tr)));

  const canonicalUrl = locale === "de" ? "https://museumsufer.app/" : `https://museumsufer.app/?lang=${locale}`;
  const jsonSchemas = [
    { name: "website", json: websiteSchema },
    { name: "publisher", json: publisherSchema },
    { name: "org", json: orgSchemaJson },
    { name: "webapp", json: webAppSchemaJson },
    { name: "faq", json: faqSchema },
  ];

  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          {renderHtmlHead({
            locale,
            title: tr.pageTitle,
            description: tr.metaLong,
            canonicalUrl,
            jsonSchemas,
            turnstileSiteKey,
          })}
          <link rel="alternate" type="application/rss+xml" title="Museumsufer Frankfurt" href="/feed.xml" />
          <link rel="manifest" href="/manifest.json" />
          {eventSchemaJson ? (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: eventSchemaJson }} />
          ) : null}
          <script src="/uFuzzy.iife.min.js" defer />
          <script src="/htmx.min.js" defer />
        </head>
        <body>
          <IconSprite />
          <div class="progress-bar" aria-hidden="true" />
          <a href="#content" class="skip-link">
            {tr.skipLink}
          </a>

          <div class="page">
            <Masthead locale={locale} tr={tr} />

            <AskAI tr={tr} />

            <RiverNav
              locale={locale}
              tr={tr}
              activeDate={initialData?.date || todayIso()}
              activeRange={range}
              dateCounts={dateCounts}
            />

            <button type="button" class="digest-cue" data-digest-open>
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

            <div class="anchor-headline" id="date-label" aria-live="polite">
              {range
                ? tr.upcomingDays.replace("{n}", String(range))
                : initialData
                  ? formatDateFull(initialData.date, dateLocale(locale))
                  : ""}
            </div>

            <SearchBar tr={tr} />

            <div id="search-no-results" class="search-no-results fade-in">
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
                <div class="loading-state">
                  <div class="river-band loading-state__rule" aria-hidden="true" />
                  <p class="loading-state__label">{tr.loading}…</p>
                </div>
              )}
            </main>

            <PassPromo locale={locale} tr={tr} />

            <MuseumsSection museums={museums || {}} tr={tr} />

            <AboutSection tr={tr} />
            <FaqSection tr={tr} />

            <footer class="footer">
              <div class="footer__primary">
                <a
                  href="https://calendar.google.com/calendar/r?cid=webcal://museumsufer.app/feed.ics"
                  target="_blank"
                  rel="noopener"
                  class="footer__primary-link"
                >
                  {tr.subscribeCal}
                </a>
                <a href="/feed.xml" class="footer__primary-link">
                  {tr.rssFeed}
                </a>
                <button type="button" data-digest-open class="footer__primary-link">
                  {tr.digestOpen}
                </button>
                <button type="button" data-contact-open class="footer__primary-link">
                  {tr.contact}
                </button>
              </div>
              <div class="footer__secondary">
                <a href="/api/docs" class="footer__secondary-link">
                  API
                </a>
                <a
                  href="https://github.com/boredland/museumsufer/tree/main/apps/frankfurt-museums"
                  target="_blank"
                  rel="noopener"
                  class="footer__secondary-link"
                >
                  Source
                </a>
                <a href={locale === "de" ? "/impressum" : `/impressum?lang=${locale}`} class="footer__secondary-link">
                  {tr.imprint}
                </a>
              </div>
              <p class="footer__byline">
                {tr.byline} ·{" "}
                <a href="mailto:feedback@ins.museum" class="footer__byline-link">
                  feedback@ins.museum
                </a>
              </p>
            </footer>
          </div>

          <ContactDialog tr={tr} turnstileSiteKey={turnstileSiteKey} />
          <DigestDialog tr={tr} />

          <script
            dangerouslySetInnerHTML={{ __html: generateScriptInit({ locale, initialDate: initialData?.date }) }}
          />
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

function museumLocationNode(slug: string, name: string): Record<string, unknown> {
  const id = `https://museumsufer.app/#museum/${slug}`;
  const geo = MUSEUM_LOCATIONS[slug];
  const config = getMuseumConfig(slug);
  const node: Record<string, unknown> = { "@type": "Museum", "@id": id, name };
  if (config?.website) node.url = config.website;
  if (geo) {
    node.geo = { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng };
    node.address = { "@type": "PostalAddress", addressLocality: "Frankfurt am Main", addressCountry: "DE" };
  }
  return node;
}

function buildEventSchema(data: InitialData, tz: string): string {
  const schemas: Record<string, unknown>[] = [];
  const emittedMuseums = new Set<string>();

  function ensureMuseum(slug: string, name: string) {
    if (!slug || emittedMuseums.has(slug)) return;
    emittedMuseums.add(slug);
    schemas.push(museumLocationNode(slug, name));
  }

  const exhibitions = data.exhibitions as Array<Record<string, unknown>>;
  if (exhibitions) {
    for (const ex of exhibitions.slice(0, 20)) {
      const museum = (ex.museum_name as string) || "";
      const slug = (ex.museum_slug as string) || "";
      ensureMuseum(slug, museum);
      const museumConfig = getMuseumConfig(slug);
      const museumUrl = museumConfig?.website || "https://museumsufer.app/";
      const exUrl = (ex.detail_url as string) || museumUrl;
      const exSchema: Record<string, unknown> = {
        "@type": "ExhibitionEvent",
        name: ex.title,
        description: (ex.description as string) || `${ex.title} — ${museum}, Frankfurt am Main`,
        url: exUrl,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
      };
      if (ex.start_date) exSchema.startDate = ex.start_date;
      if (ex.end_date) exSchema.endDate = ex.end_date;
      if (ex.image_url) {
        const img = ex.image_url as string;
        exSchema.image = img.startsWith("/") ? `https://museumsufer.app${img}` : img;
      } else {
        exSchema.image = "https://museumsufer.app/og-image.png";
      }
      exSchema.location = slug
        ? { "@id": `https://museumsufer.app/#museum/${slug}` }
        : { "@type": "Place", name: museum };
      exSchema.organizer = { "@type": "Organization", name: museum, url: museumUrl };
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
      ensureMuseum(slug, museum);

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

      const museumConfig = getMuseumConfig(slug);
      const museumUrl = museumConfig?.website || "https://museumsufer.app/";
      const evUrl = (ev.detail_url as string) || (ev.url as string) || museumUrl;

      const schema: Record<string, unknown> = {
        "@type": "Event",
        name: ev.title,
        description: (ev.description as string) || `${ev.title} — ${museum}, Frankfurt am Main`,
        url: evUrl,
        startDate: startIso,
        endDate: endIso,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
      };
      if (ev.image_url) {
        const img = ev.image_url as string;
        schema.image = img.startsWith("/") ? `https://museumsufer.app${img}` : img;
      } else {
        schema.image = "https://museumsufer.app/og-image.png";
      }

      schema.location = slug
        ? { "@id": `https://museumsufer.app/#museum/${slug}` }
        : { "@type": "Place", name: museum };
      schema.organizer = { "@type": "Organization", name: museum, url: museumUrl };
      if (ev.price) {
        const raw = String(ev.price).trim();
        const cleaned = raw.replace(/[^\d.,]/g, "");
        const isSimplePrice = /^\d+([.,]\d+)?$/.test(cleaned);
        schema.offers = {
          "@type": "Offer",
          url: evUrl,
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          validFrom: date,
          ...(isSimplePrice ? { price: cleaned.replace(",", ".") } : { price: "0", description: raw }),
        };
      }

      schemas.push(schema);
    });
  }

  if (schemas.length === 0) return "";
  const wrapper = { "@context": "https://schema.org", "@graph": schemas };
  return JSON.stringify(wrapper);
}
