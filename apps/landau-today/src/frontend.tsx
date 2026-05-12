import { buildFaqPageSchema, type FaqItem, THEME_FOUC_SCRIPT } from "@museumsufer/core";
import { CATEGORY_BY_SLUG } from "./categories";
import { ChipRow, DateStrip, DayHeadline, EventList } from "./components";
import { todayIso } from "./date";
import { APP_URL, formatDateLong } from "./shared";
import type { Event } from "./types";

const FAQ: FaqItem[] = [
  {
    q: "Wo kommen die Veranstaltungen her?",
    a: "Täglich aggregiert aus sechs öffentlichen Quellen: Kulturnetz Landau (kulturnetz-landau.de), Stadt Landau (landau.de), Stiftung Hambacher Schloss, RPTU Kaiserslautern-Landau (gefiltert auf Landau), Pfalz.de und Südliche Weinstraße Tourismus. Die Originale verlinken wir bei jeder Veranstaltung.",
  },
  {
    q: "Warum sind manche Veranstaltungen nicht aus Landau, sondern aus den umliegenden Dörfern?",
    a: "landau.today versteht sich als Veranstaltungsblatt für Landau und die Südliche Weinstraße. Konzerte, Weinfeste und Stadtführungen aus Bornheim, Edenkoben, Annweiler und den Landauer Stadtteilen gehören für viele Landauer:innen zum Alltag — und diese Region ist das thematische Zuhause der Seite.",
  },
  {
    q: "Wie kann ich eine Veranstaltung melden, die hier fehlt?",
    a: "Schreibt direkt an die ursprüngliche Quelle: Stadt Landau betreibt einen offenen Eintrag unter landau.de/Tourismus-Kultur/Veranstaltungen, Kulturnetz Landau hat ein Mitmach-Formular auf kulturnetz-landau.de/mitmachen. Was dort eingetragen ist, erscheint am nächsten Tag automatisch hier.",
  },
  {
    q: 'Was bedeutet die Karte mit dem Kompass-Symbol „In der Nähe"?',
    a: "Das ist ein optionaler Filter: Wenn ihr ihn aktiviert und der Browser nach eurem Standort fragt, sortieren wir die Veranstaltungen nach Luftlinie zu eurem aktuellen Ort. Standortdaten verlassen den Browser nicht — wir machen die Berechnung lokal.",
  },
  {
    q: "Kann ich den Kalender abonnieren?",
    a: "Ja. /feed.ics ist ein iCalendar-Abo der nächsten 14 Tage; einfach in Apple Kalender, Google Kalender oder Outlook hinzufügen. Für RSS-Reader gibt es /feed.xml mit den nächsten 7 Tagen.",
  },
  {
    q: "Werden meine Daten getrackt?",
    a: "Nein. Keine Analytics, keine Cookies, kein Login. Der Service Worker speichert lediglich Seiteninhalt für Offline-Nutzung im Browser-Cache.",
  },
];

interface PageProps {
  date: string;
  category?: string;
  events: Event[];
  categoryCounts: Map<string, number>;
  dateCounts: Map<string, number>;
  turnstileSiteKey: string;
}

