import {
  buildGoogleCalendarUrl,
  buildIcsCalendar,
  buildOutlookCalendarUrl,
  buildUtm,
  buildYahooCalendarUrl,
  THEME_FOUC_SCRIPT,
} from "@museumsufer/core";
import { Hono } from "hono";
import { CATEGORY_BY_SLUG } from "../categories";
import { todayIso } from "../date";
import { buildHreflangs, buildLangSwitchHtml } from "../frontend";
import { categoryLabel, detectLocale, getTranslations, type Locale, type Translations } from "../i18n";
import { imageProxyUrl } from "../image-proxy";
import { getEventById } from "../queries";
import {
  APP_URL,
  buildGoogleMapsUrl,
  buildVrnUrl,
  formatDateLong,
  formatDateRange,
  formatTime,
  jsonLdSafe,
  weekdayShort,
} from "../shared";
import type { Env, Event } from "../types";

const utm = buildUtm("landau.today");

const app = new Hono<{ Bindings: Env }>();

app.get("/event/:id{[0-9]+}/feed.ics", (c) => {
  const ev = getEventById(parseInt(c.req.param("id"), 10));
  if (!ev) return c.notFound();
  return c.text(buildIcsForOne(ev), 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${ev.id}.ics"`,
  });
});

app.get("/event/:id{[0-9]+}", (c) => {
  const ev = getEventById(parseInt(c.req.param("id"), 10));
  if (!ev) return c.notFound();
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  return c.html(renderEventPage(ev, locale, tr), 200, {
    "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=3600",
    "Content-Language": locale,
    Vary: "Accept-Language",
  });
});

export default app;

function renderEventPage(ev: Event, locale: Locale, tr: Translations): string {
  const cat = CATEGORY_BY_SLUG.get(ev.category) ?? CATEGORY_BY_SLUG.get("sonstiges")!;
  const localCat = categoryLabel(cat.slug, tr);
  const today = todayIso();
  const isPast = (ev.end_date ?? ev.date) < today;
  const time = formatTime(ev.time, locale);
  const endTime = formatTime(ev.end_time, locale);
  const sameTime = time !== null && endTime !== null && time === endTime;
  const when = ev.end_date
    ? formatDateRange(ev.date, ev.end_date, locale)
    : `${weekdayShort(ev.date, locale)}, ${formatDateLong(ev.date, locale)}`;
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
  const ldJson = jsonLdSafe({
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    startDate: ev.time ? `${ev.date}T${ev.time}:00+02:00` : ev.date,
    endDate: ev.end_date ? (ev.end_time ? `${ev.end_date}T${ev.end_time}:00+02:00` : ev.end_date) : undefined,
    location: ev.venue
      ? {
          "@type": "Place",
          name: ev.venue,
          address: {
            "@type": "PostalAddress",
            addressLocality: ev.city || "Landau in der Pfalz",
            addressCountry: "DE",
          },
          ...(typeof ev.lat === "number" && typeof ev.lng === "number"
            ? { geo: { "@type": "GeoCoordinates", latitude: ev.lat, longitude: ev.lng } }
            : {}),
        }
      : undefined,
    image: ev.image_url || undefined,
    description: ev.description || undefined,
    organizer: ev.organizer ? { "@type": "Organization", name: ev.organizer } : undefined,
    url: `${APP_URL}/event/${ev.id}`,
    offers: ev.price ? { "@type": "Offer", price: ev.price } : undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  });
  const breadcrumbLd = jsonLdSafe({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "landau.today", item: APP_URL },
      { "@type": "ListItem", position: 2, name: cat.label, item: `${APP_URL}/c/${cat.slug}` },
      { "@type": "ListItem", position: 3, name: ev.title, item: `${APP_URL}/event/${ev.id}` },
    ],
  });
  const title = `${ev.title} — landau.today`;
  // SERP descriptions truncate around ~155 chars; trim defensively so we
  // don't end on a half-word.
  const metaDescription = trimToWords(ev.description ?? `${ev.title} — ${when} in ${ev.city ?? "Landau"}.`, 155);
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDescription)}" />
<meta name="theme-color" content="#f2ead3" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(metaDescription)}" />
<meta property="og:type" content="event" />
<meta property="og:image" content="${APP_URL}/og/${ev.id}/image.svg" />
<meta property="og:image:type" content="image/svg+xml" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
${ev.image_url ? `<meta property="og:image:secure_url" content="${esc(ev.image_url)}" />` : ""}
<link rel="canonical" href="${APP_URL}/event/${ev.id}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;0,6..96,800;1,6..96,400;1,6..96,500;1,6..96,600&family=Bodoni+Moda+SC:opsz,wght@6..96,400&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" href="/styles.css" />
${buildHreflangs(`/event/${ev.id}`)}
<script>${THEME_FOUC_SCRIPT}</script>
<script src="/client.js" defer></script>
<script type="application/ld+json">${ldJson}</script>
<script type="application/ld+json">${breadcrumbLd}</script>
</head>
<body>
<header class="masthead">
  <h1><a href="/${locale === "fr" ? "?lang=fr" : ""}">Landau<span class="ampersand">&amp;</span>heute</a></h1>
  <p class="subtitle">${esc(tr.subtitle)}</p>
  <nav class="langswitch" aria-label="${esc(tr.langSwitchAria)}">${buildLangSwitchHtml(locale, `/event/${ev.id}`)}</nav>
  <button type="button" class="theme-toggle js-theme" aria-label="${esc(tr.themeToggle)}" title="${esc(tr.themeToggle)}">
    <span class="icon-sun" aria-hidden="true">☀</span>
    <span class="icon-moon" aria-hidden="true">☾</span>
  </button>
