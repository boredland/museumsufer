import {
  berlinHourMinute,
  buildFaqPageSchema,
  buildUtm,
  buildWebMcpScript,
  type CalendarEvent,
  escapeHtml as coreEscapeHtml,
  dateOffset,
  type FaqItem,
  formatGermanDateLong,
  HTMX_LIFECYCLE_SCRIPT,
  GERMAN_MONTHS_LONG as MONTHS_LONG,
  THEME_FOUC_SCRIPT,
  TURNSTILE_LAZY_LOAD_SCRIPT,
  todayIso,
  GERMAN_WEEKDAYS as WEEKDAYS_LONG,
  GERMAN_WEEKDAYS_SHORT as WEEKDAYS_SHORT,
  type WebMcpToolDef,
} from "@museumsufer/core";
import { AskAi as SharedAskAi } from "@museumsufer/core/ask-ai";
import { CalendarPopover, POPOVER_POSITIONING_SCRIPT } from "@museumsufer/core/calendar-popover";
import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { DateWithCount, DayPerformance } from "./db";
import { imageProxyUrl } from "./image-proxy";
import { INLINE_CSS } from "./styles-inline";
import { THEATERS } from "./theater-config";

export type { DayPerformance } from "./db";

interface PageProps {
  date: string;
  today: string;
  performances: DayPerformance[];
  dateStrip: DateWithCount[];
  turnstileSiteKey?: string;
}

const APP_URL = "https://frankfurt.ins.theater";

/** Absolute proxied image URL for JSON-LD / OG tags (callers need a full URL). */
function absImageUrl(src: string | null | undefined): string | undefined {
  const proxied = imageProxyUrl(src ?? undefined);
  if (!proxied) return undefined;
  return proxied.startsWith("/") ? `${APP_URL}${proxied}` : proxied;
}
const REPO_URL = "https://github.com/boredland/museumsufer";

const utm = buildUtm("frankfurt.ins.theater");

function dateParts(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    weekday: d.getUTCDay(),
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
    year: d.getUTCFullYear(),
  };
}

const fullGerman = formatGermanDateLong;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export const escapeHtml = coreEscapeHtml;

