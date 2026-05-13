import {
  buildFaqPageSchema,
  buildHreflangAlternates,
  buildLangParam,
  digestScheduleLabel,
  langSwitchItems,
  THEME_FOUC_SCRIPT,
} from "@museumsufer/core";
import { ContactDialog as SharedContactDialog } from "@museumsufer/core/contact-dialog";
import { DigestDialog as SharedDigestDialog } from "@museumsufer/core/digest-dialog";
import { buildDigestDialogScript } from "@museumsufer/core/digest-dialog-script";
import { Faq as SharedFaq } from "@museumsufer/core/faq-ui";
import { Footer as SharedFooter } from "@museumsufer/core/footer";
import { LangSwitch as SharedLangSwitch } from "@museumsufer/core/langswitch";
import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CATEGORIES, CATEGORY_BY_SLUG } from "./categories";
import { ChipRow, DateStrip, DayHeadline, EventList } from "./components";
import { todayIso } from "./date";
import { DEFAULT_LOCALE, type FaqEntry, type Locale, SUPPORTED_LOCALES, type Translations } from "./i18n";
import { APP_URL, formatDateLong, jsonLdSafe } from "./shared";
import type { Event } from "./types";

const langSuffix = (locale: Locale, sep: "?" | "&" = "?") => buildLangParam(locale, DEFAULT_LOCALE, sep);

interface PageProps {
  date: string;
  category?: string;
  events: Event[];
  categoryCounts: Map<string, number>;
  dateCounts: Map<string, number>;
  turnstileSiteKey: string;
  locale: Locale;
  tr: Translations;
}

function HreflangLinks({ currentPath }: { currentPath: string }) {
  const items = buildHreflangAlternates({
    currentPath,
    appUrl: APP_URL,
    supported: SUPPORTED_LOCALES,
    fallback: DEFAULT_LOCALE,
  });
  return (
    <>
      {items.map((h) => (
        <link key={`hreflang-${h.hreflang}`} rel="alternate" hreflang={h.hreflang} href={h.href} />
      ))}
    </>
  );
}

function LangSwitch({ locale, currentPath, tr }: { locale: Locale; currentPath: string; tr: Translations }) {
  const items = langSwitchItems({ locale, currentPath, supported: SUPPORTED_LOCALES, fallback: DEFAULT_LOCALE });
  const hrefByLocale = new Map(items.map((i) => [i.locale, i.href] as const));
  return (
    <SharedLangSwitch
      locale={locale}
      supported={SUPPORTED_LOCALES}
      ariaLabel={tr.langSwitchAria}
      buildHref={(l) => hrefByLocale.get(l) ?? `?lang=${l}`}
    />
  );
}

/** HreflangLinks helper exposed for /event/:id and /impressum. */
export function renderHreflangs(currentPath: string): HtmlEscapedString {
  return (<HreflangLinks currentPath={currentPath} />) as unknown as HtmlEscapedString;
}

export function renderLangSwitch(locale: Locale, currentPath: string, tr: Translations): HtmlEscapedString {
  return (<LangSwitch locale={locale} currentPath={currentPath} tr={tr} />) as unknown as HtmlEscapedString;
}

function Faq({ items, tr }: { items: FaqEntry[]; tr: Translations }) {
  return <SharedFaq kicker={tr.faqTitle} items={items} />;
}

function DigestCue({ tr, locale }: { tr: Translations; locale: Locale }) {
  return (
    <button type="button" class="digest-cue ink-up" data-digest-open style="animation-delay:180ms">
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
    <SharedDigestDialog
      schedules={[
        { value: "morning", label: tr.digestMorning, time: "07:00", desc: tr.digestMorningSub },
        { value: "afternoon", label: tr.digestAfternoon, time: "17:00", desc: tr.digestAfternoonSub },
        { value: "weekly", label: tr.digestWeekly, time: "So 09:00", desc: tr.digestWeeklySub },
      ]}
      filterChips={CATEGORIES.map((c) => ({
        value: c.slug,
        label: `${c.glyph} ${tr.categories[c.slug]?.short ?? c.short}`,
      }))}
      filterName="filter-category"
      tr={{
        title: tr.digestDialogTitle,
        close: tr.close,
        intro: tr.digestDialogIntro,
        filterLabel: tr.digestRestrictCategories,
        filterHint: tr.digestRestrictHint,
        iosHint: tr.digestIosHint,
        unsupported: tr.digestBrowserUnsupported,
        submit: tr.digestSubscribeBtn,
        unsubAll: tr.digestUnsubscribeAll,
      }}
    />
  );
}

