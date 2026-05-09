import { buildGoogleCalendarUrl, buildOutlookCalendarUrl, buildYahooCalendarUrl } from "@museumsufer/core";
import { Hono } from "hono";
import { CATEGORY_BY_SLUG } from "../categories";
import { todayIso } from "../date";
import { imageProxyUrl } from "../image-proxy";
import { getEventById } from "../queries";
import {
  APP_URL,
  buildGoogleMapsUrl,
  buildVrnUrl,
  formatDateLong,
  formatDateRange,
  formatTime,
  weekdayShort,
} from "../shared";
import type { Env, Event } from "../types";

const app = new Hono<{ Bindings: Env }>();

// Single handler so the literal `.ics` suffix doesn't fight Hono's
// param matcher — `:id` would otherwise eat the dot.
app.get("/event/:slug", (c) => {
  const raw = c.req.param("slug");
  const isIcs = raw.endsWith(".ics");
  const idStr = isIcs ? raw.slice(0, -4) : raw;
  if (!/^\d+$/.test(idStr)) return c.notFound();
  const ev = getEventById(parseInt(idStr, 10));
  if (!ev) return c.notFound();
  if (isIcs) {
    return c.text(buildIcsForOne(ev), 200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ev.id}.ics"`,
    });
  }
  return c.html(renderEventPage(ev), 200, {
    "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=3600",
  });
});

export default app;

function renderEventPage(ev: Event): string {
  const cat = CATEGORY_BY_SLUG.get(ev.category) ?? CATEGORY_BY_SLUG.get("sonstiges")!;
  const today = todayIso();
  const isPast = (ev.end_date ?? ev.date) < today;
  const time = formatTime(ev.time);
  const endTime = formatTime(ev.end_time);
  const when = ev.end_date
    ? formatDateRange(ev.date, ev.end_date)
    : `${weekdayShort(ev.date)}, ${formatDateLong(ev.date)}`;
  const calEv = {
    date: ev.date,
    time: ev.time ?? null,
    end_time: ev.end_time ?? null,
    end_date: ev.end_date ?? null,
    title: ev.title,
    location: ev.venue,
    description: ev.description ?? null,
    detail_url: ev.detail_url,
  };
  const img = imageProxyUrl(ev.image_url);
  const vrnUrl = buildVrnUrl(ev.venue, ev.city);
  const mapsUrl = buildGoogleMapsUrl(ev.venue, ev.city);
  const shareUrl = `${APP_URL}/event/${ev.id}`;
  const ldJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    startDate: ev.time ? `${ev.date}T${ev.time}:00+02:00` : ev.date,
    endDate: ev.end_date ? (ev.end_time ? `${ev.end_date}T${ev.end_time}:00+02:00` : ev.end_date) : undefined,
    location: ev.venue
      ? {
          "@type": "Place",
          name: ev.venue,
          address: { "@type": "PostalAddress", addressLocality: "Landau in der Pfalz", addressCountry: "DE" },
        }
      : undefined,
    image: ev.image_url || undefined,
    description: ev.description || undefined,
    organizer: ev.organizer ? { "@type": "Organization", name: ev.organizer } : undefined,
    url: `${APP_URL}/event/${ev.id}`,
    offers: ev.price ? { "@type": "Offer", price: ev.price } : undefined,
  });
  const title = `${ev.title} — landau.today`;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(ev.description?.slice(0, 200) ?? `${ev.title} — ${when} in Landau.`)}" />
<meta name="theme-color" content="#f2ead3" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(ev.description?.slice(0, 200) ?? "")}" />
<meta property="og:type" content="event" />
${ev.image_url ? `<meta property="og:image" content="${esc(ev.image_url)}" />` : ""}
<link rel="canonical" href="${APP_URL}/event/${ev.id}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;0,6..96,800;1,6..96,400;1,6..96,500;1,6..96,600&family=Bodoni+Moda+SC:opsz,wght@6..96,400&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" href="/styles.css" />
<script type="application/ld+json">${ldJson}</script>
</head>
<body>
<header class="masthead">
  <h1><a href="/">Landau<span class="ampersand">&amp;</span>heute</a></h1>
  <p class="subtitle">Veranstaltungsblatt für die Südliche Weinstraße</p>