function jsonLdSafe(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export interface HeadOptions {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Extra <link> tags rendered after the standard head links (e.g. per-theater iCal). */
  extraLinks?: Array<{ rel: string; href: string; type?: string; title?: string }>;
  /** When set, includes the Cloudflare Turnstile script for the contact form. */
  turnstileSiteKey?: string;
}

export function Head(opts: HeadOptions) {
  const ogImage = opts.ogImage ?? `${APP_URL}/og-image.png`;
  const jsonLdArr = opts.jsonLd ? (Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd]) : [];
  const fontHref =
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=JetBrains+Mono:wght@400;500;700&display=swap";
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
      <meta property="og:locale" content="de_DE" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="theme-color" content="#F4EFE2" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/icon-192.png" />
      <link rel="manifest" href="/manifest.json" />
      <link rel="alternate" type="application/json" title="Frankfurt Theater API" href="/api/day" />
      <link rel="alternate" type="text/calendar" title="Spielplan iCal" href="/feed.ics" />
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
      <script src="/uFuzzy.iife.min.js" defer></script>
      {opts.turnstileSiteKey
        ? {
            /* Turnstile is lazy-loaded via window.__loadTurnstile() on dialog open — see TURNSTILE_LAZY_LOAD_SCRIPT. */
          }
        : null}
      {jsonLdArr.map((j, i) => (
        <script key={`jsonld-${i}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(j) }} />
      ))}
    </>
  );
}

export function Grain() {
  return (
    <>
      <div class="grain" aria-hidden="true" />
      <div class="progress-bar" aria-hidden="true" />
    </>
  );
}

export function Masthead({ sublabel }: { sublabel?: string } = {}) {
  return (
    <header class="masthead">
      <a class="masthead__brand" href="/">
        <h1 class="wordmark">
          <span class="wordmark__line wordmark__line--1">Frankfurt</span>
          <span class="wordmark__ins" aria-hidden="true">
            ins
          </span>
          <span class="wordmark__line wordmark__line--2">Theater.</span>
        </h1>
        <p class="tagline">{sublabel ?? "Was heute auf den Frankfurter Bühnen läuft."}</p>
      </a>
      <button
        type="button"
        class="theme-toggle"
        data-theme-toggle
        aria-label="Farbthema wechseln"
        title="Farbthema wechseln"
      >
        <svg
          class="theme-toggle__moon"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          aria-hidden="true"
          fill="currentColor"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg
          class="theme-toggle__sun"
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

export function DateStrip({
  strip,
  active,
  today,
  base = "/",
}: {
  strip: DateWithCount[];
  active: string;
  today: string;
  base?: string;
}) {
  if (!strip.length) return null;
  const params = base.includes("?") ? "&" : "?";
  const isHome = base === "/";
  return (
    <nav class="datestrip" aria-label="Spieltage">
      <div class="datestrip__inner" id="datestrip">
        {strip.map((d) => {
          const p = dateParts(d.date);
          const isActive = d.date === active;
          const isToday = d.date === today;
          const cls = ["datetile", isActive ? "datetile--active" : "", isToday ? "datetile--today" : ""]
            .filter(Boolean)
            .join(" ");
          const href = `${base}${params}date=${d.date}`;
          return (
            <a
              key={d.date}
              class={cls}
              href={href}
              aria-current={isActive ? "true" : "false"}
              hx-get={isHome ? `/partial/content?date=${d.date}` : undefined}
              hx-target={isHome ? "#programme-content" : undefined}
              hx-swap={isHome ? "innerHTML swap:80ms settle:20ms" : undefined}
              hx-push-url={isHome ? href : undefined}
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

// ─── Performance row ───────────────────────────────────────────────────

const ICON_NAVIGATE = (
  <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" fill="currentColor">
    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
  </svg>
);
const ICON_RMV = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
    <path d="M19 16.94V8.5c0-2.79-2.61-3.4-5.5-3.5V3h-3v2C7.6 5.1 5 5.71 5 8.5v8.44c-.56.51-.97 1.18-1 1.97V21h4v-1h8v1h4v-2.09c-.03-.79-.44-1.46-1-1.97zM12 4.5c3.13.09 4 .84 4 1.5H8c0-.66.87-1.41 4-1.5zM7 8h10v5H7V8zm1.5 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
  </svg>
);
const ICON_GOOGLE = (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
  >
    <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" stroke-linejoin="round" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);
const ICON_APPLE = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.65-2.2.46-3.06-.4C3.79 16.17 4.36 9.43 8.9 9.18c1.25.07 2.12.73 2.86.78.97-.2 1.9-.76 2.93-.69 1.24.1 2.17.58 2.79 1.48-2.56 1.53-1.95 4.89.58 5.83-.45 1.19-.99 2.38-1.95 3.72h-.06zM12.03 9.12C11.9 7.05 13.6 5.36 15.56 5.2c.29 2.38-2.16 4.16-3.53 3.92z" />
  </svg>
);
const ICON_REPORT = (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
  >
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 4.5v4M8 11h.01" stroke-linecap="round" />
  </svg>
);
const ICON_LINK = (
  <svg
    viewBox="0 0 24 24"
    width="13"
    height="13"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M10.5 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66L12 6.34" />
    <path d="M13.5 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66L12 17.66" />
  </svg>
);

function StatusStamp({ status, terminus }: { status: string; terminus?: boolean }) {
  const term = terminus ? " stamp--terminus" : "";
  switch (status) {
    case "sold_out":
      return <span class={`stamp stamp--soldout${term}`}>Ausverkauft</span>;
    case "cancelled":
      return <span class={`stamp stamp--cancelled${term}`}>Entfällt</span>;
    case "few_left":
      return <span class={`stamp stamp--few${term}`}>Restkarten</span>;
    default:
      return null;
  }
}

function PerformanceCalendarPopover({ p }: { p: DayPerformance }) {
  if (p.status === "cancelled") return null;
  const ev: CalendarEvent = {
    date: p.date,
    time: p.time ?? null,
    end_time: p.end_time ?? null,
    end_date: p.end_date ?? null,
    title: p.show.title,
    location: [p.theater.name, p.venue_room && p.venue_room !== p.theater.name ? p.venue_room : null]
      .filter(Boolean)
      .join(", "),
    description: p.show.subtitle ?? null,
    detail_url: (() => {
      const src = p.show.detail_url ?? p.ticket_url ?? null;
      return src ? utm(src, "calendar") : null;
    })(),
  };
  return <CalendarPopover event={ev} popoverId={`cal-${p.id}`} icsHref={`/performance/${p.id}/feed.ics`} />;
}

function TransitPopover({ p }: { p: DayPerformance }) {
  const popId = `nav-${p.id}`;
  return (
    <span class="nav-wrap">
      <button
        type="button"
        class="transit-btn"
        data-popover-target={popId}
        aria-label={`Anfahrt zu ${p.theater.name}`}
        title={`Anfahrt zu ${p.theater.name}`}
        popovertarget={popId}
        aria-haspopup="menu"
      >
        {ICON_NAVIGATE}
      </button>
      <div id={popId} popover="auto" role="menu" class="nav-popover" data-theater={p.theater.slug}>
        {/* biome-ignore-start lint/a11y/useValidAnchor: href set by client JS from theater slug */}
        <a
          role="menuitem"
          class="nav-popover__link nav-popover__link--rmv-app"
          data-kind="rmv-app"
          href="#"
          target="_blank"
          rel="noopener"
        >
          <span class="nav-popover__icon" aria-hidden="true">
            {ICON_RMV}
          </span>{" "}
          RMV
        </a>
        <a
          role="menuitem"
          class="nav-popover__link nav-popover__link--rmv-web"
          data-kind="rmv-web"
          href="#"
          target="_blank"
          rel="noopener"
        >
          <span class="nav-popover__icon" aria-hidden="true">
            {ICON_RMV}
          </span>{" "}
          RMV
        </a>
        <a role="menuitem" class="nav-popover__link" data-kind="google" href="#" target="_blank" rel="noopener">
          <span class="nav-popover__icon" aria-hidden="true">
            {ICON_GOOGLE}
          </span>{" "}
          Google Maps
        </a>
        <a role="menuitem" class="nav-popover__link" data-kind="apple" href="#" target="_blank" rel="noopener">
          <span class="nav-popover__icon" aria-hidden="true">
            {ICON_APPLE}
          </span>{" "}
          Apple Maps
        </a>
        {/* biome-ignore-end lint/a11y/useValidAnchor: href set by client JS from theater slug */}
      </div>
    </span>
  );
}

function ShareButton({ p }: { p: DayPerformance }) {
  return (
    <button
      type="button"
      class="share-btn"
      data-share-id={`perf-${p.id}`}
      data-share-date={p.date}
      data-share-title={p.show.title}
      aria-label="Link zu dieser Vorstellung kopieren"
      title="Link zu dieser Vorstellung kopieren"
    >
      {ICON_LINK}
    </button>
  );
}

function ReportButton({ p }: { p: DayPerformance }) {
  const regarding = `${p.show.title} — ${p.theater.name}, ${p.date}${p.time ? ` ${p.time}` : ""}`;
  const context = `${regarding} (${APP_URL}/api/performance/${p.id})`;
  return (
    <button
      type="button"
      class="report-btn"
      data-report-type="performance"
      data-report-regarding={regarding}
      data-report-context={context}
      aria-label="Fehler bei dieser Vorstellung melden"
      title="Fehler bei dieser Vorstellung melden"
    >
      {ICON_REPORT}
    </button>
  );
}

function Terminus({ p }: { p: DayPerformance }) {
  if (p.status === "sold_out" || p.status === "cancelled") {
    return <StatusStamp status={p.status} terminus />;
  }
  if (!p.ticket_url) return null;
  return (
    <a class="action" href={utm(p.ticket_url, "karten")} target="_blank" rel="noopener">
      <span>Karten</span>
      <span class="action__arrow" aria-hidden="true">
        →
      </span>
    </a>
  );
}

function PriceRange({ min, max }: { min: number | null | undefined; max: number | null | undefined }) {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return (
      <>
        {min}
        <span class="dash">–</span>
        {max} <span class="cur">€</span>
      </>
    );
  }
  return (
    <>
      {max ?? min} <span class="cur">€</span>
    </>
  );
}

export interface PerformanceRowOptions {
  index: number;
  showDate?: boolean;
  /** When true, omit the theater name (used on theater detail pages) */
  hideTheater?: boolean;
}

export function Performance({ p, opts }: { p: DayPerformance; opts: PerformanceRowOptions }) {
  const { index } = opts;
  const time = p.time ?? "—";
  const endTime = p.end_time ? ` – ${p.end_time}` : "";
  // Some scrapers (Reservix listings) store the theater name itself as the
  // venue room, which would render as "Die Käs · Die Käs". Drop the room
  // when it's effectively the same string as the theater name.
  const isSameVenue = !!p.venue_room && p.venue_room.trim().toLowerCase() === p.theater.name.trim().toLowerCase();
  const room = p.venue_room && !isSameVenue ? p.venue_room : null;
  const isStruck = p.status === "sold_out" || p.status === "cancelled";
  // The original code joins <br/>-separated subtitles with " · "; do the same
  // by computing a pre-escaped HTML string and embedding via dangerouslySetInnerHTML.
  const subtitleHtml = p.show.subtitle ? escapeHtml(p.show.subtitle).replace(/\s*<br\s*\/?>\s*/gi, " · ") : null;
  const showPrice = p.status !== "sold_out" && p.status !== "cancelled";
  const hasPrice = showPrice && (p.price_min != null || p.price_max != null);
  const titleSource = p.show.detail_url ?? p.ticket_url ?? null;
  const titleHref = titleSource ? utm(titleSource, p.show.detail_url ? "show_title" : "show_title_ticket") : null;

  // Sold-out and cancelled stamps live in the terminal (Karten) slot of the
  // rail so the layout matches available rows. Other statuses (e.g. few_left
  // → "Restkarten") render inline alongside the price.
  const isTerminalStatus = p.status === "sold_out" || p.status === "cancelled";

  return (
    <li
      class={`perf perf--${p.status}`}
      id={`perf-${p.id}`}
      style={`--i:${index}`}
      data-perf-id={String(p.id)}
      data-share-key={`perf-${p.id}`}
      data-theater={p.theater.slug}
    >
      <div class="perf__when">
        {opts.showDate ? <p class="perf__when-date">{fullGerman(p.date)}</p> : null}
        <span class="perf__index">{pad2(index + 1)}</span>
        <span class="perf__time">
          <span class="t1">{time}</span>
          <span class="t2">{endTime}</span>
        </span>
      </div>
      <div class="perf__body">
        <h3 class={`perf__title ${isStruck ? "perf__title--struck" : ""}`}>
          {titleHref ? (
            <a href={titleHref} target="_blank" rel="noopener">
              {p.show.title}
            </a>
          ) : (
            p.show.title
          )}
        </h3>
        {opts.hideTheater ? (
          room ? (
            <p class="perf__venue">
              <span>{room}</span>
            </p>
          ) : null
        ) : (
          <p class="perf__venue">
            <a href={`/theater/${p.theater.slug}`}>{p.theater.name}</a>
            {room ? (
              <>
                <span class="perf__sep">·</span>
                <span>{room}</span>
              </>
            ) : null}
          </p>
        )}
        {subtitleHtml ? <p class="perf__byline" dangerouslySetInnerHTML={{ __html: subtitleHtml }} /> : null}
      </div>
      <div class="perf__rail">
        {hasPrice ? (
          <p class="perf__price">
            <PriceRange min={p.price_min} max={p.price_max} />
          </p>
        ) : null}
        {!isTerminalStatus ? <StatusStamp status={p.status} /> : null}
        <TransitPopover p={p} />
        <PerformanceCalendarPopover p={p} />
        <ShareButton p={p} />
        <ReportButton p={p} />
        <Terminus p={p} />
      </div>
    </li>
  );
}

// ─── Top-level page sections ───────────────────────────────────────────

export function AskAi() {
  return (
    <SharedAskAi
      label="Frag eine KI"
      aria="Frag eine KI nach dem heutigen Spielplan"
      prompt="Was läuft heute Abend auf den Frankfurter Bühnen? Quelle: https://frankfurt.ins.theater"
    />
  );
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Welche Bühnen sind hier vertreten?",
    a: "Die Seite bündelt rund zwei Dutzend Frankfurter Häuser — von Schauspiel Frankfurt, Oper Frankfurt und English Theatre über die Komödie und Die Käs bis zu freien Bühnen wie dem Gallus Theater, dem Mousonturm oder der Brotfabrik. Auch Tanz und Musical sind dabei.",
  },
  {
    q: "Wie aktuell ist der Spielplan?",
    a: "Die Daten werden stündlich zwischen 09 und 21 Uhr direkt von den Webseiten der Häuser abgerufen. Änderungen wie Absagen oder ausverkaufte Vorstellungen erscheinen normalerweise innerhalb einer Stunde.",
  },
  {
    q: "Kann ich hier Karten kaufen?",
    a: "Nein — die Tickets-Schaltfläche an jeder Vorstellung führt direkt auf die Buchungsseite des jeweiligen Hauses. Diese Seite ist keine Verkaufsplattform und nimmt keine Provision.",
  },
  {
    q: "Ist die Seite kostenlos?",
    a: "Ja, frankfurt.ins.theater ist vollständig kostenlos, ohne Registrierung und ohne App-Store. Die Seite läuft als Progressive Web App direkt im Browser.",
  },
  {
    q: "Was ist mit Vorstellungen, die schon angefangen haben?",
    a: "Auf dem heutigen Spielplan werden Vorstellungen 30 Minuten nach Beginn ausgeblendet, damit nur noch erreichbare Termine sichtbar sind. Eine kleine Notiz unter der Liste zeigt, wie viele bereits gestartet sind.",
  },
  {
    q: "Wie geht die Seite mit meinen Daten um?",
    a: "Es werden keine personenbezogenen Daten erhoben. Feedback-Nachrichten werden nur dann gespeichert, wenn du sie selbst absendest. Die Seite verwendet weder Tracking noch Analyse-Cookies.",
  },
  {
    q: "Warum diese Seite?",
    a: "Frankfurt hat eine ungewöhnlich dichte Theaterlandschaft, aber keinen gemeinsamen Spielplan. Diese Seite legt alle Häuser auf eine durchsuchbare Tagesansicht — ein Programmheft für die ganze Stadt.",
  },
];

export function Faq() {
  const total = String(FAQ_ITEMS.length).padStart(2, "0");
  return (
    <section class="faq" aria-labelledby="faq-title">
      <header class="faq__head">
        <span class="faq__kicker" id="faq-title">
          Häufige Fragen
        </span>
        <span class="faq__rule" aria-hidden="true" />
        <span class="faq__count">01 — {total}</span>
      </header>
      <div class="faq__list">
        {FAQ_ITEMS.map((item, i) => (
          <details class="faq__item" open={i === 0 ? true : undefined}>
            <summary class="faq__row">
              <span class="faq__num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 class="faq__q">{item.q}</h3>
              <span class="faq__toggle" aria-hidden="true" />
            </summary>
            <p class="faq__a">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function DigestCue() {
  return (
    <button type="button" class="digest-cue" data-digest-open>
      <span class="digest-cue__mark" aria-hidden="true">
        ※
      </span>
      <span class="digest-cue__kicker">Push-Digest</span>
      <span class="digest-cue__rule" aria-hidden="true" />
      <span class="digest-cue__text">Erfahre morgens, was heute Abend gespielt wird.</span>
      <span class="digest-cue__schedules" aria-hidden="true">
        07 · 17 · So 09
      </span>
      <span class="digest-cue__chevron" aria-hidden="true">
        →
      </span>
    </button>
  );
}

function ContactDialog({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  return (
    <dialog id="contact-dialog" class="contact-dialog">
      <form id="contact-form" class="contact-form" novalidate>
        <header class="contact-form__head">
          <h2 class="contact-form__title">Feedback &amp; Korrekturen</h2>
          <button type="button" class="contact-form__close" data-contact-close aria-label="Schließen">
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
          Falsche Zeit, fehlende Vorstellung, Tippfehler? Wir freuen uns über jeden Hinweis.
        </p>
        <div class="contact-form__regarding" id="contact-regarding" hidden>
          <span class="contact-form__regarding-label">Betrifft</span>
          <span id="contact-regarding-text" />
        </div>
        <label class="contact-form__field">
          <span class="contact-form__label">Kategorie</span>
          <select id="contact-category" name="category" required>
            <option value="Vorstellung">Vorstellung — falsche Daten</option>
            <option value="Bühne">Bühne — fehlt oder Korrektur</option>
            <option value="Allgemein">Allgemein — Feedback / Funktionen</option>
          </select>
        </label>
        <label class="contact-form__field">
          <span class="contact-form__label">E-Mail (optional, für Rückfragen)</span>
          <input type="email" id="contact-email" name="email" placeholder="dein@email.de" />
        </label>
        <label class="contact-form__field">
          <span class="contact-form__label">Nachricht</span>
          <textarea id="contact-message" name="message" required rows={4} placeholder="Was stimmt nicht?" />
        </label>
        <input type="hidden" id="contact-context" name="context" />
        {turnstileSiteKey ? (
          <div class="cf-turnstile" data-sitekey={turnstileSiteKey} data-size="flexible" data-theme="auto" />
        ) : null}
        <footer class="contact-form__foot">
          <p id="contact-status" class="contact-form__status" hidden aria-live="polite" />
          <button type="submit" id="contact-submit" class="contact-form__submit">
            Senden
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function DigestDialog() {
  return (
    <dialog id="digest-dialog" class="contact-dialog">
      <form id="digest-form" class="contact-form" novalidate>
        <header class="contact-form__head">
          <h2 class="contact-form__title">Vorstellungen abonnieren</h2>
          <button type="button" class="contact-form__close" data-digest-close aria-label="Schließen">
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
          Bekomme Push-Nachrichten direkt aufs Gerät — keine E-Mail, kein Konto. Du kannst jederzeit wieder abbestellen.
        </p>
        <fieldset class="digest-options" aria-label="Digest-Zeitpunkte">
          <label class="digest-option">
            <input type="checkbox" name="schedule" value="morning" />
            <span class="digest-option__main">
              <span class="digest-option__title">Jeden Morgen</span>
              <span class="digest-option__time">07:00</span>
            </span>
            <span class="digest-option__sub">Heutige Vorstellungen</span>
          </label>
          <label class="digest-option">
            <input type="checkbox" name="schedule" value="afternoon" />
            <span class="digest-option__main">
              <span class="digest-option__title">Jeden Nachmittag</span>
              <span class="digest-option__time">17:00</span>
            </span>
            <span class="digest-option__sub">Was läuft heute Abend?</span>
          </label>
          <label class="digest-option">
            <input type="checkbox" name="schedule" value="weekly" />
            <span class="digest-option__main">
              <span class="digest-option__title">Sonntag-Digest</span>
              <span class="digest-option__time">So 09:00</span>
            </span>
            <span class="digest-option__sub">Wochenüberblick</span>
          </label>
        </fieldset>
        <details class="digest-filter">
          <summary class="digest-filter__summary">
            <span class="digest-filter__label">Bühnen einschränken</span>
            <span class="digest-filter__hint">leer = alle</span>
          </summary>
          <fieldset class="digest-filter__chips" aria-label="Bühnen">
            {THEATERS.map((t) => (
              <label key={t.slug} class="digest-chip">
                <input type="checkbox" name="filter-theater" value={t.slug} />
                <span class="digest-chip__label">{t.name}</span>
              </label>
            ))}
          </fieldset>
        </details>
        <div id="digest-ios-hint" class="digest-hint" hidden>
          <strong>Auf iPhone/iPad:</strong> Tippe unten auf »Teilen« und »Zum Home-Bildschirm hinzufügen«. Öffne die
          Seite anschließend über das neue App-Icon — erst dann sind Push-Nachrichten möglich.
        </div>
        <div id="digest-unsupported" class="digest-hint digest-hint--err" hidden>
          Dein Browser unterstützt Push-Nachrichten nicht. Probier es in Safari (macOS), Chrome, Firefox oder Edge.
        </div>
        <footer class="contact-form__foot">
          <p id="digest-status" class="contact-form__status" hidden aria-live="polite" />
          <button type="button" id="digest-unsubscribe-all" class="digest-form__unsub" hidden>
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

export function Footer({ turnstileSiteKey }: { turnstileSiteKey?: string } = {}) {
  return (
    <>
      <footer class="footer">
        <div>
          <p class="footer__rule" />
          <p>Eine Übersicht des Spielplans an Frankfurts Bühnen.</p>
          <p class="footer__actions">
            <button type="button" class="footer__action" data-digest-open aria-label="Benachrichtigungen abonnieren">
              <svg
                viewBox="0 0 16 16"
                width="13"
                height="13"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M3 6a5 5 0 0 1 10 0v3l1.2 1.6a.5.5 0 0 1-.4.8H2.2a.5.5 0 0 1-.4-.8L3 9V6Z" />
                <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke-linecap="round" />
              </svg>
              <span>Abonnieren</span>
            </button>
            <button type="button" class="footer__action" data-contact-open aria-label="Problem melden">
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
              <span>Problem melden</span>
            </button>
          </p>
          <p class="footer__links">
            <a href="/api/docs">API</a>
            <span class="footer__sep">·</span>
            <a href="/feed.ics">iCal</a>
            <span class="footer__sep">·</span>
            <a href="/sitemap.xml">Sitemap</a>
            <span class="footer__sep">·</span>
            <a href="/impressum">Impressum</a>
            <span class="footer__sep">·</span>
            <a href={REPO_URL} target="_blank" rel="noopener" aria-label="Quellcode auf GitHub">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
                <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.3-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.2.5.7.5 1.4v2.1c0 .2.1.5.6.4A8 8 0 0 0 8 .2Z" />
              </svg>
              GitHub
            </a>
          </p>
          <span class="footer__toast" role="status" aria-live="polite" />
        </div>
      </footer>
      <ContactDialog turnstileSiteKey={turnstileSiteKey} />
      <DigestDialog />
    </>
  );
}

function TomorrowLink() {
  const tomorrow = dateOffset(1);
  return (
    <a
      class="empty__next"
      href={`/?date=${tomorrow}`}
      hx-get={`/partial/content?date=${tomorrow}`}
      hx-target="#programme-content"
      hx-swap="innerHTML swap:80ms settle:20ms"
      hx-push-url={`/?date=${tomorrow}`}
    >
      Spielplan für morgen →
    </a>
  );
}

function filterPastForToday(date: string, performances: DayPerformance[]): DayPerformance[] {
  if (date !== todayIso()) return performances;
  const { hour, minute } = berlinHourMinute();
  const nowMin = hour * 60 + minute - 30; // 30-minute grace
  return performances.filter((p) => {
    if (!p.time) return true;
    const [hh, mm] = p.time.split(":");
    const startMin = parseInt(hh, 10) * 60 + parseInt(mm, 10);
    return startMin >= nowMin;
  });
}

/**
 * Quiet editorial cross-link to the two sibling Frankfurt apps. Sits
 * after the performances list — a soft suggestion for visitors who
 * didn't find anything in today's theatre line-up.
 */
function SiblingStrap() {
  return (
    <section class="programme__siblings">
      <hr class="programme__siblings-rule" />
      <p class="programme__siblings-prompt">
        Nichts dabei? Wie wäre es stattdessen mit einem{" "}
        <a href="https://frankfurt.konzert.haus" target="_blank" rel="noopener">
          Konzert
        </a>{" "}
        oder einem{" "}
        <a href="https://museumsufer.app" target="_blank" rel="noopener">
          Museumsbesuch
        </a>
        ?
      </p>
    </section>
  );
}

export function ProgrammePartial({ date, performances }: { date: string; performances: DayPerformance[] }) {
  const dp = dateParts(date);
  const headerWeekday = WEEKDAYS_LONG[dp.weekday];
  const visible = filterPastForToday(date, performances);
  const hidden = performances.length - visible.length;
  return (
    <>
      <header class="programme__header">
        <p class="programme__line" />
        <p class="programme__weekday">{headerWeekday}</p>
        <h2 class="programme__date">
          <span class="programme__day">{dp.day}.</span>
          <span class="programme__month">{MONTHS_LONG[dp.month]}</span>
          <span class="programme__year">{dp.year}</span>
        </h2>
        {performances.length > 1 ? (
          <div class="programme__search">
            <input
              type="search"
              id="search-input"
              class="programme__search-input"
              placeholder="Stück, Bühne, Stichwort durchsuchen…"
              aria-label="Vorstellungen filtern"
              autocomplete="off"
            />
            <p class="programme__search-status" id="search-status" aria-live="polite" />
          </div>
        ) : null}
      </header>
      {visible.length === 0 ? (
        <div class="empty">
          <p class="empty__mark">∅</p>
          <p>
            {hidden > 0 ? (
              <>
                Heute keine kommenden Vorstellungen mehr. <TomorrowLink />
              </>
            ) : (
              "An diesem Tag keine Vorstellungen."
            )}
          </p>
        </div>
      ) : (
        <>
          <ol class="performances" id="performances">
            {visible.map((p, i) => (
              <Performance key={p.id} p={p} opts={{ index: i }} />
            ))}
          </ol>
          {hidden > 0 ? (
            <p class="programme__past-note">
              {hidden} Vorstellung{hidden === 1 ? "" : "en"} heute bereits gestartet — verborgen.
            </p>
          ) : null}
        </>
      )}
      <SiblingStrap />
    </>
  );
}

// ─── Inline client JS ──────────────────────────────────────────────────

const WEBMCP_TOOLS: WebMcpToolDef[] = [
  {
    name: "get_performances",
    description:
      "Get theater performances on a specific date in Frankfurt. Returns titles, times, theaters, prices, and ticket links.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date (YYYY-MM-DD). Defaults to today." },
      },
    },
    executeBody: `var params = new URLSearchParams();
      if (input.date) params.set('date', input.date);
      return fetch('/api/day?' + params).then(function(r) { return r.json(); });`,
  },
  {
    name: "get_performances_range",
    description:
      "Get all theater performances within a date range, optionally filtered by theater slug. Max 60-day span.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "ISO start date (YYYY-MM-DD). Defaults to today." },
        to: { type: "string", description: "ISO end date (YYYY-MM-DD). Defaults to +14 days." },
        theater: { type: "string", description: "Optional theater slug to filter by." },
      },
    },
    executeBody: `var params = new URLSearchParams();
      if (input.from) params.set('from', input.from);
      if (input.to) params.set('to', input.to);
      if (input.theater) params.set('theater', input.theater);
      return fetch('/api/performances?' + params).then(function(r) { return r.json(); });`,
  },
  {
    name: "get_theaters",
    description: "Get all Frankfurt theaters with names, slugs, addresses, websites, and ticketing providers.",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return fetch('/api/theaters').then(function(r) { return r.json(); });`,
  },
  {
    name: "get_theater",
    description: "Get a single theater's details and its upcoming performances (next 60 days) by slug.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Theater slug, e.g. 'schauspiel-frankfurt'." },
      },
      required: ["slug"],
    },
    executeBody: `if (!input.slug) return Promise.reject(new Error('slug required'));
      return fetch('/api/theater/' + encodeURIComponent(input.slug)).then(function(r) { return r.json(); });`,
  },
  {
    name: "search_performances",
    description:
      "Search visible performances on the page by keyword (title, theater, byline). Filters the list and returns matches.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search term" } },
      required: ["query"],
    },
    executeBody: `var searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.value = input.query;
        searchInput.dispatchEvent(new Event('input'));
      }
      var rows = document.querySelectorAll('#performances .perf:not([hidden])');
      var results = [];
      rows.forEach(function(el) {
        var title = el.querySelector('.perf__title');
        var venue = el.querySelector('.perf__venue');
        var time = el.querySelector('.perf__time .t1');
        results.push({
          title: title ? title.textContent.trim() : '',
          venue: venue ? venue.textContent.trim() : '',
          time: time ? time.textContent.trim() : ''
        });
      });
      return Promise.resolve({ query: input.query, count: results.length, results: results.slice(0, 20) });`,
  },
];

