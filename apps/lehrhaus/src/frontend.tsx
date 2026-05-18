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
import type { DateWithCount, DayEvent } from "./db";
import { DEFAULT_LOCALE, getTranslations, type Locale, SUPPORTED_LOCALES, type Translations } from "./i18n";
import { imageProxyUrl } from "./image-proxy";
import { SCRAPE_DATA } from "./scrape-data";

const SOURCES = SCRAPE_DATA.sources;

import { INLINE_CSS } from "./styles-inline";
import { CATEGORIES, type Category } from "./types";

export type { DayEvent } from "./db";

export const APP_URL = "https://frankfurt.lehr.salon";
export const REPO_URL = "https://github.com/boredland/museumsufer";

const utm = buildUtm("frankfurt.lehr.salon");

export function categoryLabel(c: Category, tr: Translations): string {
  switch (c) {
    case "Vortrag":
      return tr.categoryVortrag;
    case "Diskussion":
      return tr.categoryDiskussion;
    case "Lesung":
      return tr.categoryLesung;
  }
}

const langSuffix = (locale: Locale, separator: "?" | "&" = "?") => buildLangParam(locale, DEFAULT_LOCALE, separator);

const CATEGORY_ORDER: Category[] = ["Vortrag", "Lesung", "Diskussion"];

/**
 * Three-ink system per the lehrhaus identity:
 *   - rubric red for monologic Vorträge (the lecturer's emphasis)
 *   - umber brown for Lesungen (book-binding leather — readings are about the book)
 *   - marginalia blue for Diskussionen (the deliberative second ink)
 * The pilcrow anchor inherits this color and replaces konzert-haus's roman numeral.
 */
const CATEGORY_COLOR_VAR: Record<Category, string> = {
  Vortrag: "var(--rubric)",
  Lesung: "var(--umber)",
  Diskussion: "var(--marginalia)",
};

interface PageProps {
  date: string;
  today: string;
  events: DayEvent[];
  dateStrip: DateWithCount[];
  category?: Category | null;
  /** When set, render the events as a grouped-by-date list spanning this many
   *  days starting at `date`. When undefined, render a single-day view. */
  range?: number;
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
      themeColor="#F2E9D5"
      icons={{ svg: "/favicon.svg", appleTouch: "/icon-192.png" }}
      alternates={[
        { rel: "alternate", type: "application/json", title: "lehr.salon API", href: "/api/events" },
        { rel: "alternate", type: "text/calendar", title: "Programm iCal", href: "/feed.ics" },
        ...(opts.extraLinks ?? []),
      ]}
      inlineCss={INLINE_CSS}
      deferScripts={["/htmx.min.js"]}
      jsonLd={jsonLdArr}
    />
  );
}

/**
 * Foxing replaces konzert-haus's wood-grain overlay — soft cellulose-fibre
 * texture clustering toward the page corners, the way it shows up on aged
 * paper. Pure CSS in styles.css; this is just the carrier element.
 */