export function renderPage(props: PageProps): string {
  const { date, category, events, turnstileSiteKey } = props;
  const cat = category ? CATEGORY_BY_SLUG.get(category) : undefined;
  const isHome = !category && date === todayIso();
  const title = cat
    ? `${cat.label} — ${formatDateLong(date)} · landau.today`
    : isHome
      ? "landau.today — Veranstaltungen heute in Landau in der Pfalz"
      : `${formatDateLong(date)} · landau.today`;
  const description = cat
    ? `${cat.label} in Landau in der Pfalz und an der Südlichen Weinstraße: alle Veranstaltungen am ${formatDateLong(date)}.`
    : "Veranstaltungen in Landau in der Pfalz und an der Südlichen Weinstraße — Konzert, Theater, Tanz, Lesung, Weinfest, Ausstellung, Stadtführung. Täglich aggregiert aus Kulturnetz Landau, Stadt Landau, Hambacher Schloss, RPTU, Pfalz.de und der SÜW-Tourismus.";
  const canonical = cat ? `${APP_URL}/c/${cat.slug}?date=${date}` : `${APP_URL}/?date=${date}`;
  const jsonLd = buildJsonLd(events.slice(0, 50));
  const faqLd = JSON.stringify(buildFaqPageSchema(FAQ));

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
<script>${THEME_FOUC_SCRIPT}</script>
<script src="/htmx.min.js" defer></script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script type="application/ld+json">${jsonLd}</script>
<script type="application/ld+json">${faqLd}</script>
</head>
<body>
<a class="sr-only" href="#content">Zum Inhalt</a>
<div class="htmx-progress" aria-hidden="true"></div>
<div class="search-bar ink-up" style="animation-delay:0ms">
  <label for="q" class="sr-only">Suchen</label>
  <input id="q" type="search" class="search-input js-search" placeholder="Suchen — Konzert, Theater, Veranstalter, Ort …" autocomplete="off" />
  <kbd class="search-kbd">⌘K</kbd>
  <span class="search-empty" hidden>Keine Treffer</span>
</div>
<header class="masthead ink-up" style="animation-delay:0ms">
  <h1>
    <a href="/">Landau<span class="ampersand">&amp;</span>heute</a>
  </h1>
  <p class="subtitle">Veranstaltungsblatt für die Südliche Weinstraße</p>
  <p class="colophon">${escapeHtml(formatDateLong(todayIso()))}</p>
  <button type="button" class="theme-toggle js-theme" aria-label="Hell/Dunkel wechseln" title="Hell/Dunkel">
    <span class="icon-sun" aria-hidden="true">☀</span>
    <span class="icon-moon" aria-hidden="true">☾</span>
  </button>
</header>
<main id="content" style="max-width:48rem;margin:0 auto;padding:0 1rem">
<div id="content-body">
${renderPartial(props)}
</div>
${renderFaq(FAQ)}
</main>
<footer class="colophon-foot" style="max-width:48rem;margin:0 auto;padding:0 1rem 2rem">
  <span>Landau heute · Heimatzeitung für Veranstaltungen</span>
  <span>
    <button type="button" data-digest-open style="background:transparent;border:0;padding:0;cursor:pointer;font:inherit;color:inherit;text-decoration:underline;text-decoration-color:rgb(from var(--color-ink) r g b / 0.3);text-underline-offset:3px">Push abonnieren</button> · <button type="button" data-contact-open style="background:transparent;border:0;padding:0;cursor:pointer;font:inherit;color:inherit;text-decoration:underline;text-decoration-color:rgb(from var(--color-ink) r g b / 0.3);text-underline-offset:3px">Problem melden</button> · <a href="/feed.ics">Kalender abonnieren</a> · <a href="/feed.xml">RSS</a> · <a href="/llms.txt">llms.txt</a> · <a href="/impressum">Impressum</a>
  </span>
</footer>

<dialog id="digest-dialog" style="margin:auto;padding:0;border:1px solid var(--color-rule);border-radius:0.5rem;background:var(--color-paper);color:var(--color-ink);width:min(28rem,calc(100vw - 2rem));box-shadow:0 16px 48px -16px rgb(from var(--color-ink) r g b / 0.35);">
  <form id="digest-form" style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem;font-family:var(--font-body)">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem">
      <h2 style="font-family:var(--font-display);font-style:italic;font-size:1.4rem;font-weight:500;margin:0;line-height:1.15">Veranstaltungen abonnieren</h2>
      <button type="button" data-digest-close aria-label="Schließen" style="background:transparent;border:0;cursor:pointer;color:rgb(from var(--color-ink) r g b / 0.55);padding:0.25rem;margin:-0.25rem;font-size:1.25rem;line-height:1">×</button>
    </div>

    <p style="margin:-0.25rem 0 0;font-size:0.875rem;line-height:1.5;color:rgb(from var(--color-ink) r g b / 0.75)">Push-Nachrichten direkt aufs Gerät — keine E-Mail, kein Konto. Jederzeit abbestellbar.</p>

    <fieldset style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:0.4rem" aria-label="Digest-Zeitpunkte">
      <label class="digest-option">
        <input type="checkbox" name="schedule" value="morning" />
        <span class="digest-option__main">
          <span class="digest-option__title">Jeden Morgen</span>
          <span class="digest-option__time">07:00</span>
        </span>
        <span class="digest-option__sub">Heutige Termine</span>
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

    <div id="digest-ios-hint" hidden style="padding:0.75rem 0.9rem;font-size:0.8125rem;line-height:1.5;background:var(--color-paper-2);border-radius:0.4rem;color:rgb(from var(--color-ink) r g b / 0.8)">
      <strong style="font-weight:600">Auf iPhone/iPad:</strong> Tippe »Teilen« und »Zum Home-Bildschirm hinzufügen«. Öffne die Seite anschließend über das App-Icon — erst dann sind Push-Nachrichten möglich.
    </div>

    <div id="digest-unsupported" hidden style="padding:0.75rem 0.9rem;font-size:0.8125rem;line-height:1.5;background:var(--color-paper-2);border-radius:0.4rem;color:var(--color-rotwein)">
      Dein Browser unterstützt keine Push-Nachrichten. Probier es in Safari (macOS), Chrome, Firefox oder Edge.
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.8rem;margin-top:0.25rem">
      <p id="digest-status" hidden style="margin:0;font-size:0.8125rem;color:rgb(from var(--color-ink) r g b / 0.7);flex:1;min-width:0" aria-live="polite"></p>
      <button type="button" id="digest-unsubscribe-all" hidden style="background:transparent;border:0;padding:0.5rem 0;font-size:0.6875rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55);cursor:pointer;font-family:var(--font-body)">Alle abbestellen</button>
      <button type="submit" id="digest-submit" style="margin-left:auto;padding:0.5rem 1.25rem;font-size:0.6875rem;letter-spacing:0.18em;text-transform:uppercase;background:var(--color-rotwein);color:var(--color-paper);border:1px solid var(--color-rotwein);border-radius:999px;cursor:pointer;font-family:var(--font-body)">Abonnieren</button>
    </div>
  </form>
</dialog>

<dialog id="contact-dialog" style="margin:auto;padding:0;border:1px solid var(--color-rule);border-radius:0.5rem;background:var(--color-paper);color:var(--color-ink);width:min(28rem,calc(100vw - 2rem));box-shadow:0 16px 48px -16px rgb(from var(--color-ink) r g b / 0.35);">
  <form id="contact-form" style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem;font-family:var(--font-body)" novalidate>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem">
      <h2 style="font-family:var(--font-display);font-style:italic;font-size:1.4rem;font-weight:500;margin:0;line-height:1.15">Feedback &amp; Korrekturen</h2>
      <button type="button" data-contact-close aria-label="Schließen" style="background:transparent;border:0;cursor:pointer;color:rgb(from var(--color-ink) r g b / 0.55);padding:0.25rem;margin:-0.25rem;font-size:1.25rem;line-height:1">×</button>
    </div>
    <p style="margin:-0.25rem 0 0;font-size:0.875rem;line-height:1.5;color:rgb(from var(--color-ink) r g b / 0.75)">Fehlende Veranstaltung, falsche Zeit, Tippfehler? Wir freuen uns über jeden Hinweis.</p>
    <label style="display:flex;flex-direction:column;gap:0.35rem">
      <span style="font-size:0.625rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55)">Kategorie</span>
      <select id="contact-category" name="category" required style="padding:0.55rem 0.7rem;border-radius:0.4rem;border:1px solid var(--color-rule);background:var(--color-paper-2);color:var(--color-ink);font:inherit">
        <option value="Veranstaltung">Veranstaltung — fehlt oder falsch</option>
        <option value="Quelle">Quelle — neue Seite vorschlagen</option>
        <option value="Allgemein">Allgemein — Feedback / Funktionen</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;gap:0.35rem">
      <span style="font-size:0.625rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55)">E-Mail (optional, für Rückfragen)</span>
      <input type="email" id="contact-email" name="email" placeholder="dein@email.de" style="padding:0.55rem 0.7rem;border-radius:0.4rem;border:1px solid var(--color-rule);background:var(--color-paper-2);color:var(--color-ink);font:inherit" />
    </label>
    <label style="display:flex;flex-direction:column;gap:0.35rem">
      <span style="font-size:0.625rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55)">Nachricht</span>
      <textarea id="contact-message" name="message" required rows="4" placeholder="Was stimmt nicht?" style="padding:0.55rem 0.7rem;border-radius:0.4rem;border:1px solid var(--color-rule);background:var(--color-paper-2);color:var(--color-ink);font:inherit;resize:vertical;min-height:5rem"></textarea>
    </label>
    <input type="hidden" id="contact-context" name="context" />
    <div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey)}" data-size="flexible" data-theme="auto"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.8rem;margin-top:0.25rem">
      <p id="contact-status" hidden style="margin:0;font-size:0.8125rem;color:rgb(from var(--color-ink) r g b / 0.7);flex:1;min-width:0" aria-live="polite"></p>
      <button type="submit" id="contact-submit" style="margin-left:auto;padding:0.5rem 1.25rem;font-size:0.6875rem;letter-spacing:0.18em;text-transform:uppercase;background:var(--color-rotwein);color:var(--color-paper);border:1px solid var(--color-rotwein);border-radius:999px;cursor:pointer;font-family:var(--font-body)">Senden</button>
    </div>
  </form>