const WEBMCP_SCRIPT = buildWebMcpScript(WEBMCP_TOOLS);

function buildClientScript(): string {
  const theaterLoc: Record<string, { name: string; lat: number; lng: number }> = {};
  for (const t of THEATERS) {
    theaterLoc[t.slug] = { name: t.name, lat: t.lat, lng: t.lon };
  }
  const locJson = JSON.stringify(theaterLoc).replace(/</g, "\\u003c");

  return `
  window.THEATER_LOC = ${locJson};

  ${HTMX_LIFECYCLE_SCRIPT}
  ${POPOVER_POSITIONING_SCRIPT}
  ${TURNSTILE_LAZY_LOAD_SCRIPT}
  ${WEBMCP_SCRIPT}

  // Anfahrt — popover with RMV / Google Maps / Apple Maps deep-links
  (function(){
    function buildNavUrls(slug){
      var t = window.THEATER_LOC[slug];
      if (!t) return null;
      var x = Math.round(t.lng * 1e6);
      var y = Math.round(t.lat * 1e6);
      var zid = 'A=2@O=' + t.name + '@X=' + x + '@Y=' + y + '@';
      var enc = encodeURIComponent(zid);
      return {
        rmvApp: 'https://www.rmv.de/go/?ZID=' + enc,
        rmvWeb: 'https://www.rmv.de/c/de/fahrplan/verbindungssuche-hinweise/fahrplanauskunft?language=de_DE&context=TP&start=1&ZID=' + enc,
        google: 'https://www.google.com/maps/dir/?api=1&destination=' + t.lat + ',' + t.lng + '&travelmode=transit',
        apple: 'https://maps.apple.com/?daddr=' + t.lat + ',' + t.lng + '&dirflg=r'
      };
    }
    function populatePopover(pop){
      var slug = pop.getAttribute('data-theater');
      var urls = buildNavUrls(slug);
      if (!urls) return;
      pop.querySelectorAll('a[data-kind]').forEach(function(a){
        var kind = a.getAttribute('data-kind');
        if (kind === 'rmv-app') a.href = urls.rmvApp;
        else if (kind === 'rmv-web') a.href = urls.rmvWeb;
        else if (kind === 'google') a.href = urls.google;
        else if (kind === 'apple') a.href = urls.apple;
      });
    }
    function rebindAll(){
      document.querySelectorAll('.nav-popover').forEach(populatePopover);
    }
    rebindAll();
    window.__rebindTransit = rebindAll;
  })();

  function showToast(msg){
    var toast = document.querySelector('.footer__toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('footer__toast--visible');
    setTimeout(function(){ toast.classList.remove('footer__toast--visible'); }, 2400);
  }
  function copyOrShare(payload, successMsg){
    if (navigator.share) { navigator.share(payload).catch(function(){}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload.url || payload.text).then(function(){ showToast(successMsg); })
        .catch(function(){ showToast('Kopieren fehlgeschlagen'); });
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = payload.url || payload.text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast(successMsg); } catch(e){}
    document.body.removeChild(ta);
  }
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.share-btn');
    if (!btn) return;
    var key = btn.getAttribute('data-share-id');
    var date = btn.getAttribute('data-share-date');
    var title = btn.getAttribute('data-share-title') || '';
    var url = location.origin + '/?date=' + encodeURIComponent(date) + '&item=' + encodeURIComponent(key);
    copyOrShare({ title: title, text: title, url: url }, 'Link kopiert');
  });

  // Contact dialog (general feedback + per-perf report)
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
      if (openBtn) { e.preventDefault(); if (window.__loadTurnstile) window.__loadTurnstile(); open(null); return; }
      var closeBtn = e.target.closest('[data-contact-close]');
      if (closeBtn) { e.preventDefault(); close(); return; }
      var reportBtn = e.target.closest('[data-report-type]');
      if (reportBtn) {
        e.preventDefault();
        if (window.__loadTurnstile) window.__loadTurnstile();
        var type = reportBtn.dataset.reportType;
        var cat = type === 'theater' ? 'Bühne' : type === 'performance' ? 'Vorstellung' : 'Allgemein';
        open({ category: cat, regarding: reportBtn.dataset.reportRegarding || '', context: reportBtn.dataset.reportContext || '' });
      }
    });
    dlg.addEventListener('click', function(e){ if (e.target === dlg) close(); });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      submit.disabled = true; submit.textContent = 'Wird gesendet…';
      status.hidden = true;
      var data = new FormData(form); var payload = {};
      data.forEach(function(v, k){ payload[k] = v; });
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(r){
        if (!r.ok) throw new Error('submit failed');
        status.textContent = 'Danke — Hinweis ist angekommen.';
        status.className = 'contact-form__status contact-form__status--ok';
        status.hidden = false; form.reset();
        setTimeout(close, 1800);
      }).catch(function(){
        status.textContent = 'Senden fehlgeschlagen. Bitte schreib direkt an feedback@ins.theater.';
        status.className = 'contact-form__status contact-form__status--err';
        status.hidden = false; submit.disabled = false; submit.textContent = 'Senden';
      });
    });
  })();

  function initSearch(){
    var input = document.getElementById('search-input');
    var list = document.getElementById('performances');
    var status = document.getElementById('search-status');
    if (!input || !list || !window.uFuzzy) return;
    var prevEmpty = document.getElementById('search-empty');
    if (prevEmpty) prevEmpty.remove();
    var items = Array.prototype.slice.call(list.querySelectorAll('.perf'));
    var haystack = items.map(function(li){
      var t = (li.querySelector('.perf__title')||{}).textContent || '';
      var v = (li.querySelector('.perf__venue')||{}).textContent || '';
      var b = (li.querySelector('.perf__byline')||{}).textContent || '';
      return (t + ' ' + v + ' ' + b).replace(/\\s+/g,' ').trim();
    });
    var fuzzy = new uFuzzy({ intraMode: 1, intraIns: 1, interIns: Infinity });
    function ensureEmpty(){
      var node = document.getElementById('search-empty');
      if (!node) {
        node = document.createElement('div');
        node.id = 'search-empty';
        node.className = 'empty';
        node.innerHTML = '<p class="empty__mark">∅</p><p>Keine Vorstellung gefunden. <button type="button" class="empty__reset">Filter zurücksetzen</button></p>';
        list.parentNode.insertBefore(node, list.nextSibling);
        node.querySelector('.empty__reset').addEventListener('click', function(){ input.value = ''; applyFilter(); input.focus(); });
      }
      node.style.display = '';
    }
    function hideEmpty(){
      var node = document.getElementById('search-empty');
      if (node) node.style.display = 'none';
    }
    function applyFilter(){
      var q = input.value.trim();
      if (!q) { items.forEach(function(li){ li.style.display = ''; }); if (status) status.textContent = ''; hideEmpty(); return; }
      var idxs = fuzzy.filter(haystack, q);
      var keep = new Set(idxs || []);
      var visible = 0;
      items.forEach(function(li, i){
        var match = keep.has(i);
        li.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      if (status) status.textContent = visible + ' von ' + items.length + ' Treffern';
      if (visible === 0) ensureEmpty(); else hideEmpty();
    }
    input.addEventListener('input', applyFilter);
    input.addEventListener('keydown', function(e){
      if (e.key === 'Escape') { input.value = ''; applyFilter(); input.blur(); }
    });
  }

  function highlightShareTarget(){
    var key = new URL(location.href).searchParams.get('item') || (location.hash && location.hash.replace(/^#/, ''));
    document.querySelectorAll('.share-target, .share-highlight').forEach(function(el){
      el.classList.remove('share-target'); el.classList.remove('share-highlight');
    });
    if (!key) return;
    var el = document.querySelector('[data-share-key="' + key.replace(/"/g, '\\\\"') + '"]') || document.getElementById(key);
    if (!el) return;
    requestAnimationFrame(function(){
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('share-target');
      void el.offsetWidth;
      el.classList.add('share-highlight');
    });
  }
  setTimeout(highlightShareTarget, 350);
  window.addEventListener('hashchange', highlightShareTarget);

  function centerActiveTile(smooth){
    var active = document.querySelector('#datestrip .datetile--active');
    if (!active) return;
    if (typeof active.scrollIntoView === 'function') {
      try { active.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest', inline: 'center' }); return; } catch(e){}
    }
    var strip = active.parentElement; if (!strip) return;
    var offset = active.offsetLeft - (strip.parentElement.clientWidth / 2) + (active.offsetWidth / 2);
    strip.parentElement.scrollLeft = Math.max(0, offset);
  }
  function syncDateStrip(smooth){
    var date = new URL(location.href).searchParams.get('date');
    if (!date) return;
    var strip = document.getElementById('datestrip'); if (!strip) return;
    strip.querySelectorAll('.datetile').forEach(function(t){
      var match = (t.getAttribute('href') || '').indexOf('date=' + date) > -1;
      t.classList.toggle('datetile--active', match);
      t.setAttribute('aria-current', match ? 'true' : 'false');
    });
    centerActiveTile(smooth);
  }
  document.addEventListener('click', function(e){
    var tile = e.target.closest('.datetile'); if (!tile) return;
    var strip = tile.parentElement; if (!strip) return;
    strip.querySelectorAll('.datetile--active').forEach(function(el){
      el.classList.remove('datetile--active');
      el.setAttribute('aria-current', 'false');
    });
    tile.classList.add('datetile--active'); tile.setAttribute('aria-current', 'true');
    centerActiveTile(true);
  });
  window.addEventListener('popstate', function(){ syncDateStrip(true); });

  document.body.addEventListener('htmx:afterSwap', function(e){
    if (!e.detail || !e.detail.target) return;
    if (e.detail.target.id !== 'programme-content') return;
    initSearch(); syncDateStrip(true);
    setTimeout(highlightShareTarget, 80);
    if (typeof window.__rebindTransit === 'function') window.__rebindTransit();
  });
  function onReady(){ initSearch(); syncDateStrip(false); }
  if (document.readyState !== 'loading') onReady();
  else document.addEventListener('DOMContentLoaded', onReady);

  (function(){
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    btn.addEventListener('click', function(){
      var html = document.documentElement;
      var isDark = html.classList.contains('dark');
      html.classList.toggle('dark', !isDark);
      html.classList.toggle('light', isDark);
      try { localStorage.setItem('theme', isDark ? 'light' : 'dark'); } catch(e){}
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
    var theaterBoxes = form.querySelectorAll('input[name="filter-theater"]');
    function checked(){ var out = []; boxes.forEach(function(b){ if (b.checked) out.push(b.value); }); return out; }
    function setChecked(values){ boxes.forEach(function(b){ b.checked = values.indexOf(b.value) !== -1; }); }
    function checkedTheaters(){ var out = []; theaterBoxes.forEach(function(b){ if (b.checked) out.push(b.value); }); return out; }
    function setTheaters(values){ theaterBoxes.forEach(function(b){ b.checked = values.indexOf(b.value) !== -1; }); }
    function setStatus(msg, kind){
      if (!msg) { status.hidden = true; status.textContent = ''; status.className = 'contact-form__status'; return; }
      status.hidden = false; status.textContent = msg;
      status.className = 'contact-form__status' + (kind ? ' contact-form__status--' + kind : '');
    }
    function urlBase64ToUint8Array(s){
      var pad = '='.repeat((4 - s.length % 4) % 4);
      var b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    function isIosNonStandalone(){
      var ua = navigator.userAgent || '';
      var isIos = /iP(hone|od|ad)/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
      if (!isIos) return false;
      var standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
      return !standalone;
    }
    function supportsPush(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
    async function fetchVapidKey(){
      var r = await fetch('/api/push/key'); if (!r.ok) throw new Error('vapid key unavailable');
      return (await r.json()).publicKey;
    }
    async function currentSubscription(){
      var reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    }
    async function open(){
      setStatus(''); submit.disabled = false; submit.textContent = 'Abonnieren';
      unsubBtn.hidden = true; setChecked([]); setTheaters([]);
      iosHint.hidden = true; unsupported.hidden = true;
      if (!supportsPush()) {
        if (isIosNonStandalone()) iosHint.hidden = false; else unsupported.hidden = false;
        submit.disabled = true;
      } else if (isIosNonStandalone()) {
        iosHint.hidden = false; submit.disabled = true;
      } else {
        try {
          var existing = await currentSubscription();
          if (existing) {
            var me = await fetch('/api/push/me?endpoint=' + encodeURIComponent(existing.endpoint));
            if (me.ok) {
              var data = await me.json();
              if (data.schedules && data.schedules.length) {
                setChecked(data.schedules);
                if (data.filters && Array.isArray(data.filters.theaters)) setTheaters(data.filters.theaters);
                submit.textContent = 'Speichern'; unsubBtn.hidden = false;
              }
            }
          }
        } catch (_) {}
      }
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }
    function close(){
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    }
    async function subscribeOrUpdate(){
      var sched = checked();
      submit.disabled = true;
      submit.textContent = sched.length === 0 ? 'Wird abbestellt…' : 'Wird gespeichert…';
      setStatus('');
      try {
        var existing = await currentSubscription();
        if (sched.length === 0) {
          if (existing) {
            await fetch('/api/push/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: existing.endpoint })
            });
            await existing.unsubscribe().catch(function(){});
          }
          setStatus('Abbestellt.', 'ok');
          setTimeout(close, 1200);
          return;
        }
        if (!existing) {
          if (Notification.permission === 'denied') throw new Error('permission-denied');
          if (Notification.permission !== 'granted') {
            var p = await Notification.requestPermission();
            if (p !== 'granted') throw new Error('permission-denied');
          }
          var key = await fetchVapidKey();
          var reg = await navigator.serviceWorker.ready;
          existing = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key)
          });
        }
        var json = existing.toJSON();
        var theaters = checkedTheaters();
        var filters = theaters.length > 0 ? { theaters: theaters } : null;
        var res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, schedules: sched, filters: filters })
        });
        if (!res.ok) throw new Error('save-failed');
        setStatus('Gespeichert. Bis bald!', 'ok');
        submit.textContent = 'Speichern'; unsubBtn.hidden = false;
        setTimeout(close, 1200);
      } catch (err) {
        var msg = 'Speichern fehlgeschlagen.';
        if (err && err.message === 'permission-denied') {
          msg = 'Benachrichtigungen wurden blockiert. Erlaube sie in den Browser-Einstellungen.';
        }
        setStatus(msg, 'err');
        submit.disabled = false;
        submit.textContent = sched.length === 0 ? 'Abbestellen' : (existing ? 'Speichern' : 'Abonnieren');
      }
    }
    async function unsubscribeAll(){
      setChecked([]);
      await subscribeOrUpdate();
    }
    document.addEventListener('click', function(e){
      var openBtn = e.target.closest('[data-digest-open]');
      if (openBtn) { e.preventDefault(); open(); return; }
      var closeBtn = e.target.closest('[data-digest-close]');
      if (closeBtn) { e.preventDefault(); close(); return; }
    });
    dlg.addEventListener('click', function(e){ if (e.target === dlg) close(); });
    form.addEventListener('submit', function(e){ e.preventDefault(); subscribeOrUpdate(); });
    unsubBtn.addEventListener('click', function(e){ e.preventDefault(); unsubscribeAll(); });
    form.addEventListener('change', function(){
      if (submit.disabled) return;
      var sched = checked();
      if (sched.length === 0 && !unsubBtn.hidden) submit.textContent = 'Abbestellen';
      else submit.textContent = unsubBtn.hidden ? 'Abonnieren' : 'Speichern';
    });
  })();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('/sw.js').catch(function(){});
    });
  }
`;
}

