import {
  berlinHourMinute,
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  buildUtm,
  buildYahooCalendarUrl,
  type CalendarEvent,
  escapeHtml as coreEscapeHtml,
  GERMAN_MONTHS_LONG as MONTHS_LONG,
  THEME_FOUC_SCRIPT,
  todayIso,
  GERMAN_WEEKDAYS as WEEKDAYS_LONG,
  GERMAN_WEEKDAYS_SHORT as WEEKDAYS_SHORT,
} from "@museumsufer/core";
import type { DateWithCount, DayPerformance } from "./db";
import { INLINE_CSS } from "./styles-inline";
import { THEATERS } from "./theater-config";

export type { DayPerformance } from "./db";

interface PageProps {
  date: string;
  today: string;
  performances: DayPerformance[];
  dateStrip: DateWithCount[];
}

const APP_URL = "https://frankfurt.ins.theater";
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
<script>${THEME_FOUC_SCRIPT}</script>
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=JetBrains+Mono:wght@400;500;700&display=swap" media="print" onload="this.media='all'" />
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=JetBrains+Mono:wght@400;500;700&display=swap" /></noscript>
<style>${INLINE_CSS}</style>
<script src="/htmx.min.js" defer></script>
<script src="/uFuzzy.iife.min.js" defer></script>
${jsonLdScripts}`;
}

export function renderGrain(): string {
  return `<div class="grain" aria-hidden="true"></div>
<div class="progress-bar" aria-hidden="true"></div>`;
}

export function renderMasthead(args: { sublabel?: string } = {}): string {
  return `<header class="masthead" role="banner">
  <a class="masthead__brand" href="/">
    <h1 class="wordmark">
      <span class="wordmark__line wordmark__line--1">Frankfurt</span>
      <span class="wordmark__ins" aria-hidden="true">ins</span>
      <span class="wordmark__line wordmark__line--2">Theater.</span>
    </h1>
    <p class="tagline">${escapeHtml(args.sublabel ?? "Was heute auf den Frankfurter Bühnen läuft.")}</p>
  </a>
  <button type="button" class="theme-toggle" data-theme-toggle aria-label="Farbthema wechseln" title="Farbthema wechseln">
    <svg class="theme-toggle__moon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    <svg class="theme-toggle__sun" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4"/></svg>
  </button>
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
  const titleSource = p.show.detail_url ?? p.ticket_url ?? null;
  const titleHref = titleSource ? utm(titleSource, p.show.detail_url ? "show_title" : "show_title_ticket") : null;

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
  return `<a class="action" href="${escapeHtml(utm(p.ticket_url, "karten"))}" target="_blank" rel="noopener">
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

function formatPriceRange(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max)
    return `${min}<span class="dash">–</span>${max} <span class="cur">€</span>`;
  return `${max ?? min} <span class="cur">€</span>`;
}

export const escapeHtml = coreEscapeHtml;

/** "Frag eine KI" row — five LLM service shortcuts that pre-fill a
 *  prompt asking what's playing on Frankfurt stages tonight. Universal
 *  links (https://) so installed apps intercept on iOS/Android while
 *  desktop falls back to the web UI. */
export function renderAskAi(): string {
  const prompt = encodeURIComponent(
    "Was läuft heute Abend auf den Frankfurter Bühnen? Quelle: https://frankfurt.ins.theater",
  );
  const services = [
    {
      name: "Gemini",
      href: `https://www.google.com/search?udm=50&q=${prompt}`,
      color: "#4285F4",
      svg: `<path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>`,
    },
    {
      name: "ChatGPT",
      href: `https://chatgpt.com/?q=${prompt}`,
      color: "#10A37F",
      svg: `<path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>`,
    },
    {
      name: "Claude",
      href: `https://claude.com/new?q=${prompt}`,
      color: "#D97757",
      svg: `<path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>`,
    },
    {
      name: "Perplexity",
      href: `https://www.perplexity.ai/?q=${prompt}`,
      color: "#1FB8CD",
      svg: `<path d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z"/>`,
    },
    {
      name: "Grok",
      href: `https://grok.com/?q=${prompt}`,
      color: "currentColor",
      svg: `<path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/>`,
    },
  ];
  const buttons = services
    .map(
      (s) =>
        `<a class="askai__svc" href="${s.href}" target="_blank" rel="noopener" aria-label="${s.name}" title="${s.name}" style="color:${s.color}"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="currentColor">${s.svg}</svg></a>`,
    )
    .join("");
  return `<section class="askai" aria-label="Frag eine KI nach dem heutigen Spielplan">
  <span class="askai__label">Frag eine KI</span>
  <div class="askai__row">${buttons}</div>
</section>`;
}

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
${renderAskAi()}

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

  // Top-of-viewport progress bar driven by htmx lifecycle. Shows during
  // the fetch (which is the slow part — the swap+settle is already
  // dimmed via .htmx-swapping/.htmx-settling on #programme-content).
  document.body.addEventListener('htmx:beforeRequest', function(){
    document.body.dataset.loading = 'true';
  });
  document.body.addEventListener('htmx:afterRequest', function(){
    delete document.body.dataset.loading;
  });

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
