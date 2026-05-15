import {
  berlinHourMinute,
  buildFaqPageSchema,
  buildHreflangAlternates,
  buildLangParam,
  buildUtm,
  buildWebMcpScript,
  type CalendarEvent,
  dateFormatter,
  dateLocale,
  dateParts,
  digestScheduleLabel,
  type FaqItem,
  formatLocalisedDateLong,
  HTMX_LIFECYCLE_SCRIPT,
  jsonLdSafe,
  langSwitchItems,
  TURNSTILE_LAZY_LOAD_SCRIPT,
  todayIso,
  type WebMcpToolDef,
} from "@museumsufer/core";
import { AskAi as SharedAskAi } from "@museumsufer/core/ask-ai";
import { CalendarPopover, POPOVER_POSITIONING_SCRIPT } from "@museumsufer/core/calendar-popover";
import { ContactDialog as SharedContactDialog } from "@museumsufer/core/contact-dialog";
import { DigestDialog as SharedDigestDialog } from "@museumsufer/core/digest-dialog";
import { buildDigestDialogScript } from "@museumsufer/core/digest-dialog-script";
import { Faq as SharedFaq } from "@museumsufer/core/faq-ui";
import { Footer as SharedFooter } from "@museumsufer/core/footer";
import { HtmlHead } from "@museumsufer/core/html-head";
import { LangSwitch as SharedLangSwitch } from "@museumsufer/core/langswitch";
import { ThemeToggle } from "@museumsufer/core/theme-toggle";
import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { VENUES } from "./concert-config";
import type { DateWithCount, DayEvent } from "./db";
import { DEFAULT_LOCALE, getTranslations, type Locale, SUPPORTED_LOCALES, type Translations } from "./i18n";
import { imageProxyUrl } from "./image-proxy";
import { INLINE_CSS } from "./styles-inline";
import { GENRES, type Genre } from "./types";

export type { DayEvent } from "./db";

export const APP_URL = "https://frankfurt.konzert.haus";
export const REPO_URL = "https://github.com/boredland/museumsufer";

const utm = buildUtm("frankfurt.konzert.haus");

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

const langSuffix = (locale: Locale, separator: "?" | "&" = "?") => buildLangParam(locale, DEFAULT_LOCALE, separator);

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

const OG_LOCALE: Record<Locale, string> = { de: "de_DE", en: "en_GB", fr: "fr_FR" };

export function Head(opts: HeadOptions) {
  const ogImage = opts.ogImage ?? `${APP_URL}/og-image.png`;
  const jsonLdArr = opts.jsonLd ? (Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd]) : [];
  const hreflangs = opts.currentPath
    ? buildHreflangAlternates({
        currentPath: opts.currentPath,
        appUrl: APP_URL,
        supported: SUPPORTED_LOCALES,
        fallback: DEFAULT_LOCALE,
      })
    : undefined;
  return (
    <HtmlHead
      title={opts.title}
      description={opts.description}
      canonical={opts.canonical}
      ogImage={ogImage}
      ogLocale={OG_LOCALE[opts.locale ?? DEFAULT_LOCALE]}
      hreflangs={hreflangs}
      themeColor="#F7F0E7"
      icons={{ svg: "/favicon.svg", appleTouch: "/icon-192.png" }}
      alternates={[
        { rel: "alternate", type: "application/json", title: "konzert.haus API", href: "/api/events" },
        { rel: "alternate", type: "text/calendar", title: "Programm iCal", href: "/feed.ics" },
        ...(opts.extraLinks ?? []),
      ]}
      inlineCss={INLINE_CSS}
      deferScripts={["/htmx.min.js"]}
      jsonLd={jsonLdArr}
    />
  );
}

