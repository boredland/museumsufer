import {
  type Locale as CoreLocale,
  cityMeta,
  detectLocale as coreDetect,
  DEFAULT_CITY,
  dateLocale,
  localizeCityText,
} from "@museumsufer/core";

export type Locale = Extract<CoreLocale, "de" | "en">;
export const SUPPORTED_LOCALES: Locale[] = ["de", "en"];
export const DEFAULT_LOCALE: Locale = "de";

export function detectLocale(request: Request): Locale {
  return coreDetect(request, SUPPORTED_LOCALES, DEFAULT_LOCALE);
}

export { dateLocale };

export interface Translations {
  tagline: string;
  dateStripLabel: string;
  todayProgrammeTitle: string;
  emptyTitle: string;
  emptyTodayAfterPast: string;
  emptyHint: string;
  pastNote: (n: number) => string;
  /** "Mit", "Featuring" — Q&A guests, live accompaniment, etc. */
  creditsLabel: string;
  empty: string;
  ticketsAction: string;
  freeEntry: string;
  toCalendar: string;
  reportScreening: string;
  themeToggle: string;
  weekOverview: string;
  reportProblem: string;
  imprint: string;
  // Format / version / language label helpers
  formatLabel: string;
  versionLabel: string;
  // Series UI
  seriesKicker: string;
  seriesAll: string;
  // Ticket availability badges
  soldOut: string;
  fewLeft: string;
  // Digest dialog
  digestKicker: string;
  digestCueText: string;
  digestTitle: string;
  digestIntro: string;
  digestIosHint: string;
  digestUnsupported: string;
  digestUnsubAll: string;
  digestSave: string;
  digestUnsubscribeBtn: string;
  digestPermissionDenied: string;
  digestSubscribe: string;
  digestSchedules: string;
  digestMorning: string;
  digestAfternoon: string;
  digestSunday: string;
  digestMorningSub: string;
  digestAfternoonSub: string;
  digestSundaySub: string;
  digestFilterLabel: string;
  digestFilterHint: string;
  digestSaving: string;
  digestSaved: string;
  digestUnsubscribing: string;
  digestUnsubscribed: string;
  digestError: string;
  digestClose: string;
  // Contact dialog
  contactTitle: string;
  contactBody: string;
  contactCategoryLabel: string;
  contactEmailPlaceholder: string;
  contactIntro: string;
  contactCategoryGeneral: string;
  contactCategoryScreening: string;
  contactCategoryCinema: string;
  contactCategoryBrowser: string;
  contactRegarding: string;
  contactMessage: string;
  contactEmail: string;
  contactSend: string;
  contactSending: string;
  contactSent: string;
  contactErr: string;
  // SEO
  homeTitle: string;
  homeDescription: string;
  // Cinema + series pages
  endTimePrefix: string;
  cinemaKicker: string;
  emptyCinema: string;
  emptySeries: (series: string) => string;
  icalSubscribe: string;
  jsonLink: string;
  websiteLink: string;
  cinemaDescription: (cinema: string, count: number) => string;
  seriesDescription: (series: string, count: number) => string;
  /** Lead sentence above the screening list on /reihe/:slug.
   *  Lifts the page from a bare event grid to something with real
   *  text to excerpt -- date span, screening count, host cinemas. */
  seriesLead: (opts: { name: string; count: number; firstDate: string; lastDate: string; cinemas: string[] }) => string;
  /** Strings for the /kinos venue-directory page. */
  cinemasIndexKicker: string;
  cinemasIndexTitle: string;
  cinemasIndexLead: string;
  backToCinemasIndex: string;
  upcomingShows: (count: number) => string;
  filmKicker: string;
  // Search bar (above the date strip)
  searchLabel: string;
  searchPlaceholder: string;
  searchEmpty: string;
  // Mark-seen / hide
  markSeen: string;
  unmarkSeen: string;
  seenHiddenLead: (n: number) => string;
  seenReveal: string;
  seenHide: string;
  /** "← Zum Programm" — top-of-page link on every detail view back to
   *  the day programme. /film/:id deep-links to the screening's row. */
  backToProgramme: string;
  /** "← Alle Reihen" — back link from a single film series page to the
   *  series index. */
  backToSeriesIndex: string;
  // a11y
  langSwitchAria: string;
  // Cross-app strap
  siblingTemplate: string;
  siblingTheaterLabel: string;
  siblingMuseumLabel: string;
  siblingKonzertLabel: string;
  // Ask AI
  askAiLabel: string;
  askAiPrompt: (date: string) => string;
  askAiPromptFilm: (title: string, cinema: string, date: string) => string;
  askAiPromptCinema: (cinema: string) => string;
  askAiAria: string;
  // FAQ
  faqKicker: string;
  faqItems: { q: string; a: string }[];
  // TMDb attribution — required by their API terms when an app uses the
  // /search endpoints + poster CDN. Rendered as a small line below the
  // main footer block.
  tmdbAttributionLead: string;
  tmdbAttributionTail: string;
  /** Shown above the synopsis on /film/:id when the visitor's locale
   *  is `en` but TMDb has no English overview, so the German cinema
   *  description is rendered as fallback. */
  synopsisFallbackNotice: string;
  /** One-line "Synopsis: TMDb" attribution rendered adjacent to the
   *  description text on /film/:id, satisfying TMDb's API terms at
   *  the point of use (the global footer attribution stays as well). */
  synopsisAttribution: string;
}

