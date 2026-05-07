import {
  berlinHourMinute,
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  buildYahooCalendarUrl,
  type CalendarEvent,
  escapeHtml as coreEscapeHtml,
  GERMAN_MONTHS_LONG as MONTHS_LONG,
  todayIso,
  GERMAN_WEEKDAYS as WEEKDAYS_LONG,
  GERMAN_WEEKDAYS_SHORT as WEEKDAYS_SHORT,
} from "@museumsufer/core";
import type { DateWithCount } from "./db";
import { THEATERS } from "./theater-config";
import type { Performance, Show, Theater } from "./types";

export type DayPerformance = Performance & {
  show: Show;
  theater: Pick<Theater, "id" | "name" | "slug" | "website_url">;
};

interface PageProps {
  date: string;
  today: string;
  performances: DayPerformance[];
  dateStrip: DateWithCount[];
}

const APP_URL = "https://frankfurt.ins.theater";
const REPO_URL = "https://github.com/boredland/museumsufer";

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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export interface HeadOptions {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Extra <link> tags rendered after the standard head links (e.g. per-theater iCal). */
  extraLinks?: Array<{ rel: string; href: string; type?: string; title?: string }>;
}

export function renderHead(opts: HeadOptions): string {
  const ogImage = opts.ogImage ?? `${APP_URL}/og-image.png`;
  const jsonLdScripts = opts.jsonLd
    ? (Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd])
        .map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`)
        .join("\n")
    : "";
  return `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script>(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d))document.documentElement.classList.add('dark');else if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();</script>
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}" />
<link rel="canonical" href="${escapeHtml(opts.canonical)}" />
<meta property="og:title" content="${escapeHtml(opts.title)}" />
<meta property="og:description" content="${escapeHtml(opts.description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(opts.canonical)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta property="og:locale" content="de_DE" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#F4EFE2" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<link rel="manifest" href="/manifest.json" />
<link rel="alternate" type="application/json" title="Frankfurt Theater API" href="/api/day" />
<link rel="alternate" type="text/calendar" title="Spielplan iCal" href="/feed.ics" />
${
  opts.extraLinks
    ?.map(
      (l) =>
        `<link rel="${escapeHtml(l.rel)}" href="${escapeHtml(l.href)}"${l.type ? ` type="${escapeHtml(l.type)}"` : ""}${l.title ? ` title="${escapeHtml(l.title)}"` : ""} />`,
    )
    .join("\n") ?? ""
}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=JetBrains+Mono:wght@400;500;700&display=swap" />
<link rel="stylesheet" href="/styles.css" />
<script src="/htmx.min.js" defer></script>
<script src="/uFuzzy.iife.min.js" defer></script>
${jsonLdScripts}`;
}

export function renderGrain(): string {
  return `<div class="grain" aria-hidden="true"></div>
<button type="button" class="theme-toggle" data-theme-toggle aria-label="Farbthema wechseln" title="Farbthema wechseln">
  <svg class="theme-toggle__moon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  <svg class="theme-toggle__sun" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4"/></svg>
</button>`;
}

export function renderMasthead(args: { sublabel?: string } = {}): string {
  return `<header class="masthead" role="banner">
  <a class="masthead__brand" href="/" aria-label="Frankfurt Theater Startseite">
    <h1 class="wordmark">
      <span class="wordmark__line wordmark__line--1">Frankfurt</span>
      <span class="wordmark__ins" aria-hidden="true">ins</span>
      <span class="wordmark__line wordmark__line--2">Theater.</span>
    </h1>
    <p class="tagline">${escapeHtml(args.sublabel ?? "Was heute auf den Frankfurter Bühnen läuft.")}</p>
  </a>