</header>
<main id="content" class="event-detail" style="padding:0 1rem">
  <p class="eyebrow">
    <span style="color:var(--color-${cat.mood})">${cat.glyph}</span> ${esc(cat.label)}
    ${isPast ? " · vorbei" : ""}
  </p>
  <h1>${esc(ev.title)}</h1>
  <p class="when">${esc(when)}${time ? ` · ${time}${endTime ? `–${endTime}` : ""} Uhr` : ""}</p>
  ${ev.venue ? `<p class="where">${esc(ev.venue)}${ev.organizer && ev.organizer !== ev.venue ? ` · ${esc(ev.organizer)}` : ""}</p>` : ""}
  ${img ? `<img src="${esc(img)}" alt="${esc(ev.title)}" />` : ""}
  ${ev.description ? `<div class="body-copy"><p>${esc(ev.description)}</p></div>` : ""}
  ${ev.price ? `<p class="when" style="margin-top:1rem"><em>${esc(ev.price)}</em></p>` : ""}
  <div class="actions actions--group">
    <span class="actions__label">Anfahrt</span>
    ${vrnUrl ? `<a href="${esc(vrnUrl)}" rel="external">VRN ÖPNV</a>` : ""}
    ${mapsUrl ? `<a href="${esc(mapsUrl)}" rel="external">Google Maps</a>` : ""}
  </div>
  <div class="actions actions--group">
    <span class="actions__label">Kalender</span>
    <a href="/event/${ev.id}.ics">.ics</a>
    <a href="${esc(buildGoogleCalendarUrl(calEv))}" rel="external">Google</a>
    <a href="${esc(buildOutlookCalendarUrl(calEv))}" rel="external">Outlook</a>
    <a href="${esc(buildYahooCalendarUrl(calEv))}" rel="external">Yahoo</a>
  </div>
  <div class="actions actions--group">
    <span class="actions__label">Mehr</span>
    <a href="${esc(ev.detail_url)}" rel="external">Quelle ansehen</a>
    <button type="button" class="action-btn js-share" data-url="${esc(shareUrl)}" data-title="${esc(ev.title)}">Teilen</button>
  </div>
  <div class="share-toast" hidden>Link kopiert</div>
</main>
<script>
(function(){
  // Share via the Web Share API where available; otherwise copy the URL
  // to the clipboard and surface a small toast. Same idiom as theaters.
  function showToast(){
    var t = document.querySelector('.share-toast');
    if (!t) return;
    t.hidden = false;
    setTimeout(function(){ t.hidden = true; }, 2000);
  }
  function onShare(btn){
    var payload = { title: btn.dataset.title, url: btn.dataset.url };
    if (navigator.share) {
      navigator.share(payload).catch(function(){});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload.url).then(showToast).catch(function(){});
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = payload.url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast(); } catch(e){}
    document.body.removeChild(ta);
  }
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.js-share');
    if (btn) { e.preventDefault(); onShare(btn); }
  });
})();
</script>
<footer class="colophon-foot" style="max-width:38rem;margin:0 auto;padding:0 1rem 2rem">
  <span>Landau heute · Heimatzeitung für Veranstaltungen</span>
  <span><a href="/">Zurück zum Programm</a></span>
</footer>
</body>
</html>`;
}

function buildIcsForOne(ev: Event): string {
  const dt = (date: string, time?: string) => date.replace(/-/g, "") + (time ? `T${time.replace(":", "")}00` : "");
  const stamp = `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//landau.today//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.id}@landau.today`,
    `DTSTAMP:${stamp}`,
    ev.time ? `DTSTART;TZID=Europe/Berlin:${dt(ev.date, ev.time)}` : `DTSTART;VALUE=DATE:${dt(ev.date)}`,
    ev.end_date || ev.end_time
      ? ev.end_time
        ? `DTEND;TZID=Europe/Berlin:${dt(ev.end_date ?? ev.date, ev.end_time)}`
        : `DTEND;VALUE=DATE:${dt(ev.end_date ?? ev.date)}`
      : "",
    `SUMMARY:${icsEscape(ev.title)}`,
    ev.venue ? `LOCATION:${icsEscape(ev.venue)}` : "",
    ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : "",
    `URL:${APP_URL}/event/${ev.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.filter(Boolean).join("\r\n");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
