import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CLIENT_SCRIPT } from "./client-script";
import { ContentBody, MuseumsSection } from "./components";
import { berlinNow, todayIso } from "./date";
import { dateLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "./i18n";
import { ICON, IconSprite } from "./icons";
import { getMuseumConfig, getMuseumLocations } from "./museum-config";
import { formatDateFull } from "./shared";
import { kbdClass, passLinkClass } from "./tw";
import type { EventWithLikes, ExhibitionWithLikes, MuseumInfo } from "./types";

export type { MuseumInfo };

const MUSEUM_LOCATIONS = getMuseumLocations();

export interface InitialData {
  date: string;
  exhibitions: unknown[];
  events: unknown[];
}

const PASS_URLS: Record<Locale, { card: string; ticket: string }> = {
  de: {
    card: "de/eintritt-und-tickets/dauerkarten/museumsufercard/",
    ticket: "de/eintritt-und-tickets/dauerkarten/museumsuferticket/",
  },
  en: {
    card: "en/admission-tickets/season-tickets/museumsufercard/",
    ticket: "en/admission-tickets/season-tickets/museumsuferticket/",
  },
  fr: {
    card: "fr/tickets/tickets-permanentes/museumsufercard/",
    ticket: "fr/tickets/tickets-permanentes/museumsufer-ticket/",
  },
};

function Mark({ class: cls }: { class?: string }) {
  return (
    <svg viewBox="0 0 96 80" role="img" aria-label="Museumsufer" class={cls} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mark-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.5" />
          <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
        <clipPath id="mark-clip">
          <rect x="0" y="48" width="96" height="40" />
        </clipPath>
      </defs>
      <g fill="currentColor">
        <path d="M48 6 L72 22 L24 22 Z" />
        <rect x="22" y="24" width="52" height="3.5" />
        <rect x="26" y="29" width="3.5" height="14" />
        <rect x="35" y="29" width="3.5" height="14" />
        <rect x="46.25" y="29" width="3.5" height="14" />
        <rect x="57.5" y="29" width="3.5" height="14" />
        <rect x="66.5" y="29" width="3.5" height="14" />
        <rect x="20" y="44" width="56" height="3.5" />
      </g>
      <g clip-path="url(#mark-clip)">
        <g fill="url(#mark-fade)">
          <rect x="20" y="49" width="56" height="3.5" />
          <rect x="26" y="53" width="3.5" height="14" />
          <rect x="35" y="53" width="3.5" height="14" />
          <rect x="46.25" y="53" width="3.5" height="14" />
          <rect x="57.5" y="53" width="3.5" height="14" />
          <rect x="66.5" y="53" width="3.5" height="14" />
          <rect x="22" y="68" width="52" height="3.5" />
          <path d="M48 86 L72 70 L24 70 Z" />
        </g>
      </g>
    </svg>
  );
}

function Masthead({ locale, tr }: { locale: Locale; tr: Record<string, string> }) {
  return (
    <header class="mb-12 max-[480px]:mb-9">
      <div class="flex items-center justify-between gap-4 mb-4">
        <div class="flex items-center gap-2.5 min-w-0">
          <Mark class="text-river w-7 h-[1.45rem] shrink-0" />
          <p class="section-eyebrow truncate">Frankfurt am Main · 50.10°N 8.68°E</p>
        </div>
        <div class="flex items-center gap-4 shrink-0">
          <ThemeToggle tr={tr} />
          <LangSwitch locale={locale} />
        </div>
      </div>
      <h1 class="font-display italic font-normal leading-[0.95] tracking-[-0.02em] text-text-primary text-[clamp(2.6rem,9vw,4rem)]">
        Museumsufer Frankfurt
      </h1>
      <div class="flex items-center gap-3 mt-4">
        <div class="river-band flex-1" aria-hidden="true" />
        <span class="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-text-tertiary shrink-0">
          {tr.subtitle}
        </span>
        <div class="river-band flex-1" aria-hidden="true" />
      </div>
    </header>
  );
}

function ThemeToggle({ tr }: { tr: Record<string, string> }) {
  return (
    <button
      type="button"
      id="theme-toggle"
      class="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-text-tertiary hover:text-river transition-colors cursor-pointer"
      title={tr.switchTheme}
    >
      <span class="dark:hidden">{tr.themeDark}</span>
      <span class="hidden dark:inline">{tr.themeLight}</span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="w-3.5 h-3.5"
        aria-hidden="true"
      >
        <path
          class="dark:hidden"
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
          fill="currentColor"
          stroke="none"
        />
        <circle class="hidden dark:block" cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
        <path
          class="hidden dark:block"
          d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          stroke="currentColor"
        />
      </svg>
    </button>
  );
}

function LangSwitch({ locale }: { locale: Locale }) {
  return (
    <nav class="flex gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em]" aria-label="Language">
      {SUPPORTED_LOCALES.map((l) => (
        <a
          href={`?lang=${l}`}
          data-lang={l}
          class={`no-underline transition-colors focus-visible:outline-2 focus-visible:outline-river focus-visible:outline-offset-2 ${l === locale ? "text-text-primary" : "text-text-tertiary hover:text-river"}`}
          aria-current={l === locale ? "page" : undefined}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}

function SearchBar({ tr }: { tr: Record<string, string> }) {
  return (
    <div class="search-bar mb-6">
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        width="14"
        height="14"
        aria-hidden="true"
        class="text-text-tertiary shrink-0"
      >
        <path d={ICON.search} />
      </svg>
      <input
        type="search"
        id="search-input"
        autocomplete="off"
        placeholder={tr.searchPlaceholder}
        aria-label={tr.search}
      />
      <button
        type="button"
        id="search-clear"
        class="text-text-tertiary hover:text-river hidden cursor-pointer transition-colors"
        aria-label="Clear search"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
          <path d={ICON.close} />
        </svg>
      </button>
      <kbd class={`${kbdClass} max-[1024px]:hidden`}>⌘K</kbd>
    </div>
  );
}

function PassPromo({ locale, tr }: { locale: Locale; tr: Record<string, string> }) {
  const urls = PASS_URLS[locale];
  const utm = "?utm_source=museumsufer.app&utm_medium=referral&utm_campaign=pass_promo&utm_content=";
  return (
    <aside class="my-12 px-2 py-8 border-y border-border-light text-center">
      <p class="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-text-tertiary mb-3">Card · Ticket</p>
      <p class="font-display italic text-[1.5rem] leading-tight text-text-primary mb-1 max-w-[28ch] mx-auto">
        {tr.passPromo}
      </p>
      <div class="flex justify-center gap-3 mt-5 flex-wrap">
        <a
          href={`https://www.museumsufer.de/${urls.card}${utm}card`}
          target="_blank"
          rel="noopener"
          class={passLinkClass}
        >
          {tr.passCard}
        </a>
        <a
          href={`https://www.museumsufer.de/${urls.ticket}${utm}ticket`}
          target="_blank"
          rel="noopener"
          class={passLinkClass}
        >
          {tr.passTicket}
        </a>
      </div>
    </aside>
  );
}

function RiverNav({
  locale,
  tr,
  activeDate,
  activeRange,
}: {
  locale: Locale;
  tr: Record<string, string>;
  activeDate: string;
  activeRange?: number;
}) {
  const dl = dateLocale(locale);
  const now = berlinNow();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = now.add(i, "day");
    return {
      iso: d.format("YYYY-MM-DD"),
      weekday: i === 0 ? tr.today : d.toDate().toLocaleDateString(dl, { weekday: "short" }),
      day: String(d.date()),
    };
  });

  return (
    <nav class="mb-7" aria-label={tr.dateNav}>
      <div class="relative pb-3">
        <div class="river-band absolute left-0 right-0 bottom-1.5" aria-hidden="true" />
        <div class="relative flex items-end justify-between gap-0.5">
          {days.map((d, i) => (
            <button
              type="button"
              data-date={d.iso}
              class={`date-stop${!activeRange && d.iso === activeDate ? " active" : ""}${i === 0 ? " is-today" : ""}`}
            >
              <span class="stop-day">{d.day}</span>
              <span class="stop-weekday">{d.weekday}</span>
            </button>
          ))}
        </div>
      </div>
      <div class="flex items-center gap-2 mt-5 flex-wrap">
        <button
          type="button"
          id="btn-upcoming"
          data-range="7"
          aria-pressed={activeRange ? "true" : "false"}
          class={`range-pill${activeRange ? " active" : ""}`}
        >
          {tr.upcoming}
        </button>
        <button
          type="button"
          id="btn-near"
          aria-pressed="false"
          aria-label={tr.nearMe}
          title={tr.nearMe}
          class="range-pill"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true">
            <path d={ICON.gps} />
          </svg>
          <span class="max-[480px]:sr-only">{tr.nearMe}</span>
        </button>
      </div>
    </nav>
  );
}

function LlmTip({ tr }: { tr: Record<string, string> }) {
  return (
    <details class="mt-4 py-2.5 px-4 bg-surface rounded-xl shadow-card text-[0.8125rem] text-text-secondary open:[&>summary]:mb-3">
      <summary class="cursor-pointer font-medium text-text-tertiary text-xs uppercase tracking-wide flex items-center gap-1.5">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class="w-3.5 h-3.5 shrink-0">
          <path
            d="M8 1v4M8 11v4M1 8h4M11 8h4M3 3l2.5 2.5M10.5 10.5L13 13M13 3l-2.5 2.5M5.5 10.5L3 13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        {tr.llmTip}
      </summary>
      <div
        class="relative bg-border-light rounded-lg p-3 font-mono text-xs leading-relaxed text-text-primary whitespace-pre-wrap break-words"
        id="llm-prompt"
        data-prompt={tr.llmPrompt}
      >
        {tr.llmPrompt}
        <button
          type="button"
          class="absolute top-2 right-2 bg-surface border border-border rounded px-2 py-1 text-[0.6875rem] font-sans cursor-pointer text-text-secondary transition-colors hover:border-river hover:text-river"
          onclick="copyPrompt()"
          aria-label={tr.copyPrompt}
        >
          {tr.copyPrompt}
        </button>
      </div>
    </details>
  );
}

function AboutSection({ tr }: { tr: Record<string, string> }) {
  return (
    <section class="mt-12">
      <h2 class="font-display italic text-[1.25rem] leading-tight text-text-primary mb-3">{tr.aboutHeading}</h2>
      <p class="text-[0.8125rem] text-text-secondary leading-relaxed">{tr.introText}</p>
    </section>
  );
}

function FaqSection({ tr }: { tr: Record<string, string> }) {
  const items = [
    { q: tr.faq1Q, a: tr.faq1A },
    { q: tr.faq2Q, a: tr.faq2A },
    { q: tr.faq3Q, a: tr.faq3A },
    { q: tr.faq4Q, a: tr.faq4A },
    { q: tr.faq5Q, a: tr.faq5A },
    { q: tr.faq6Q, a: tr.faq6A },
    { q: tr.faq7Q, a: tr.faq7A },
  ];
  return (
    <section class="mt-8">
      <h2 class="font-display italic text-[1.25rem] leading-tight text-text-primary mb-4">{tr.faqTitle}</h2>
      <dl class="flex flex-col gap-4">
        {items.map((item) => (
          <div>
            <dt class="text-[0.8125rem] font-medium text-text-primary">{item.q}</dt>
            <dd class="mt-1 text-[0.8125rem] text-text-secondary leading-relaxed">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function renderPage(
  locale: Locale,
  initialData?: InitialData,
  museums?: Record<string, MuseumInfo>,
  _sort?: string,
  range?: number,
): HtmlEscapedString {
  const tr = getTranslations(locale);
  const trJson = JSON.stringify(tr);
  const dlJson = JSON.stringify(dateLocale(locale));
  const localesJson = JSON.stringify(SUPPORTED_LOCALES);
  const berlinOffset = getBerlinUtcOffset();
  const eventSchemaJson = initialData ? buildEventSchema(initialData, berlinOffset) : "";
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://museumsufer.app/#publisher",
    name: "Jonas Strassel",
    email: "feedback@ins.museum",
    url: "https://museumsufer.app/impressum",
    sameAs: ["https://github.com/boredland"],
  };
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://museumsufer.app/#org",
    name: "Museumsufer Frankfurt",
    url: "https://museumsufer.app/",
    logo: { "@type": "ImageObject", url: "https://museumsufer.app/og-image.png", width: 1200, height: 630 },
    founder: { "@id": "https://museumsufer.app/#publisher" },
    sameAs: ["https://github.com/boredland/museumsufer"],
  };
  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": "https://museumsufer.app/#webapp",
    name: "Museumsufer Frankfurt",
    url: "https://museumsufer.app/",
    description: tr.metaLong,
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "All",
    inLanguage: ["de", "en", "fr"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    publisher: { "@id": "https://museumsufer.app/#org" },
  };
  const websiteSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Museumsufer Frankfurt",
    url: "https://museumsufer.app/",
    description: tr.metaLong,
    dateModified: todayIso(),
    inLanguage: ["de", "en", "fr"],
    publisher: { "@id": "https://museumsufer.app/#org" },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://museumsufer.app/?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  });
  const publisherSchema = JSON.stringify(personSchema);
  const orgSchemaJson = JSON.stringify(orgSchema);
  const webAppSchemaJson = JSON.stringify(webAppSchema);
  const faqSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: tr.faq1Q, acceptedAnswer: { "@type": "Answer", text: tr.faq1A } },
      { "@type": "Question", name: tr.faq2Q, acceptedAnswer: { "@type": "Answer", text: tr.faq2A } },
      { "@type": "Question", name: tr.faq3Q, acceptedAnswer: { "@type": "Answer", text: tr.faq3A } },
      { "@type": "Question", name: tr.faq4Q, acceptedAnswer: { "@type": "Answer", text: tr.faq4A } },
      { "@type": "Question", name: tr.faq5Q, acceptedAnswer: { "@type": "Answer", text: tr.faq5A } },
      { "@type": "Question", name: tr.faq6Q, acceptedAnswer: { "@type": "Answer", text: tr.faq6A } },
      { "@type": "Question", name: tr.faq7Q, acceptedAnswer: { "@type": "Answer", text: tr.faq7A } },
    ],
  });

  const dataInit = `const T = ${trJson};
    const DATE_LOCALE = ${dlJson};
    const LOCALES = ${localesJson};
    const CURRENT_LANG = '${locale}';
    const BERLIN_TODAY = '${todayIso()}';
    const __INITIAL_DATE__ = ${initialData ? JSON.stringify(initialData.date) : "null"};`;

  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{tr.pageTitle}</title>
          <meta name="description" content={tr.metaLong} />
          <link
            rel="canonical"
            href={locale === "de" ? "https://museumsufer.app/" : `https://museumsufer.app/?lang=${locale}`}
          />
          <link rel="alternate" hreflang="de" href="https://museumsufer.app/" />
          <link rel="alternate" hreflang="en" href="https://museumsufer.app/?lang=en" />
          <link rel="alternate" hreflang="fr" href="https://museumsufer.app/?lang=fr" />
          <link rel="alternate" hreflang="x-default" href="https://museumsufer.app/" />
          <meta property="og:title" content={tr.pageTitle} />
          <meta property="og:description" content={tr.metaLong} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://museumsufer.app/" />
          <meta property="og:locale" content={locale} />
          <meta property="og:site_name" content="Museumsufer Frankfurt" />
          <meta property="og:image" content="https://museumsufer.app/og-image.png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={tr.pageTitle} />
          <meta name="twitter:description" content={tr.metaLong} />
          <meta name="twitter:image" content="https://museumsufer.app/og-image.png" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
          <link rel="apple-touch-icon" href="/icon-192.png" />
          <link rel="alternate" type="application/rss+xml" title="Museumsufer Frankfurt" href="/feed.xml" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#efe7d8" media="(prefers-color-scheme: light)" />
          <meta name="theme-color" content="#14110e" media="(prefers-color-scheme: dark)" />
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){const t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else if(t==='light'){document.documentElement.classList.add('light')}})()`,
            }}
          />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link
            rel="preload"
            as="style"
            href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
            onload="this.onload=null;this.rel='stylesheet'"
          />
          <noscript>
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
            />
          </noscript>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteSchema }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: publisherSchema }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgSchemaJson }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: webAppSchemaJson }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />
          {eventSchemaJson ? raw(eventSchemaJson) : null}
          <script src="/uFuzzy.iife.min.js" defer />
          <script src="/htmx.min.js" defer />
          <script src="https://formspree.io/js/formbutton-v1.min.js" defer />
          <style
            dangerouslySetInnerHTML={{
              __html: "#formbutton-button{opacity:0!important;pointer-events:none!important;position:fixed!important}",
            }}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.formbutton=window.formbutton||function(){(formbutton.q=formbutton.q||[]).push(arguments)};formbutton("create",{action:"https://formspree.io/f/feedback@ins.museum",title:${JSON.stringify(tr.contactTitle)},fields:[{type:"select",label:${JSON.stringify(tr.contactCategoryLabel)},name:"category",required:true,options:[${JSON.stringify(tr.contactCategoryEvent)},${JSON.stringify(tr.contactCategoryInstitution)},${JSON.stringify(tr.contactCategoryFeedback)}]},{type:"email",label:${JSON.stringify(tr.contactEmailLabel)},name:"email",required:true,placeholder:${JSON.stringify(tr.contactEmailPlaceholder)}},{type:"textarea",label:${JSON.stringify(tr.contactMessageLabel)},name:"message",required:true,placeholder:${JSON.stringify(tr.contactMessagePlaceholder)}},{type:"submit"}]});`,
            }}
          />
          <link rel="preload" as="style" href="/styles.css" />
          <link rel="stylesheet" href="/styles.css" />
        </head>
        <body>
          <IconSprite />
          <a
            href="#content"
            class="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[200] focus:bg-river focus:text-bg focus:py-2 focus:px-4 focus:rounded-br-xl focus:text-sm"
          >
            {tr.skipLink}
          </a>

          <div class="max-w-[720px] mx-auto pt-10 pb-16 px-5 max-[480px]:pt-8 max-[480px]:pb-12">
            <Masthead locale={locale} tr={tr} />

            <RiverNav locale={locale} tr={tr} activeDate={initialData?.date || todayIso()} activeRange={range} />

            <div class="anchor-headline mb-7 mt-8" id="date-label" aria-live="polite">
              {range
                ? tr.upcomingDays.replace("{n}", String(range))
                : initialData
                  ? formatDateFull(initialData.date, dateLocale(locale))
                  : ""}
            </div>

            <SearchBar tr={tr} />

            <div id="search-no-results" class="hidden py-16 px-4 text-center fade-in">
              <div class="empty-state">
                <p>{tr.noResults}</p>
              </div>
            </div>

            <style
              dangerouslySetInnerHTML={{
                __html: "#content>*{opacity:0}.hydrated #content>*{opacity:1;transition:opacity .1s}",
              }}
            />
            <main id="content">
              {initialData ? (
                <ContentBody
                  events={initialData.events as EventWithLikes[]}
                  exhibitions={initialData.exhibitions as ExhibitionWithLikes[]}
                  tr={tr}
                  locale={locale}
                  todayIso={todayIso()}
                  groupByDate={!!range}
                />
              ) : (
                <div class="py-16 px-4 text-center">
                  <div class="river-band mx-auto mb-6 max-w-[200px] opacity-60" aria-hidden="true" />
                  <p class="font-display italic text-xl text-text-tertiary">{tr.loading}…</p>
                </div>
              )}
            </main>

            <PassPromo locale={locale} tr={tr} />

            <MuseumsSection museums={museums || {}} tr={tr} />

            <AboutSection tr={tr} />
            <FaqSection tr={tr} />

            <LlmTip tr={tr} />

            <footer class="mt-12 pt-6 border-t border-border-light flex flex-col gap-3 max-[480px]:items-stretch">
              <div class="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem]">
                <a
                  href="https://calendar.google.com/calendar/r?cid=webcal://museumsufer.app/feed.ics"
                  target="_blank"
                  rel="noopener"
                  class="text-text-secondary no-underline hover:text-river"
                >
                  {tr.subscribeCal}
                </a>
                <a href="/feed.xml" class="text-text-secondary no-underline hover:text-river">
                  {tr.rssFeed}
                </a>
                <button
                  type="button"
                  onclick="document.getElementById('formbutton-button').click()"
                  class="text-text-secondary no-underline hover:text-river bg-transparent border-0 p-0 cursor-pointer text-[0.8125rem] font-sans text-left"
                >
                  {tr.contact}
                </button>
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-text-tertiary">
                <a href="/api/docs" class="no-underline hover:text-river">
                  API
                </a>
                <a
                  href="https://github.com/boredland/museumsufer"
                  target="_blank"
                  rel="noopener"
                  class="no-underline hover:text-river"
                >
                  Source
                </a>
                <a
                  href={locale === "de" ? "/impressum" : `/impressum?lang=${locale}`}
                  class="no-underline hover:text-river"
                >
                  {tr.imprint}
                </a>
              </div>
              <p class="text-[0.75rem] text-text-tertiary">
                {tr.byline} ·{" "}
                <a href="mailto:feedback@ins.museum" class="no-underline hover:text-river text-text-secondary">
                  feedback@ins.museum
                </a>
              </p>
            </footer>
          </div>

          <script dangerouslySetInnerHTML={{ __html: dataInit + CLIENT_SCRIPT }} />
        </body>
      </html>
    </>
  ) as unknown as HtmlEscapedString;
}