const de: Translations = {
  tagline: "Was heute auf Frankfurts Leinwänden flimmert.",
  dateStripLabel: "Spieltage",
  todayProgrammeTitle: "Heutige Vorstellungen",
  emptyTitle: "Heute keine Vorstellungen gemeldet.",
  emptyTodayAfterPast: "Heute keine kommenden Vorstellungen mehr.",
  emptyHint: "Schau morgen wieder vorbei oder wechsle das Datum oben.",
  pastNote: (n) => `${n} Vorstellung${n === 1 ? "" : "en"} heute bereits begonnen — verborgen.`,
  creditsLabel: "Mit",
  empty: "Schau morgen wieder vorbei oder wechsle das Datum oben.",
  ticketsAction: "Karten",
  freeEntry: "Eintritt frei",
  toCalendar: "Zum Kalender",
  reportScreening: "Fehler bei dieser Vorstellung melden",
  themeToggle: "Lichtwechsel",
  weekOverview: "Wochenüberblick",
  reportProblem: "Problem melden",
  imprint: "Impressum",
  formatLabel: "Format",
  versionLabel: "Fassung",
  seriesKicker: "Filmreihe",
  seriesAll: "Alle Reihen",
  soldOut: "Ausverkauft",
  fewLeft: "Nur noch Restkarten",
  digestKicker: "Push-Digest",
  digestCueText: "Erfahre morgens, welche Filme heute laufen.",
  digestTitle: "Vorstellungen abonnieren",
  digestIntro: "Push-Nachrichten direkt aufs Gerät — keine E-Mail, kein Konto. Jederzeit abbestellbar.",
  digestIosHint:
    "<strong>iPhone:</strong> Tippe »Teilen« und »Zum Home-Bildschirm hinzufügen«. Öffne dann über das App-Icon — erst dann sind Push-Nachrichten möglich.",
  digestUnsupported:
    "Dein Browser unterstützt keine Push-Nachrichten. Probier es in Safari (macOS), Chrome, Firefox oder Edge.",
  digestUnsubAll: "Alle abbestellen",
  digestSave: "Speichern",
  digestUnsubscribeBtn: "Abbestellen",
  digestPermissionDenied: "Benachrichtigungen wurden blockiert. Erlaube sie in den Browser-Einstellungen.",
  digestSubscribe: "Push abonnieren",
  digestSchedules: "Digest-Zeitpunkte",
  digestMorning: "Jeden Morgen",
  digestAfternoon: "Jeden Nachmittag",
  digestSunday: "Sonntag-Digest",
  digestMorningSub: "Filme des heutigen Tages.",
  digestAfternoonSub: "Was heute Abend noch läuft.",
  digestSundaySub: "Wochenüberblick — die kommende Woche.",
  digestFilterLabel: "Auf Kinos einschränken",
  digestFilterHint: "leer = alle",
  digestSaving: "Wird gespeichert…",
  digestSaved: "Gespeichert.",
  digestUnsubscribing: "Wird abbestellt…",
  digestUnsubscribed: "Abbestellt.",
  digestError: "Speichern fehlgeschlagen.",
  digestClose: "Schließen",
  contactTitle: "Feedback & Korrekturen",
  contactBody: "Falsche Zeit, fehlende Vorstellung, Tippfehler? Wir freuen uns über jeden Hinweis.",
  contactCategoryLabel: "Kategorie",
  contactEmailPlaceholder: "dein@email.de",
  contactIntro: "Was stimmt nicht?",
  contactCategoryGeneral: "Allgemein — Feedback / Funktionen",
  contactCategoryScreening: "Vorstellung — falsche Daten",
  contactCategoryCinema: "Kino — fehlt oder Korrektur",
  contactCategoryBrowser: "Browser",
  contactRegarding: "Betrifft",
  contactMessage: "Nachricht",
  contactEmail: "E-Mail (optional, für Rückfragen)",
  contactSend: "Senden",
  contactSending: "Wird gesendet…",
  contactSent: "Vielen Dank — wir sehen es uns an.",
  contactErr: "Senden fehlgeschlagen.",
  homeTitle: "frankfurt.lichtspiel.haus — Kinoprogramm heute in Frankfurt am Main",
  homeDescription:
    "Programmkino, Arthouse, Repertoire, Filmreihen und Festivals — täglich aktualisiertes Kinoprogramm aus Frankfurt und der Rhein-Main-Region.",
  endTimePrefix: "bis",
  cinemaKicker: "Spielstätte",
  emptyCinema: "Noch kein angekündigtes Programm.",
  emptySeries: (series) => `Aktuell keine angekündigten Vorstellungen in der Reihe »${series}«.`,
  icalSubscribe: "iCal abonnieren",
  jsonLink: "JSON",
  websiteLink: "Website",
  cinemaDescription: (cinema, count) =>
    `Vorstellungen im ${cinema}. ${count} Termin${count === 1 ? "" : "e"} in den nächsten 60 Tagen.`,
  seriesDescription: (series, count) =>
    `Filmreihe »${series}« — ${count} Vorstellung${count === 1 ? "" : "en"} in den nächsten 60 Tagen.`,
  seriesLead: ({ name, count, firstDate, lastDate, cinemas }) => {
    const fmt = (d: string) => {
      const dt = new Date(`${d}T12:00:00Z`);
      return dt.toLocaleDateString("de-DE", { day: "numeric", month: "long", timeZone: "UTC" });
    };
    const at =
      cinemas.length === 1
        ? `im ${cinemas[0]}`
        : `in ${cinemas.slice(0, -1).join(", ")} und ${cinemas[cinemas.length - 1]}`;
    return `Die Filmreihe »${name}« läuft vom ${fmt(firstDate)} bis ${fmt(lastDate)} ${at} mit ${count} ${count === 1 ? "Vorstellung" : "Vorstellungen"}.`;
  },
  cinemasIndexKicker: "Verzeichnis",
  cinemasIndexTitle: "Kinos in Frankfurt und Umgebung",
  cinemasIndexLead:
    "Arthouse, Programmkino, Repertoire — alle Spielstätten der Rhein-Main-Region mit aktuellem Vorstellungs-Programm.",
  backToCinemasIndex: "Zum Kino-Verzeichnis",
  upcomingShows: (count) => `${count} Vorstellung${count === 1 ? "" : "en"} in 14 Tagen`,
  filmKicker: "Vorstellung",
  searchLabel: "Suchen",
  searchPlaceholder: "Filme, Regisseur:innen, Kinos suchen …",
  searchEmpty: "Keine Treffer",
  markSeen: "Als gesehen markieren",
  unmarkSeen: "Markierung entfernen",
  seenHiddenLead: (n) => `${n} bereits gesehene${n === 1 ? "r Film" : " Filme"} ausgeblendet`,
  seenReveal: "Einblenden",
  seenHide: "Wieder ausblenden",
  backToProgramme: "Zum Programm",
  backToSeriesIndex: "Alle Filmreihen",
  langSwitchAria: "Sprache",
  siblingTemplate: "Nichts dabei? Vielleicht stattdessen {first}, {second} oder {third}?",
  siblingTheaterLabel: "ein Theaterstück",
  siblingMuseumLabel: "ein Museumsbesuch",
  siblingKonzertLabel: "ein Konzert",
  askAiPromptFilm: (title, cinema, date) =>
    `Erzähl mir mehr über »${title}«, gezeigt im ${cinema} am ${date}. Worum geht der Film, wie wurde er aufgenommen, und was sollte ich vor dem Kinobesuch wissen? Quelle: https://frankfurt.lichtspiel.haus`,
  askAiPromptCinema: (cinema) =>
    `Was läuft in den nächsten Wochen im ${cinema} in Frankfurt? Bitte gruppiere nach Filmreihen oder besonderen Vorstellungen. Quelle: https://frankfurt.lichtspiel.haus`,
  askAiLabel: "Frag eine KI",
  askAiPrompt: (date) =>
    `Welche Filme laufen am ${date} in Frankfurt und Umgebung? Quelle: https://frankfurt.lichtspiel.haus`,
  askAiAria: "Frag eine KI nach dem heutigen Kinoprogramm",
  faqKicker: "Häufige Fragen",
  faqItems: [
    {
      q: "Welche Kinos sind hier vertreten?",
      a: "Aktuell {n} Spielstätten und Filmreihen in Frankfurt und Umgebung: {venues}.",
    },
    {
      q: "Wie aktuell ist das Programm?",
      a: "Die Daten werden mehrmals täglich direkt von den Webseiten der Kinos abgerufen. Absagen, Ausverkauft-Hinweise und Programmänderungen erscheinen in der Regel innerhalb einer Stunde.",
    },
    {
      q: "Kann ich hier Karten kaufen?",
      a: "Nein — die Karten-Schaltfläche an jeder Vorstellung führt direkt auf die Buchungsseite des Kinos. Diese Seite verkauft selbst keine Tickets und nimmt keine Provision.",
    },
    {
      q: "Was bedeuten OmU, OmeU, DF, OV, DCP, 35mm?",
      a: "Sprachfassung: OmU = Originalfassung mit deutschen Untertiteln, OmeU = Originalfassung mit englischen Untertiteln, DF = deutsche Fassung (synchronisiert), OV = Originalfassung ohne Untertitel, stumm = Stummfilm (oft mit Live-Begleitung). Vorführformat: DCP = Digital Cinema Package, der digitale Standard heutiger Kinos; 35mm / 16mm / 70mm = analoge Filmkopie auf physischem Filmmaterial.",
    },
    {
      q: "Was passiert mit Vorstellungen, die schon angefangen haben?",
      a: "Auf der heutigen Ansicht werden Vorstellungen 30 Minuten nach Beginn ausgeblendet, damit nur erreichbare Anfangszeiten sichtbar sind. Eine kleine Notiz unter der Liste zeigt, wie viele bereits gestartet sind.",
    },
    {
      q: "Warum diese Seite?",
      a: "Frankfurt hat eine außergewöhnliche Kinodichte — DFF, Astor, drei Arthouse-Häuser, Pupille im Westend, Programmkino Rex in Darmstadt, das Murnau in Wiesbaden — aber kein gemeinsames Programmheft. Diese Seite legt alle Häuser auf eine durchsuchbare Tagesansicht.",
    },
    {
      q: "Wie funktionieren die Push-Mitteilungen?",
      a: "Über die »Push-Digest«-Schaltfläche oder den Footer-Link. Drei Zeitfenster: morgens (07:00 Uhr), nachmittags (17:00 Uhr) und ein wöchentlicher Sonntagsüberblick (09:00 Uhr). Optional lassen sich die Mitteilungen auf bestimmte Kinos einschränken. Anonym, jederzeit kündbar. Auf iOS muss die Seite vorher als Web-App zum Home-Bildschirm hinzugefügt werden.",
    },
  ],
  tmdbAttributionLead: "Filmplakate & -beschreibungen via ",
  tmdbAttributionTail: ". Dieses Produkt nutzt die TMDB-API, ist aber weder von TMDB unterstützt noch zertifiziert.",
  synopsisFallbackNotice: "Synopsis auf Deutsch — keine englische Übersetzung verfügbar.",
  synopsisAttribution: "Synopsis: TMDb.",
};

