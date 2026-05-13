import {
  buildFaqPageSchema,
  buildHreflangAlternates,
  buildLangParam as coreBuildLangParam,
  dateFormatter,
  digestScheduleLabel,
  type FaqItem,
  LLM_SERVICES,
  langSwitchItems,
  THEME_FOUC_SCRIPT,
} from "@museumsufer/core";
import { ContactDialog as SharedContactDialog } from "@museumsufer/core/contact-dialog";
import { DigestDialog as SharedDigestDialog } from "@museumsufer/core/digest-dialog";
import { Faq } from "@museumsufer/core/faq-ui";
import { Footer } from "@museumsufer/core/footer";
import { HtmlHead } from "@museumsufer/core/html-head";
import { LangSwitch } from "@museumsufer/core/langswitch";
import { ThemeToggle } from "@museumsufer/core/theme-toggle";
import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { ContentBody, MuseumsSection } from "./components";
import { berlinNow, todayIso } from "./date";
import { DEFAULT_LOCALE, dateLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "./i18n";
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

const OG_LOCALE: Record<Locale, string> = { de: "de_DE", en: "en_GB", fr: "fr_FR" };

export function renderHtmlHead(options: HtmlHeadOptions) {
  const {
    locale,
    title,
    description,
    canonicalUrl,
    ogImage = "https://museumsufer.app/og-image.png",
    jsonSchemas = [],
    twitterCard = "summary_large_image",
  } = options;

  return (
    <HtmlHead
      title={title}
      description={description}
      canonical={canonicalUrl}
      ogImage={ogImage}
      ogLocale={OG_LOCALE[locale]}
      ogSiteName="Museumsufer Frankfurt"
      ogImageSize={{ width: 1200, height: 630 }}
      twitterCard={twitterCard}
      twitter={{ title, description, image: ogImage }}
      hreflangs={buildHreflangsForCanonical(canonicalUrl)}
      themeColor={[
        { content: "#efe7d8", media: "(prefers-color-scheme: light)" },
        { content: "#14110e", media: "(prefers-color-scheme: dark)" },
      ]}
      icons={{ svg: "/favicon.svg", png192: "/icon-192.png", appleTouch: "/icon-192.png" }}
      alternates={[
        { rel: "alternate", type: "application/rss+xml", title: "Museumsufer Frankfurt", href: "/feed.xml" },
      ]}
      inlineCss={INLINE_CSS}
      deferScripts={["/uFuzzy.iife.min.js", "/htmx.min.js"]}
      jsonLd={jsonSchemas.map((s) => s.json)}
    />
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
export function Masthead({
  locale,
  tr,
  currentPath = "/",
}: {
  locale: Locale;
  tr: Record<string, string>;
  currentPath?: string;
}) {
  const langItems = langSwitchItems({ locale, currentPath, supported: SUPPORTED_LOCALES, fallback: DEFAULT_LOCALE });
  const hrefByLocale = new Map(langItems.map((i) => [i.locale, i.href] as const));
  return (
    <header class="masthead">
      <div class="masthead__head">
        <div class="masthead__brand">
          <Mark class="masthead__mark" />
          <p class="section-eyebrow masthead__location">Frankfurt am Main · 50.10°N 8.68°E</p>
        </div>
        <div class="masthead__actions">
          <ThemeToggle label={tr.switchTheme} />
          <LangSwitch
            locale={locale}
            supported={SUPPORTED_LOCALES}
            ariaLabel={tr.langSwitchAria}
            buildHref={(l) => hrefByLocale.get(l) ?? `?lang=${l}`}
          />
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
  const weekdayFmt = dateFormatter(dl, { weekday: "short" });
  const monthFmt = dateFormatter(dl, { month: "short" });
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
    const dateObj = date.toDate();
    return {
      iso: s.date,
      weekday: isToday ? tr.today : weekdayFmt.format(dateObj),
      day: String(date.date()),
      month: monthFmt.format(dateObj),
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
    <SharedDigestDialog
      schedules={[
        {
          value: "morning",
          label: tr.digestSchedMorning,
          time: tr.digestSchedMorningTime,
          desc: tr.digestSchedMorningDesc,
        },
        {
          value: "afternoon",
          label: tr.digestSchedAfternoon,
          time: tr.digestSchedAfternoonTime,
          desc: tr.digestSchedAfternoonDesc,
        },
        {
          value: "weekly",
          label: tr.digestSchedWeekly,
          time: tr.digestSchedWeeklyTime,
          desc: tr.digestSchedWeeklyDesc,
        },
      ]}
      filterChips={museumOptions.map((m) => ({ value: m.slug, label: m.name }))}
      filterName="filter-museum"
      tr={{
        title: tr.digestTitle,
        close: tr.contactClose,
        intro: tr.digestIntro,
        filterLabel: tr.digestFilterLabel,
        filterHint: tr.digestFilterHint,
        iosHint: tr.digestIosHint,
        unsupported: tr.digestUnsupported,
        submit: tr.digestSubscribe,
        unsubAll: tr.digestUnsubAll,
      }}
    />
  );
}

/** Contact dialog for submitting feedback, missing events, or museum corrections */
export function ContactDialog({ tr, turnstileSiteKey }: { tr: Record<string, string>; turnstileSiteKey?: string }) {
  return (
    <SharedContactDialog
      emailRequired
      turnstileSiteKey={turnstileSiteKey}
      categories={[
        { value: tr.contactCategoryEvent, label: tr.contactCategoryEvent },
        { value: tr.contactCategoryInstitution, label: tr.contactCategoryInstitution },
        { value: tr.contactCategoryFeedback, label: tr.contactCategoryFeedback },
      ]}
      tr={{
        title: tr.contactTitle,
        close: tr.contactClose,
        regarding: tr.contactRegarding,
        categoryLabel: tr.contactCategoryLabel,
        emailLabel: tr.contactEmailLabel,
        emailPlaceholder: tr.contactEmailPlaceholder,
        messageLabel: tr.contactMessageLabel,
        messagePlaceholder: tr.contactMessagePlaceholder,
        submit: tr.contactSubmit,
      }}
    />
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
  return <Faq kicker={tr.faqTitle} items={faqItems(tr)} />;
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
  currentPath = "/",
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
          })}
          {eventSchemaJson ? (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: eventSchemaJson }} />
          ) : null}
        </head>
        <body>
          <IconSprite />
          <div class="progress-bar" aria-hidden="true" />
          <a href="#content" class="skip-link">
            {tr.skipLink}
          </a>

          <div class="page">
            <Masthead locale={locale} tr={tr} currentPath={currentPath} />

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

            <Footer
              description={tr.metaShort ?? tr.subtitle}
              actions={[
                { label: tr.digestOpen, openAttr: "data-digest-open", kind: "digest" },
                { label: tr.contact, openAttr: "data-contact-open", kind: "report" },
              ]}
              links={[
                { href: "/feed.ics", label: "iCal" },
                { href: "/feed.xml", label: tr.rssFeed },
                { href: "/api/docs", label: "API" },
                {
                  href: locale === "de" ? "/impressum" : `/impressum?lang=${locale}`,
                  label: tr.imprint,
                },
                {
                  href: "https://github.com/boredland/museumsufer/tree/main/apps/frankfurt-museums",
                  label: "GitHub",
                  external: true,
                  ariaLabel: "GitHub",
                  icon: (
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
                      <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.3-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.2.5.7.5 1.4v2.1c0 .2.1.5.6.4A8 8 0 0 0 8 .2Z" />
                    </svg>
                  ),
                },
              ]}
            />
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
