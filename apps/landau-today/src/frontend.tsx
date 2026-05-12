import {
  buildFaqPageSchema,
  buildHreflangAlternates,
  buildLangParam,
  digestScheduleLabel,
  langSwitchItems,
  THEME_FOUC_SCRIPT,
} from "@museumsufer/core";
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

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;0,6..96,800;1,6..96,400;1,6..96,500;1,6..96,600&family=Bodoni+Moda+SC:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap";

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
  return (
    <nav class="langswitch" aria-label={tr.langSwitchAria}>
      {items.map(({ locale: l, href, active }) => (
        <a key={l} href={href} class={active ? "langswitch__a langswitch__a--active" : "langswitch__a"} hreflang={l}>
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
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
  return (
    <section class="faq ink-up" style="animation-delay:300ms">
      <h2 class="faq-title">{tr.faqTitle}</h2>
      {items.map((it, i) => (
        <details key={`faq-${i}`} class="faq-item">
          <summary>
            <span class="faq-q">{it.q}</span>
            <span class="faq-toggle" aria-hidden="true" />
          </summary>
          <div class="faq-a">{it.a}</div>
        </details>
      ))}
    </section>
  );
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

const DIALOG_STYLE =
  "margin:auto;padding:0;border:1px solid var(--color-rule);border-radius:0.5rem;background:var(--color-paper);color:var(--color-ink);width:min(28rem,calc(100vw - 2rem));box-shadow:0 16px 48px -16px rgb(from var(--color-ink) r g b / 0.35);";
const DIALOG_FORM_STYLE = "padding:1.5rem;display:flex;flex-direction:column;gap:1rem;font-family:var(--font-body)";
const DIALOG_HEAD_STYLE = "display:flex;align-items:flex-start;justify-content:space-between;gap:1rem";
const DIALOG_TITLE_STYLE =
  "font-family:var(--font-display);font-style:italic;font-size:1.4rem;font-weight:500;margin:0;line-height:1.15";
const DIALOG_CLOSE_STYLE =
  "background:transparent;border:0;cursor:pointer;color:rgb(from var(--color-ink) r g b / 0.55);padding:0.25rem;margin:-0.25rem;font-size:1.25rem;line-height:1";
const DIALOG_INTRO_STYLE =
  "margin:-0.25rem 0 0;font-size:0.875rem;line-height:1.5;color:rgb(from var(--color-ink) r g b / 0.75)";
const DIALOG_FIELD_LABEL_STYLE = "display:flex;flex-direction:column;gap:0.35rem";
const DIALOG_FIELD_LABEL_TEXT_STYLE =
  "font-size:0.625rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55)";
const DIALOG_FIELD_INPUT_STYLE =
  "padding:0.55rem 0.7rem;border-radius:0.4rem;border:1px solid var(--color-rule);background:var(--color-paper-2);color:var(--color-ink);font:inherit";
const DIALOG_NOTICE_STYLE =
  "padding:0.75rem 0.9rem;font-size:0.8125rem;line-height:1.5;background:var(--color-paper-2);border-radius:0.4rem;color:rgb(from var(--color-ink) r g b / 0.8)";
const DIALOG_NOTICE_ERR_STYLE =
  "padding:0.75rem 0.9rem;font-size:0.8125rem;line-height:1.5;background:var(--color-paper-2);border-radius:0.4rem;color:var(--color-rotwein)";
const DIALOG_FOOT_STYLE = "display:flex;align-items:center;justify-content:space-between;gap:0.8rem;margin-top:0.25rem";
const DIALOG_STATUS_STYLE =
  "margin:0;font-size:0.8125rem;color:rgb(from var(--color-ink) r g b / 0.7);flex:1;min-width:0";
const DIALOG_BTN_PRIMARY_STYLE =
  "margin-left:auto;padding:0.5rem 1.25rem;font-size:0.6875rem;letter-spacing:0.18em;text-transform:uppercase;background:var(--color-rotwein);color:var(--color-paper);border:1px solid var(--color-rotwein);border-radius:999px;cursor:pointer;font-family:var(--font-body)";
const DIALOG_BTN_SECONDARY_STYLE =
  "background:transparent;border:0;padding:0.5rem 0;font-size:0.6875rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55);cursor:pointer;font-family:var(--font-body)";
const FOOTER_LINK_STYLE =
  "background:transparent;border:0;padding:0;cursor:pointer;font:inherit;color:inherit;text-decoration:underline;text-decoration-color:rgb(from var(--color-ink) r g b / 0.3);text-underline-offset:3px";

function DigestDialog({ tr }: { tr: Translations }) {
  return (
    <dialog id="digest-dialog" style={DIALOG_STYLE}>
      <form id="digest-form" style={DIALOG_FORM_STYLE}>
        <div style={DIALOG_HEAD_STYLE}>
          <h2 style={DIALOG_TITLE_STYLE}>{tr.digestDialogTitle}</h2>
          <button type="button" data-digest-close aria-label={tr.close} style={DIALOG_CLOSE_STYLE}>
            ×
          </button>
        </div>
        <p style={DIALOG_INTRO_STYLE}>{tr.digestDialogIntro}</p>
        <fieldset
          aria-label={tr.digestSchedulesLabel}
          style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:0.4rem"
        >
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
              <span class="digest-option__title">{tr.digestWeekly}</span>
              <span class="digest-option__time">So 09:00</span>
            </span>
            <span class="digest-option__sub">{tr.digestWeeklySub}</span>
          </label>
        </fieldset>
        <details class="digest-filter">
          <summary class="digest-filter__summary">
            <span class="digest-filter__label">{tr.digestRestrictCategories}</span>
            <span class="digest-filter__hint">{tr.digestRestrictHint}</span>
          </summary>
          <fieldset class="digest-filter__chips" aria-label={tr.ariaCategory}>
            {CATEGORIES.map((c) => {
              const localized = tr.categories[c.slug]?.short ?? c.short;
              return (
                <label key={c.slug} class="digest-chip">
                  <input type="checkbox" name="filter-category" value={c.slug} />
                  <span class="digest-chip__glyph">{c.glyph}</span>
                  <span class="digest-chip__label">{localized}</span>
                </label>
              );
            })}
          </fieldset>
        </details>
        <div id="digest-ios-hint" hidden style={DIALOG_NOTICE_STYLE}>
          {tr.digestIosHint}
        </div>
        <div id="digest-unsupported" hidden style={DIALOG_NOTICE_ERR_STYLE}>
          {tr.digestBrowserUnsupported}
        </div>
        <div style={DIALOG_FOOT_STYLE}>
          <p id="digest-status" hidden style={DIALOG_STATUS_STYLE} aria-live="polite" />
          <button type="button" id="digest-unsubscribe-all" hidden style={DIALOG_BTN_SECONDARY_STYLE}>
            {tr.digestUnsubscribeAll}
          </button>
          <button type="submit" id="digest-submit" style={DIALOG_BTN_PRIMARY_STYLE}>
            {tr.digestSubscribeBtn}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ContactDialog({ turnstileSiteKey, tr }: { turnstileSiteKey: string; tr: Translations }) {
  const textareaStyle = `${DIALOG_FIELD_INPUT_STYLE};resize:vertical;min-height:5rem`;
  return (
    <dialog id="contact-dialog" style={DIALOG_STYLE}>
      <form id="contact-form" style={DIALOG_FORM_STYLE} novalidate>
        <div style={DIALOG_HEAD_STYLE}>
          <h2 style={DIALOG_TITLE_STYLE}>{tr.contactTitle}</h2>
          <button type="button" data-contact-close aria-label={tr.close} style={DIALOG_CLOSE_STYLE}>
            ×
          </button>
        </div>
        <p style={DIALOG_INTRO_STYLE}>{tr.contactIntro}</p>
        <label style={DIALOG_FIELD_LABEL_STYLE}>
          <span style={DIALOG_FIELD_LABEL_TEXT_STYLE}>{tr.ariaCategory}</span>
          <select id="contact-category" name="category" required style={DIALOG_FIELD_INPUT_STYLE}>
            <option value="Veranstaltung">{tr.contactCategoryEvent}</option>
            <option value="Quelle">{tr.contactCategorySource}</option>
            <option value="Allgemein">{tr.contactCategoryGeneral}</option>
          </select>
        </label>
        <label style={DIALOG_FIELD_LABEL_STYLE}>
          <span style={DIALOG_FIELD_LABEL_TEXT_STYLE}>{tr.contactEmailLabel}</span>
          <input
            type="email"
            id="contact-email"
            name="email"
            placeholder="dein@email.de"
            style={DIALOG_FIELD_INPUT_STYLE}
          />
        </label>
        <label style={DIALOG_FIELD_LABEL_STYLE}>
          <span style={DIALOG_FIELD_LABEL_TEXT_STYLE}>{tr.contactMessageLabel}</span>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={4}
            placeholder={tr.contactIntro}
            style={textareaStyle}
          />
        </label>
        <input type="hidden" id="contact-context" name="context" />
        <div class="cf-turnstile" data-sitekey={turnstileSiteKey} data-size="flexible" data-theme="auto" />
        <div style={DIALOG_FOOT_STYLE}>
          <p id="contact-status" hidden style={DIALOG_STATUS_STYLE} aria-live="polite" />
          <button type="submit" id="contact-submit" style={DIALOG_BTN_PRIMARY_STYLE}>
            {tr.contactSendBtn}
          </button>
        </div>
      </form>
    </dialog>
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
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link rel="preload" as="style" href={FONT_HREF} onload="this.onload=null;this.rel='stylesheet'" />
          <noscript>
            <link rel="stylesheet" href={FONT_HREF} />
          </noscript>
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
          <footer class="colophon-foot" style="max-width:48rem;margin:0 auto;padding:0 1rem 2rem">
            <span>{tr.footerLine}</span>
            <span>
              <button type="button" data-digest-open style={FOOTER_LINK_STYLE}>
                {tr.digestSubscribe}
              </button>{" "}
              ·{" "}
              <button type="button" data-contact-open style={FOOTER_LINK_STYLE}>
                {tr.reportProblem}
              </button>{" "}
              · <a href="/feed.ics">{tr.subscribeCalendar}</a> · <a href="/feed.xml">RSS</a> ·{" "}
              <a href="/llms.txt">llms.txt</a> · <a href={`/impressum${lang}`}>{tr.imprint}</a>
            </span>
          </footer>
          <DigestDialog tr={tr} />
          <ContactDialog turnstileSiteKey={turnstileSiteKey} tr={tr} />
          <script src="/client.js" defer />
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
