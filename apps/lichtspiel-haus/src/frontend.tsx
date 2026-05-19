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
import { genreNames } from "./tmdb-genres";

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
  /** When set (7 or 14), render a multi-day grouped view starting on
   *  `date` instead of the single-day programme. */
  range?: number | null;
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

/** Search bar — token-AND match against each row's `data-search`
 *  haystack. Client behaviour lives in buildClientScript. */
function SearchBar({ tr }: { tr: Translations }) {
  return (
    <div class="search-bar">
      <label for="lh-search" class="sr-only">
        {tr.searchLabel}
      </label>
      <input
        id="lh-search"
        type="search"
        class="search-input js-search"
        placeholder={tr.searchPlaceholder}
        autocomplete="off"
        aria-label={tr.searchLabel}
      />
      <kbd class="search-kbd">⌘K</kbd>
      <span class="search-empty" hidden>
        {tr.searchEmpty}
      </span>
    </div>
  );
}

/** Hidden by default; the client script reveals it (with a count) when
 *  any row on the current view is marked seen. Clicking the "Einblenden"
 *  button toggles a body class that brings the hidden rows back in a
 *  dimmed style. */
function SeenBanner({ tr }: { tr: Translations }) {
  return (
    <aside class="seen-banner" id="seen-banner" hidden>
      <span class="seen-banner__lead">
        <span id="seen-banner-count">0</span>
        <span id="seen-banner-label" />
      </span>
      <button type="button" class="seen-banner__btn" data-seen-reveal>
        <span data-seen-reveal-label>{tr.seenReveal}</span>
      </button>
      <span
        hidden
        data-seen-label-show={tr.seenReveal}
        data-seen-label-hide={tr.seenHide}
        data-seen-label-singular={tr.seenHiddenLead(1).replace("1 ", "")}
        data-seen-label-plural={tr.seenHiddenLead(2).replace("2 ", "")}
      />
    </aside>
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
        <div class="datestrip__film">
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
  /** Locale of the surrounding page — drives whether the row shows the
   *  English TMDb overview (when present) or the German cinema description. */
  locale: Locale;
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

/** TMDb user-score rendered as a 10-bulb marquee meter — brass-lit bulbs
 *  on the left for each whole point of the average, 1px stroked empty
 *  sockets on the right. Hidden under the ≥25-vote confidence threshold.
 *  The exact value lives in `title=` + aria-label so hover + screen
 *  readers still get the precise number. */
/** Three-source score badges — TMDb, Rotten Tomatoes, IMDb — rendered in
 *  the same brass-bordered mono-caps register as the OmU / DCP badges.
 *  Each one links to the canonical page on its respective service when
 *  we have a stable identifier; tooltips carry the precise number +
 *  vote count. The TMDb badge subsumes the role of the old toolbar pill
 *  + the marquee meter, so both are gone. ≥25 votes confidence gate on
 *  TMDb matches what the meter used. */
function ScoreBadges({ s }: { s: DayScreening }) {
  const tmdb =
    typeof s.tmdb_vote_average === "number" &&
    typeof s.tmdb_vote_count === "number" &&
    s.tmdb_vote_count >= 25 &&
    s.tmdb_vote_average > 0
      ? { avg: s.tmdb_vote_average, count: s.tmdb_vote_count, pct: Math.round(s.tmdb_vote_average * 10) }
      : null;
  const rt = typeof s.rt_critic === "number" ? s.rt_critic : null;
  const imdb =
    typeof s.imdb_rating === "number" && s.imdb_rating > 0 ? { rating: s.imdb_rating, votes: s.imdb_votes ?? 0 } : null;
  if (!tmdb && !rt && !imdb) return null;

  const tmdbHref = s.tmdb_id ? `https://www.themoviedb.org/${s.tmdb_kind ?? "movie"}/${s.tmdb_id}` : null;
  return (
    <span class="ext-scores">
      {tmdb !== null ? (
        tmdbHref ? (
          <a
            class="ext-score ext-score--tmdb"
            href={tmdbHref}
            target="_blank"
            rel="noopener"
            title={`TMDb · ${tmdb.avg.toFixed(1)} / 10 (${tmdb.count.toLocaleString()} votes)`}
          >
            TMDB {tmdb.pct}
          </a>
        ) : (
          <span
            class="ext-score ext-score--tmdb"
            title={`TMDb · ${tmdb.avg.toFixed(1)} / 10 (${tmdb.count.toLocaleString()} votes)`}
          >
            TMDB {tmdb.pct}
          </span>
        )
      ) : null}
      {rt !== null ? (
        s.imdb_id ? (
          <a
            class="ext-score ext-score--rt"
            href={`https://www.rottentomatoes.com/`}
            target="_blank"
            rel="noopener"
            title={`Rotten Tomatoes critic score: ${rt}%`}
          >
            RT {rt}
          </a>
        ) : (
          <span class="ext-score ext-score--rt" title={`Rotten Tomatoes critic score: ${rt}%`}>
            RT {rt}
          </span>
        )
      ) : null}
      {imdb !== null ? (
        s.imdb_id ? (
          <a
            class="ext-score ext-score--imdb"
            href={`https://www.imdb.com/title/${s.imdb_id}/`}
            target="_blank"
            rel="noopener"
            title={`IMDb · ${imdb.rating.toFixed(1)} / 10 (${imdb.votes.toLocaleString()} votes)`}
          >
            IMDb {imdb.rating.toFixed(1)}
          </a>
        ) : (
          <span
            class="ext-score ext-score--imdb"
            title={`IMDb · ${imdb.rating.toFixed(1)} / 10 (${imdb.votes.toLocaleString()} votes)`}
          >
            IMDb {imdb.rating.toFixed(1)}
          </span>
        )
      ) : null}
    </span>
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
  // Display title: prefer TMDb's canonical title (locale-aware) over the
  // cinema's listing title, which often carries series chrome like
  // "Kino4Kids „Zirkuskind"" or "Schamlos Harmlos: Love Me Tender". The
  // venue's title remains available as `s.title` for the report dialog.
  const displayTitle = opts.locale === "en" ? (s.title_en ?? s.title_de ?? s.title) : (s.title_de ?? s.title);
  // English visitors prefer the TMDb English overview when present, with
  // a soft fallback to the German cinema description so we never render
  // a row with no synopsis just because TMDb missed.
  const description = opts.locale === "en" ? (s.description_en ?? s.description) : s.description;
  const showDescription = description && description !== s.subtitle;
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
  const genres = s.tmdb_genre_ids?.length ? genreNames(s.tmdb_genre_ids, opts.locale) : [];

  // Searchable haystack — title (display + original, since the venue
  // chrome version is what regulars remember), cinema, credits, series,
  // and resolved genre names. All lower-cased + diacritic-folded by the
  // client-side search helper.
  const searchHay = [
    displayTitle,
    s.title,
    s.title_en,
    s.subtitle,
    s.cinema.name,
    s.cinema.short_name,
    s.credits,
    s.series?.name,
    ...genres,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    <li
      class="prog-entry"
      id={`screening-${s.id}`}
      style={`--i:${opts.index}`}
      data-search={searchHay}
      data-seen-key={s.seen_key ?? ""}
    >
      <script
        type="application/ld+json"
        data-id={String(s.id)}
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(buildScreeningJsonLd(s)) }}
      />
      <a class="prog-entry__poster-link" href={filmHref} aria-label={displayTitle}>
        <PosterCard title={displayTitle} imageUrl={s.image_url} />
      </a>
      <header class="prog-entry__head">
        <time class="prog-entry__time-hero" dateTime={s.time ? `${s.date}T${s.time}` : s.date}>
          {time}
        </time>
        <ScoreBadges s={s} />
        <h3 class="prog-entry__work">
          {titleHref ? (
            <a href={titleHref} target="_blank" rel="noopener">
              {displayTitle}
            </a>
          ) : (
            <a href={filmHref}>{displayTitle}</a>
          )}
        </h3>
        {subtitle ? <p class="prog-entry__subtitle">{subtitle}</p> : null}
        {showDescription ? <p class="prog-entry__description">{description}</p> : null}
        {genres.length > 0 ? (
          <ul class="prog-entry__genres" aria-label="Genres">
            {genres.map((g) => (
              <li key={g} class="prog-entry__genre">
                {g}
              </li>
            ))}
          </ul>
        ) : null}
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
        {endTime ? (
          <span class="prog-entry__time">
            <span class="prog-entry__time-end">{endTime}</span>
          </span>
        ) : null}
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
          {s.seen_key ? (
            <button
              type="button"
              class="icon-btn icon-btn--seen"
              data-seen-toggle
              aria-pressed="false"
              aria-label={tr.markSeen}
              title={tr.markSeen}
            >
              <svg
                viewBox="0 0 16 16"
                width="13"
                height="13"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
              >
                <title>{tr.markSeen}</title>
                <path d="M3 8.5l3.2 3.2L13 5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          ) : null}
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

/** Multi-day screening list with a date separator above each new day.
 *  Used on /kino/:slug and /reihe/:slug, both of which span up to 60
 *  days — without the separator the rows blur into one stack of times
 *  with no clue which day is which. ProgrammePartial doesn't need this
 *  because the page header already names the single day in view. */
export function DateGroupedScreenings({
  screenings,
  locale,
  tr,
  hideCinema,
}: {
  screenings: DayScreening[];
  locale: Locale;
  tr: Translations;
  hideCinema?: boolean;
}) {
  if (screenings.length === 0) return null;
  const dl = dateLocale(locale);
  const dayHeader = dateFormatter(dl, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <ol class="screenings">
      {screenings.map((s, i) => {
        const prev = i > 0 ? screenings[i - 1].date : null;
        const isNewDay = s.date !== prev;
        return (
          <>
            {isNewDay ? (
              <li class="day-header" key={`day-${s.date}`} aria-hidden="false">
                <time dateTime={s.date}>{dayHeader.format(new Date(`${s.date}T12:00:00Z`))}</time>
              </li>
            ) : null}
            <Screening key={s.id} s={s} opts={{ index: i, hideCinema, locale }} tr={tr} />
          </>
        );
      })}
    </ol>
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
  markSeen: string;
  unmarkSeen: string;
  seenReveal: string;
  seenHide: string;
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

  /** Reflect ?range=7 in the day/week pill row. HTMX swaps the
   *  programme content but leaves the pills untouched, so after a
   *  toggle the URL points at the new mode while the active class
   *  still tags the old pill. Re-sync on htmx:afterSwap + popstate. */
  function syncRangePills(){
    var range = new URLSearchParams(location.search).get('range') || '0';
    document.querySelectorAll('.range-pill').forEach(function(p){
      var match = (p.getAttribute('data-range') || '0') === range;
      p.classList.toggle('range-pill--active', match);
    });
  }

  document.body.addEventListener('htmx:afterSwap', function(e){
    if (!e.detail || !e.detail.target || e.detail.target.id !== 'programme-content') return;
    syncDateStrip(); syncRangePills();
  });
  window.addEventListener('popstate', function(){ syncDateStrip(); syncRangePills(); });

  /** Honour the #screening-{id} hash that detail pages link back to.
   *  Native hash-jump fires before our CSS + variable-font load settles
   *  layout, so the target sits at the wrong scroll position. Re-scroll
   *  on next frame with block:center so the row is comfortably in view,
   *  and toggle a :target-like flash class for a moment so the visitor
   *  registers the right row. */
  function scrollToHashTarget(){
    if (!location.hash || location.hash.length < 2) return;
    var el;
    try { el = document.querySelector(location.hash); } catch (_) { return; }
    if (!el) return;
    requestAnimationFrame(function(){
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('prog-entry--flash');
      setTimeout(function(){ el.classList.remove('prog-entry--flash'); }, 1800);
    });
  }

  function onReady(){ syncDateStrip(); syncRangePills(); scrollToHashTarget(); }
  if (document.readyState !== 'loading') onReady();
  else document.addEventListener('DOMContentLoaded', onReady);
  window.addEventListener('hashchange', scrollToHashTarget);

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

  // ─── search ─────────────────────────────────────────────────────────
  // Token-AND match against each row's data-search. Ignores diacritics
  // and punctuation. Cmd/Ctrl+K focuses the input; Esc clears it.
  (function(){
    function fold(s){
      try { return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9\\s]+/g, ' ').replace(/\\s+/g, ' ').trim(); }
      catch(_){ return (s||'').toLowerCase(); }
    }
    function applySearch(){
      var input = document.querySelector('.js-search');
      if (!input) return;
      var q = fold(input.value).split(' ').filter(Boolean);
      var rows = document.querySelectorAll('.prog-entry');
      var anyVisible = false;
      rows.forEach(function(r){
        var hay = fold(r.getAttribute('data-search') || '');
        var match = q.length === 0 || q.every(function(t){ return hay.indexOf(t) !== -1; });
        if (match) { r.removeAttribute('data-search-hidden'); anyVisible = true; }
        else r.setAttribute('data-search-hidden', '');
      });
      var empty = document.querySelector('.search-empty');
      if (empty) empty.hidden = !(q.length > 0 && !anyVisible);
      updateSeenBanner();
    }
    window.__lhApplySearch = applySearch;
    document.addEventListener('input', function(e){
      if (e.target && e.target.classList && e.target.classList.contains('js-search')) applySearch();
    });
    document.addEventListener('keydown', function(e){
      var t = e.target;
      if (e.key === 'Escape' && t && t.classList && t.classList.contains('js-search')) {
        t.value = ''; applySearch(); t.blur();
      }
      if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === 'k') {
        var input = document.querySelector('.js-search');
        if (input) { e.preventDefault(); input.focus(); input.select(); }
      }
    });
  })();

  // ─── mark-seen ──────────────────────────────────────────────────────
  // Toggles localStorage entry, updates aria + checkmark fill, and lets
  // CSS hide the row. The reveal banner at the bottom counts hidden rows
  // on the current view and toggles body.lh-show-seen to bring them back.
  (function(){
    var KEY = 'lh-seen';
    function load(){ try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch(_) { return new Set(); } }
    function save(set){ try { localStorage.setItem(KEY, JSON.stringify(Array.from(set))); } catch(_) {} }
    var seen = load();

    function applyRow(row){
      var key = row.getAttribute('data-seen-key');
      if (!key) return;
      var isSeen = seen.has(key);
      row.classList.toggle('prog-entry--seen', isSeen);
      var btn = row.querySelector('[data-seen-toggle]');
      if (btn) {
        btn.classList.toggle('is-on', isSeen);
        btn.setAttribute('aria-pressed', isSeen ? 'true' : 'false');
        btn.setAttribute('aria-label', isSeen ? ${j(L.unmarkSeen)} : ${j(L.markSeen)});
        btn.setAttribute('title', isSeen ? ${j(L.unmarkSeen)} : ${j(L.markSeen)});
      }
    }
    function applyAll(){
      document.querySelectorAll('.prog-entry').forEach(applyRow);
      updateSeenBanner();
    }
    window.__lhApplySeen = applyAll;

    document.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('[data-seen-toggle]');
      if (btn) {
        e.preventDefault();
        var row = btn.closest('.prog-entry'); if (!row) return;
        var key = row.getAttribute('data-seen-key'); if (!key) return;
        if (seen.has(key)) seen.delete(key); else seen.add(key);
        save(seen);
        // Apply to every row sharing that seen_key (same film, multiple
        // dates/cinemas) so one click hides the lot.
        document.querySelectorAll('[data-seen-key="' + CSS.escape(key) + '"]').forEach(applyRow);
        updateSeenBanner();
        return;
      }
      var reveal = e.target.closest && e.target.closest('[data-seen-reveal]');
      if (reveal) {
        e.preventDefault();
        document.body.classList.toggle('lh-show-seen');
        var on = document.body.classList.contains('lh-show-seen');
        var label = reveal.querySelector('[data-seen-reveal-label]');
        if (label) label.textContent = on ? ${j(L.seenHide)} : ${j(L.seenReveal)};
      }
    });

    applyAll();
    document.body.addEventListener('htmx:afterSwap', applyAll);
  })();

  function updateSeenBanner(){
    var banner = document.getElementById('seen-banner'); if (!banner) return;
    var rows = document.querySelectorAll('.prog-entry.prog-entry--seen:not([data-search-hidden])');
    var n = rows.length;
    var count = document.getElementById('seen-banner-count');
    var label = document.getElementById('seen-banner-label');
    var tpl = banner.querySelector('[data-seen-label-show]');
    if (count) count.textContent = String(n);
    if (label && tpl) {
      var noun = n === 1 ? tpl.getAttribute('data-seen-label-singular') : tpl.getAttribute('data-seen-label-plural');
      label.textContent = ' ' + (noun || '');
    }
    banner.hidden = n === 0;
  }
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
          var time = el.querySelector('.prog-entry__time-hero');
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
    markSeen: tr.markSeen,
    unmarkSeen: tr.unmarkSeen,
    seenReveal: tr.seenReveal,
    seenHide: tr.seenHide,
  });
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `${clientScript}\n${POPOVER_POSITIONING_SCRIPT}\n${HTMX_LIFECYCLE_SCRIPT}\n${TURNSTILE_LAZY_LOAD_SCRIPT}\n${WEBMCP_SCRIPT}`,
      }}
    />
  );
}