</header>`;
}

export function renderDateStrip(strip: DateWithCount[], active: string, today: string, base: string = "/"): string {
  if (!strip.length) return "";
  const params = base.includes("?") ? "&" : "?";
  const isHome = base === "/";
  return `<nav class="datestrip" aria-label="Spieltage">
  <div class="datestrip__inner" id="datestrip">
    ${strip
      .map((d) => {
        const p = dateParts(d.date);
        const isActive = d.date === active;
        const isToday = d.date === today;
        const cls = ["datetile", isActive ? "datetile--active" : "", isToday ? "datetile--today" : ""]
          .filter(Boolean)
          .join(" ");
        const htmxAttrs = isHome
          ? ` hx-get="/partial/programme?date=${d.date}" hx-target="#programme-content" hx-swap="innerHTML swap:80ms settle:20ms" hx-push-url="${base}${params}date=${d.date}"`
          : "";
        return `<a class="${cls}" href="${base}${params}date=${d.date}" aria-current="${isActive ? "true" : "false"}"${htmxAttrs}>
        <span class="datetile__weekday">${WEEKDAYS_SHORT[p.weekday]}</span>
        <span class="datetile__day">${p.day}</span>
        <span class="datetile__month">${MONTHS_LONG[p.month].slice(0, 3)}</span>
        <span class="datetile__count">${d.n}</span>
      </a>`;
      })
      .join("")}
  </div>
</nav>`;
}

export interface PerformanceRowOptions {
  index: number;
  showDate?: boolean;
  /** When true, omit the theater name (used on theater detail pages) */
  hideTheater?: boolean;
}

export function renderPerformance(p: DayPerformance, opts: PerformanceRowOptions): string {
  const { index } = opts;
  const time = p.time ?? "—";
  const endTime = p.end_time ? ` – ${p.end_time}` : "";
  // Some scrapers (Reservix listings) store the theater name itself as the
  // venue room, which would render as "Die Käs · Die Käs". Drop the room
  // when it's effectively the same string as the theater name.
  const isSameVenue = !!p.venue_room && p.venue_room.trim().toLowerCase() === p.theater.name.trim().toLowerCase();
  const room = p.venue_room && !isSameVenue ? escapeHtml(p.venue_room) : null;
  const isStruck = p.status === "sold_out" || p.status === "cancelled";
  const subtitle = p.show.subtitle ? escapeHtml(p.show.subtitle).replace(/\s*<br\s*\/?>\s*/gi, " · ") : null;
  const showPrice = p.status !== "sold_out" && p.status !== "cancelled";
  const price = showPrice ? formatPriceRange(p.price_min, p.price_max) : null;
  const titleHref = p.show.detail_url ?? p.ticket_url ?? null;

  // Sold-out and cancelled stamps live in the terminal (Karten) slot of the
  // rail so the layout matches available rows. Other statuses (e.g. few_left
  // → "Restkarten") render inline alongside the price.
  const isTerminalStatus = p.status === "sold_out" || p.status === "cancelled";
  const inlineStamp = isTerminalStatus ? "" : renderStatusStamp(p.status);
  const dateLine = opts.showDate ? `<p class="perf__when-date">${escapeHtml(fullGerman(p.date))}</p>` : "";

  const venueLine = opts.hideTheater
    ? room
      ? `<p class="perf__venue"><span>${room}</span></p>`
      : ""
    : `<p class="perf__venue">
        <a href="/theater/${p.theater.slug}">${escapeHtml(p.theater.name)}</a>
        ${room ? `<span class="perf__sep">·</span><span>${room}</span>` : ""}
      </p>`;

  return `<li class="perf perf--${p.status}" id="perf-${p.id}" style="--i:${index}" data-perf-id="${p.id}" data-share-key="perf-${p.id}" data-theater="${p.theater.slug}">
    <div class="perf__when">
      ${dateLine}
      <span class="perf__index">${pad2(index + 1)}</span>
      <span class="perf__time"><span class="t1">${time}</span><span class="t2">${endTime}</span></span>
    </div>
    <div class="perf__body">
      <h3 class="perf__title ${isStruck ? "perf__title--struck" : ""}">
        ${titleHref ? `<a href="${escapeHtml(titleHref)}" target="_blank" rel="noopener">${escapeHtml(p.show.title)}</a>` : escapeHtml(p.show.title)}
      </h3>
      ${venueLine}
      ${subtitle ? `<p class="perf__byline">${subtitle}</p>` : ""}
    </div>
    <div class="perf__rail">
      ${price ? `<p class="perf__price">${price}</p>` : ""}
      ${inlineStamp}
      ${renderTransit(p)}
      ${renderCalendarPopover(p)}
      ${renderShareButton(p)}
      ${renderReportButton(p)}
      ${renderTerminus(p)}
    </div>
  </li>`;
}

function renderStatusStamp(status: string): string {
  switch (status) {
    case "sold_out":
      return `<span class="stamp stamp--soldout" aria-label="Ausverkauft">Ausverkauft</span>`;
    case "cancelled":
      return `<span class="stamp stamp--cancelled" aria-label="Abgesagt">Entfällt</span>`;
    case "few_left":
      return `<span class="stamp stamp--few" aria-label="Wenige Plätze">Restkarten</span>`;
    default:
      return "";
  }
}

const ICON_CAL = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6h11M5.5 2v3M10.5 2v3M5 9h2M9 9h2M5 11h2" stroke-linecap="round"/></svg>`;
const ICON_GCAL = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M19.5 4.5h-3V3a1 1 0 1 0-2 0v1.5h-5V3a1 1 0 1 0-2 0v1.5h-3A1.5 1.5 0 0 0 3 6v13.5A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5zM19 19H5V10h14v9zM5 8.5V6.5h14v2H5z"/></svg>`;
const ICON_OUTLOOK = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="13" height="12" rx="1.5"/><path d="M9.5 9.5a2.5 3 0 1 1 0 5 2.5 3 0 1 1 0-5z"/><path d="M16 10l4-1.5v7L16 14" stroke-linejoin="round"/></svg>`;
const ICON_YAHOO = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M3 5h4l3 5 3-5h4l-5 8v6h-4v-6L3 5z"/></svg>`;
const ICON_DOWNLOAD = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M4.5 7.5L8 11l3.5-3.5"/><path d="M3 13h10"/></svg>`;

