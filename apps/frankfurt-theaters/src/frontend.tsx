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

export interface HeadOptions {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
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
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=JetBrains+Mono:wght@400;500;700&display=swap" />
<link rel="stylesheet" href="/styles.css" />
${jsonLdScripts}`;
}

export function renderGrain(): string {
  return `<div class="grain" aria-hidden="true"></div>`;
}

export function renderMasthead(args: {
  weekday: string;
  numeric: string;
  date: string;
  isToday: boolean;
  sublabel?: string;
}): string {
  return `<header class="masthead" role="banner">
  <a class="masthead__brand" href="/" aria-label="Frankfurt Theater Startseite">
    <h1 class="wordmark"><span>Frankfurt</span><span>Theater.</span></h1>
    <p class="tagline">${escapeHtml(args.sublabel ?? "Was heute auf den Frankfurter Bühnen läuft.")}</p>
  </a>
  <div class="masthead__date">
    <p class="masthead__weekday">${escapeHtml(args.weekday)}</p>
    <p class="masthead__numeric"><time datetime="${args.date}">${args.numeric}</time></p>
    ${args.isToday ? '<p class="masthead__today">Heute</p>' : ""}
  </div>
</header>`;
}

export function renderDateStrip(strip: DateWithCount[], active: string, today: string, base: string = "/"): string {
  if (!strip.length) return "";
  const params = base.includes("?") ? "&" : "?";
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
        return `<a class="${cls}" href="${base}${params}date=${d.date}" aria-current="${isActive ? "true" : "false"}">
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
  const room = p.venue_room ? escapeHtml(p.venue_room) : null;
  const isStruck = p.status === "sold_out" || p.status === "cancelled";
  const subtitle = p.show.subtitle ? escapeHtml(p.show.subtitle).replace(/\s*<br\s*\/?>\s*/gi, " · ") : null;
  const showPrice = p.status !== "sold_out" && p.status !== "cancelled";
  const price = showPrice ? formatPriceRange(p.price_min, p.price_max) : null;
  const titleHref = p.show.detail_url ?? p.ticket_url ?? null;

  const stamp = renderStatusStamp(p.status);
  const action = renderAction(p);
  const dateLine = opts.showDate ? `<p class="perf__when-date">${escapeHtml(fullGerman(p.date))}</p>` : "";

  const venueLine = opts.hideTheater
    ? room
      ? `<p class="perf__venue"><span>${room}</span></p>`
      : ""
    : `<p class="perf__venue">
        <a href="/theater/${p.theater.slug}">${escapeHtml(p.theater.name)}</a>
        ${room ? `<span class="perf__sep">·</span><span>${room}</span>` : ""}
      </p>`;

