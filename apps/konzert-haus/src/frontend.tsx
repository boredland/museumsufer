import {
  buildUtm,
  escapeHtml as coreEscapeHtml,
  GERMAN_MONTHS_LONG as MONTHS_LONG,
  THEME_FOUC_SCRIPT,
  todayIso,
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
  turnstileSiteKey?: string;
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
  turnstileSiteKey?: string;
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
${opts.turnstileSiteKey ? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ""}
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
  <button type="button" class="theme-toggle" data-theme-toggle aria-label="Farbthema wechseln" title="Farbthema wechseln">
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
  if (e.image_url) jsonLd.image = e.image_url;
  return jsonLd;
}

function renderEventJsonLd(e: DayEvent): string {
  const json = JSON.stringify(buildEventJsonLd(e)).replace(/</g, "\\u003c");
  return `<script type="application/ld+json" data-id="${e.id}">${json}</script>`;
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
    ${renderEventJsonLd(e)}
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
      <button type="button" class="icon-btn"
        data-report-regarding="${escapeHtml(`${e.title} — ${e.venue.name}, ${e.date}${e.time ? ` ${e.time}` : ""}`)}"
        data-report-context="${escapeHtml(`${APP_URL}/api/events/${e.id}`)}"
        aria-label="Fehler bei diesem Konzert melden" title="Fehler bei diesem Konzert melden">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v4M8 11h.01" stroke-linecap="round"/></svg>
      </button>
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

export function renderContactDialog(opts: { turnstileSiteKey?: string } = {}): string {
  return `<dialog id="contact-dialog" class="contact-dialog">
  <form id="contact-form" class="contact-form" novalidate>
    <header class="contact-form__head">
      <h2 class="contact-form__title">Feedback &amp; Korrekturen</h2>
      <button type="button" class="contact-form__close" data-contact-close aria-label="Schließen">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3l10 10M13 3L3 13" stroke-linecap="round"/></svg>
      </button>
    </header>
    <p class="contact-form__intro">Falsche Zeit, fehlendes Konzert, Tippfehler? Wir freuen uns über jeden Hinweis.</p>
    <div class="contact-form__regarding" id="contact-regarding" hidden>
      <span class="contact-form__regarding-label">Betrifft</span>
      <span id="contact-regarding-text"></span>
    </div>
    <label class="contact-form__field">
      <span class="contact-form__label">Kategorie</span>
      <select id="contact-category" name="category" required>
        <option value="Konzert">Konzert — falsche Daten</option>
        <option value="Spielort">Spielort — fehlt oder Korrektur</option>
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
${
  opts.turnstileSiteKey
    ? `    <div class="cf-turnstile" data-sitekey="${escapeHtml(opts.turnstileSiteKey)}" data-size="flexible" data-theme="auto"></div>`
    : ""
}
    <footer class="contact-form__foot">
      <p id="contact-status" class="contact-form__status" hidden aria-live="polite"></p>
      <button type="submit" id="contact-submit" class="contact-form__submit">Senden</button>
    </footer>
  </form>
</dialog>`;
}

export function renderClientBehaviors(): string {
  return `<script>
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
      setAttrIfPresent(t, 'hx-get', '/partial/programme?date=' + d + hxQs);
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
      // Rewrite pill URLs so the date stays in sync with the strip
      var base = '/tag/' + date;
      var partial = '/partial/programme?date=' + date;
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

  // Optimistic active-state flip on click so the UI feels instant
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
  // Also re-sync on history navigation (back/forward) when HTMX restores the cache
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
      if (openBtn) { e.preventDefault(); open(null); return; }
      var closeBtn = e.target.closest('[data-contact-close]');
      if (closeBtn) { e.preventDefault(); close(); return; }
      var reportBtn = e.target.closest('[data-report-regarding]');
      if (reportBtn) {
        e.preventDefault();
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
      submit.disabled = true; submit.textContent = 'Wird gesendet…';
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
        status.textContent = 'Senden fehlgeschlagen. Bitte schreib direkt an info@jonas-strassel.de.';
        status.className = 'contact-form__status contact-form__status--err';
        status.hidden = false;
        submit.disabled = false; submit.textContent = 'Senden';
      });
    });
  })();
})();
</script>`;
}

export function renderFooter(): string {
  return `<footer class="footer">
  <span class="footer__rule"></span>
  <p>konzert.haus — Konzerte in Frankfurt und Umgebung.<br>Klassik, Jazz, Kammermusik, Kirchenmusik, Weltmusik und Neue Musik.</p>
  <div class="footer__actions">
    <button type="button" class="footer__action" data-contact-open aria-label="Problem melden">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v4M8 11h.01" stroke-linecap="round"/></svg>
      <span>Problem melden</span>
    </button>
  </div>
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
  const { date, today, events, dateStrip, genre, turnstileSiteKey } = props;
  const niceDate = fullGerman(date);

  const head = renderHead({
    title: `konzert.haus · ${niceDate}`,
    description: `Konzerte in Frankfurt und Umgebung am ${niceDate}. Klassik, Jazz, Kammermusik, Kirchenmusik, Weltmusik, Neue Musik.`,
    canonical: `${APP_URL}/tag/${date}`,
    turnstileSiteKey,
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
${renderContactDialog({ turnstileSiteKey })}
${renderClientBehaviors()}
</body>
</html>`;
}