</dialog>

<script src="/client.js" defer></script>
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

/** Render the swappable content body — chip row, date strip, day
 *  headline, event list. This is what htmx grafts in on date/chip
 *  clicks, and it's also what the full-page renderer wraps in
 *  `<div id="content-body">` so the markup is identical between full
 *  and partial responses. */
export function renderPartial(props: PageProps): string {
  const { date, category, events, categoryCounts, dateCounts } = props;
  return [
    render(<ChipRow active={category} date={date} counts={categoryCounts} />, "ink-up", 60),
    render(<DateStrip current={date} category={category} counts={dateCounts} />, "ink-up", 120),
    render(<DayHeadline date={date} total={events.length} />, "ink-up", 180),
    `<section class="ink-up" style="animation-delay:240ms">${render(<EventList events={events} date={date} />, "")}</section>`,
  ].join("\n");
}

/** FAQ accordion — native <details>/<summary> so it works without JS;
 *  the visual treatment comes from .faq-* rules in app.css. Section
 *  also emits FAQPage JSON-LD into <head> for SEO. */
function renderFaq(items: FaqItem[]): string {
  return `<section class="faq ink-up" style="animation-delay:300ms">
  <h2 class="faq-title">Fragen &amp; Antworten</h2>
  ${items
    .map(
      (it) => `<details class="faq-item">
    <summary>
      <span class="faq-q">${escapeHtml(it.q)}</span>
      <span class="faq-toggle" aria-hidden="true"></span>
    </summary>
    <div class="faq-a">${escapeHtml(it.a)}</div>
  </details>`,
    )
    .join("\n  ")}
</section>`;
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