  return `<li class="perf perf--${p.status}" style="--i:${index}" data-perf-id="${p.id}" data-theater="${p.theater.slug}">
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
      ${stamp}
      ${renderTransit(p)}
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
  if (p.status === "cancelled" || p.status === "sold_out") return "";
  if (p.ticket_url) {
    return `<a class="action" href="${escapeHtml(p.ticket_url)}" target="_blank" rel="noopener">
      <span>Karten</span><span class="action__arrow" aria-hidden="true">→</span>
    </a>`;
  }
  return "";
}

function renderTransit(p: DayPerformance): string {
  const popId = `nav-${p.id}`;
  const reportSubject = encodeURIComponent(`Fehler: ${p.show.title} am ${p.date}`);
  const reportBody = encodeURIComponent(
    `Bühne: ${p.theater.name}\nVorstellung: ${p.show.title}${p.time ? ` um ${p.time} Uhr` : ""}\nDatum: ${p.date}\nLink: ${APP_URL}/api/performance/${p.id}\n\nWas stimmt nicht?\n`,
  );
  return `<span class="nav-wrap">
    <button type="button" class="transit-btn" data-theater="${p.theater.slug}" data-popover-target="${popId}" aria-label="Anfahrt zu ${escapeHtml(p.theater.name)}" popovertarget="${popId}" aria-haspopup="menu">
      <span class="transit-btn__label">Anfahrt</span>
      <span class="transit-btn__value" aria-live="polite"></span>
    </button>
    <div id="${popId}" popover="auto" role="menu" class="nav-popover" data-theater="${p.theater.slug}">
      <p class="nav-popover__title">${escapeHtml(p.theater.name)}</p>
      <p class="nav-popover__transit"><span class="nav-popover__minutes" aria-live="polite">…</span></p>
      <a role="menuitem" class="nav-popover__link nav-popover__link--rmv-app" data-kind="rmv-app" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">▶</span> RMV App
      </a>
      <a role="menuitem" class="nav-popover__link nav-popover__link--rmv-web" data-kind="rmv-web" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">◐</span> RMV Fahrplan
      </a>
      <a role="menuitem" class="nav-popover__link" data-kind="google" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true">G</span> Google Maps
      </a>
      <a role="menuitem" class="nav-popover__link" data-kind="apple" target="_blank" rel="noopener">
        <span class="nav-popover__icon" aria-hidden="true"></span> Apple Maps
      </a>
      <a role="menuitem" class="nav-popover__link nav-popover__link--report" href="mailto:feedback@ins.theater?subject=${reportSubject}&body=${reportBody}">
        <span class="nav-popover__icon" aria-hidden="true">!</span> Fehler melden
      </a>
    </div>
  </span>`;
}

function formatPriceRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max)
    return `${min}<span class="dash">–</span>${max} <span class="cur">€</span>`;
  return `${max ?? min} <span class="cur">€</span>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderFooter(): string {
  return `<footer class="footer">
  <div>
    <p class="footer__rule"></p>
    <p>Eine Übersicht des Spielplans an Frankfurts Bühnen.</p>
    <p class="footer__actions">
      <button type="button" class="footer__action" data-action="share" aria-label="Diese Seite teilen">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11.5 5.5a2 2 0 1 0-1.7-3M4.5 10.5a2 2 0 1 0 0-3M11.5 14.5a2 2 0 1 0-1.7-3M5.6 8.4l4.8-2.8M5.6 9.6l4.8 2.8" stroke-linecap="round"/></svg>
        <span>Teilen</span>
      </button>
      <a class="footer__action" href="mailto:feedback@ins.theater?subject=Feedback%20zu%20frankfurt.ins.theater&body=URL%3A%20${encodeURIComponent(APP_URL)}%0A%0A">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v4M8 11h.01" stroke-linecap="round"/></svg>
        <span>Problem melden</span>
      </a>
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
</footer>`;
}

export function renderPage(props: PageProps): string {
  const { date, today, performances, dateStrip } = props;
  const isToday = date === today;
  const niceDate = fullGerman(date);
  const dp = dateParts(date);
  const headerWeekday = WEEKDAYS_LONG[dp.weekday];
  const headerNumeric = `${pad2(dp.day)}.${pad2(dp.month + 1)}.${dp.year}`;

  const head = renderHead({
    title: `Frankfurt Theater · ${niceDate}`,
    description: `Vorstellungen und Karten der Frankfurter Bühnen am ${niceDate} — kuratiert nach Tag.`,
    canonical: `${APP_URL}/?date=${date}`,
    jsonLd: buildHomeJsonLd(date, performances),
  });

  return `<!doctype html>
<html lang="de">
<head>
${head}
</head>
<body>
${renderGrain()}
${renderMasthead({ weekday: headerWeekday, numeric: headerNumeric, date, isToday })}
${renderDateStrip(dateStrip, date, today)}

<main class="programme">
  <header class="programme__header">
    <p class="programme__line"></p>
    <p class="programme__weekday">${headerWeekday}</p>
    <h2 class="programme__date">
      <span class="programme__day">${dp.day}.</span>
      <span class="programme__month">${MONTHS_LONG[dp.month]}</span>
      <span class="programme__year">${dp.year}</span>
    </h2>
  </header>

  ${
    performances.length === 0
      ? `<div class="empty">
           <p class="empty__mark">∅</p>
           <p>An diesem Tag keine Vorstellungen.</p>
         </div>`
      : `<ol class="performances" role="list">${performances.map((p, i) => renderPerformance(p, { index: i })).join("")}</ol>`
  }
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

  // Anfahrt — popover with RMV / Google Maps / Apple Maps + lazy ÖPNV minutes
  (function(){
    var btns = document.querySelectorAll('.transit-btn');
    if (!btns.length) return;
    var transit = null; // { slug -> minutes }
    var loading = false;

    function snap(n){ return Math.round(n*500)/500; }

    function fmtMin(min){
      if (min == null) return null;
      if (min < 60) return min + ' min mit ÖPNV';
      var h = Math.floor(min/60), m = min%60;
      return h + 'h' + (m ? ' ' + m + 'm' : '') + ' mit ÖPNV';
    }

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

    function populatePopover(slug){
      var pop = document.querySelector('.nav-popover[data-theater="' + slug + '"]');
      if (!pop) return;
      var urls = buildNavUrls(slug);
      if (!urls) return;
      pop.querySelectorAll('a[data-kind]').forEach(function(a){
        var kind = a.getAttribute('data-kind');
        if (kind === 'rmv-app') a.href = urls.rmvApp;
        else if (kind === 'rmv-web') a.href = urls.rmvWeb;
        else if (kind === 'google') a.href = urls.google;
        else if (kind === 'apple') a.href = urls.apple;
      });
      var minutesEl = pop.querySelector('.nav-popover__minutes');
      var v = transit && transit[slug];
      if (v != null) {
        minutesEl.textContent = fmtMin(v);
        minutesEl.parentElement.classList.add('nav-popover__transit--ready');
      }
    }

    function paintAllButtons(){
      btns.forEach(function(b){
        var slug = b.getAttribute('data-theater');
        var v = transit && transit[slug];
        var label = b.querySelector('.transit-btn__label');
        var value = b.querySelector('.transit-btn__value');
        if (v != null && label && value) {
          label.textContent = 'ÖPNV';
          value.textContent = (v < 60) ? (v + ' min') : Math.floor(v/60) + 'h' + (v%60 ? ' ' + (v%60) + 'm' : '');
          b.classList.add('transit-btn--ready');
        }
        // Also update any open popover for this slug
        var pop = document.getElementById(b.getAttribute('data-popover-target'));
        if (pop) {
          var minutesEl = pop.querySelector('.nav-popover__minutes');
          if (minutesEl && v != null) {
            minutesEl.textContent = fmtMin(v);
            minutesEl.parentElement.classList.add('nav-popover__transit--ready');
          }
        }
      });
    }

    function fetchTransit(lat, lng, then){
      if (loading) return;
      loading = true;
      var key = 'transit_' + snap(lat) + '_' + snap(lng);
      var cached = null;
      try { cached = sessionStorage.getItem(key); } catch(e){}
      if (cached) {
        try { transit = JSON.parse(cached); paintAllButtons(); loading = false; if (then) then(); return; } catch(e){}
      }
      fetch('/api/transit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: lat, lng: lng })
      }).then(function(r){ return r.json(); }).then(function(d){
        transit = d || {};
        try { sessionStorage.setItem(key, JSON.stringify(transit)); } catch(e){}
        paintAllButtons();
        if (then) then();
      }).catch(function(){}).finally(function(){ loading = false; });
    }

    function ensureLocation(cb){
      if (!navigator.geolocation) { cb(null); return; }
      navigator.geolocation.getCurrentPosition(
        function(pos){ cb({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        function(){ cb(null); },
        { maximumAge: 600000, timeout: 8000 }
      );
    }

    btns.forEach(function(b){
      var slug = b.getAttribute('data-theater');
      // Pre-populate map links so they work even without geolocation
      populatePopover(slug);
      b.addEventListener('click', function(){
        // Re-populate (covers post-fetch ÖPNV minutes)
        populatePopover(slug);
        if (transit) return;
        ensureLocation(function(p){
          if (!p) return;
          fetchTransit(p.lat, p.lng, function(){ populatePopover(slug); });
        });
      });
    });
  })();

  // Share — Web Share API on mobile, clipboard fallback on desktop
  (function(){
    var btn = document.querySelector('.footer__action[data-action="share"]');
    if (!btn) return;
    var toast = document.querySelector('.footer__toast');

    function showToast(msg){
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('footer__toast--visible');
      setTimeout(function(){ toast.classList.remove('footer__toast--visible'); }, 2400);
    }

    btn.addEventListener('click', function(){
      var url = location.href;
      var title = document.title;
      var prompt = 'Was läuft heute auf Frankfurter Bühnen? ' + url;
      if (navigator.share) {
        navigator.share({ title: title, text: prompt, url: url }).catch(function(){});
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(prompt).then(function(){
          showToast('Link für KI-Suche kopiert');
        }).catch(function(){
          showToast('Kopieren fehlgeschlagen');
        });
        return;
      }
      // Last-resort fallback: select text in a hidden textarea
      var ta = document.createElement('textarea');
      ta.value = prompt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('Link kopiert'); } catch(e){}
      document.body.removeChild(ta);
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
    name: "Frankfurt Theater",
    url: APP_URL,
    inLanguage: "de",
    publisher: { "@type": "Organization", name: "Frankfurt Theater", url: APP_URL },
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
