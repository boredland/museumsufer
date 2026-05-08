import { CATEGORY_BY_SLUG } from "./categories";
import { ChipRow, DateStrip, DayHeadline, EventList } from "./components";
import { todayIso } from "./date";
import { APP_URL, formatDateLong } from "./shared";
import type { Event } from "./types";

interface PageProps {
  date: string;
  category?: string;
  events: Event[];
  categoryCounts: Map<string, number>;
  dateCounts: Map<string, number>;
}

export function renderPage(props: PageProps): string {
  const { date, category, events, categoryCounts, dateCounts } = props;
  const cat = category ? CATEGORY_BY_SLUG.get(category) : undefined;
  const isHome = !category && date === todayIso();
  const title = cat
    ? `${cat.label} — ${formatDateLong(date)} · landau.today`
    : isHome
      ? "landau.today — Veranstaltungen heute in Landau in der Pfalz"
      : `${formatDateLong(date)} · landau.today`;
  const description = cat
    ? `${cat.label} in Landau in der Pfalz: alle Veranstaltungen am ${formatDateLong(date)}.`
    : "Alle Veranstaltungen in Landau in der Pfalz und im Landauer Land — Konzert, Theater, Tanz, Lesung, Festival, Ausstellung. Aus Kulturnetz Landau und Stadt Landau.";
  const canonical = cat ? `${APP_URL}/c/${cat.slug}?date=${date}` : `${APP_URL}/?date=${date}`;
  const jsonLd = buildJsonLd(events.slice(0, 50));

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="theme-color" content="#f2ead3" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="${APP_URL}/og.svg" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="manifest" href="/manifest.json" />
<link rel="alternate" type="application/rss+xml" title="landau.today RSS" href="/feed.xml" />
<link rel="alternate" type="text/calendar" title="landau.today Kalender" href="/feed.ics" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;0,6..96,800;1,6..96,400;1,6..96,500;1,6..96,600&family=Bodoni+Moda+SC:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" href="/styles.css" />
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>
<a class="sr-only" href="#content">Zum Inhalt</a>
<header class="masthead ink-up" style="animation-delay:0ms">
  <h1>
    <a href="/">Landau<span class="ampersand">&amp;</span>heute</a>
  </h1>
  <p class="subtitle">Veranstaltungsblatt für die Südliche Weinstraße</p>
  <p class="colophon">${escapeHtml(formatDateLong(todayIso()))}</p>
</header>
<main id="content" style="max-width:48rem;margin:0 auto;padding:0 1rem">
${render(<ChipRow active={category} date={date} counts={categoryCounts} />, "ink-up", 60)}
${render(<DateStrip current={date} category={category} counts={dateCounts} />, "ink-up", 120)}
${render(<DayHeadline date={date} total={events.length} />, "ink-up", 180)}
<section class="ink-up" style="animation-delay:240ms">
${render(<EventList events={events} date={date} />, "")}
</section>
</main>
<footer class="colophon-foot" style="max-width:48rem;margin:0 auto;padding:0 1rem 2rem">
  <span>Landau heute · Heimatzeitung für Veranstaltungen</span>
  <span>
    <a href="/feed.ics">Kalender abonnieren</a> · <a href="/feed.xml">RSS</a> · <a href="/llms.txt">llms.txt</a> · <a href="/impressum">Impressum</a>
  </span>
</footer>
</body>
</html>`;
}

// Wrap each section in its own .ink-up so the page composes top-down
// like a freshly inked broadsheet. The animation delays cap at 240ms so
// reduced-motion users (who skip the animation) still see the same
// final layout.
function render(node: unknown, _cls: string, delayMs?: number): string {
  const inner = String(node);
  if (delayMs == null) return inner;
  return `<div class="ink-up" style="animation-delay:${delayMs}ms">${inner}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildJsonLd(events: Event[]): string {
  const items = events.map((ev) => ({
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
  }));
  return JSON.stringify({ "@context": "https://schema.org", "@graph": items });
}