function ContactDialog({ turnstileSiteKey, tr }: { turnstileSiteKey: string; tr: Translations }) {
  return (
    <SharedContactDialog
      turnstileSiteKey={turnstileSiteKey}
      categories={[
        { value: "Veranstaltung", label: tr.contactCategoryEvent },
        { value: "Quelle", label: tr.contactCategorySource },
        { value: "Allgemein", label: tr.contactCategoryGeneral },
      ]}
      tr={{
        title: tr.contactTitle,
        close: tr.close,
        intro: tr.contactIntro,
        regarding: tr.ariaCategory,
        categoryLabel: tr.ariaCategory,
        emailLabel: tr.contactEmailLabel,
        emailPlaceholder: "dein@email.de",
        messageLabel: tr.contactMessageLabel,
        messagePlaceholder: tr.contactIntro,
        submit: tr.contactSendBtn,
      }}
    />
  );
}

function Page(props: PageProps) {
  const { date, category, events, turnstileSiteKey, locale, tr } = props;
  const cat = category ? CATEGORY_BY_SLUG.get(category) : undefined;
  const isHome = !category && date === todayIso();
  const title = cat
    ? `${cat.label} — ${formatDateLong(date)} · landau.today`
    : isHome
      ? tr.homeTitle
      : `${formatDateLong(date)} · landau.today`;
  const description = cat ? `${cat.label} — ${formatDateLong(date)}. ${tr.homeDescription}` : tr.homeDescription;
  const lang = langSuffix(locale);
  const langAmp = langSuffix(locale, "&");
  const canonical = cat ? `${APP_URL}/c/${cat.slug}?date=${date}${langAmp}` : `${APP_URL}/?date=${date}${langAmp}`;
  const currentPath = cat ? `/c/${cat.slug}?date=${date}` : `/?date=${date}`;
  const jsonLd = buildJsonLd(events.slice(0, 50));
  const faqLd = jsonLdSafe(buildFaqPageSchema(tr.faq));

  return (
    <>
      {raw("<!doctype html>")}
      <html lang={locale}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <title>{title}</title>
          <meta name="description" content={description} />
          <meta name="theme-color" content="#f2ead3" />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={canonical} />
          <meta property="og:image" content={`${APP_URL}/og.svg`} />
          <meta property="og:locale" content={locale === "fr" ? "fr_FR" : "de_DE"} />
          <meta name="twitter:card" content="summary_large_image" />
          <link rel="canonical" href={canonical} />
          <HreflangLinks currentPath={currentPath} />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="alternate" type="application/rss+xml" title="landau.today RSS" href="/feed.xml" />
          <link rel="alternate" type="text/calendar" title="landau.today Kalender" href="/feed.ics" />
          <link rel="stylesheet" href="/fonts.css" />
          <link rel="stylesheet" href="/styles.css" />
          <script dangerouslySetInnerHTML={{ __html: THEME_FOUC_SCRIPT }} />
          <script src="/htmx.min.js" defer />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
        </head>
        <body>
          <a class="sr-only" href="#content">
            {tr.skipToContent}
          </a>
          <div class="htmx-progress" aria-hidden="true" />
          <div class="search-bar ink-up" style="animation-delay:0ms">
            <label for="q" class="sr-only">
              {tr.searchLabel}
            </label>
            <input
              id="q"
              type="search"
              class="search-input js-search"
              placeholder={tr.searchPlaceholder}
              autocomplete="off"
            />
            <kbd class="search-kbd">⌘K</kbd>
            <span class="search-empty" hidden>
              {tr.searchEmpty}
            </span>
          </div>
          <header class="masthead ink-up" style="animation-delay:0ms">
            <h1>
              <a href={`/${lang}`}>
                Landau<span class="ampersand">&amp;</span>heute
              </a>
            </h1>
            <p class="subtitle">{tr.subtitle}</p>
            <p class="colophon">{formatDateLong(todayIso())}</p>
            <LangSwitch locale={locale} currentPath={currentPath} tr={tr} />
            <button type="button" class="theme-toggle js-theme" aria-label={tr.themeToggle} title={tr.themeToggle}>
              <span class="icon-sun" aria-hidden="true">
                ☀
              </span>
              <span class="icon-moon" aria-hidden="true">
                ☾
              </span>
            </button>
          </header>
          <main id="content" style="max-width:48rem;margin:0 auto;padding:0 1rem">
            <div id="content-body">
              <PartialBody {...props} />
            </div>
            <Faq items={tr.faq} tr={tr} />
          </main>
          <SharedFooter
            description={tr.footerLine}
            actions={[
              { label: tr.digestSubscribe, openAttr: "data-digest-open", kind: "digest" },
              { label: tr.reportProblem, openAttr: "data-contact-open", kind: "report" },
            ]}
            links={[
              { href: "/feed.ics", label: tr.subscribeCalendar },
              { href: "/feed.xml", label: "RSS" },
              { href: "/llms.txt", label: "llms.txt" },
              { href: `/impressum${lang}`, label: tr.imprint },
            ]}
            toast={false}
          />
          <DigestDialog tr={tr} />
          <ContactDialog turnstileSiteKey={turnstileSiteKey} tr={tr} />
          <script src="/client.js" defer />
          <script
            dangerouslySetInnerHTML={{
              __html: buildDigestDialogScript({
                labels: {
                  subscribe: tr.digestSubscribe,
                  save: tr.digestSave,
                  unsubscribe: tr.digestUnsubscribeBtn,
                  saving: tr.digestSaving,
                  unsubscribing: tr.digestUnsubscribing,
                  saved: tr.digestSaved,
                  unsubscribed: tr.digestUnsubscribed,
                  saveFailed: tr.digestError,
                  permissionDenied: tr.digestPermissionDenied,
                },
                filterField: "categories",
                filterName: "filter-category",
              }),
            }}
          />
        </body>
      </html>
    </>
  );
}