export function ClientScript() {
  return <script dangerouslySetInnerHTML={{ __html: buildClientScript() }} />;
}

// ─── Page composition ─────────────────────────────────────────────────

export function renderPage(props: PageProps): HtmlEscapedString {
  const { date, today, performances, dateStrip, turnstileSiteKey } = props;
  const niceDate = fullGerman(date);
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="de">
        <head>
          <Head
            title={`Frankfurt Theater · ${niceDate}`}
            description={`Vorstellungen und Karten der Frankfurter Bühnen am ${niceDate} — kuratiert nach Tag.`}
            canonical={`${APP_URL}/`}
            jsonLd={buildHomeJsonLd(date, performances)}
            turnstileSiteKey={turnstileSiteKey}
          />
        </head>
        <body>
          <Grain />
          <Masthead />
          <DateStrip strip={dateStrip} active={date} today={today} />
          <DigestCue />
          <AskAi />
          <main class="programme" id="programme">
            <div id="programme-content">
              <ProgrammePartial date={date} performances={performances} />
            </div>
          </main>
          <Faq />
          <Footer turnstileSiteKey={turnstileSiteKey} />
          <ClientScript />
        </body>
      </html>
    </>
  ) as unknown as HtmlEscapedString;
}

export function renderProgrammePartial(date: string, performances: DayPerformance[]): HtmlEscapedString {
  return (<ProgrammePartial date={date} performances={performances} />) as unknown as HtmlEscapedString;
}