export function Grain() {
  return <div class="grain" aria-hidden="true" />;
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
      <ThemeToggle label={tr.themeToggle} />
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
        hx-get={`/partial/content?date=${date}`}
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
            hx-get={`/partial/content?date=${date}&genre=${g}`}
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
  locale,
}: {
  strip: DateWithCount[];
  active: string;
  today: string;
  tr: Translations;
  locale: Locale;
}) {
  if (!strip.length) return null;
  // Localised weekday + month labels via Intl. Keeping the dateParts shape
  // for the day-of-month + isToday math, but the labels are now formatted
  // per the active locale instead of hardcoded German.
  const dl = dateLocale(locale);
  const weekdayFmt = dateFormatter(dl, { weekday: "short", timeZone: "UTC" });
  const monthFmt = dateFormatter(dl, { month: "short", timeZone: "UTC" });
  const lang = langSuffix(locale, "?");
  return (
    <nav class="datestrip" aria-label={tr.dateStripLabel}>
      <div class="datestrip__inner" id="datestrip">
        {strip.map((d) => {
          const p = dateParts(d.date);
          const dateObj = new Date(`${d.date}T12:00:00Z`);
          const isActive = d.date === active;
          const isToday = d.date === today;
          const cls = ["datetile", isActive ? "datetile--active" : "", isToday ? "datetile--today" : ""]
            .filter(Boolean)
            .join(" ");
          const href = `/tag/${d.date}${lang}`;
          return (
            <a
              key={d.date}
              class={cls}
              href={href}
              aria-current={isActive ? "true" : "false"}
              hx-get={`/partial/content?date=${d.date}`}
              hx-target="#programme-content"
              hx-push-url={href}
            >
              <span class="datetile__weekday">{weekdayFmt.format(dateObj)}</span>
              <span class="datetile__day">{p.day}</span>
              <span class="datetile__month">{monthFmt.format(dateObj)}</span>
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
  if (e.image_url) {
    const proxied = imageProxyUrl(e.image_url);
    jsonLd.image = proxied?.startsWith("/") ? `${APP_URL}${proxied}` : (proxied ?? e.image_url);
  }
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
  const hasPrice = (e.price_min != null && e.price_min > 0) || (e.price_max != null && e.price_max > 0);
  // Treat an explicit 0 (with no positive ceiling) as "Eintritt frei". Missing
  // price data isn't a free claim — many venues just don't expose tariffs in
  // their feed (or hide them once an event is sold out), so we render nothing
  // instead of misleading the visitor.
  const isFree =
    (e.price_min === 0 && (e.price_max == null || e.price_max === 0)) || (e.price_min == null && e.price_max === 0);
  const composerLine = e.subtitle ?? null;
  const showCast = e.performers && e.performers !== e.subtitle;
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

  return (
    <li
      class={`prog-entry prog-entry--${e.genre}`}
      id={`event-${e.id}`}
      style={`--i:${opts.index}; --genre-color:${GENRE_COLOR_VAR[e.genre]}`}
    >
      <script
        type="application/ld+json"
        data-id={String(e.id)}
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(buildEventJsonLd(e)) }}
      />
      <span class="prog-entry__numeral" aria-hidden="true" />
      <header class="prog-entry__head">
        {!opts.hideVenue ? (
          <p class="prog-entry__house">
            <a href={`/spielort/${e.venue.slug}`}>{e.venue.short_name ?? e.venue.name}</a>
            {venueRoom ? (
              <>
                <span class="prog-entry__house-sep" aria-hidden="true">
                  ·
                </span>
                <span>{venueRoom}</span>
              </>
            ) : null}
          </p>
        ) : venueRoom ? (
          <p class="prog-entry__house">
            <span>{venueRoom}</span>
          </p>
        ) : null}
        <h3 class="prog-entry__work">
          {composerLine ? <span class="prog-entry__composer">{composerLine}</span> : null}
          <span class="prog-entry__title">
            {titleHref ? (
              <a href={titleHref} target="_blank" rel="noopener">
                {e.title}
              </a>
            ) : (
              e.title
            )}
          </span>
        </h3>
      </header>
      {showCast ? (
        <p class="prog-entry__cast">
          <span class="prog-entry__cast-label">{tr.castLabel}</span>
          <span class="prog-entry__cast-text">{e.performers}</span>
        </p>
      ) : null}
      <div class="prog-entry__meta">
        <span class="prog-entry__time">
          <time>{time}</time>
          {endTime ? <span class="prog-entry__time-end">{endTime}</span> : null}
        </span>
        <span class="prog-entry__bar" aria-hidden="true">
          ∣
        </span>
        {hasPrice ? (
          <span class="prog-entry__price">{priceNode}</span>
        ) : isFree ? (
          <span class="prog-entry__price prog-entry__price--free">{tr.freeEntry}</span>
        ) : null}
        <span class="prog-entry__actions">
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
          {e.ticket_url && !isFree ? (
            <a class="action" href={utm(e.ticket_url, "karten")} target="_blank" rel="noopener">
              <span class="action__note" aria-hidden="true">
                ♪
              </span>
              <span>{tr.ticketsAction}</span>
            </a>
          ) : null}
        </span>
      </div>
    </li>
  );
}

function DigestCue({ tr, locale }: { tr: Translations; locale: Locale }) {
  return (
    <aside class="digest-strip" aria-labelledby="digest-strip-title">
      <span class="digest-strip__seal" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          role="presentation"
        >
          <title>Push-Glocke</title>
          <path d="M12 3.5a5 5 0 0 0-5 5v3.6L5 15h14l-2-2.9V8.5a5 5 0 0 0-5-5z" stroke-linejoin="round" />
          <path d="M9.5 17.5a2.5 2.5 0 0 0 5 0" stroke-linecap="round" />
        </svg>
        <span class="digest-strip__pulse" aria-hidden="true" />
      </span>
      <div class="digest-strip__copy">
        <span class="digest-strip__kicker">{tr.digestKicker}</span>
        <span class="digest-strip__schedules">{digestScheduleLabel(locale)}</span>
        <h2 id="digest-strip-title" class="digest-strip__title">
          {tr.digestCueText}
        </h2>
      </div>
      <button type="button" class="digest-strip__cta" data-digest-open>
        <span>{tr.digestSubscribe}</span>
        <span class="digest-strip__arrow" aria-hidden="true">
          →
        </span>
      </button>
    </aside>
  );
}

function DigestDialog({ tr }: { tr: Translations }) {
  return (
    <SharedDigestDialog
      schedules={[
        { value: "morning", label: tr.digestMorning, time: "07:00", desc: tr.digestMorningSub },
        { value: "afternoon", label: tr.digestAfternoon, time: "16:00", desc: tr.digestAfternoonSub },
        { value: "weekly", label: tr.digestSunday, time: "So 09:00", desc: tr.digestSundaySub },
      ]}
      filterChips={GENRE_ORDER.map((g) => ({
        value: g,
        label: genreLabel(g, tr),
        dotColor: GENRE_COLOR_VAR[g],
      }))}
      filterName="filter-genre"
      tr={{
        title: tr.digestTitle,
        close: tr.digestClose,
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

function ContactDialog({ turnstileSiteKey, tr }: { turnstileSiteKey?: string; tr: Translations }) {
  return (
    <SharedContactDialog
      turnstileSiteKey={turnstileSiteKey}
      categories={[
        { value: "Konzert", label: tr.contactCategoryConcert },
        { value: "Spielort", label: tr.contactCategoryVenue },
        { value: "Allgemein", label: tr.contactCategoryGeneral },
      ]}
      tr={{
        title: tr.contactTitle,
        close: tr.digestClose,
        intro: tr.contactBody,
        regarding: tr.contactRegarding,
        categoryLabel: tr.contactCategoryLabel,
        emailLabel: tr.contactEmail,
        emailPlaceholder: tr.contactEmailPlaceholder,
        messageLabel: tr.contactMessage,
        messagePlaceholder: tr.contactIntro,
        submit: tr.contactSend,
      }}
    />
  );
}

interface ClientScriptLabels {
  // Digest dialog state machine (also handed to buildDigestDialogScript).
  subscribe: string;
  save: string;
  unsubscribe: string;
  saving: string;
  unsubscribing: string;
  saved: string;
  unsubscribed: string;
  saveFailed: string;
  permissionDenied: string;
  // Contact dialog labels.
  contactSubmit: string;
  contactSending: string;
  contactSent: string;
  contactErr: string;
}

function buildClientScript(L: ClientScriptLabels): string {
  // String labels are inlined as JSON literals so the runtime gets the locale
  // copy without depending on a window-level i18n bag. Every state change in
  // the digest dialog (subscribe ↔ save ↔ unsubscribe) reads from `L`.
  const j = (s: string) => JSON.stringify(s);
  const digestScript = buildDigestDialogScript({
    labels: L,
    filterField: "genres",
    filterName: "filter-genre",
  });
  return `
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
      setAttrIfPresent(t, 'hx-get', '/partial/content?date=' + d + hxQs);
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
      var partial = '/partial/content?date=' + date;
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
      submit.disabled = false; submit.textContent = ${j(L.contactSubmit)};
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
      if (openBtn) {
        e.preventDefault();
        if (window.__loadTurnstile) window.__loadTurnstile();
        open(null);
        return;
      }
      var closeBtn = e.target.closest('[data-contact-close]');
      if (closeBtn) { e.preventDefault(); close(); return; }
      var reportBtn = e.target.closest('[data-report-regarding]');
      if (reportBtn) {
        e.preventDefault();
        if (window.__loadTurnstile) window.__loadTurnstile();
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
      submit.disabled = true; submit.textContent = ${j(L.contactSending)};
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
        status.textContent = ${j(L.contactSent)};
        status.className = 'contact-form__status contact-form__status--ok';
        status.hidden = false;
        form.reset();
        setTimeout(close, 1800);
      }).catch(function(){
        status.textContent = ${j(L.contactErr)};
        status.className = 'contact-form__status contact-form__status--err';
        status.hidden = false;
        submit.disabled = false; submit.textContent = ${j(L.contactSubmit)};
      });
    });
  })();

  // Digest dialog — Web Push subscription management. Implementation
  // lives in @museumsufer/core/digest-dialog-script (shared with landau).
  ${digestScript}
})();
`;
}

const WEBMCP_TOOLS: WebMcpToolDef[] = [
  {
    name: "get_events",
    description:
      "Get concerts on a specific date in Frankfurt (and neighbouring venues). Returns titles, times, venues, genres, prices, and ticket links.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date (YYYY-MM-DD). Defaults to today." },
        genre: { type: "string", enum: [...GENRES], description: "Optional genre filter." },
        venue: { type: "string", description: "Optional venue slug filter." },
      },
    },
    executeBody: `var params = new URLSearchParams();
      if (input.date) params.set('date', input.date);
      if (input.genre) params.set('genre', input.genre);
      if (input.venue) params.set('venue', input.venue);
      return fetch('/api/day?' + params).then(function(r) { return r.json(); });`,
  },
  {
    name: "get_venues",
    description: "Get all configured concert venues with slug, name, address, and website.",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return fetch('/api/venues').then(function(r) { return r.json(); });`,
  },
  {
    name: "list_venue_slugs",
    description: "List the slug + display name of every venue configured on konzert.haus (no network call).",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return Promise.resolve(${JSON.stringify(VENUES.map((v) => ({ slug: v.slug, name: v.name })))});`,
  },
  {
    name: "list_genres",
    description: "List the genre slugs available for filtering on konzert.haus.",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return Promise.resolve(${JSON.stringify([...GENRES])});`,
  },
  {
    name: "search_programme",
    description: "Search visible concert rows on the page by keyword (title, performer, venue).",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search term" } },
      required: ["query"],
    },
    executeBody: `var rows = document.querySelectorAll('[data-event-card], .programme-row, article.event');
      var q = (input.query || '').toLowerCase();
      var results = [];
      rows.forEach(function(el) {
        var text = (el.textContent || '').toLowerCase();
        if (!q || text.indexOf(q) !== -1) {
          var title = el.querySelector('.event-title, .programme-row__title, h2, h3');
          var venue = el.querySelector('.event-venue, .programme-row__venue');
          var time = el.querySelector('.event-time, .programme-row__time');
          results.push({
            title: title ? title.textContent.trim() : '',
            venue: venue ? venue.textContent.trim() : '',
            time: time ? time.textContent.trim() : ''
          });
        }
      });
      return Promise.resolve({ query: input.query, count: results.length, results: results.slice(0, 20) });`,
  },
];

const WEBMCP_SCRIPT = buildWebMcpScript(WEBMCP_TOOLS);

function ClientBehaviors({ tr }: { tr: Translations }) {
  const clientScript = buildClientScript({
    subscribe: tr.digestSubscribe,
    save: tr.digestSave,
    unsubscribe: tr.digestUnsubscribeBtn,
    saving: tr.digestSaving,
    unsubscribing: tr.digestUnsubscribing,
    saved: tr.digestSaved,
    unsubscribed: tr.digestUnsubscribed,
    saveFailed: tr.digestError,
    permissionDenied: tr.digestPermissionDenied,
    contactSubmit: tr.contactSend,
    contactSending: tr.contactSending,
    contactSent: tr.contactSent,
    contactErr: tr.contactErr,
  });
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `${clientScript}\n${POPOVER_POSITIONING_SCRIPT}\n${HTMX_LIFECYCLE_SCRIPT}\n${TURNSTILE_LAZY_LOAD_SCRIPT}\n${WEBMCP_SCRIPT}`,
      }}
    />
  );
}

export function Footer({ tr, locale }: { tr: Translations; locale: Locale }) {
  const lang = langSuffix(locale);
  return (
    <SharedFooter
      description={tr.homeDescription}
      actions={[
        { label: tr.digestSubscribe, openAttr: "data-digest-open", kind: "digest" },
        { label: tr.reportProblem, openAttr: "data-contact-open", kind: "report" },
      ]}
      links={[
        { href: "/feed.ics", label: "iCal" },
        { href: "/feed.rss", label: "RSS" },
        { href: "/api/docs", label: "API" },
        { href: `/impressum${lang}`, label: tr.imprint },
        {
          href: REPO_URL,
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
  );
}

/**
 * Quiet editorial cross-link to the two sibling Frankfurt apps. Sits
 * after the concert list — a soft suggestion for visitors who didn't
 * find anything in today's programme.
 */
function SiblingStrap({ tr }: { tr: Translations }) {
  const parts = tr.siblingTemplate.split(/\{first\}|\{second\}|\{third\}/);
  return (
    <section class="programme__siblings">
      <hr class="programme__siblings-rule" />
      <p class="programme__siblings-prompt">
        {parts[0]}
        <a href="https://frankfurt.ins.theater" target="_blank" rel="noopener">
          {tr.siblingTheaterLabel}
        </a>
        {parts[1]}
        <a href="https://museumsufer.app" target="_blank" rel="noopener">
          {tr.siblingMuseumLabel}
        </a>
        {parts[2]}
        <a href="https://frankfurt.lehr.salon" target="_blank" rel="noopener">
          {tr.siblingLehrLabel}
        </a>
        {parts[3]}
      </p>
    </section>
  );
}

function filterPastForToday(date: string, events: DayEvent[]): DayEvent[] {
  if (date !== todayIso()) return events;
  const { hour, minute } = berlinHourMinute();
  const nowMin = hour * 60 + minute - 30;
  return events.filter((e) => {
    if (!e.time) return true;
    const [hh, mm] = e.time.split(":");
    const startMin = parseInt(hh, 10) * 60 + parseInt(mm, 10);
    return startMin >= nowMin;
  });
}

export function ProgrammePartial({
  date,
  events,
  tr,
  locale = DEFAULT_LOCALE,
}: {
  date: string;
  events: DayEvent[];
  tr: Translations;
  locale?: Locale;
}) {
  const dp = dateParts(date);
  const dateObj = new Date(`${date}T12:00:00Z`);
  const dl = dateLocale(locale);
  const weekdayLong = dateFormatter(dl, { weekday: "long", timeZone: "UTC" }).format(dateObj);
  const monthLong = dateFormatter(dl, { month: "long", timeZone: "UTC" }).format(dateObj);
  const visible = filterPastForToday(date, events);
  const hidden = events.length - visible.length;
  return (
    <>
      <header class="programme__header">
        <p class="programme__line" />
        <p class="programme__weekday">{weekdayLong}</p>
        <h2 class="programme__date">
          <span class="programme__day">{dp.day}.</span>
          <span class="programme__month">{monthLong}</span>
          <span class="programme__year">{dp.year}</span>
        </h2>
      </header>
      {visible.length === 0 ? (
        <div class="empty empty--generalpause">
          <p class="empty__mark" aria-hidden="true">
            ‖
          </p>
          <p class="empty__direction">Generalpause</p>
          <p class="empty__line">{hidden > 0 ? tr.emptyTodayAfterPast : tr.emptyTitle}</p>
          <p class="empty__hint">{tr.emptyHint}</p>
        </div>
      ) : (
        <>
          <ol class="concerts" id="concerts">
            {visible.map((e, i) => (
              <Event key={e.id} e={e} opts={{ index: i }} tr={tr} />
            ))}
          </ol>
          {hidden > 0 ? <p class="programme__past-note">{tr.pastNote(hidden)}</p> : null}
        </>
      )}
      <SiblingStrap tr={tr} />
    </>
  );
}

const DEFAULT_TR = getTranslations(DEFAULT_LOCALE);

function Faq({ tr }: { tr: Translations }) {
  return <SharedFaq kicker={tr.faqKicker} items={tr.faqItems} />;
}

function AskAi({ date, tr, locale }: { date: string; tr: Translations; locale: Locale }) {
  const niceDate = formatLocalisedDateLong(date, locale);
  return <SharedAskAi label={tr.askAiLabel} aria={tr.askAiAria} prompt={tr.askAiPrompt(niceDate)} />;
}

export function renderProgrammePartial(
  date: string,
  events: DayEvent[],
  tr: Translations = DEFAULT_TR,
  locale: Locale = DEFAULT_LOCALE,
): HtmlEscapedString {
  return (<ProgrammePartial date={date} events={events} tr={tr} locale={locale} />) as unknown as HtmlEscapedString;
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
            jsonLd={buildFaqPageSchema(tr.faqItems as FaqItem[])}
          />
        </head>
        <body>
          <Grain />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <GenreFilter date={date} active={genre} tr={tr} locale={locale} />
          <DateStrip strip={dateStrip} active={date} today={today} tr={tr} locale={locale} />
          <DigestCue tr={tr} locale={locale} />
          <AskAi date={date} tr={tr} locale={locale} />
          <main class="programme" id="programme">
            <div id="programme-content">
              <ProgrammePartial date={date} events={events} tr={tr} locale={locale} />
            </div>
          </main>
          <Faq tr={tr} />
          <Footer tr={tr} locale={locale} />
          <ContactDialog turnstileSiteKey={turnstileSiteKey} tr={tr} />
          <DigestDialog tr={tr} />
          <ClientBehaviors tr={tr} />
        </body>
      </html>
    </>
  ) as unknown as HtmlEscapedString;
}

function niceDateFor(date: string, locale: Locale): string {
  return formatLocalisedDateLong(date, locale === "fr" ? "fr-FR" : locale === "en" ? "en-GB" : "de-DE");
}