</header>
<main id="content" class="event-detail" style="padding:0 1rem">
  <p class="eyebrow">
    <span style="color:var(--color-${cat.mood})">${cat.glyph}</span> ${esc(localCat.label)}
    ${isPast ? ` · ${esc(tr.evPast)}` : ""}
  </p>
  <h1>${esc(ev.title)}</h1>
  <p class="when">${esc(when)}${time ? ` · ${time}${endTime && !sameTime ? `–${endTime}` : ""}${tr.timeSuffix ? ` ${esc(tr.timeSuffix)}` : ""}` : ""}</p>
  ${ev.venue ? `<p class="where">${esc(ev.venue)}${ev.organizer && ev.organizer !== ev.venue ? ` · ${esc(ev.organizer)}` : ""}</p>` : ""}
  ${img ? `<img src="${esc(img)}" alt="${esc(ev.title)}" width="800" height="450" loading="lazy" decoding="async" style="width:100%;height:auto;aspect-ratio:16/9;object-fit:cover" />` : ""}
  ${ev.description ? `<div class="body-copy"><p>${esc(ev.description)}</p></div>` : ""}
  ${ev.price ? `<p class="when" style="margin-top:1rem"><em>${esc(ev.price)}</em></p>` : ""}
  <div class="actions actions--group">
    <span class="actions__label">${esc(tr.evDirections)}</span>
    ${vrnUrl ? `<a href="${esc(vrnUrl)}" rel="external">VRN ÖPNV</a>` : ""}
    ${mapsUrl ? `<a href="${esc(mapsUrl)}" rel="external">Google Maps</a>` : ""}
  </div>
  <div class="actions actions--group">
    <span class="actions__label">${esc(tr.evCalendar)}</span>
    <a href="/event/${ev.id}/feed.ics">.ics</a>
    <a href="${esc(buildGoogleCalendarUrl(calEv))}" rel="external">Google</a>
    <a href="${esc(buildOutlookCalendarUrl(calEv))}" rel="external">Outlook</a>
    <a href="${esc(buildYahooCalendarUrl(calEv))}" rel="external">Yahoo</a>
  </div>
  <div class="actions actions--group">
    <span class="actions__label">${esc(tr.evMore)}</span>
    <a href="${esc(utm(ev.detail_url, "event"))}" rel="external">${esc(tr.evViewSource)}</a>
    <button type="button" class="action-btn js-share" data-url="${esc(shareUrl)}" data-title="${esc(ev.title)}">${esc(tr.evShare)}</button>
  </div>
  <div class="share-toast" hidden>${esc(tr.evLinkCopied)}</div>
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
  <span>${esc(tr.footerLine)}</span>
  <span><a href="/${locale === "fr" ? "?lang=fr" : ""}">${esc(tr.evBackToProgramme)}</a></span>
</footer>
</body>
</html>`;
}

function buildIcsForOne(ev: Event): string {
  return buildIcsCalendar({
    prodId: "-//landau.today//EN",
    events: [
      {
        uid: `${ev.id}@landau.today`,
        date: ev.date,
        time: ev.time ?? null,
        end_date: ev.end_date ?? null,
        end_time: ev.end_time ?? null,
        title: ev.title,
        location: ev.venue,
        description: ev.description ?? null,
        detail_url: `${APP_URL}/event/${ev.id}`,
      },
    ],
  });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Trim a string to ≤ maxLen characters at the nearest word boundary
 *  and append a single ellipsis when we cut. SERP meta descriptions
 *  truncate around 155 chars; doing the cut server-side keeps the
 *  ending coherent rather than chopping mid-word. */
function trimToWords(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const slice = s.slice(0, maxLen - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > maxLen * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}