function renderCalendarPopover(p: DayPerformance): string {
  // Calendar links offered for every confirmed performance, including sold-out
  // ones (waitlist/returns). Cancelled rows drop it entirely.
  if (p.status === "cancelled") return "";
  const popId = `cal-${p.id}`;
  const ev: CalendarEvent = {
    date: p.date,
    time: p.time,
    end_time: p.end_time,
    end_date: p.end_date,
    title: p.show.title,
    location: [p.theater.name, p.venue_room && p.venue_room !== p.theater.name ? p.venue_room : null]
      .filter(Boolean)
      .join(", "),
    description: p.show.subtitle ?? null,
    detail_url: p.show.detail_url ?? p.ticket_url ?? null,
  };
  const google = escapeHtml(buildGoogleCalendarUrl(ev));
  const outlook = escapeHtml(buildOutlookCalendarUrl(ev));
  const yahoo = escapeHtml(buildYahooCalendarUrl(ev));
  return `<span class="nav-wrap">
    <button type="button" class="ics-btn" data-popover-target="${popId}" aria-label="Zum Kalender hinzufügen" title="Zum Kalender hinzufügen" popovertarget="${popId}" aria-haspopup="menu">${ICON_CAL}</button>
    <div id="${popId}" popover="auto" role="menu" class="nav-popover">
      <a role="menuitem" class="nav-popover__link" href="${google}" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">${ICON_GCAL}</span> Google Calendar
      </a>
      <a role="menuitem" class="nav-popover__link" href="${outlook}" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">${ICON_OUTLOOK}</span> Outlook
      </a>
      <a role="menuitem" class="nav-popover__link" href="${yahoo}" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">${ICON_YAHOO}</span> Yahoo
      </a>
      <a role="menuitem" class="nav-popover__link" href="/performance/${p.id}/feed.ics" download>
        <span class="nav-popover__icon" aria-hidden="true">${ICON_DOWNLOAD}</span> .ics (Apple, Proton, …)
      </a>
    </div>
  </span>`;
}

function renderTerminus(p: DayPerformance): string {
  // The rightmost rail slot. Sold-out/cancelled rows show their stamp here so
  // the visual rhythm of the row stays consistent with the Karten button on
  // available rows.
  if (p.status === "sold_out") {
    return `<span class="stamp stamp--soldout stamp--terminus" aria-label="Ausverkauft">Ausverkauft</span>`;
  }
  if (p.status === "cancelled") {
    return `<span class="stamp stamp--cancelled stamp--terminus" aria-label="Abgesagt">Entfällt</span>`;
  }
  if (!p.ticket_url) return "";
  return `<a class="action" href="${escapeHtml(p.ticket_url)}" target="_blank" rel="noopener">
    <span>Karten</span><span class="action__arrow" aria-hidden="true">→</span>
  </a>`;
}