function PartialBody(props: PageProps) {
  const { date, category, events, categoryCounts, dateCounts, tr, locale } = props;
  return (
    <>
      <div class="ink-up" style="animation-delay:60ms">
        <ChipRow active={category} date={date} counts={categoryCounts} tr={tr} locale={locale} />
      </div>
      <div class="ink-up" style="animation-delay:120ms">
        <DateStrip current={date} category={category} counts={dateCounts} tr={tr} locale={locale} />
      </div>
      <DigestCue tr={tr} locale={locale} />
      <div class="ink-up" style="animation-delay:200ms">
        <DayHeadline date={date} total={events.length} tr={tr} locale={locale} />
      </div>
      <section class="ink-up" style="animation-delay:240ms">
        <EventList events={events} date={date} tr={tr} locale={locale} />
      </section>
    </>
  );
}

export function renderPage(props: PageProps): HtmlEscapedString {
  return (<Page {...props} />) as unknown as HtmlEscapedString;
}

export function renderPartial(props: PageProps): HtmlEscapedString {
  return (<PartialBody {...props} />) as unknown as HtmlEscapedString;
}

function buildJsonLd(events: Event[]): string {
  const items = events.map((ev) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    startDate: ev.time ? `${ev.date}T${ev.time}:00+02:00` : ev.date,
    endDate: ev.end_date ? (ev.end_time ? `${ev.end_date}T${ev.end_time}:00+02:00` : ev.end_date) : undefined,
    location: ev.venue
      ? {
          "@type": "Place",
          name: ev.venue,
          address: { "@type": "PostalAddress", addressLocality: "Landau in der Pfalz", addressCountry: "DE" },
        }
      : undefined,
    image: ev.image_url || undefined,
    description: ev.description || undefined,
    organizer: ev.organizer ? { "@type": "Organization", name: ev.organizer } : undefined,
    url: `${APP_URL}/event/${ev.id}`,
    offers: ev.price ? { "@type": "Offer", price: ev.price } : undefined,
  }));
  return jsonLdSafe({ "@context": "https://schema.org", "@graph": items });
}