const en: Translations = {
  tagline: "Tonight's play of light across Frankfurt's screens.",
  dateStripLabel: "Showing days",
  todayProgrammeTitle: "Today's screenings",
  emptyTitle: "No screenings announced today.",
  emptyTodayAfterPast: "No more upcoming screenings today.",
  emptyHint: "Check back tomorrow or change the date above.",
  pastNote: (n) => `${n} screening${n === 1 ? "" : "s"} already started today — hidden.`,
  creditsLabel: "With",
  empty: "Check back tomorrow or change the date above.",
  ticketsAction: "Tickets",
  freeEntry: "Free entry",
  toCalendar: "Add to calendar",
  reportScreening: "Report an issue with this screening",
  themeToggle: "Toggle light",
  weekOverview: "Weekly overview",
  reportProblem: "Report a problem",
  imprint: "Imprint",
  formatLabel: "Format",
  versionLabel: "Version",
  seriesKicker: "Series",
  seriesAll: "All series",
  soldOut: "Sold out",
  fewLeft: "Only a few tickets left",
  digestKicker: "Push digest",
  digestCueText: "Wake up to what's screening tonight.",
  digestTitle: "Subscribe to screenings",
  digestIntro: "Push notifications straight to your device — no email, no account. Cancel any time.",
  digestIosHint:
    '<strong>iPhone:</strong> Tap "Share" and "Add to Home Screen". Then open from the app icon — only then can push notifications work.',
  digestUnsupported: "Your browser doesn't support push notifications. Try Safari (macOS), Chrome, Firefox or Edge.",
  digestUnsubAll: "Unsubscribe all",
  digestSave: "Save",
  digestUnsubscribeBtn: "Unsubscribe",
  digestPermissionDenied: "Notifications were blocked. Allow them in your browser settings.",
  digestSubscribe: "Subscribe",
  digestSchedules: "Digest times",
  digestMorning: "Every morning",
  digestAfternoon: "Every afternoon",
  digestSunday: "Sunday digest",
  digestMorningSub: "Today's programme.",
  digestAfternoonSub: "What's still on tonight.",
  digestSundaySub: "The week ahead at a glance.",
  digestFilterLabel: "Restrict to cinemas",
  digestFilterHint: "empty = all",
  digestSaving: "Saving…",
  digestSaved: "Saved.",
  digestUnsubscribing: "Unsubscribing…",
  digestUnsubscribed: "Unsubscribed.",
  digestError: "Saving failed.",
  digestClose: "Close",
  contactTitle: "Feedback & corrections",
  contactBody: "Wrong time, missing screening, typo? Every hint is welcome.",
  contactCategoryLabel: "Category",
  contactEmailPlaceholder: "you@email.com",
  contactIntro: "What's wrong?",
  contactCategoryGeneral: "General — feedback / features",
  contactCategoryScreening: "Screening — wrong data",
  contactCategoryCinema: "Cinema — missing or correction",
  contactCategoryBrowser: "Browser",
  contactRegarding: "Regarding",
  contactMessage: "Message",
  contactEmail: "Email (optional, for follow-up)",
  contactSend: "Send",
  contactSending: "Sending…",
  contactSent: "Thank you — we'll take a look.",
  contactErr: "Sending failed.",
  homeTitle: "frankfurt.lichtspiel.haus — Today's cinema programme in Frankfurt am Main",
  homeDescription:
    "Arthouse, repertory, programmkino, festivals and film series — daily cinema programme from Frankfurt and the Rhine-Main region.",
  endTimePrefix: "until",
  cinemaKicker: "Cinema",
  emptyCinema: "No programme announced yet.",
  emptySeries: (series) => `No screenings currently announced for the "${series}" series.`,
  icalSubscribe: "Subscribe via iCal",
  jsonLink: "JSON",
  websiteLink: "Website",
  cinemaDescription: (cinema, count) =>
    `Screenings at ${cinema}. ${count} ${count === 1 ? "show" : "shows"} in the next 60 days.`,
  seriesDescription: (series, count) =>
    `Film series "${series}" — ${count} ${count === 1 ? "screening" : "screenings"} in the next 60 days.`,
  seriesLead: ({ name, count, firstDate, lastDate, cinemas }) => {
    const fmt = (d: string) => {
      const dt = new Date(`${d}T12:00:00Z`);
      return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
    };
    const at =
      cinemas.length === 1
        ? `at ${cinemas[0]}`
        : `at ${cinemas.slice(0, -1).join(", ")} and ${cinemas[cinemas.length - 1]}`;
    return `The film series "${name}" runs from ${fmt(firstDate)} to ${fmt(lastDate)} ${at} with ${count} ${count === 1 ? "screening" : "screenings"}.`;
  },
  cinemasIndexKicker: "Directory",
  cinemasIndexTitle: "Cinemas in Frankfurt & Rhine-Main",
  cinemasIndexLead:
    "Arthouse, Programmkino, repertory — every cinema in the region with its current programme of upcoming screenings.",
  backToCinemasIndex: "Back to the cinema directory",
  upcomingShows: (count) => `${count} ${count === 1 ? "show" : "shows"} in 14 days`,
  filmKicker: "Screening",
  searchLabel: "Search",
  searchPlaceholder: "Search films, directors, cinemas …",
  searchEmpty: "No results",
  markSeen: "Mark as seen",
  unmarkSeen: "Unmark",
  seenHiddenLead: (n) => `${n} already-seen film${n === 1 ? "" : "s"} hidden`,
  seenReveal: "Show",
  seenHide: "Hide again",
  backToProgramme: "Back to programme",
  backToSeriesIndex: "All film series",
  langSwitchAria: "Language",
  siblingTemplate: "Nothing for you? How about {first}, {second}, or {third} instead?",
  siblingTheaterLabel: "a play",
  siblingMuseumLabel: "a museum visit",
  siblingKonzertLabel: "a concert",
  askAiPromptFilm: (title, cinema, date) =>
    `Tell me about "${title}", screening at ${cinema} on ${date}. What's the film about, how was it received, and what should I know before going? Source: https://frankfurt.lichtspiel.haus`,
  askAiPromptCinema: (cinema) =>
    `What's coming up at ${cinema} in Frankfurt in the next few weeks? Please group by film series or notable screenings. Source: https://frankfurt.lichtspiel.haus`,
  askAiLabel: "Ask an AI",
  askAiPrompt: (date) =>
    `What's playing in Frankfurt and the wider region on ${date}? Source: https://frankfurt.lichtspiel.haus`,
  askAiAria: "Ask an AI about today's cinema programme",
  faqKicker: "Frequently asked",
  faqItems: [
    {
      q: "Which cinemas are covered?",
      a: "Currently {n} cinemas and film series in Frankfurt and the surrounding area: {venues}.",
    },
    {
      q: "How current is the programme?",
      a: "Data is scraped multiple times a day directly from cinema websites. Cancellations, sold-out flags and programme changes usually surface within an hour.",
    },
    {
      q: "Can I buy tickets here?",
      a: "No — the Tickets button on each screening links directly to the cinema's own booking page. This site doesn't sell tickets and takes no commission.",
    },
    {
      q: "What do OmU, OmeU, DF, OV, DCP, 35mm mean?",
      a: "Language version: OmU = original audio with German subtitles, OmeU = original with English subtitles, DF = German-dubbed version, OV = original version with no subtitles, stumm = silent film (often with live accompaniment). Projection format: DCP = Digital Cinema Package, the digital standard in modern cinemas; 35mm / 16mm / 70mm = analogue film prints on physical stock.",
    },
    {
      q: "What happens to screenings that have already started?",
      a: "On today's view, screenings are hidden 30 minutes after their start time, so only reachable showtimes remain visible. A small note at the bottom shows how many have already begun.",
    },
    {
      q: "Why this site?",
      a: "Frankfurt has an unusually dense cinema scene — the DFF Filmmuseum, Astor, three arthouse houses, Pupille at the university, Programmkino Rex in Darmstadt, the Murnau in Wiesbaden — but no shared programme. This site lays every house onto one searchable day view.",
    },
    {
      q: "How do push notifications work?",
      a: 'Subscribe via the "Push Digest" button or the footer link. Three time slots are available: morning (07:00), afternoon (17:00) and a weekly Sunday overview (09:00). Notifications can optionally be restricted to specific cinemas. Sign-up is anonymous — no account, no email — and can be cancelled at any time. On iOS, the site must first be added to the home screen as a web app.',
    },
  ],
  tmdbAttributionLead: "Posters & synopses via ",
  tmdbAttributionTail: ". This product uses the TMDB API but is not endorsed or certified by TMDB.",
  synopsisFallbackNotice: "Synopsis in German — no English translation available.",
  synopsisAttribution: "Synopsis: TMDb.",
};