// Paper-airplane / navigation cursor — same glyph museumsufer uses for its
// per-museum "navigate" trigger (apps/frankfurt-museums/src/icons.tsx).
const ICON_NAVIGATE = `<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>`;
const ICON_RMV = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M19 16.94V8.5c0-2.79-2.61-3.4-5.5-3.5V3h-3v2C7.6 5.1 5 5.71 5 8.5v8.44c-.56.51-.97 1.18-1 1.97V21h4v-1h8v1h4v-2.09c-.03-.79-.44-1.46-1-1.97zM12 4.5c3.13.09 4 .84 4 1.5H8c0-.66.87-1.41 4-1.5zM7 8h10v5H7V8zm1.5 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>`;
const ICON_GOOGLE = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.5"/></svg>`;
const ICON_APPLE = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.65-2.2.46-3.06-.4C3.79 16.17 4.36 9.43 8.9 9.18c1.25.07 2.12.73 2.86.78.97-.2 1.9-.76 2.93-.69 1.24.1 2.17.58 2.79 1.48-2.56 1.53-1.95 4.89.58 5.83-.45 1.19-.99 2.38-1.95 3.72h-.06zM12.03 9.12C11.9 7.05 13.6 5.36 15.56 5.2c.29 2.38-2.16 4.16-3.53 3.92z"/></svg>`;
const ICON_REPORT = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v4M8 11h.01" stroke-linecap="round"/></svg>`;

function renderTransit(p: DayPerformance): string {
  const popId = `nav-${p.id}`;
  return `<span class="nav-wrap">
    <button type="button" class="transit-btn" data-popover-target="${popId}" aria-label="Anfahrt zu ${escapeHtml(p.theater.name)}" title="Anfahrt zu ${escapeHtml(p.theater.name)}" popovertarget="${popId}" aria-haspopup="menu">${ICON_NAVIGATE}</button>
    <div id="${popId}" popover="auto" role="menu" class="nav-popover" data-theater="${p.theater.slug}">
      <a role="menuitem" class="nav-popover__link nav-popover__link--rmv-app" data-kind="rmv-app" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">${ICON_RMV}</span> RMV
      </a>
      <a role="menuitem" class="nav-popover__link nav-popover__link--rmv-web" data-kind="rmv-web" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">${ICON_RMV}</span> RMV
      </a>
      <a role="menuitem" class="nav-popover__link" data-kind="google" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">${ICON_GOOGLE}</span> Google Maps
      </a>
      <a role="menuitem" class="nav-popover__link" data-kind="apple" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">${ICON_APPLE}</span> Apple Maps
      </a>
    </div>
  </span>`;
}

const ICON_LINK = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66L12 6.34"/><path d="M13.5 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66L12 17.66"/></svg>`;

function renderShareButton(p: DayPerformance): string {
  return `<button type="button" class="share-btn"
    data-share-id="perf-${p.id}"
    data-share-date="${p.date}"
    data-share-title="${escapeHtml(p.show.title)}"
    aria-label="Link zu dieser Vorstellung kopieren"
    title="Link zu dieser Vorstellung kopieren">${ICON_LINK}</button>`;
}

function renderReportButton(p: DayPerformance): string {
  const regarding = `${p.show.title} — ${p.theater.name}, ${p.date}${p.time ? ` ${p.time}` : ""}`;
  const context = `${regarding} (${APP_URL}/api/performance/${p.id})`;
  return `<button type="button" class="report-btn"
    data-report-type="performance"
    data-report-regarding="${escapeHtml(regarding)}"
    data-report-context="${escapeHtml(context)}"
    aria-label="Fehler bei dieser Vorstellung melden"
    title="Fehler bei dieser Vorstellung melden">${ICON_REPORT}</button>`;
}

function formatPriceRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max)
    return `${min}<span class="dash">–</span>${max} <span class="cur">€</span>`;
  return `${max ?? min} <span class="cur">€</span>`;
}

export const escapeHtml = coreEscapeHtml;

