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
import { joinNames, rankVenuesByEventCount } from "@museumsufer/core/venue-faq";
import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CINEMAS } from "./cinema-config";
import { type DateWithCount, type DayScreening, getAllSeries } from "./db";
import { DEFAULT_LOCALE, getTranslations, type Locale, SUPPORTED_LOCALES, type Translations } from "./i18n";
import { imageProxyUrl } from "./image-proxy";
import { SCRAPE_DATA } from "./scrape-data";
import { INLINE_CSS } from "./styles-inline";

export type { DayScreening } from "./db";

export const APP_URL = "https://frankfurt.lichtspiel.haus";
export const REPO_URL = "https://github.com/boredland/museumsufer";

const utm = buildUtm("frankfurt.lichtspiel.haus");

const langSuffix = (locale: Locale, separator: "?" | "&" = "?") => buildLangParam(locale, DEFAULT_LOCALE, separator);

interface PageProps {
  date: string;
  today: string;
  screenings: DayScreening[];
  dateStrip: DateWithCount[];
  city: string;
  cinema?: string | null;
  series?: string | null;
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

const OG_LOCALE: Record<Locale, string> = { de: "de_DE", en: "en_GB" };

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
      themeColor="#0E0B07"
      icons={{ svg: "/favicon.svg", appleTouch: "/icon-192.png" }}
      alternates={[
        { rel: "alternate", type: "application/json", title: "lichtspiel.haus API", href: "/api/screenings" },
        { rel: "alternate", type: "text/calendar", title: "Programm iCal", href: "/feed.ics" },
        ...(opts.extraLinks ?? []),
      ]}
      inlineCss={INLINE_CSS}
      deferScripts={["/htmx.min.js"]}
      jsonLd={jsonLdArr}
    />
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

export function Masthead({ tr, locale, currentPath }: { tr: Translations; locale: Locale; currentPath: string }) {
  return (
    <header class="masthead">
      <a class="masthead__brand" href={`/${langSuffix(locale)}`}>
        <h1 class="wordmark">
          <span class="wordmark__lichtspiel">lichtspiel</span>
          <span class="wordmark__iris" aria-hidden="true">
            <svg viewBox="-12 -12 24 24" width="0.85em" height="0.85em" role="presentation">
              <title>iris</title>
              <circle cx="0" cy="0" r="9" fill="none" stroke="currentColor" stroke-width="1.4" />
              <circle cx="0" cy="0" r="5" fill="none" stroke="currentColor" stroke-width="1.4" />
              <circle cx="0" cy="0" r="1.6" fill="currentColor" />
            </svg>
          </span>
          <span class="wordmark__haus">haus</span>
        </h1>
        <p class="tagline">{tr.tagline}</p>
      </a>
      <hr class="masthead__rule" />
      <FriezeDivider />
      <LangSwitch locale={locale} currentPath={currentPath} tr={tr} />
      <ThemeToggle label={tr.themeToggle} />
    </header>
  );
}

function FriezeDivider() {
  return (
    <div class="frieze" aria-hidden="true">
      <svg viewBox="0 0 360 6" width="100%" height="6" preserveAspectRatio="xMinYMid meet">
        <title>Wiener Frieze</title>
        {Array.from({ length: 10 }, (_, i) => i * 36).map((x) => (
          <g key={x}>
            <rect x={x + 2} y={1} width={4} height={4} fill="none" stroke="currentColor" stroke-width="0.7" />
            <rect x={x + 10} y={1} width={4} height={4} fill="currentColor" />
            <rect x={x + 18} y={1} width={4} height={4} fill="none" stroke="currentColor" stroke-width="0.7" />
          </g>
        ))}
      </svg>
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

function buildScreeningJsonLd(s: DayScreening): Record<string, unknown> {
  const offset = berlinOffsetFor(s.date);
  const startTime = s.time ?? "00:00";
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ScreeningEvent",
    name: s.title,
    startDate: `${s.date}T${startTime}:00${offset}`,
    location: {
      "@type": "MovieTheater",
      name: s.cinema.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: s.cinema.address,
        addressLocality: capitalize(s.cinema.city),
        addressCountry: "DE",
      },
    },
    url: `${APP_URL}/film/${s.id}`,
  };
  const description = s.description ?? s.subtitle ?? s.credits;
  if (description) jsonLd.description = description;
  if (s.end_time && s.time) jsonLd.endDate = `${s.date}T${s.end_time}:00${offset}`;
  if (s.format) jsonLd.videoFormat = s.format;
  if (s.language) jsonLd.inLanguage = s.language;
  if (s.ticket_url) {
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      url: s.ticket_url,
      priceCurrency: "EUR",
      validFrom: todayIso(),
    };
    if (s.price_min != null) offer.price = String(s.price_min);
    jsonLd.offers = offer;
  }
  if (s.image_url) {
    const proxied = imageProxyUrl(s.image_url);
    jsonLd.image = proxied?.startsWith("/") ? `${APP_URL}${proxied}` : (proxied ?? s.image_url);
  }
  return jsonLd;
}