const TRANSLATIONS: Record<Locale, Translations> = { de, en };

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}

const APEX = "lichtspiel.haus";

/** Frankfurt-specific regional phrasing that plain name substitution can't
 *  cover. Generic "und Umgebung" / "wider region" already read fine anywhere. */
const REGION_SUB: Record<Locale, ReadonlyArray<readonly [string, string]>> = {
  de: [["Rhein-Main-Region", "Metropolregion"]],
  en: [["Rhine-Main region", "metropolitan region"]],
};

/**
 * City-specific "Why this site?" FAQ answer. The base copy names individual
 * Frankfurt cinemas, which plain name-substitution can't transpose — each city
 * gets its own hand-written venue list. Keyed by city slug, then locale.
 */
const WHY_FAQ_ANSWER: Record<string, Record<Locale, string>> = {
  hamburg: {
    de: "Hamburg hat eine lebendige Programmkino-Szene — das Abaton, das kommunale Metropolis, das 3001, die Zeise-Kinos, das Studio-Kino und das Savoy — aber kein gemeinsames Programmheft. Diese Seite legt alle Häuser auf eine durchsuchbare Tagesansicht.",
    en: "Hamburg has a lively repertory-cinema scene — the Abaton, the municipal Metropolis, the 3001, the Zeise cinemas, the Studio-Kino and the Savoy — but no shared programme. This site lays every house onto one searchable day view.",
  },
};

