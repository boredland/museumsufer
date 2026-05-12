import {
  buildFaqPageSchema,
  buildLangParam,
  digestScheduleLabel,
  renderHreflangLinks,
  renderLangSwitchLinks,
  THEME_FOUC_SCRIPT,
} from "@museumsufer/core";
import { CATEGORIES, CATEGORY_BY_SLUG } from "./categories";
import { ChipRow, DateStrip, DayHeadline, EventList } from "./components";
import { todayIso } from "./date";
import { DEFAULT_LOCALE, type FaqEntry, type Locale, SUPPORTED_LOCALES, type Translations } from "./i18n";
import { APP_URL, formatDateLong, jsonLdSafe } from "./shared";
import type { Event } from "./types";

const langSuffix = (locale: Locale, sep: "?" | "&" = "?") => buildLangParam(locale, DEFAULT_LOCALE, sep);

export const buildHreflangs = (currentPath: string): string =>
  renderHreflangLinks({ currentPath, appUrl: APP_URL, supported: SUPPORTED_LOCALES, fallback: DEFAULT_LOCALE });

export const buildLangSwitchHtml = (locale: Locale, currentPath: string): string =>
  renderLangSwitchLinks({ locale, currentPath, supported: SUPPORTED_LOCALES, fallback: DEFAULT_LOCALE });

interface PageProps {
  date: string;
  category?: string;
  events: Event[];
  categoryCounts: Map<string, number>;
  dateCounts: Map<string, number>;
  turnstileSiteKey: string;
  locale: Locale;
  tr: Translations;
}