export function renderFooter(): string {
  return `<footer class="footer">
  <div>
    <p class="footer__rule"></p>
    <p>Eine Übersicht des Spielplans an Frankfurts Bühnen.</p>
    <p class="footer__actions">
      <button type="button" class="footer__action" data-contact-open aria-label="Problem melden">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v4M8 11h.01" stroke-linecap="round"/></svg>
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
      <a href="${REPO_URL}" target="_blank" rel="noopener" aria-label="Quellcode auf GitHub">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.3-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.2.5.7.5 1.4v2.1c0 .2.1.5.6.4A8 8 0 0 0 8 .2Z"/></svg>
        GitHub
      </a>
    </p>
    <span class="footer__toast" role="status" aria-live="polite"></span>
  </div>
</footer>

<dialog id="contact-dialog" class="contact-dialog">
  <form id="contact-form" class="contact-form" novalidate>
    <header class="contact-form__head">
      <h2 class="contact-form__title">Feedback &amp; Korrekturen</h2>
      <button type="button" class="contact-form__close" data-contact-close aria-label="Schließen">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3l10 10M13 3L3 13" stroke-linecap="round"/></svg>
      </button>
    </header>

    <p class="contact-form__intro">Falsche Zeit, fehlende Vorstellung, Tippfehler? Wir freuen uns über jeden Hinweis.</p>

    <div class="contact-form__regarding" id="contact-regarding" hidden>
      <span class="contact-form__regarding-label">Betrifft</span>
      <span id="contact-regarding-text"></span>
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
      <textarea id="contact-message" name="message" required rows="4" placeholder="Was stimmt nicht?"></textarea>
    </label>

    <input type="hidden" id="contact-context" name="context" />

    <footer class="contact-form__foot">
      <p id="contact-status" class="contact-form__status" hidden aria-live="polite"></p>
      <button type="submit" id="contact-submit" class="contact-form__submit">Senden</button>
    </footer>
  </form>
</dialog>`;
}