/** TMDb terms of use require attribution when an app consumes their API
 *  data. Rendered as a sibling of SharedFooter so every page (home,
 *  cinema, series, film, imprint) carries it; matches the typography
 *  scale of the existing footer__links row. */
function TmdbAttribution({ tr }: { tr: Translations }) {
  return (
    <p class="footer__attribution">
      {tr.tmdbAttributionLead}
      <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">
        TMDB
      </a>
      {tr.tmdbAttributionTail}
    </p>
  );
}

export function Footer({ tr, locale }: { tr: Translations; locale: Locale }) {
  const lang = langSuffix(locale);
  return (
    <>
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
      <TmdbAttribution tr={tr} />
    </>
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

/** Drop screenings whose listed showtime has already passed. Cinemas
 *  schedule ~10–20 min of trailers, so "you can still walk in" makes
 *  less sense here than for concert / theatre. Strict cutoff at the
 *  printed start time. */
function filterPastForToday(date: string, screenings: DayScreening[]): DayScreening[] {
  if (date !== todayIso()) return screenings;
  const { hour, minute } = berlinHourMinute();
  const nowMin = hour * 60 + minute;
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
  range = null,
}: {
  date: string;
  screenings: DayScreening[];
  tr: Translations;
  locale?: Locale;
  range?: number | null;
}) {
  const dp = dateParts(date);
  const dateObj = new Date(`${date}T12:00:00Z`);
  const dl = dateLocale(locale);
  const weekdayLong = dateFormatter(dl, { weekday: "long", timeZone: "UTC" }).format(dateObj);
  const monthLong = dateFormatter(dl, { month: "long", timeZone: "UTC" }).format(dateObj);
  // Range mode: skip past-filter (multi-day list shouldn't lose today's
  // earlier screenings — they're still future from tomorrow onward) and
  // render via the shared date-grouped helper.
  if (range) {
    const endIso = (() => {
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + range - 1);
      return d.toISOString().slice(0, 10);
    })();
    const fromLabel = dateFormatter(dl, { day: "numeric", month: "short", timeZone: "UTC" }).format(dateObj);
    const toLabel = dateFormatter(dl, { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${endIso}T12:00:00Z`),
    );
    return (
      <>
        <header class="programme__header">
          <p class="programme__line" />
          <p class="programme__weekday">{tr.weekOverview}</p>
          <h2 class="programme__date">
            <span class="programme__range">
              {fromLabel} – {toLabel}
            </span>
          </h2>
        </header>
        {screenings.length === 0 ? (
          <div class="empty empty--blackout">
            <p class="empty__mark" aria-hidden="true">
              ‖
            </p>
            <p class="empty__direction">Saal dunkel</p>
            <p class="empty__line">{tr.emptyTitle}</p>
            <p class="empty__hint">{tr.emptyHint}</p>
          </div>
        ) : (
          <DateGroupedScreenings screenings={screenings} locale={locale} tr={tr} />
        )}
        <SiblingStrap tr={tr} />
      </>
    );
  }
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
              <Screening key={s.id} s={s} opts={{ index: i, locale }} tr={tr} />
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
  range: number | null = null,
): HtmlEscapedString {
  return (
    <ProgrammePartial date={date} screenings={screenings} tr={tr} locale={locale} range={range} />
  ) as unknown as HtmlEscapedString;
}

/** Day / week toggle near the date strip. Mirrors frankfurt-museums'
 *  range-pill row, lichtspiel.haus-styled. URL pattern:
 *  /tag/{date}?range=7 — HTMX swaps the programme-content. */
function RangeToggle({
  date,
  range,
  locale,
  tr,
}: {
  date: string;
  range: number | null;
  locale: Locale;
  tr: Translations;
}) {
  const lang = langSuffix(locale, "?");
  const langAmp = langSuffix(locale, "&");
  return (
    <div class="range-row">
      <a
        class={`range-pill${range == null ? " range-pill--active" : ""}`}
        data-range="0"
        href={`/tag/${date}${lang}`}
        hx-get={`/partial/content?date=${date}`}
        hx-target="#programme-content"
        hx-push-url={`/tag/${date}${lang}`}
      >
        {tr.todayProgrammeTitle}
      </a>
      <a
        class={`range-pill${range === 7 ? " range-pill--active" : ""}`}
        data-range="7"
        href={`/tag/${date}?range=7${langAmp}`}
        hx-get={`/partial/content?date=${date}&range=7`}
        hx-target="#programme-content"
        hx-push-url={`/tag/${date}?range=7${langAmp}`}
      >
        {tr.weekOverview}
      </a>
    </div>
  );
}

export function renderPage(props: PageProps): HtmlEscapedString {
  const { date, today, screenings, dateStrip, locale, tr, turnstileSiteKey, range = null } = props;
  const niceDate = niceDateFor(date, locale);
  const currentPath = range ? `/tag/${date}?range=${range}` : `/tag/${date}`;
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
          <SearchBar tr={tr} />
          <DateStrip strip={dateStrip} active={range ? "" : date} today={today} tr={tr} locale={locale} />
          <RangeToggle date={date} range={range} locale={locale} tr={tr} />
          <DigestCue tr={tr} locale={locale} />
          <AskAi date={date} tr={tr} locale={locale} />
          <main class="programme" id="programme">
            <div id="programme-content">
              <ProgrammePartial date={date} screenings={screenings} tr={tr} locale={locale} range={range} />
            </div>
            <SeenBanner tr={tr} />
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
