import {
  buildUtm,
  escapeHtml as coreEscapeHtml,
  GERMAN_MONTHS_LONG as MONTHS_LONG,
  THEME_FOUC_SCRIPT,
  GERMAN_WEEKDAYS as WEEKDAYS_LONG,
  GERMAN_WEEKDAYS_SHORT as WEEKDAYS_SHORT,
} from "@museumsufer/core";
import type { DateWithCount, DayEvent } from "./db";
import { INLINE_CSS } from "./styles-inline";
import type { Genre } from "./types";

export type { DayEvent } from "./db";

export const APP_URL = "https://frankfurt.konzert.haus";
export const REPO_URL = "https://github.com/boredland/museumsufer";

const utm = buildUtm("frankfurt.konzert.haus");

export const GENRE_LABELS: Record<Genre, string> = {
  classical: "Klassik",
  jazz: "Jazz",
  sacred: "Kirchenmusik",
  world: "Weltmusik",
  experimental: "Neue Musik",
  chamber: "Kammermusik",
};

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
}

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

export interface HeadOptions {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
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
<meta name="theme-color" content="#F7F0E7" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<link rel="manifest" href="/manifest.json" />
<link rel="alternate" type="application/json" title="konzert.haus API" href="/api/events" />
<link rel="alternate" type="text/calendar" title="Programm iCal" href="/feed.ics" />
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap" media="print" onload="this.media='all'" />
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap" /></noscript>
<style>${INLINE_CSS}</style>
<script src="/htmx.min.js" defer></script>
${jsonLdScripts}`;
}

export function renderGrain(): string {
  return `<div class="grain" aria-hidden="true"></div>`;
}

export function renderMasthead(): string {
  return `<header class="masthead" role="banner">
  <a class="masthead__brand" href="/">
    <h1 class="wordmark">
      <span class="wordmark__konzert">konzert</span><span class="wordmark__dot">.</span><span class="wordmark__haus">haus</span>
    </h1>
    <p class="tagline">Was heute in Frankfurt und Umgebung erklingt.</p>
  </a>
  <hr class="masthead__rule" />
  <button type="button" class="theme-toggle" data-theme-toggle aria-label="Farbthema wechseln" title="Farbthema wechseln" onclick="document.documentElement.classList.toggle('dark');document.documentElement.classList.remove('light');localStorage.setItem('theme',document.documentElement.classList.contains('dark')?'dark':'light')">
    <svg class="tt-moon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    <svg class="tt-sun" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4"/></svg>
  </button>
</header>`;
}

export function renderGenreFilter(date: string, active?: Genre | null): string {
  const all = `<a class="genre-pill ${!active ? "genre-pill--active" : ""}" href="/tag/${date}"
    hx-get="/partial/programme?date=${date}" hx-target="#programme-content" hx-push-url="/tag/${date}">Alle</a>`;
  const pills = GENRE_ORDER.map((g) => {
    const href = `/tag/${date}?genre=${g}`;
    const cls = `genre-pill ${active === g ? "genre-pill--active" : ""}`;
    return `<a class="${cls}" href="${href}"
      hx-get="/partial/programme?date=${date}&genre=${g}" hx-target="#programme-content" hx-push-url="${href}">
      <span class="genre-pill__dot" style="background:${GENRE_COLOR_VAR[g]}"></span>${GENRE_LABELS[g]}
    </a>`;
  }).join("");
  return `<div class="genre-filter">
    <span class="genre-filter__label">Genre</span>
    ${all}
    ${pills}
  </div>`;
}

export function renderDateStrip(strip: DateWithCount[], active: string, today: string): string {
  if (!strip.length) return "";
  return `<nav class="datestrip" aria-label="Konzerttage">
  <div class="datestrip__inner" id="datestrip">
    ${strip
      .map((d) => {
        const p = dateParts(d.date);
        const isActive = d.date === active;
        const isToday = d.date === today;
        const cls = ["datetile", isActive ? "datetile--active" : "", isToday ? "datetile--today" : ""]
          .filter(Boolean)
          .join(" ");
        return `<a class="${cls}" href="/tag/${d.date}" aria-current="${isActive ? "true" : "false"}"
          hx-get="/partial/programme?date=${d.date}" hx-target="#programme-content" hx-push-url="/tag/${d.date}">
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

export interface EventRowOptions {
  index: number;
  hideVenue?: boolean;
}

export function renderEvent(e: DayEvent, opts: EventRowOptions): string {
  const time = e.time ?? "—";
  const endTime = e.end_time ? `bis ${e.end_time}` : "";
  const subtitle = e.subtitle ? escapeHtml(e.subtitle) : null;
  const performers = e.performers ? escapeHtml(e.performers) : null;
  const venueRoom = e.venue_room ? escapeHtml(e.venue_room) : null;
  const titleSource = e.detail_url ?? e.ticket_url ?? null;
  const titleHref = titleSource ? utm(titleSource, "event_title") : null;
  const price = formatPriceRange(e.price_min, e.price_max);
  const genreLabel = GENRE_LABELS[e.genre];

  const venueLine = opts.hideVenue
    ? venueRoom
      ? `<p class="concert__venue"><span>${venueRoom}</span></p>`
      : ""
    : `<p class="concert__venue">
        <a href="/spielort/${e.venue.slug}">${escapeHtml(e.venue.short_name ?? e.venue.name)}</a>
        ${venueRoom ? `<span class="concert__venue-sep">/</span><span>${venueRoom}</span>` : ""}
      </p>`;

  return `<li class="concert" id="event-${e.id}" style="--i:${opts.index}">
    <div class="concert__when">
      <span class="concert__time">${escapeHtml(time)}</span>
      ${endTime ? `<span class="concert__time-end">${escapeHtml(endTime)}</span>` : ""}
    </div>
    <div class="concert__body">
      <span class="concert__genre concert__genre--${e.genre}">${escapeHtml(genreLabel)}</span>
      <h3 class="concert__title">
        ${titleHref ? `<a href="${escapeHtml(titleHref)}" target="_blank" rel="noopener">${escapeHtml(e.title)}</a>` : escapeHtml(e.title)}
      </h3>
      ${subtitle ? `<p class="concert__subtitle">${subtitle}</p>` : ""}
      ${performers && performers !== subtitle ? `<p class="concert__subtitle">${performers}</p>` : ""}
      ${venueLine}
    </div>
    <div class="concert__rail">
      ${price ? `<p class="concert__price">${price}</p>` : `<p class="concert__price concert__price--free">Eintritt frei</p>`}
      <a class="icon-btn" href="/event/${e.id}/feed.ics" aria-label="Zum Kalender" title="Zum Kalender">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg>
      </a>
      ${
        e.ticket_url
          ? `<a class="action" href="${escapeHtml(utm(e.ticket_url, "karten"))}" target="_blank" rel="noopener">
              <span>Karten</span><span class="action__arrow" aria-hidden="true">→</span>
            </a>`
          : ""
      }
    </div>
  </li>`;
}

function formatPriceRange(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return `${min}<span class="dash">–</span>${max}<span class="cur">€</span>`;
  }
  return `${max ?? min}<span class="cur">€</span>`;
}

export const escapeHtml = coreEscapeHtml;

export function renderFooter(): string {
  return `<footer class="footer">
  <span class="footer__rule"></span>
  <p>konzert.haus — Konzerte in Frankfurt und Umgebung.<br>Klassik, Jazz, Kammermusik, Kirchenmusik, Weltmusik und Neue Musik.</p>
  <div class="footer__links">
    <a href="/feed.ics">iCal</a>
    <span class="footer__sep">·</span>
    <a href="/feed.rss">RSS</a>
    <span class="footer__sep">·</span>
    <a href="/api/docs">API</a>
    <span class="footer__sep">·</span>
    <a href="/impressum">Impressum</a>
    <span class="footer__sep">·</span>
    <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a>
  </div>
</footer>`;
}

export function renderProgrammePartial(date: string, events: DayEvent[]): string {
  const dp = dateParts(date);
  return `<header class="programme__header">
    <p class="programme__line"></p>
    <p class="programme__weekday">${WEEKDAYS_LONG[dp.weekday]}</p>
    <h2 class="programme__date">
      <span class="programme__day">${dp.day}.</span>
      <span class="programme__month">${MONTHS_LONG[dp.month]}</span>
      <span class="programme__year">${dp.year}</span>
    </h2>
  </header>
  ${
    events.length === 0
      ? `<div class="empty"><p class="empty__mark">∅</p><p>Heute keine Konzerte gemeldet.</p></div>`
      : `<ol class="concerts" id="concerts">${events.map((e, i) => renderEvent(e, { index: i })).join("")}</ol>`
  }`;
}

export function renderPage(props: PageProps): string {
  const { date, today, events, dateStrip, genre } = props;
  const niceDate = fullGerman(date);

  const head = renderHead({
    title: `konzert.haus · ${niceDate}`,
    description: `Konzerte in Frankfurt und Umgebung am ${niceDate}. Klassik, Jazz, Kammermusik, Kirchenmusik, Weltmusik, Neue Musik.`,
    canonical: `${APP_URL}/tag/${date}`,
  });

  return `<!doctype html>
<html lang="de">
<head>
${head}
</head>
<body>
${renderGrain()}
${renderMasthead()}
${renderGenreFilter(date, genre)}
${renderDateStrip(dateStrip, date, today)}

<main class="programme" id="programme">
  <div id="programme-content">
    ${renderProgrammePartial(date, events)}
  </div>
</main>

${renderFooter()}
</body>
</html>`;
}