export function renderProgrammePartial(date: string, performances: DayPerformance[]): string {
  const dp = dateParts(date);
  const headerWeekday = WEEKDAYS_LONG[dp.weekday];
  // On today's view, hide performances whose start time has passed (with a
  // 30-min grace so late arrivals can still find the row). Un-timed entries
  // and future dates are unaffected.
  const visible = filterPastForToday(date, performances);
  const hidden = performances.length - visible.length;
  return `<header class="programme__header">
    <p class="programme__line"></p>
    <p class="programme__weekday">${headerWeekday}</p>
    <h2 class="programme__date">
      <span class="programme__day">${dp.day}.</span>
      <span class="programme__month">${MONTHS_LONG[dp.month]}</span>
      <span class="programme__year">${dp.year}</span>
    </h2>
    ${
      performances.length > 1
        ? `<div class="programme__search">
            <input type="search" id="search-input" class="programme__search-input"
              placeholder="Stück, Bühne, Stichwort durchsuchen…"
              aria-label="Vorstellungen filtern"
              autocomplete="off" />
            <p class="programme__search-status" id="search-status" aria-live="polite"></p>
          </div>`
        : ""
    }
  </header>

  ${
    visible.length === 0
      ? `<div class="empty">
           <p class="empty__mark">∅</p>
           <p>${hidden > 0 ? "Heute keine kommenden Vorstellungen mehr." : "An diesem Tag keine Vorstellungen."}</p>
         </div>`
      : `<ol class="performances" role="list" id="performances">${visible.map((p, i) => renderPerformance(p, { index: i })).join("")}</ol>
         ${
           hidden > 0
             ? `<p class="programme__past-note">${hidden} Vorstellung${hidden === 1 ? "" : "en"} heute bereits gestartet — verborgen.</p>`
             : ""
         }`
  }`;
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

export function renderPage(props: PageProps): string {
  const { date, today, performances, dateStrip } = props;
  const niceDate = fullGerman(date);

  const head = renderHead({
    title: `Frankfurt Theater · ${niceDate}`,
    description: `Vorstellungen und Karten der Frankfurter Bühnen am ${niceDate} — kuratiert nach Tag.`,
    canonical: `${APP_URL}/`,
    jsonLd: buildHomeJsonLd(date, performances),
  });

  return `<!doctype html>
<html lang="de">
<head>
${head}
</head>
<body>
${renderGrain()}
${renderMasthead()}
${renderDateStrip(dateStrip, date, today)}

<main class="programme" id="programme">
  <div id="programme-content">
    ${renderProgrammePartial(date, performances)}
  </div>
</main>

${renderFooter()}

${renderClientScript()}
</body>
</html>`;
}

export function renderClientScript(): string {
  const theaterLoc: Record<string, { name: string; lat: number; lng: number }> = {};
  for (const t of THEATERS) {
    theaterLoc[t.slug] = { name: t.name, lat: t.lat, lng: t.lon };
  }
  const locJson = JSON.stringify(theaterLoc).replace(/</g, "\\u003c");

  return `<script>
  window.THEATER_LOC = ${locJson};

  // Initial date-strip centering happens in syncDateStrip on load (further down).

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

    function positionPopover(btn){
      var pop = document.getElementById(btn.getAttribute('data-popover-target') || btn.getAttribute('popovertarget'));
      if (!pop) return;
      var r = btn.getBoundingClientRect();
      var w = pop.offsetWidth || 224;
      var h = pop.offsetHeight || 280;
      var maxLeft = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      var spaceBelow = window.innerHeight - r.bottom;
      var top = (spaceBelow >= h + 12) ? (r.bottom + 4) : Math.max(8, r.top - h - 4);
      pop.style.top = top + 'px';
      pop.style.left = maxLeft + 'px';
      pop.style.right = 'auto';
    }

    document.addEventListener('click', function(e){
      // Reposition any popover triggered by a button carrying data-popover-target.
      // Covers both the Anfahrt popover (.transit-btn) and the calendar popover
      // (.ics-btn) — and any future additions for free.
      var btn = e.target.closest('[data-popover-target]');
      if (!btn) return;
      requestAnimationFrame(function(){ positionPopover(btn); });
    });

    rebindAll();
    window.__rebindTransit = rebindAll;
  })();

  // Toast helper (used by both the footer share button and per-row share)
  function showToast(msg){
    var toast = document.querySelector('.footer__toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('footer__toast--visible');
    setTimeout(function(){ toast.classList.remove('footer__toast--visible'); }, 2400);
  }
  function copyOrShare(payload, successMsg){
    if (navigator.share) {
      navigator.share(payload).catch(function(){});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload.url || payload.text).then(function(){
        showToast(successMsg);
      }).catch(function(){
        showToast('Kopieren fehlgeschlagen');
      });
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = payload.url || payload.text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast(successMsg); } catch(e){}
    document.body.removeChild(ta);
  }

  // Per-row share — chain icon copies the deep-link to a single performance
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
      status.hidden = true;
      status.textContent = '';
      status.className = 'contact-form__status';
      submit.disabled = false;
      submit.textContent = 'Senden';
      if (prefill && prefill.category) category.value = prefill.category;
      if (prefill && prefill.regarding) {
        regardingText.textContent = prefill.regarding;
        context.value = prefill.context || prefill.regarding;
        regarding.hidden = false;
      } else {
        regarding.hidden = true;
        regardingText.textContent = '';
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
      var reportBtn = e.target.closest('[data-report-type]');
      if (reportBtn) {
        e.preventDefault();
        var type = reportBtn.dataset.reportType;
        var cat = type === 'theater' ? 'Bühne' : type === 'performance' ? 'Vorstellung' : 'Allgemein';
        open({
          category: cat,
          regarding: reportBtn.dataset.reportRegarding || '',
          context: reportBtn.dataset.reportContext || ''
        });
      }
    });

    dlg.addEventListener('click', function(e){
      // Close on backdrop click
      if (e.target === dlg) close();
    });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Wird gesendet…';
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
        status.textContent = 'Senden fehlgeschlagen. Bitte schreib direkt an feedback@ins.theater.';
        status.className = 'contact-form__status contact-form__status--err';
        status.hidden = false;
        submit.disabled = false;
        submit.textContent = 'Senden';
      });
    });
  })();

  // Client-side fuzzy search across visible performances
  function initSearch(){
    var input = document.getElementById('search-input');
    var list = document.getElementById('performances');
    var status = document.getElementById('search-status');
    if (!input || !list || !window.uFuzzy) return;
    // Tear down any previous empty-state node from a prior swap
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
        node.querySelector('.empty__reset').addEventListener('click', function(){
          input.value = ''; applyFilter(); input.focus();
        });
      }
      node.style.display = '';
    }
    function hideEmpty(){
      var node = document.getElementById('search-empty');
      if (node) node.style.display = 'none';
    }

    function applyFilter(){
      var q = input.value.trim();
      if (!q) {
        items.forEach(function(li){ li.style.display = ''; });
        if (status) status.textContent = '';
        hideEmpty();
        return;
      }
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

  // Deep-link to a single performance: /?date=…&item=perf-<id> or
  // /?date=…#perf-<id> scrolls the row into view, plays a 2.6s entry pulse,
  // and leaves a persistent brick-red left bar so the target row stays
  // visually distinguished until the user navigates to a different item.
  function highlightShareTarget(){
    var key = new URL(location.href).searchParams.get('item')
      || (location.hash && location.hash.replace(/^#/, ''));
    // Clear both classes from any previously highlighted row so only one
    // target is ever decorated and the pulse re-runs on a fresh element.
    document.querySelectorAll('.share-target, .share-highlight').forEach(function(el){
      el.classList.remove('share-target');
      el.classList.remove('share-highlight');
    });
    if (!key) return;
    var el = document.querySelector('[data-share-key="' + key.replace(/"/g, '\\\\"') + '"]')
      || document.getElementById(key);
    if (!el) return;
    requestAnimationFrame(function(){
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('share-target');
      void el.offsetWidth; // force reflow so the entry pulse re-runs cleanly
      el.classList.add('share-highlight');
      // No setTimeout removal — animation-fill-mode: forwards holds the end
      // state, so the persistent .share-target bar stays visible without flicker.
    });
  }
  // Initial load + manual hash change. Slight delay on first paint so the
  // programme content is laid out before we measure scroll position.
  setTimeout(highlightShareTarget, 350);
  window.addEventListener('hashchange', highlightShareTarget);

  // Date strip — keep the active tile in sync with the URL across HTMX
  // swaps and browser back/forward. The strip lives outside the swap target,
  // so we have to move the .datetile--active class manually.
  function centerActiveTile(smooth){
    var active = document.querySelector('#datestrip .datetile--active');
    if (!active) return;
    if (typeof active.scrollIntoView === 'function') {
      try {
        active.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest', inline: 'center' });
        return;
      } catch(e){}
    }
    // Fallback for browsers that don't honour the options object
    var strip = active.parentElement;
    if (!strip) return;
    var offset = active.offsetLeft - (strip.parentElement.clientWidth / 2) + (active.offsetWidth / 2);
    strip.parentElement.scrollLeft = Math.max(0, offset);
  }
  function syncDateStrip(smooth){
    var date = new URL(location.href).searchParams.get('date');
    if (!date) return;
    var strip = document.getElementById('datestrip');
    if (!strip) return;
    strip.querySelectorAll('.datetile').forEach(function(t){
      var match = (t.getAttribute('href') || '').indexOf('date=' + date) > -1;
      t.classList.toggle('datetile--active', match);
      t.setAttribute('aria-current', match ? 'true' : 'false');
    });
    centerActiveTile(smooth);
  }
  // Optimistic update on click — runs before HTMX fires so the tile feels snappy.
  document.addEventListener('click', function(e){
    var tile = e.target.closest('.datetile');
    if (!tile) return;
    var strip = tile.parentElement;
    if (!strip) return;
    strip.querySelectorAll('.datetile--active').forEach(function(el){
      el.classList.remove('datetile--active');
      el.setAttribute('aria-current', 'false');
    });
    tile.classList.add('datetile--active');
    tile.setAttribute('aria-current', 'true');
    centerActiveTile(true);
  });
  window.addEventListener('popstate', function(){ syncDateStrip(true); });

  // Re-bind dynamic UI after HTMX swaps the programme content
  document.body.addEventListener('htmx:afterSwap', function(e){
    if (!e.detail || !e.detail.target) return;
    if (e.detail.target.id !== 'programme-content') return;
    initSearch();
    syncDateStrip(true);
    setTimeout(highlightShareTarget, 80);
    // Re-bind transit popover for newly rendered rows
    if (typeof window.__rebindTransit === 'function') window.__rebindTransit();
  });

  function onReady(){
    initSearch();
    // Center the initial active tile (instant scroll — no animation on first paint)
    syncDateStrip(false);
  }
  if (document.readyState !== 'loading') onReady();
  else document.addEventListener('DOMContentLoaded', onReady);

  // Theme toggle (light/dark, persisted to localStorage)
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

  // Service worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('/sw.js').catch(function(){});
    });
  }
</script>`;
}

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
  return [website, itemList];
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
    image: p.show.image_url ?? undefined,
    url: `${APP_URL}/api/performance/${p.id}`,
    offers: offer,
  };
}