export function renderHead(opts: HeadOptions): HtmlEscapedString {
  return (<Head {...opts} />) as unknown as HtmlEscapedString;
}

export function renderFooter(opts: { turnstileSiteKey?: string } = {}): HtmlEscapedString {
  return (<Footer {...opts} />) as unknown as HtmlEscapedString;
}

export function renderPerformance(p: DayPerformance, opts: PerformanceRowOptions): HtmlEscapedString {
  return (<Performance p={p} opts={opts} />) as unknown as HtmlEscapedString;
}

export function renderGrain(): HtmlEscapedString {
  return (<Grain />) as unknown as HtmlEscapedString;
}

export function renderMasthead(args: { sublabel?: string } = {}): HtmlEscapedString {
  return (<Masthead {...args} />) as unknown as HtmlEscapedString;
}

export function renderDateStrip(
  strip: DateWithCount[],
  active: string,
  today: string,
  base: string = "/",
): HtmlEscapedString {
  return (<DateStrip strip={strip} active={active} today={today} base={base} />) as unknown as HtmlEscapedString;
}

export function renderAskAi(): HtmlEscapedString {
  return (<AskAi />) as unknown as HtmlEscapedString;
}

export function renderFaq(): HtmlEscapedString {
  return (<Faq />) as unknown as HtmlEscapedString;
}