/** Whether a FAQ item is the "Why this site?" entry (Frankfurt-venue copy). */
function isWhyFaq(q: string): boolean {
  return q === "Warum diese Seite?" || q === "Why this site?";
}

/**
 * Rewrite the Frankfurt-authored copy for another city, applied once per
 * request so the localized `tr` reaches every component. Byte-identical for
 * the default city.
 */
export function localizeTranslations(tr: Translations, city: string, locale: Locale): Translations {
  if (cityMeta(city).slug === DEFAULT_CITY) return tr;
  const s = (t: string): string => localizeCityText(t, city, locale, APEX, REGION_SUB[locale]);
  const whyAnswer = WHY_FAQ_ANSWER[cityMeta(city).slug]?.[locale];
  return {
    ...tr,
    tagline: s(tr.tagline),
    homeTitle: s(tr.homeTitle),
    homeDescription: s(tr.homeDescription),
    cinemasIndexTitle: s(tr.cinemasIndexTitle),
    cinemasIndexLead: s(tr.cinemasIndexLead),
    askAiPrompt: (date) => s(tr.askAiPrompt(date)),
    askAiPromptFilm: (title, cinema, date) => s(tr.askAiPromptFilm(title, cinema, date)),
    askAiPromptCinema: (cinema) => s(tr.askAiPromptCinema(cinema)),
    faqItems: tr.faqItems.map((item) => ({
      q: s(item.q),
      // The "why this site" answer names individual cinemas; use the
      // city-specific copy when available rather than name-substituting.
      a: isWhyFaq(item.q) && whyAnswer ? whyAnswer : s(item.a),
    })),
  };
}