export function Foxing() {
  return <div class="foxing" aria-hidden="true" />;
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
          <span class="wordmark__lehr">lehr</span>
          <span class="wordmark__dot">.</span>
          <span class="wordmark__salon">salon</span>
        </h1>
        <p class="tagline">{tr.tagline}</p>
      </a>
      <hr class="masthead__rule" />
      <hr class="masthead__rule--rubric" />
      <LangSwitch locale={locale} currentPath={currentPath} tr={tr} />
      <ThemeToggle label={tr.themeToggle} />
    </header>
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

/**
 * The "Next 7 days" toggle pill. Sits just below the date strip; when active,
 * the date strip's per-tile highlight clears and the programme content
 * switches to a date-grouped list of the upcoming week. Mirrors museumsufer's
 * range-pill UX (see frankfurt-museums/src/frontend.tsx).
 */
function RangeRow({ active, tr, locale }: { active: boolean; tr: Translations; locale: Locale }) {
  const lang = langSuffix(locale);
  return (
    <div class="range-row">
      <a
        class={`range-pill${active ? " range-pill--active" : ""}`}
        href={`/${lang}`}
        hx-get="/partial/content?range=7"
        hx-target="#programme-content"
        hx-push-url={`/${lang}`}
        aria-current={active ? "true" : "false"}
      >
        <span class="range-pill__glyph" aria-hidden="true">
          ⁂
        </span>
        {tr.rangeUpcomingLabel}
      </a>
    </div>
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

function buildEventJsonLd(e: DayEvent): Record<string, unknown> {
  const offset = berlinOffsetFor(e.date);
  const startTime = e.time ?? "00:00";
  const eventType = e.category === "Diskussion" ? "EducationEvent" : "Event";
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": eventType,
    name: e.title,
    startDate: `${e.date}T${startTime}:00${offset}`,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: e.source.name,
      address: { "@type": "PostalAddress", addressLocality: "Frankfurt am Main", addressCountry: "DE" },
    },
    organizer: {
      "@type": "Organization",
      name: e.source.name,
      url: e.source.url,
    },
    url: `${APP_URL}/tag/${e.date}#event-${e.id}`,
  };
  if (e.description) jsonLd.description = e.description;
  if (e.end_time && e.time) jsonLd.endDate = `${e.date}T${e.end_time}:00${offset}`;
  if (e.language) jsonLd.inLanguage = e.language;
  if (e.image_url) {
    const proxied = imageProxyUrl(e.image_url);
    jsonLd.image = proxied?.startsWith("/") ? `${APP_URL}${proxied}` : (proxied ?? e.image_url);
  }
  return jsonLd;
}

export interface EventRowOptions {
  index: number;
  hideSource?: boolean;
}

export function Event({ e, opts, tr }: { e: DayEvent; opts: EventRowOptions; tr: Translations }) {
  const time = e.time ?? "—";
  const endTime = e.end_time ? `${tr.endTimePrefix} ${e.end_time}` : "";
  const titleSource = e.detail_url ?? e.ticket_url ?? null;
  const titleHref = titleSource ? utm(titleSource, "event_title") : null;
  const reportRegarding = `${e.title} — ${e.source.name}, ${e.date}${e.time ? ` ${e.time}` : ""}`;
  const reportContext = `${APP_URL}/api/events/${e.id}`;
  const calendarEvent: CalendarEvent = {
    date: e.date,
    time: e.time ?? null,
    end_time: e.end_time ?? null,
    end_date: null,
    title: e.title,
    location: e.source.name,
    description: e.description ?? null,
    detail_url: (() => {
      const src = e.detail_url ?? e.ticket_url ?? null;
      return src ? utm(src, "calendar") : null;
    })(),
  };
  // Non-German talks get a small badge ("auf en", "in fr"). German is the
  // implicit default; only foreign-language entries need flagging.
  const isForeignLang = e.language && e.language.toLowerCase() !== "de";
  const langLabel = e.language ? e.language.toUpperCase() : "";

  return (
    <li
      class={`prog-entry prog-entry--${e.category.toLowerCase()}`}
      id={`event-${e.id}`}
      style={`--i:${opts.index}; --cat-color:${CATEGORY_COLOR_VAR[e.category]}`}
    >
      <script
        type="application/ld+json"
        data-id={String(e.id)}
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(buildEventJsonLd(e)) }}
      />
      <span class="prog-entry__pilcrow" aria-hidden="true">
        ¶
      </span>
      <header class="prog-entry__head">
        {!opts.hideSource ? (
          <p class="prog-entry__house">
            {/* For cross-imports (aggregators), the per-event source_name carries
                the actual host museum / theater. Prefer it over the aggregator's
                short_name; the link still points to the aggregator's page. */}
            <a href={`/quelle/${e.source.slug}`}>
              {e.source_name !== e.source.name ? e.source_name : (e.source.short_name ?? e.source.name)}
            </a>
            {isForeignLang ? (
              <>
                <span class="prog-entry__house-sep" aria-hidden="true">
                  ·
                </span>
                <span class="prog-entry__lang">{tr.languageBadge(langLabel)}</span>
              </>
            ) : null}
          </p>
        ) : isForeignLang ? (
          <p class="prog-entry__house">
            <span class="prog-entry__lang">{tr.languageBadge(langLabel)}</span>
          </p>
        ) : null}
        <h3 class="prog-entry__work">
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
      {e.description ? <p class="prog-entry__lede">{e.description}</p> : null}
      <div class="prog-entry__meta">
        <span class="prog-entry__time">
          <time>{time}</time>
          {endTime ? <span class="prog-entry__time-end">{endTime}</span> : null}
        </span>
        <span class="prog-entry__bar" aria-hidden="true">
          ∣
        </span>
        <span class="prog-entry__category">{categoryLabel(e.category, tr)}</span>
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
            aria-label={tr.reportEvent}
            title={tr.reportEvent}
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
            <a class="action" href={utm(e.ticket_url, "vormerken")} target="_blank" rel="noopener">
              <span class="action__manicule" aria-hidden="true">
                ☞
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
      filterChips={CATEGORY_ORDER.map((c) => ({
        value: c,
        label: categoryLabel(c, tr),
        dotColor: CATEGORY_COLOR_VAR[c],
      }))}
      filterName="filter-format"
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
        { value: "Eintrag", label: tr.contactCategoryEvent },
        { value: "Quelle", label: tr.contactCategorySource },
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
    filterField: "formats",
    filterName: "filter-format",
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

  // URL state: either /tag/YYYY-MM-DD (single day) or / (which means the
  // rolling next-7-days view). The range pill toggles between the two.
  function currentDate(){
    var m = location.pathname.match(/^\\/tag\\/(\\d{4}-\\d{2}-\\d{2})/);
    return m ? m[1] : null;
  }
  function isRangeView(){ return location.pathname === '/' || location.pathname === ''; }

  function syncDateStrip(){
    var date = currentDate();
    var range = isRangeView();
    document.querySelectorAll('.datetile').forEach(function(t){
      var tileDate = (t.getAttribute('href') || '').match(/\\/tag\\/(\\d{4}-\\d{2}-\\d{2})/);
      if (!tileDate) return;
      var active = !range && tileDate[1] === date;
      t.classList.toggle('datetile--active', active);
      t.setAttribute('aria-current', active ? 'true' : 'false');
    });
    if (!range) {
      var activeTile = document.querySelector('.datetile--active');
      if (activeTile && activeTile.scrollIntoView) activeTile.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    document.querySelectorAll('.range-pill').forEach(function(p){
      p.classList.toggle('range-pill--active', range);
      p.setAttribute('aria-current', range ? 'true' : 'false');
    });
  }

  document.addEventListener('click', function(e){
    var tile = e.target.closest('.datetile');
    if (tile){
      document.querySelectorAll('.datetile--active').forEach(function(el){ el.classList.remove('datetile--active'); el.setAttribute('aria-current', 'false'); });
      tile.classList.add('datetile--active'); tile.setAttribute('aria-current', 'true');
      document.querySelectorAll('.range-pill').forEach(function(p){ p.classList.remove('range-pill--active'); p.setAttribute('aria-current', 'false'); });
      return;
    }
    var rangePill = e.target.closest('.range-pill');
    if (rangePill){
      document.querySelectorAll('.datetile--active').forEach(function(el){ el.classList.remove('datetile--active'); el.setAttribute('aria-current', 'false'); });
      rangePill.classList.add('range-pill--active'); rangePill.setAttribute('aria-current', 'true');
    }
  });

  document.body.addEventListener('htmx:afterSwap', function(e){
    if (!e.detail || !e.detail.target || e.detail.target.id !== 'programme-content') return;
    syncDateStrip();
  });
  window.addEventListener('popstate', function(){ syncDateStrip(); });

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
      submit.disabled = false; submit.textContent = ${j("Senden")};
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
          category: 'Eintrag',
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
    name: "get_events",
    description:
      "Get public lectures and discussions on a specific date in Frankfurt. Returns titles, times, sources, formats, and detail links.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date (YYYY-MM-DD). Defaults to today." },
        format: {
          type: "string",
          enum: [...CATEGORIES],
          description: "Optional format filter (Vortrag / Diskussion).",
        },
        source: { type: "string", description: "Optional source slug filter." },
      },
    },
    executeBody: `var params = new URLSearchParams();
      if (input.date) params.set('date', input.date);
      if (input.format) params.set('format', input.format);
      if (input.source) params.set('source', input.source);
      return fetch('/api/day?' + params).then(function(r) { return r.json(); });`,
  },
  {
    name: "get_sources",
    description: "Get all configured lecture sources with slug, name, and website.",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return fetch('/api/sources').then(function(r) { return r.json(); });`,
  },
  {
    name: "list_source_slugs",
    description: "List the slug + display name of every source configured on lehr.salon (no network call).",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return Promise.resolve(${JSON.stringify(SOURCES.map((s) => ({ slug: s.slug, name: s.name })))});`,
  },
  {
    name: "list_formats",
    description: "List the format slugs available for filtering on lehr.salon.",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return Promise.resolve(${JSON.stringify([...CATEGORIES])});`,
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
 * Editorial cross-link to the three sibling Frankfurt apps — sits after the
 * lecture list as a soft suggestion when nothing today fits.
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
        <a href="https://frankfurt.konzert.haus" target="_blank" rel="noopener">
          {tr.siblingConcertLabel}
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

function DayGroup({
  date,
  events,
  tr,
  locale,
  startIndex,
}: {
  date: string;
  events: DayEvent[];
  tr: Translations;
  locale: Locale;
  startIndex: number;
}) {
  const dp = dateParts(date);
  const dateObj = new Date(`${date}T12:00:00Z`);
  const dl = dateLocale(locale);
  const weekdayShort = dateFormatter(dl, { weekday: "long", timeZone: "UTC" }).format(dateObj);
  const monthShort = dateFormatter(dl, { month: "long", timeZone: "UTC" }).format(dateObj);
  return (
    <section class="day-group">
      <header class="day-group__head">
        <span class="day-group__day">{dp.day}.</span>
        <span class="day-group__month">{monthShort}</span>
        <span class="day-group__sep" aria-hidden="true">
          ·
        </span>
        <span class="day-group__weekday">{weekdayShort}</span>
        <span class="day-group__count">{events.length}</span>
      </header>
      <ol class="concerts">
        {events.map((e, i) => (
          <Event key={e.id} e={e} opts={{ index: startIndex + i }} tr={tr} />
        ))}
      </ol>
    </section>
  );
}

export function ProgrammePartial({
  date,
  events,
  tr,
  locale = DEFAULT_LOCALE,
  range,
}: {
  date: string;
  events: DayEvent[];
  tr: Translations;
  locale?: Locale;
  range?: number;
}) {
  if (range) {
    const groups = new Map<string, DayEvent[]>();
    for (const e of events) {
      const arr = groups.get(e.date);
      if (arr) arr.push(e);
      else groups.set(e.date, [e]);
    }
    const sortedDates = [...groups.keys()].sort();
    let cursor = 0;
    return (
      <>
        <header class="programme__header">
          <p class="programme__line" />
          <p class="programme__weekday">{tr.dateStripLabel}</p>
          <h2 class="programme__date">
            <span class="programme__day">{tr.rangeUpcomingHeading(range)}</span>
          </h2>
        </header>
        {events.length === 0 ? (
          <div class="empty empty--paginavacua">
            <p class="empty__mark" aria-hidden="true">
              ⁂
            </p>
            <p class="empty__direction">{tr.emptyDirection}</p>
            <p class="empty__line">{tr.emptyTitle}</p>
            <p class="empty__hint">{tr.emptyHint}</p>
          </div>
        ) : (
          <div class="day-groups">
            {sortedDates.map((d) => {
              const dayEvents = filterPastForToday(d, groups.get(d) ?? []);
              const startIndex = cursor;
              cursor += dayEvents.length;
              return <DayGroup key={d} date={d} events={dayEvents} tr={tr} locale={locale} startIndex={startIndex} />;
            })}
          </div>
        )}
        <SiblingStrap tr={tr} />
      </>
    );
  }

  // Single-day view (the original behaviour, unchanged).
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
        <div class="empty empty--paginavacua">
          <p class="empty__mark" aria-hidden="true">
            ⁂
          </p>
          <p class="empty__direction">{tr.emptyDirection}</p>
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

const VENUE_FAQ = ((): { count: number; byLocale: Record<Locale, string> } => {
  const nameBySlug = new Map(SOURCES.map((s) => [s.slug, s.name]));
  const ranked = rankVenuesByEventCount(SCRAPE_DATA.events, (e) => e.source_slug, nameBySlug);
  const names = ranked.map((v) => v.name);
  return {
    count: ranked.length,
    byLocale: { de: joinNames(names, "de"), en: joinNames(names, "en") },
  };
})();

function applyVenueSubstitution(items: ReadonlyArray<FaqItem>, locale: Locale): FaqItem[] {
  return items.map((item) =>
    item.a.includes("{venues}")
      ? { q: item.q, a: item.a.replace("{n}", String(VENUE_FAQ.count)).replace("{venues}", VENUE_FAQ.byLocale[locale]) }
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
  events: DayEvent[],
  tr: Translations = DEFAULT_TR,
  locale: Locale = DEFAULT_LOCALE,
  range?: number,
): HtmlEscapedString {
  return (
    <ProgrammePartial date={date} events={events} tr={tr} locale={locale} range={range} />
  ) as unknown as HtmlEscapedString;
}

export function renderPage(props: PageProps): HtmlEscapedString {
  const { date, today, events, dateStrip, category, range, locale, tr, turnstileSiteKey } = props;
  const niceDate = niceDateFor(date, locale);
  const currentPath = range ? "/" : category ? `/tag/${date}?format=${encodeURIComponent(category)}` : `/tag/${date}`;
  const pageTitle = range ? `lehr.salon · ${tr.rangeUpcomingHeading(range)}` : `lehr.salon · ${niceDate}`;
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={pageTitle}
            description={tr.homeDescription}
            canonical={range ? `${APP_URL}/${langSuffix(locale)}` : `${APP_URL}/tag/${date}${langSuffix(locale)}`}
            locale={locale}
            currentPath={currentPath}
            turnstileSiteKey={turnstileSiteKey}
            jsonLd={buildFaqPageSchema(applyVenueSubstitution(tr.faqItems, locale))}
          />
        </head>
        <body>
          <Foxing />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
          <DateStrip strip={dateStrip} active={range ? "" : date} today={today} tr={tr} locale={locale} />
          <RangeRow active={!!range} tr={tr} locale={locale} />
          <DigestCue tr={tr} locale={locale} />
          <AskAi date={date} tr={tr} locale={locale} />
          <main class="programme" id="programme">
            <div id="programme-content">
              <ProgrammePartial date={date} events={events} tr={tr} locale={locale} range={range} />
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