export function renderDigestCue(): HtmlEscapedString {
  return (<DigestCue />) as unknown as HtmlEscapedString;
}

export function renderClientScript(): HtmlEscapedString {
  return (<ClientScript />) as unknown as HtmlEscapedString;
}

// ─── JSON-LD builders (unchanged) ─────────────────────────────────────

export function buildHomeJsonLd(date: string, performances: DayPerformance[]): Record<string, unknown>[] {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Spielplan Frankfurt — ${date}`,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: performances.length,
    itemListElement: performances.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: buildPerformanceJsonLd(p),
    })),
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${APP_URL}/#website`,
    name: "Frankfurt Theater",
    url: APP_URL,
    inLanguage: "de",
    publisher: { "@type": "Organization", name: "Frankfurt Theater", url: APP_URL },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${APP_URL}/?date={date}` },
      "query-input": "required name=date",
    },
  };
  return [website, itemList, buildFaqPageSchema(FAQ_ITEMS)];
}

export function buildPerformanceJsonLd(p: DayPerformance): Record<string, unknown> {
  const startDate = p.time ? `${p.date}T${p.time}:00+02:00` : p.date;
  const endDate = p.end_time ? `${p.end_date ?? p.date}T${p.end_time}:00+02:00` : undefined;
  const offer =
    p.status === "cancelled"
      ? undefined
      : {
          "@type": "Offer",
          url: p.ticket_url ?? p.show.detail_url ?? undefined,
          price: p.price_min ?? undefined,
          priceCurrency: "EUR",
          availability: p.status === "sold_out" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        };
  return {
    "@type": "TheaterEvent",
    name: p.show.title,
    description: p.show.subtitle ?? p.show.description ?? undefined,
    startDate,
    endDate,
    eventStatus: p.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "PerformingArtsTheater",
      name: p.theater.name,
      url: p.theater.website_url ?? undefined,
    },
    image: absImageUrl(p.show.image_url),
    url: `${APP_URL}/api/performance/${p.id}`,
    offers: offer,
  };
}