export interface ScreeningRowOptions {
  index: number;
  hideCinema?: boolean;
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

export function PosterCard({ title, imageUrl }: { title: string; imageUrl?: string | null }) {
  const proxied = imageUrl ? imageProxyUrl(imageUrl) : undefined;
  if (proxied) {
    return (
      <div class="poster">
        <img class="poster__img" src={proxied} alt="" loading="lazy" decoding="async" />
      </div>
    );
  }
  return (
    <div class="poster poster--fallback" aria-hidden="true">
      <span class="poster__fallback-title">{title}</span>
      <svg class="poster__fallback-frieze" viewBox="0 0 90 4" width="60%" height="4">
        <title>Wiener Frieze</title>
        <rect x="2" y="0" width="3" height="3" fill="none" stroke="currentColor" stroke-width="0.6" />
        <rect x="10" y="0" width="3" height="3" fill="currentColor" />
        <rect x="18" y="0" width="3" height="3" fill="none" stroke="currentColor" stroke-width="0.6" />
        <rect x="34" y="0" width="3" height="3" fill="currentColor" />
        <rect x="42" y="0" width="3" height="3" fill="none" stroke="currentColor" stroke-width="0.6" />
        <rect x="50" y="0" width="3" height="3" fill="currentColor" />
      </svg>
    </div>
  );
}

export function Screening({ s, opts, tr }: { s: DayScreening; opts: ScreeningRowOptions; tr: Translations }) {
  const time = s.time ?? "—";
  const endTime = s.end_time ? `${tr.endTimePrefix} ${s.end_time}` : "";
  const venueRoom = s.venue_room ?? null;
  const titleSource = s.detail_url ?? s.ticket_url ?? null;
  const titleHref = titleSource ? utm(titleSource, "screening_title") : null;
  const priceNode = <PriceRange min={s.price_min} max={s.price_max} />;
  const hasPrice = (s.price_min != null && s.price_min > 0) || (s.price_max != null && s.price_max > 0);
  const isFree =
    (s.price_min === 0 && (s.price_max == null || s.price_max === 0)) || (s.price_min == null && s.price_max === 0);
  const subtitle = s.subtitle ?? null;
  const showCredits = s.credits && s.credits !== s.subtitle;
  const reportRegarding = `${s.title} — ${s.cinema.name}, ${s.date}${s.time ? ` ${s.time}` : ""}`;
  const reportContext = `${APP_URL}/film/${s.id}`;
  const filmHref = `/film/${s.id}`;
  const calendarEvent: CalendarEvent = {
    date: s.date,
    time: s.time ?? null,
    end_time: s.end_time ?? null,
    end_date: null,
    title: s.title,
    location: [s.cinema.name, venueRoom && venueRoom !== s.cinema.name ? venueRoom : null].filter(Boolean).join(", "),
    description: s.subtitle ?? null,
    detail_url: (() => {
      const src = s.detail_url ?? s.ticket_url ?? null;
      return src ? utm(src, "calendar") : null;
    })(),
  };

  const badges: string[] = [];
  if (s.version) badges.push(s.version);
  if (s.format) badges.push(s.format);

  return (
    <li class="prog-entry" id={`screening-${s.id}`} style={`--i:${opts.index}`}>
      <script
        type="application/ld+json"
        data-id={String(s.id)}
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(buildScreeningJsonLd(s)) }}
      />
      <a class="prog-entry__poster-link" href={filmHref} aria-label={s.title}>
        <PosterCard title={s.title} imageUrl={s.image_url} />
      </a>
      <header class="prog-entry__head">
        <span class="prog-entry__time-hero">{time}</span>
        <h3 class="prog-entry__work">
          {titleHref ? (
            <a href={titleHref} target="_blank" rel="noopener">
              {s.title}
            </a>
          ) : (
            <a href={filmHref}>{s.title}</a>
          )}
        </h3>
        {subtitle ? <p class="prog-entry__subtitle">{subtitle}</p> : null}
        {!opts.hideCinema || venueRoom ? (
          <p class="prog-entry__house">
            {!opts.hideCinema ? (
              <a class="prog-entry__cinema" href={`/kino/${s.cinema_slug}`}>
                {s.cinema.short_name ?? s.cinema.name}
              </a>
            ) : null}
            {venueRoom && !opts.hideCinema ? (
              <>
                <span class="prog-entry__house-sep" aria-hidden="true">
                  ·
                </span>
                <span>{venueRoom}</span>
              </>
            ) : venueRoom ? (
              <span>{venueRoom}</span>
            ) : null}
            {badges.map((b) => (
              <>
                <span class="prog-entry__house-sep" aria-hidden="true">
                  ·
                </span>
                <span class="prog-entry__badge" key={b}>
                  {b}
                </span>
              </>
            ))}
          </p>
        ) : badges.length > 0 ? (
          <p class="prog-entry__house">
            {badges.map((b, i) => (
              <>
                {i > 0 ? (
                  <span class="prog-entry__house-sep" aria-hidden="true">
                    ·
                  </span>
                ) : null}
                <span class="prog-entry__badge" key={b}>
                  {b}
                </span>
              </>
            ))}
          </p>
        ) : null}
      </header>
      {showCredits ? (
        <p class="prog-entry__cast">
          <span class="prog-entry__cast-label">{tr.creditsLabel}</span>
          <span class="prog-entry__cast-text">{s.credits}</span>
        </p>
      ) : null}
      {s.series ? (
        <p class="prog-entry__series">
          <a href={`/reihe/${s.series.slug}`}>{s.series.name}</a>
        </p>
      ) : null}
      <div class="prog-entry__meta">
        <span class="prog-entry__time">
          <time>{time}</time>
          {endTime ? <span class="prog-entry__time-end">{endTime}</span> : null}
        </span>
        {hasPrice ? (
          <>
            <span class="prog-entry__bar" aria-hidden="true">
              ∣
            </span>
            <span class="prog-entry__price">{priceNode}</span>
          </>
        ) : isFree ? (
          <>
            <span class="prog-entry__bar" aria-hidden="true">
              ∣
            </span>
            <span class="prog-entry__price prog-entry__price--free">{tr.freeEntry}</span>
          </>
        ) : null}
        <span class="prog-entry__actions">
          <CalendarPopover
            event={calendarEvent}
            popoverId={`cal-${s.id}`}
            icsHref={`/film/${s.id}/feed.ics`}
            buttonClass="icon-btn"
            labels={{ addToCalendar: tr.toCalendar }}
          />
          <button
            type="button"
            class="icon-btn"
            data-report-regarding={reportRegarding}
            data-report-context={reportContext}
            aria-label={tr.reportScreening}
            title={tr.reportScreening}
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
          {s.ticket_url && !isFree ? (
            <a class="action" href={utm(s.ticket_url, "karten")} target="_blank" rel="noopener">
              <span class="action__note" aria-hidden="true">
                ◉
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
      filterChips={CINEMAS.map((c) => ({ value: c.slug, label: c.short_name ?? c.name }))}
      filterName="filter-cinema"
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
        { value: "Vorstellung", label: tr.contactCategoryScreening },
        { value: "Kino", label: tr.contactCategoryCinema },
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
  subscribe: string;
  save: string;
  unsubscribe: string;
  saving: string;
  unsubscribing: string;
  saved: string;
  unsubscribed: string;
  saveFailed: string;
  permissionDenied: string;
  contactSubmit: string;
  contactSending: string;
  contactSent: string;
  contactErr: string;
}

function buildClientScript(L: ClientScriptLabels): string {
  const j = (s: string) => JSON.stringify(s);
  const digestScript = buildDigestDialogScript({
    labels: L,
    filterField: "cinemas",
    filterName: "filter-cinema",
  });
  return `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function(){ navigator.serviceWorker.register('/sw.js').catch(function(){}); });
}
(function(){
  var btn = document.querySelector('[data-theme-toggle]');
  if (btn) btn.addEventListener('click', function(){
    var html = document.documentElement;
    var isDark = html.classList.contains('dark') || (!html.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    html.classList.toggle('dark', !isDark);
    html.classList.toggle('light', isDark);
    try { localStorage.setItem('theme', isDark ? 'light' : 'dark'); } catch(e){}
  });

  function currentDate(){
    var m = location.pathname.match(/^\\/tag\\/(\\d{4}-\\d{2}-\\d{2})/);
    return m ? m[1] : null;
  }

  function syncDateStrip(){
    var date = currentDate(); if (!date) return;
    document.querySelectorAll('.datetile').forEach(function(t){
      var tileDate = (t.getAttribute('href') || '').match(/\\/tag\\/(\\d{4}-\\d{2}-\\d{2})/);
      if (!tileDate) return;
      var d = tileDate[1];
      var active = d === date;
      t.classList.toggle('datetile--active', active);
      t.setAttribute('aria-current', active ? 'true' : 'false');
    });
    var active = document.querySelector('.datetile--active');
    if (active && active.scrollIntoView) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  document.addEventListener('click', function(e){
    var tile = e.target.closest('.datetile');
    if (tile){
      document.querySelectorAll('.datetile--active').forEach(function(el){ el.classList.remove('datetile--active'); el.setAttribute('aria-current', 'false'); });
      tile.classList.add('datetile--active'); tile.setAttribute('aria-current', 'true');
    }
  });

  document.body.addEventListener('htmx:afterSwap', function(e){
    if (!e.detail || !e.detail.target || e.detail.target.id !== 'programme-content') return;
    syncDateStrip();
  });
  window.addEventListener('popstate', syncDateStrip);

  function onReady(){ syncDateStrip(); }
  if (document.readyState !== 'loading') onReady();
  else document.addEventListener('DOMContentLoaded', onReady);

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
          category: 'Vorstellung',
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

  ${digestScript}
})();
`;
}

const WEBMCP_TOOLS: WebMcpToolDef[] = [
  {
    name: "get_screenings",
    description:
      "Get cinema screenings on a specific date in Frankfurt (and neighbouring venues). Returns titles, times, cinemas, version (OmU/OmeU/DF), format (35mm/DCP), prices, and ticket links.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date (YYYY-MM-DD). Defaults to today." },
        cinema: { type: "string", description: "Optional cinema slug filter." },
        series: { type: "string", description: "Optional film-series slug filter." },
      },
    },
    executeBody: `var params = new URLSearchParams();
      if (input.date) params.set('date', input.date);
      if (input.cinema) params.set('cinema', input.cinema);
      if (input.series) params.set('series', input.series);
      return fetch('/api/day?' + params).then(function(r) { return r.json(); });`,
  },
  {
    name: "get_cinemas",
    description: "Get all cinemas with slug, name, address, and website.",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return fetch('/api/cinemas').then(function(r) { return r.json(); });`,
  },
  {
    name: "list_cinema_slugs",
    description: "List slug + display name of every cinema configured on lichtspiel.haus (no network call).",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return Promise.resolve(${JSON.stringify(CINEMAS.map((v) => ({ slug: v.slug, name: v.name })))});`,
  },
  {
    name: "list_series",
    description: "List all active film series (festivals, retrospectives).",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return fetch('/api/series').then(function(r) { return r.json(); });`,
  },
  {
    name: "search_films",
    description: "Search visible screening rows on the page by keyword (title, cinema, credits).",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search term" } },
      required: ["query"],
    },
    executeBody: `var rows = document.querySelectorAll('.prog-entry');
      var q = (input.query || '').toLowerCase();
      var results = [];
      rows.forEach(function(el) {
        var text = (el.textContent || '').toLowerCase();
        if (!q || text.indexOf(q) !== -1) {
          var title = el.querySelector('.prog-entry__work');
          var cinema = el.querySelector('.prog-entry__cinema');
          var time = el.querySelector('.prog-entry__time time');
          results.push({
            title: title ? title.textContent.trim() : '',
            cinema: cinema ? cinema.textContent.trim() : '',
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
        { href: "/reihe", label: tr.seriesAll },
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
        <a href="https://frankfurt.konzert.haus" target="_blank" rel="noopener">
          {tr.siblingKonzertLabel}
        </a>
        {parts[3]}
      </p>
    </section>
  );
}

function filterPastForToday(date: string, screenings: DayScreening[]): DayScreening[] {
  if (date !== todayIso()) return screenings;
  const { hour, minute } = berlinHourMinute();
  const nowMin = hour * 60 + minute - 30;
  return screenings.filter((s) => {
    if (!s.time) return true;
    const [hh, mm] = s.time.split(":");
    const startMin = parseInt(hh, 10) * 60 + parseInt(mm, 10);
    return startMin >= nowMin;
  });
}

export function ProgrammePartial({
  date,
  screenings,
  tr,
  locale = DEFAULT_LOCALE,
}: {
  date: string;
  screenings: DayScreening[];
  tr: Translations;
  locale?: Locale;
}) {
  const dp = dateParts(date);
  const dateObj = new Date(`${date}T12:00:00Z`);
  const dl = dateLocale(locale);
  const weekdayLong = dateFormatter(dl, { weekday: "long", timeZone: "UTC" }).format(dateObj);
  const monthLong = dateFormatter(dl, { month: "long", timeZone: "UTC" }).format(dateObj);
  const visible = filterPastForToday(date, screenings);
  const hidden = screenings.length - visible.length;
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
        <div class="empty empty--blackout">
          <p class="empty__mark" aria-hidden="true">
            ‖
          </p>
          <p class="empty__direction">Saal dunkel</p>
          <p class="empty__line">{hidden > 0 ? tr.emptyTodayAfterPast : tr.emptyTitle}</p>
          <p class="empty__hint">{tr.emptyHint}</p>
        </div>
      ) : (
        <>
          <ol class="screenings" id="screenings">
            {visible.map((s, i) => (
              <Screening key={s.id} s={s} opts={{ index: i }} tr={tr} />
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

const CINEMA_FAQ = ((): { count: number; byLocale: Record<Locale, string> } => {
  const nameBySlug = new Map<string, string>(CINEMAS.map((c) => [c.slug, c.name]));
  const ranked = rankVenuesByEventCount<DayScreening | { cinema_slug: string }>(
    SCRAPE_DATA.screenings as unknown as Array<{ cinema_slug: string }>,
    (s) => (s as { cinema_slug: string }).cinema_slug,
    nameBySlug,
  );
  const names = ranked.map((v) => v.name);
  return {
    count: ranked.length,
    byLocale: { de: joinNames(names, "de"), en: joinNames(names, "en") },
  };
})();

function applyVenueSubstitution(items: ReadonlyArray<FaqItem>, locale: Locale): FaqItem[] {
  return items.map((item) =>
    item.a.includes("{venues}")
      ? {
          q: item.q,
          a: item.a.replace("{n}", String(CINEMA_FAQ.count)).replace("{venues}", CINEMA_FAQ.byLocale[locale]),
        }
      : item,
  );
}

function Faq({ tr, locale }: { tr: Translations; locale: Locale }) {
  return <SharedFaq kicker={tr.faqKicker} items={applyVenueSubstitution(tr.faqItems, locale)} />;
}

function AskAi({ date, tr, locale }: { date: string; tr: Translations; locale: Locale }) {
  const niceDate = formatLocalisedDateLong(date, locale);
  return <SharedAskAi label={tr.askAiLabel} aria={tr.askAiAria} prompt={tr.askAiPrompt(niceDate)} />;
}

export function renderProgrammePartial(
  date: string,
  screenings: DayScreening[],
  tr: Translations = DEFAULT_TR,
  locale: Locale = DEFAULT_LOCALE,
): HtmlEscapedString {
  return (
    <ProgrammePartial date={date} screenings={screenings} tr={tr} locale={locale} />
  ) as unknown as HtmlEscapedString;
}

export function renderPage(props: PageProps): HtmlEscapedString {
  const { date, today, screenings, dateStrip, locale, tr, turnstileSiteKey } = props;
  const niceDate = niceDateFor(date, locale);
  const currentPath = `/tag/${date}`;
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`lichtspiel.haus · ${niceDate}`}
            description={tr.homeDescription}
            canonical={`${APP_URL}/tag/${date}${langSuffix(locale)}`}
            locale={locale}
            currentPath={currentPath}
            turnstileSiteKey={turnstileSiteKey}
            jsonLd={buildFaqPageSchema(applyVenueSubstitution(tr.faqItems, locale))}
          />
        </head>
        <body>
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <DateStrip strip={dateStrip} active={date} today={today} tr={tr} locale={locale} />
          <DigestCue tr={tr} locale={locale} />
          <AskAi date={date} tr={tr} locale={locale} />
          <main class="programme" id="programme">
            <div id="programme-content">
              <ProgrammePartial date={date} screenings={screenings} tr={tr} locale={locale} />
            </div>
          </main>
          <Faq tr={tr} locale={locale} />
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
  return formatLocalisedDateLong(date, locale === "en" ? "en-GB" : "de-DE");
}

export { getAllSeries };