export function renderPage(props: PageProps): string {
  const { date, category, events, turnstileSiteKey, locale, tr } = props;
  const cat = category ? CATEGORY_BY_SLUG.get(category) : undefined;
  const isHome = !category && date === todayIso();
  const title = cat
    ? `${cat.label} — ${formatDateLong(date)} · landau.today`
    : isHome
      ? tr.homeTitle
      : `${formatDateLong(date)} · landau.today`;
  const description = cat ? `${cat.label} — ${formatDateLong(date)}. ${tr.homeDescription}` : tr.homeDescription;
  const lang = langSuffix(locale);
  const langAmp = langSuffix(locale, "&");
  const canonical = cat ? `${APP_URL}/c/${cat.slug}?date=${date}${langAmp}` : `${APP_URL}/?date=${date}${langAmp}`;
  const currentPath = cat ? `/c/${cat.slug}?date=${date}` : `/?date=${date}`;
  const jsonLd = buildJsonLd(events.slice(0, 50));
  const faqLd = jsonLdSafe(buildFaqPageSchema(tr.faq));

  return `<!doctype html>
<html lang="${locale}">
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
<meta property="og:locale" content="${locale === "fr" ? "fr_FR" : "de_DE"}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
${buildHreflangs(currentPath)}
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
<a class="sr-only" href="#content">${escapeHtml(tr.skipToContent)}</a>
<div class="htmx-progress" aria-hidden="true"></div>
<div class="search-bar ink-up" style="animation-delay:0ms">
  <label for="q" class="sr-only">${escapeHtml(tr.searchLabel)}</label>
  <input id="q" type="search" class="search-input js-search" placeholder="${escapeHtml(tr.searchPlaceholder)}" autocomplete="off" />
  <kbd class="search-kbd">⌘K</kbd>
  <span class="search-empty" hidden>${escapeHtml(tr.searchEmpty)}</span>
</div>
<header class="masthead ink-up" style="animation-delay:0ms">
  <h1>
    <a href="/${lang}">Landau<span class="ampersand">&amp;</span>heute</a>
  </h1>
  <p class="subtitle">${escapeHtml(tr.subtitle)}</p>
  <p class="colophon">${escapeHtml(formatDateLong(todayIso()))}</p>
  <nav class="langswitch" aria-label="${escapeHtml(tr.langSwitchAria)}">${buildLangSwitchHtml(locale, currentPath)}</nav>
  <button type="button" class="theme-toggle js-theme" aria-label="${escapeHtml(tr.themeToggle)}" title="${escapeHtml(tr.themeToggle)}">
    <span class="icon-sun" aria-hidden="true">☀</span>
    <span class="icon-moon" aria-hidden="true">☾</span>
  </button>
</header>
<main id="content" style="max-width:48rem;margin:0 auto;padding:0 1rem">
<div id="content-body">
${renderPartial(props)}
</div>
${renderFaq(tr.faq, tr)}
</main>
<footer class="colophon-foot" style="max-width:48rem;margin:0 auto;padding:0 1rem 2rem">
  <span>${escapeHtml(tr.footerLine)}</span>
  <span>
    <button type="button" data-digest-open style="background:transparent;border:0;padding:0;cursor:pointer;font:inherit;color:inherit;text-decoration:underline;text-decoration-color:rgb(from var(--color-ink) r g b / 0.3);text-underline-offset:3px">${escapeHtml(tr.digestSubscribe)}</button> · <button type="button" data-contact-open style="background:transparent;border:0;padding:0;cursor:pointer;font:inherit;color:inherit;text-decoration:underline;text-decoration-color:rgb(from var(--color-ink) r g b / 0.3);text-underline-offset:3px">${escapeHtml(tr.reportProblem)}</button> · <a href="/feed.ics">${escapeHtml(tr.subscribeCalendar)}</a> · <a href="/feed.xml">RSS</a> · <a href="/llms.txt">llms.txt</a> · <a href="/impressum${lang}">${escapeHtml(tr.imprint)}</a>
  </span>
</footer>

<dialog id="digest-dialog" style="margin:auto;padding:0;border:1px solid var(--color-rule);border-radius:0.5rem;background:var(--color-paper);color:var(--color-ink);width:min(28rem,calc(100vw - 2rem));box-shadow:0 16px 48px -16px rgb(from var(--color-ink) r g b / 0.35);">
  <form id="digest-form" style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem;font-family:var(--font-body)">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem">
      <h2 style="font-family:var(--font-display);font-style:italic;font-size:1.4rem;font-weight:500;margin:0;line-height:1.15">${escapeHtml(tr.digestDialogTitle)}</h2>
      <button type="button" data-digest-close aria-label="${escapeHtml(tr.close)}" style="background:transparent;border:0;cursor:pointer;color:rgb(from var(--color-ink) r g b / 0.55);padding:0.25rem;margin:-0.25rem;font-size:1.25rem;line-height:1">×</button>
    </div>

    <p style="margin:-0.25rem 0 0;font-size:0.875rem;line-height:1.5;color:rgb(from var(--color-ink) r g b / 0.75)">${escapeHtml(tr.digestDialogIntro)}</p>

    <fieldset style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:0.4rem" aria-label="${escapeHtml(tr.digestSchedulesLabel)}">
      <label class="digest-option">
        <input type="checkbox" name="schedule" value="morning" />
        <span class="digest-option__main">
          <span class="digest-option__title">${escapeHtml(tr.digestMorning)}</span>
          <span class="digest-option__time">07:00</span>
        </span>
        <span class="digest-option__sub">${escapeHtml(tr.digestMorningSub)}</span>
      </label>
      <label class="digest-option">
        <input type="checkbox" name="schedule" value="afternoon" />
        <span class="digest-option__main">
          <span class="digest-option__title">${escapeHtml(tr.digestAfternoon)}</span>
          <span class="digest-option__time">17:00</span>
        </span>
        <span class="digest-option__sub">${escapeHtml(tr.digestAfternoonSub)}</span>
      </label>
      <label class="digest-option">
        <input type="checkbox" name="schedule" value="weekly" />
        <span class="digest-option__main">
          <span class="digest-option__title">${escapeHtml(tr.digestWeekly)}</span>
          <span class="digest-option__time">So 09:00</span>
        </span>
        <span class="digest-option__sub">${escapeHtml(tr.digestWeeklySub)}</span>
      </label>
    </fieldset>

    <details class="digest-filter">
      <summary class="digest-filter__summary">
        <span class="digest-filter__label">${escapeHtml(tr.digestRestrictCategories)}</span>
        <span class="digest-filter__hint">${escapeHtml(tr.digestRestrictHint)}</span>
      </summary>
      <fieldset class="digest-filter__chips" aria-label="${escapeHtml(tr.ariaCategory)}">
        ${CATEGORIES.map((c) => {
          const localized = tr.categories[c.slug]?.short ?? c.short;
          return `<label class="digest-chip">
          <input type="checkbox" name="filter-category" value="${c.slug}" />
          <span class="digest-chip__glyph">${c.glyph}</span>
          <span class="digest-chip__label">${escapeHtml(localized)}</span>
        </label>`;
        }).join("")}
      </fieldset>
    </details>

    <div id="digest-ios-hint" hidden style="padding:0.75rem 0.9rem;font-size:0.8125rem;line-height:1.5;background:var(--color-paper-2);border-radius:0.4rem;color:rgb(from var(--color-ink) r g b / 0.8)">
      ${escapeHtml(tr.digestIosHint)}
    </div>

    <div id="digest-unsupported" hidden style="padding:0.75rem 0.9rem;font-size:0.8125rem;line-height:1.5;background:var(--color-paper-2);border-radius:0.4rem;color:var(--color-rotwein)">
      ${escapeHtml(tr.digestBrowserUnsupported)}
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.8rem;margin-top:0.25rem">
      <p id="digest-status" hidden style="margin:0;font-size:0.8125rem;color:rgb(from var(--color-ink) r g b / 0.7);flex:1;min-width:0" aria-live="polite"></p>
      <button type="button" id="digest-unsubscribe-all" hidden style="background:transparent;border:0;padding:0.5rem 0;font-size:0.6875rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55);cursor:pointer;font-family:var(--font-body)">${escapeHtml(tr.digestUnsubscribeAll)}</button>
      <button type="submit" id="digest-submit" style="margin-left:auto;padding:0.5rem 1.25rem;font-size:0.6875rem;letter-spacing:0.18em;text-transform:uppercase;background:var(--color-rotwein);color:var(--color-paper);border:1px solid var(--color-rotwein);border-radius:999px;cursor:pointer;font-family:var(--font-body)">${escapeHtml(tr.digestSubscribeBtn)}</button>
    </div>
  </form>
</dialog>

<dialog id="contact-dialog" style="margin:auto;padding:0;border:1px solid var(--color-rule);border-radius:0.5rem;background:var(--color-paper);color:var(--color-ink);width:min(28rem,calc(100vw - 2rem));box-shadow:0 16px 48px -16px rgb(from var(--color-ink) r g b / 0.35);">
  <form id="contact-form" style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem;font-family:var(--font-body)" novalidate>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem">
      <h2 style="font-family:var(--font-display);font-style:italic;font-size:1.4rem;font-weight:500;margin:0;line-height:1.15">${escapeHtml(tr.contactTitle)}</h2>
      <button type="button" data-contact-close aria-label="${escapeHtml(tr.close)}" style="background:transparent;border:0;cursor:pointer;color:rgb(from var(--color-ink) r g b / 0.55);padding:0.25rem;margin:-0.25rem;font-size:1.25rem;line-height:1">×</button>
    </div>
    <p style="margin:-0.25rem 0 0;font-size:0.875rem;line-height:1.5;color:rgb(from var(--color-ink) r g b / 0.75)">${escapeHtml(tr.contactIntro)}</p>
    <label style="display:flex;flex-direction:column;gap:0.35rem">
      <span style="font-size:0.625rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55)">${escapeHtml(tr.ariaCategory)}</span>
      <select id="contact-category" name="category" required style="padding:0.55rem 0.7rem;border-radius:0.4rem;border:1px solid var(--color-rule);background:var(--color-paper-2);color:var(--color-ink);font:inherit">
        <option value="Veranstaltung">${escapeHtml(tr.contactCategoryEvent)}</option>
        <option value="Quelle">${escapeHtml(tr.contactCategorySource)}</option>
        <option value="Allgemein">${escapeHtml(tr.contactCategoryGeneral)}</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;gap:0.35rem">
      <span style="font-size:0.625rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55)">${escapeHtml(tr.contactEmailLabel)}</span>
      <input type="email" id="contact-email" name="email" placeholder="dein@email.de" style="padding:0.55rem 0.7rem;border-radius:0.4rem;border:1px solid var(--color-rule);background:var(--color-paper-2);color:var(--color-ink);font:inherit" />
    </label>
    <label style="display:flex;flex-direction:column;gap:0.35rem">
      <span style="font-size:0.625rem;letter-spacing:0.16em;text-transform:uppercase;color:rgb(from var(--color-ink) r g b / 0.55)">${escapeHtml(tr.contactMessageLabel)}</span>
      <textarea id="contact-message" name="message" required rows="4" placeholder="${escapeHtml(tr.contactIntro)}" style="padding:0.55rem 0.7rem;border-radius:0.4rem;border:1px solid var(--color-rule);background:var(--color-paper-2);color:var(--color-ink);font:inherit;resize:vertical;min-height:5rem"></textarea>
    </label>
    <input type="hidden" id="contact-context" name="context" />
    <div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey)}" data-size="flexible" data-theme="auto"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.8rem;margin-top:0.25rem">
      <p id="contact-status" hidden style="margin:0;font-size:0.8125rem;color:rgb(from var(--color-ink) r g b / 0.7);flex:1;min-width:0" aria-live="polite"></p>
      <button type="submit" id="contact-submit" style="margin-left:auto;padding:0.5rem 1.25rem;font-size:0.6875rem;letter-spacing:0.18em;text-transform:uppercase;background:var(--color-rotwein);color:var(--color-paper);border:1px solid var(--color-rotwein);border-radius:999px;cursor:pointer;font-family:var(--font-body)">${escapeHtml(tr.contactSendBtn)}</button>
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

function renderDigestCue(delayMs: number, tr: Translations, locale: Locale): string {
  return `<button type="button" class="digest-cue ink-up" data-digest-open style="animation-delay:${delayMs}ms" aria-label="${escapeHtml(tr.digestDialogTitle)}">
  <span class="digest-cue__mark" aria-hidden="true">※</span>
  <span class="digest-cue__kicker">${escapeHtml(tr.digestKicker)}</span>
  <span class="digest-cue__rule" aria-hidden="true"></span>
  <span class="digest-cue__text">${escapeHtml(tr.digestCueText)}</span>
  <span class="digest-cue__schedules" aria-hidden="true">${escapeHtml(digestScheduleLabel(locale))}</span>
  <span class="digest-cue__chevron" aria-hidden="true">→</span>
</button>`;
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
  const { date, category, events, categoryCounts, dateCounts, tr, locale } = props;
  return [
    render(<ChipRow active={category} date={date} counts={categoryCounts} tr={tr} locale={locale} />, "ink-up", 60),
    render(<DateStrip current={date} category={category} counts={dateCounts} tr={tr} locale={locale} />, "ink-up", 120),
    renderDigestCue(180, tr, locale),
    render(<DayHeadline date={date} total={events.length} tr={tr} locale={locale} />, "ink-up", 200),
    `<section class="ink-up" style="animation-delay:240ms">${render(<EventList events={events} date={date} tr={tr} locale={locale} />, "")}</section>`,
  ].join("\n");
}

/** FAQ accordion — native <details>/<summary> so it works without JS;
 *  the visual treatment comes from .faq-* rules in app.css. Section
 *  also emits FAQPage JSON-LD into <head> for SEO. */
function renderFaq(items: FaqEntry[], tr: Translations): string {
  return `<section class="faq ink-up" style="animation-delay:300ms">
  <h2 class="faq-title">${escapeHtml(tr.faqTitle)}</h2>
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
  return jsonLdSafe({ "@context": "https://schema.org", "@graph": items });
}
