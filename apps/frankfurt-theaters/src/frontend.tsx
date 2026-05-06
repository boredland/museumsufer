import type { DateWithCount } from "./db";
import type { Performance, Show, Theater } from "./types";

type DayPerformance = Performance & {
  show: Show;
  theater: Pick<Theater, "id" | "name" | "slug" | "website_url">;
};

interface PageProps {
  date: string;
  today: string;
  performances: DayPerformance[];
  dateStrip: DateWithCount[];
}

const WEEKDAYS_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS_LONG = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

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

export function renderPage(props: PageProps): string {
  const { date, today, performances, dateStrip } = props;
  const isToday = date === today;
  const niceDate = fullGerman(date);
  const datePartsX = dateParts(date);
  const headerWeekday = WEEKDAYS_LONG[datePartsX.weekday];
  const headerNumeric = `${pad2(datePartsX.day)}.${pad2(datePartsX.month + 1)}.${datePartsX.year}`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Frankfurt Theater · ${niceDate}</title>
<meta name="description" content="Vorstellungen und Karten der Frankfurter Bühnen — kuratiert nach Tag." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=JetBrains+Mono:wght@400;500;700&display=swap" />
<link rel="stylesheet" href="/styles.css" />
</head>
<body>
${renderGrain()}
<header class="masthead" role="banner">
  <div class="masthead__brand">
    <h1 class="wordmark"><span>Frankfurt</span><span>Theater.</span></h1>
    <p class="tagline">Spielplan der Bühnen am Willy-Brandt-Platz.</p>
  </div>
  <div class="masthead__date">
    <p class="masthead__weekday">${headerWeekday}</p>
    <p class="masthead__numeric"><time datetime="${date}">${headerNumeric}</time></p>
    ${isToday ? '<p class="masthead__today">Heute</p>' : ""}
  </div>
</header>

<nav class="datestrip" aria-label="Spieltage">
  <div class="datestrip__inner" id="datestrip">
    ${renderDateStrip(dateStrip, date, today)}
  </div>
</nav>

<main class="programme">
  <header class="programme__header">
    <p class="programme__line"></p>
    <p class="programme__weekday">${headerWeekday}</p>
    <h2 class="programme__date">
      <span class="programme__day">${datePartsX.day}.</span>
      <span class="programme__month">${MONTHS_LONG[datePartsX.month]}</span>
      <span class="programme__year">${datePartsX.year}</span>
    </h2>
  </header>

  ${
    performances.length === 0
      ? `<div class="empty">
           <p class="empty__mark">∅</p>
           <p>An diesem Tag keine Vorstellungen.</p>
         </div>`
      : renderPerformances(performances)
  }
</main>

<footer class="footer">
  <div>
    <p class="footer__rule"></p>
    <p>Eine Übersicht des Spielplans an Frankfurts Bühnen.</p>
    <p class="footer__small">
      Daten von <a href="https://www.schauspielfrankfurt.de" target="_blank" rel="noopener">schauspielfrankfurt.de</a>
      und <a href="https://oper-frankfurt.de" target="_blank" rel="noopener">oper-frankfurt.de</a>.
      Kein offizielles Angebot der Städtischen Bühnen.
    </p>
  </div>
</footer>

<script>
  // Center the active date in the strip on load
  (function(){
    var strip = document.getElementById('datestrip');
    if (!strip) return;
    var active = strip.querySelector('.datetile--active');
    if (active) {
      var offset = active.offsetLeft - (strip.parentElement.clientWidth / 2) + (active.offsetWidth / 2);
      strip.parentElement.scrollLeft = Math.max(0, offset);
    }
  })();
</script>
</body>
</html>`;
}

function renderGrain(): string {
  return `<div class="grain" aria-hidden="true"></div>`;
}

function renderDateStrip(strip: DateWithCount[], active: string, today: string): string {
  if (!strip.length) return "";
  return strip
    .map((d) => {
      const p = dateParts(d.date);
      const isActive = d.date === active;
      const isToday = d.date === today;
      const cls = ["datetile", isActive ? "datetile--active" : "", isToday ? "datetile--today" : ""]
        .filter(Boolean)
        .join(" ");
      return `<a class="${cls}" href="/?date=${d.date}" aria-current="${isActive ? "true" : "false"}">
        <span class="datetile__weekday">${WEEKDAYS_SHORT[p.weekday]}</span>
        <span class="datetile__day">${p.day}</span>
        <span class="datetile__month">${MONTHS_LONG[p.month].slice(0, 3)}</span>
        <span class="datetile__count">${d.n}</span>
      </a>`;
    })
    .join("");
}

function renderPerformances(performances: DayPerformance[]): string {
  return `<ol class="performances" role="list">
    ${performances.map((p, i) => renderPerformance(p, i)).join("")}
  </ol>`;
}

function renderPerformance(p: DayPerformance, index: number): string {
  const time = p.time ?? "—";
  const endTime = p.end_time ? ` – ${p.end_time}` : "";
  const room = p.venue_room ? escapeHtml(p.venue_room) : null;
  const isStruck = p.status === "sold_out" || p.status === "cancelled";
  const subtitle = p.show.subtitle ? escapeHtml(p.show.subtitle).replace(/\s*<br\s*\/?>\s*/gi, " · ") : null;
  const price = p.status === "sold_out" ? null : formatPriceRange(p.price_min, p.price_max);
  const titleHref = p.show.detail_url ?? p.ticket_url ?? null;

  const stamp = renderStatusStamp(p.status);
  const action = renderAction(p);

  return `<li class="perf perf--${p.status}" style="--i:${index}">
    <div class="perf__when">
      <span class="perf__index">${pad2(index + 1)}</span>
      <span class="perf__time"><span class="t1">${time}</span><span class="t2">${endTime}</span></span>
    </div>
    <div class="perf__body">
      <h3 class="perf__title ${isStruck ? "perf__title--struck" : ""}">
        ${titleHref ? `<a href="${escapeHtml(titleHref)}" target="_blank" rel="noopener">${escapeHtml(p.show.title)}</a>` : escapeHtml(p.show.title)}
      </h3>
      <p class="perf__venue">
        <span>${escapeHtml(p.theater.name)}</span>
        ${room ? `<span class="perf__sep">·</span><span>${room}</span>` : ""}
      </p>
      ${subtitle ? `<p class="perf__byline">${subtitle}</p>` : ""}
    </div>
    <div class="perf__rail">
      ${price ? `<p class="perf__price">${price}</p>` : ""}
      ${stamp}
      ${action}
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

function renderAction(p: DayPerformance): string {
  if (p.status === "cancelled") return "";
  if (p.ticket_url) {
    return `<a class="action" href="${escapeHtml(p.ticket_url)}" target="_blank" rel="noopener">
      <span>Karten</span><span class="action__arrow" aria-hidden="true">→</span>
    </a>`;
  }
  return "";
}

function formatPriceRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max)
    return `${min}<span class="dash">–</span>${max} <span class="cur">€</span>`;
  return `${max ?? min} <span class="cur">€</span>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