function getBerlinUtcOffset(): string {
  const now = new Date();
  const utc = now.toLocaleString("en-US", { timeZone: "UTC" });
  const berlin = now.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
  const diff = (new Date(berlin).getTime() - new Date(utc).getTime()) / 3600000;
  return `+${String(Math.floor(diff)).padStart(2, "0")}:00`;
}

function museumLocationNode(slug: string, name: string): Record<string, unknown> {
  const id = `https://museumsufer.app/#museum/${slug}`;
  const geo = MUSEUM_LOCATIONS[slug];
  const config = getMuseumConfig(slug);
  const node: Record<string, unknown> = { "@type": "Museum", "@id": id, name };
  if (config?.website) node.url = config.website;
  if (geo) {
    node.geo = { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng };
    node.address = { "@type": "PostalAddress", addressLocality: "Frankfurt am Main", addressCountry: "DE" };
  }
  return node;
}

function buildEventSchema(data: InitialData, tz: string): string {
  const schemas: Record<string, unknown>[] = [];
  const emittedMuseums = new Set<string>();

  function ensureMuseum(slug: string, name: string) {
    if (!slug || emittedMuseums.has(slug)) return;
    emittedMuseums.add(slug);
    schemas.push(museumLocationNode(slug, name));
  }

  const exhibitions = data.exhibitions as Array<Record<string, unknown>>;
  if (exhibitions) {
    for (const ex of exhibitions.slice(0, 20)) {
      const museum = (ex.museum_name as string) || "";
      const slug = (ex.museum_slug as string) || "";
      ensureMuseum(slug, museum);
      const museumConfig = getMuseumConfig(slug);
      const museumUrl = museumConfig?.website || "https://museumsufer.app/";
      const exUrl = (ex.detail_url as string) || museumUrl;
      const exSchema: Record<string, unknown> = {
        "@type": "ExhibitionEvent",
        name: ex.title,
        description: (ex.description as string) || `${ex.title} — ${museum}, Frankfurt am Main`,
        url: exUrl,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
      };
      if (ex.start_date) exSchema.startDate = ex.start_date;
      if (ex.end_date) exSchema.endDate = ex.end_date;
      if (ex.image_url) {
        const img = ex.image_url as string;
        exSchema.image = img.startsWith("/") ? `https://museumsufer.app${img}` : img;
      } else {
        exSchema.image = "https://museumsufer.app/og-image.png";
      }
      exSchema.location = slug
        ? { "@id": `https://museumsufer.app/#museum/${slug}` }
        : { "@type": "Place", name: museum };
      exSchema.organizer = { "@type": "Organization", name: museum, url: museumUrl };
      schemas.push(exSchema);
    }
  }

  const events = data.events as Array<Record<string, unknown>>;
  if (events) {
    events.slice(0, 20).forEach((ev) => {
      const date = ev.date as string;
      const time = ev.time as string | null;
      const endTime = ev.end_time as string | null;
      const endDate = ev.end_date as string | null;
      const museum = (ev.museum_name as string) || "";
      const slug = (ev.museum_slug as string) || "";
      ensureMuseum(slug, museum);

      const startIso = time ? `${date}T${time}:00${tz}` : `${date}T09:00:00${tz}`;
      let endIso: string;
      if (endTime) {
        const ed = endDate || date;
        endIso = `${ed}T${endTime}:00${tz}`;
      } else if (time) {
        const h = (parseInt(time.split(":")[0], 10) + 1) % 24;
        endIso = `${date}T${h.toString().padStart(2, "0")}:${time.split(":")[1]}:00${tz}`;
      } else {
        endIso = `${date}T18:00:00${tz}`;
      }

      const museumConfig = getMuseumConfig(slug);
      const museumUrl = museumConfig?.website || "https://museumsufer.app/";
      const evUrl = (ev.detail_url as string) || (ev.url as string) || museumUrl;

      const schema: Record<string, unknown> = {
        "@type": "Event",
        name: ev.title,
        description: (ev.description as string) || `${ev.title} — ${museum}, Frankfurt am Main`,
        url: evUrl,
        startDate: startIso,
        endDate: endIso,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
      };
      if (ev.image_url) {
        const img = ev.image_url as string;
        schema.image = img.startsWith("/") ? `https://museumsufer.app${img}` : img;
      } else {
        schema.image = "https://museumsufer.app/og-image.png";
      }

      schema.location = slug
        ? { "@id": `https://museumsufer.app/#museum/${slug}` }
        : { "@type": "Place", name: museum };
      schema.organizer = { "@type": "Organization", name: museum, url: museumUrl };
      if (ev.price) {
        const raw = String(ev.price).trim();
        const cleaned = raw.replace(/[^\d.,]/g, "");
        const isSimplePrice = /^\d+([.,]\d+)?$/.test(cleaned);
        schema.offers = {
          "@type": "Offer",
          url: evUrl,
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          validFrom: date,
          ...(isSimplePrice ? { price: cleaned.replace(",", ".") } : { price: "0", description: raw }),
        };
      }

      schemas.push(schema);
    });
  }

  if (schemas.length === 0) return "";
  const wrapper = { "@context": "https://schema.org", "@graph": schemas };
  return `<script type="application/ld+json">${JSON.stringify(wrapper)}</script>`;
}
