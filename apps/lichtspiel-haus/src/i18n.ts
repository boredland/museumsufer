import {
  type Locale as CoreLocale,
  cityMeta,
  detectLocale as coreDetect,
  DEFAULT_CITY,
  dateLocale,
  localizeCityText,
} from "@museumsufer/core";

export type Locale = Extract<CoreLocale, "de" | "en" | "es">;
export const SUPPORTED_LOCALES: Locale[] = ["de", "en", "es"];
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
  /** Italic stage direction above the empty-day message, like a script's "(lights down)". */
  emptyDirection: string;
  emptyTodayAfterPast: string;
  emptyHint: string;
  pastNote: (n: number) => string;
  /** "Mit", "Featuring" — Q&A guests, live accompaniment, etc. */
  creditsLabel: string;
  /** Read-more control on a clamped synopsis. */
  moreLabel: string;
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
  // OMDb attribution — required by their API terms when using RT/IMDb
  // ratings data. Rendered alongside the TMDb attribution in the footer.
  omdbAttributionLead: string;
  omdbAttributionTail: string;
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
  emptyDirection: "Saal dunkel",
  emptyTodayAfterPast: "Heute keine kommenden Vorstellungen mehr.",
  emptyHint: "Schau morgen wieder vorbei oder wechsle das Datum oben.",
  pastNote: (n) => `${n} Vorstellung${n === 1 ? "" : "en"} heute bereits begonnen — verborgen.`,
  creditsLabel: "Mit",
  moreLabel: "Mehr",
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
  omdbAttributionLead: "Bewertungen (Rotten Tomatoes, IMDb) via ",
  omdbAttributionTail: ".",
  synopsisFallbackNotice: "Synopsis auf Deutsch — keine englische Übersetzung verfügbar.",
  synopsisAttribution: "Synopsis: TMDb.",
};

const en: Translations = {
  tagline: "Tonight's play of light across Frankfurt's screens.",
  dateStripLabel: "Showing days",
  todayProgrammeTitle: "Today's screenings",
  emptyTitle: "No screenings announced today.",
  emptyDirection: "House dark",
  emptyTodayAfterPast: "No more upcoming screenings today.",
  emptyHint: "Check back tomorrow or change the date above.",
  pastNote: (n) => `${n} screening${n === 1 ? "" : "s"} already started today — hidden.`,
  creditsLabel: "With",
  moreLabel: "More",
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
  omdbAttributionLead: "Ratings (Rotten Tomatoes, IMDb) via ",
  omdbAttributionTail: ".",
  synopsisFallbackNotice: "Synopsis in German — no English translation available.",
  synopsisAttribution: "Synopsis: TMDb.",
};

const es: Translations = {
  tagline: "Lo que se proyecta hoy en las pantallas de Fráncfort.",
  dateStripLabel: "Días de proyección",
  todayProgrammeTitle: "Sesiones de hoy",
  emptyTitle: "Hoy no hay sesiones anunciadas.",
  emptyDirection: "Sala a oscuras",
  emptyTodayAfterPast: "Hoy ya no quedan más sesiones.",
  emptyHint: "Vuelva a consultar mañana o cambie la fecha de arriba.",
  pastNote: (n) => `${n} sesión${n === 1 ? "" : "es"} de hoy ya ha${n === 1 ? "" : "n"} empezado — oculta${n === 1 ? "" : "s"}.`,
  creditsLabel: "Con",
  moreLabel: "Más",
  empty: "Vuelva a consultar mañana o cambie la fecha de arriba.",
  ticketsAction: "Entradas",
  freeEntry: "Entrada gratuita",
  toCalendar: "Añadir al calendario",
  reportScreening: "Avisar de un error en esta sesión",
  themeToggle: "Cambiar la luz",
  weekOverview: "Resumen semanal",
  reportProblem: "Avisar de un problema",
  imprint: "Aviso legal",
  formatLabel: "Formato",
  versionLabel: "Versión",
  seriesKicker: "Ciclo",
  seriesAll: "Todos los ciclos",
  soldOut: "Agotado",
  fewLeft: "Quedan pocas entradas",
  digestKicker: "Resumen por notificación",
  digestCueText: "Por la mañana, las películas que se proyectan hoy.",
  digestTitle: "Suscribirse a las sesiones",
  digestIntro:
    "Notificaciones push directas al dispositivo, sin correo ni cuenta. Se pueden cancelar en cualquier momento.",
  digestIosHint:
    "<strong>iPhone:</strong> pulsar «Compartir» y «Añadir a pantalla de inicio». Después hay que abrir la web desde el icono: solo así funcionan las notificaciones push.",
  digestUnsupported:
    "El navegador no admite notificaciones push. Pruebe con Safari (macOS), Chrome, Firefox o Edge.",
  digestUnsubAll: "Cancelar todas",
  digestSave: "Guardar",
  digestUnsubscribeBtn: "Cancelar suscripción",
  digestPermissionDenied: "Las notificaciones están bloqueadas. Permítalas en los ajustes del navegador.",
  digestSubscribe: "Suscribirse",
  digestSchedules: "Horarios del resumen",
  digestMorning: "Cada mañana",
  digestAfternoon: "Cada tarde",
  digestSunday: "Resumen del domingo",
  digestMorningSub: "Las películas de hoy.",
  digestAfternoonSub: "Lo que aún se proyecta esta noche.",
  digestSundaySub: "Resumen de la semana que empieza.",
  digestFilterLabel: "Limitar a determinados cines",
  digestFilterHint: "vacío = todos",
  digestSaving: "Guardando…",
  digestSaved: "Guardado.",
  digestUnsubscribing: "Cancelando suscripción…",
  digestUnsubscribed: "Suscripción cancelada.",
  digestError: "No se pudo guardar.",
  digestClose: "Cerrar",
  contactTitle: "Comentarios y correcciones",
  contactBody: "¿Hora incorrecta, sesión que falta, errata? Cualquier aviso es bienvenido.",
  contactCategoryLabel: "Categoría",
  contactEmailPlaceholder: "su@correo.es",
  contactIntro: "¿Qué falla?",
  contactCategoryGeneral: "General — comentarios / funciones",
  contactCategoryScreening: "Sesión — datos incorrectos",
  contactCategoryCinema: "Cine — falta o corrección",
  contactCategoryBrowser: "Navegador",
  contactRegarding: "Asunto",
  contactMessage: "Mensaje",
  contactEmail: "Correo electrónico (opcional, para responderle)",
  contactSend: "Enviar",
  contactSending: "Enviando…",
  contactSent: "Gracias: lo revisaremos.",
  contactErr: "No se pudo enviar.",
  homeTitle: "frankfurt.lichtspiel.haus — Cartelera de cine de hoy en Fráncfort del Meno",
  homeDescription:
    "Cine de autor, cine de repertorio, ciclos y festivales: cartelera diaria actualizada de Fráncfort y la región Rin-Meno.",
  endTimePrefix: "hasta las",
  cinemaKicker: "Sala",
  emptyCinema: "Todavía no hay programación anunciada.",
  emptySeries: (series) => `Ahora mismo no hay sesiones anunciadas del ciclo «${series}».`,
  icalSubscribe: "Suscribirse por iCal",
  jsonLink: "JSON",
  websiteLink: "Web",
  cinemaDescription: (cinema, count) =>
    `Sesiones en ${cinema}. ${count} ${count === 1 ? "pase" : "pases"} en los próximos 60 días.`,
  seriesDescription: (series, count) =>
    `Ciclo de cine «${series}» — ${count} ${count === 1 ? "sesión" : "sesiones"} en los próximos 60 días.`,
  seriesLead: ({ name, count, firstDate, lastDate, cinemas }) => {
    const fmt = (d: string) => {
      const dt = new Date(`${d}T12:00:00Z`);
      return dt.toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
    };
    const at =
      cinemas.length === 1
        ? `en ${cinemas[0]}`
        : `en ${cinemas.slice(0, -1).join(", ")} y ${cinemas[cinemas.length - 1]}`;
    return `El ciclo «${name}» se proyecta del ${fmt(firstDate)} al ${fmt(lastDate)} ${at}, con ${count} ${count === 1 ? "sesión" : "sesiones"}.`;
  },
  cinemasIndexKicker: "Directorio",
  cinemasIndexTitle: "Cines en Fráncfort y alrededores",
  cinemasIndexLead:
    "Cine de autor, de repertorio y de barrio: todas las salas de la región Rin-Meno con su programación de próximas sesiones.",
  backToCinemasIndex: "Volver al directorio de cines",
  upcomingShows: (count) => `${count} ${count === 1 ? "pase" : "pases"} en 14 días`,
  filmKicker: "Sesión",
  searchLabel: "Buscar",
  searchPlaceholder: "Buscar películas, directores, cines …",
  searchEmpty: "Sin resultados",
  markSeen: "Marcar como vista",
  unmarkSeen: "Quitar marca",
  seenHiddenLead: (n) => `${n} película${n === 1 ? " ya vista oculta" : "s ya vistas ocultas"}`,
  seenReveal: "Mostrar",
  seenHide: "Volver a ocultar",
  backToProgramme: "Volver a la cartelera",
  backToSeriesIndex: "Todos los ciclos de cine",
  langSwitchAria: "Idioma",
  siblingTemplate: "¿Nada que encaje? Quizá {first}, {second} o {third}.",
  siblingTheaterLabel: "una obra de teatro",
  siblingMuseumLabel: "una visita a un museo",
  siblingKonzertLabel: "un concierto",
  askAiPromptFilm: (title, cinema, date) =>
    `Quiero saber más sobre «${title}», que se proyecta en ${cinema} el ${date}. ¿De qué trata la película, cómo fue recibida y qué conviene saber antes de ir al cine? Fuente: https://frankfurt.lichtspiel.haus`,
  askAiPromptCinema: (cinema) =>
    `¿Qué se proyecta en ${cinema}, en Fráncfort, durante las próximas semanas? Se agradece una respuesta agrupada por ciclos o sesiones especiales. Fuente: https://frankfurt.lichtspiel.haus`,
  askAiLabel: "Preguntar a una IA",
  askAiPrompt: (date) =>
    `¿Qué películas se proyectan el ${date} en Fráncfort y alrededores? Fuente: https://frankfurt.lichtspiel.haus`,
  askAiAria: "Preguntar a una IA por la cartelera de cine de hoy",
  faqKicker: "Preguntas frecuentes",
  faqItems: [
    {
      q: "¿Qué cines aparecen aquí?",
      a: "Actualmente, {n} salas y ciclos de cine en Fráncfort y alrededores: {venues}.",
    },
    {
      q: "¿Cómo de actual es la cartelera?",
      a: "Los datos se obtienen varias veces al día directamente de las webs de los cines. Las cancelaciones, los avisos de entradas agotadas y los cambios de programación suelen reflejarse en menos de una hora.",
    },
    {
      q: "¿Se pueden comprar entradas aquí?",
      a: "No: el botón de entradas de cada sesión lleva directamente a la página de reservas del propio cine. Esta web no vende entradas ni cobra comisión.",
    },
    {
      q: "¿Qué significan OmU, OmeU, DF, OV, DCP, 35mm?",
      a: "Versión lingüística: OmU = versión original con subtítulos en alemán, OmeU = versión original con subtítulos en inglés, DF = versión doblada al alemán, OV = versión original sin subtítulos, stumm = cine mudo (a menudo con acompañamiento en directo). Formato de proyección: DCP = Digital Cinema Package, el estándar digital de las salas actuales; 35mm / 16mm / 70mm = copias analógicas en película física.",
    },
    {
      q: "¿Qué pasa con las sesiones que ya han empezado?",
      a: "En la vista de hoy, las sesiones se ocultan 30 minutos después de su inicio, de modo que solo quedan horas a las que aún se puede llegar. Una nota breve bajo la lista indica cuántas han empezado ya.",
    },
    {
      q: "¿Por qué esta web?",
      a: "Fráncfort tiene una densidad de cines poco común —el DFF Filmmuseum, el Astor, tres salas de cine de autor, la Pupille en el Westend, el Programmkino Rex en Darmstadt, el Murnau en Wiesbaden—, pero ninguna cartelera conjunta. Esta web reúne todas las salas en una única vista diaria con buscador.",
    },
    {
      q: "¿Cómo funcionan las notificaciones push?",
      a: "Mediante el botón «Resumen por notificación» o el enlace del pie de página. Hay tres franjas: por la mañana (07:00), por la tarde (17:00) y un resumen semanal el domingo (09:00). Opcionalmente se pueden limitar a determinados cines. Es anónimo y se puede cancelar en cualquier momento. En iOS, la web debe añadirse antes a la pantalla de inicio como aplicación web.",
    },
  ],
  tmdbAttributionLead: "Carteles y sinopsis vía ",
  tmdbAttributionTail: ". Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.",
  omdbAttributionLead: "Valoraciones (Rotten Tomatoes, IMDb) vía ",
  omdbAttributionTail: ".",
  synopsisFallbackNotice: "Sinopsis en alemán — no hay traducción al español disponible.",
  synopsisAttribution: "Sinopsis: TMDb.",
};

const TRANSLATIONS: Record<Locale, Translations> = { de, en, es };

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}

const APEX = "lichtspiel.haus";

/** Frankfurt-specific regional phrasing that plain name substitution can't
 *  cover. Generic "und Umgebung" / "wider region" already read fine anywhere. */
const REGION_SUB: Record<Locale, ReadonlyArray<readonly [string, string]>> = {
  de: [["Rhein-Main-Region", "Metropolregion"]],
  en: [["Rhine-Main region", "metropolitan region"]],
  es: [
    ["de la región Rin-Meno", "del área metropolitana"],
    ["y la región Rin-Meno", "y su área metropolitana"],
  ],
};

/** Localize one Frankfurt-authored string for `city`. For builders (manifest, feeds, llms.txt) that
 *  carry a single sentence and so cannot go through localizeTranslations, which needs the whole table. */
export function localizeText(text: string, city: string, locale: Locale): string {
  return cityMeta(city).slug === DEFAULT_CITY ? text : localizeCityText(text, city, locale, APEX, REGION_SUB[locale]);
}

/**
 * City-specific "Why this site?" FAQ answer. The base copy names individual
 * Frankfurt cinemas, which plain name-substitution can't transpose — each city
 * gets its own hand-written venue list. Keyed by city slug, then locale.
 */
const WHY_FAQ_ANSWER: Record<string, Record<Locale, string>> = {
  hamburg: {
    de: "Hamburg hat eine lebendige Programmkino-Szene — das Abaton, das kommunale Metropolis, das 3001, die Zeise-Kinos, das Studio-Kino und das Savoy — aber kein gemeinsames Programmheft. Diese Seite legt alle Häuser auf eine durchsuchbare Tagesansicht.",
    en: "Hamburg has a lively repertory-cinema scene — the Abaton, the municipal Metropolis, the 3001, the Zeise cinemas, the Studio-Kino and the Savoy — but no shared programme. This site lays every house onto one searchable day view.",
    es: "Hamburgo tiene una animada escena de cine de autor y de repertorio —el Abaton, el Metropolis municipal, el 3001, los cines Zeise, el Studio-Kino y el Savoy—, pero ninguna cartelera conjunta. Esta web reúne todas las salas en una única vista diaria con buscador.",
  },
  valencia: {
    de: "Valencia hat eine lebendige Kinoszene — die Filmoteca de València, die Cines Babel, die Cines Lys, das Cinestudio d'Or, die ABC-Kinos (Park, El Saler, Gran Túria), die Cines MN4 und das Ocine Aqua — aber kein gemeinsames Programmheft. Diese Seite legt alle Häuser auf eine durchsuchbare Tagesansicht.",
    en: "Valencia has a lively cinema scene — the Filmoteca de València, the Cines Babel, the Cines Lys, the Cinestudio d'Or, the ABC cinemas (Park, El Saler, Gran Túria), the Cines MN4 and the Ocine Aqua — but no shared programme. This site lays every house onto one searchable day view.",
    es: "Valencia tiene una escena cinematográfica muy viva —la Filmoteca de València, los Cines Babel, los Cines Lys, el Cinestudio d'Or, los cines ABC (Park, El Saler, Gran Turia), los Cines MN4 y el Ocine Aqua—, pero ninguna cartelera conjunta. Esta web reúne todas las salas en una única vista diaria con buscador.",
  },
};

/**
 * City-specific answer to the "what do OmU, OmeU, DF… mean" FAQ. The base copy
 * explains German subtitle labels, which Spanish cinemas never print; they use
 * VOSE / VO / doblada.
 */
const LANGUAGE_FAQ_ANSWER: Record<string, Record<Locale, { q: string; a: string }>> = {
  valencia: {
    de: {
      q: "Was bedeuten VOSE, VO, doblada, ATMOS, DCP, 35mm?",
      a: "Sprachfassung in Valencia: VOSE = Originalfassung mit spanischen Untertiteln, VO = Originalfassung ohne Untertitel, doblada / castellano = ins Spanische synchronisiert. Vorführformat: ATMOS = Dolby-Atmos-Ton, DCP = digitales Kinopaket, der heutige Standard; 35mm / 16mm / 70mm = analoge Filmkopie.",
    },
    en: {
      q: "What do VOSE, VO, doblada, ATMOS, DCP, 35mm mean?",
      a: "Language version in Valencia: VOSE = original audio with Spanish subtitles, VO = original version with no subtitles, doblada / castellano = dubbed into Spanish. Projection format: ATMOS = Dolby Atmos sound, DCP = Digital Cinema Package, today's digital standard; 35mm / 16mm / 70mm = analogue film prints.",
    },
    es: {
      q: "¿Qué significan VOSE, VO, doblada, ATMOS, DCP, 35mm?",
      a: "Versión lingüística: VOSE = versión original subtitulada en español, VO = versión original sin subtítulos, doblada / castellano = doblada al español. Formato de proyección: ATMOS = sonido Dolby Atmos, DCP = Digital Cinema Package, el estándar digital actual; 35mm / 16mm / 70mm = copias analógicas en película.",
    },
  },
};

/** Whether a FAQ item is the "Why this site?" entry (Frankfurt-venue copy). */
function isWhyFaq(q: string): boolean {
  return q === "Warum diese Seite?" || q === "Why this site?" || q === "¿Por qué esta web?";
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
  const languageAnswer = LANGUAGE_FAQ_ANSWER[cityMeta(city).slug]?.[locale];
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
    faqItems: tr.faqItems.map((item) => {
      const isLanguageFaq =
        item.q.startsWith("Was bedeuten OmU") ||
        item.q.startsWith("What do OmU") ||
        item.q.startsWith("¿Qué significan OmU");
      // The "why this site" and language-glossary answers name Frankfurt
      // cinemas / German labels; use the city-specific copy when available
      // rather than name-substituting.
      if (isLanguageFaq && languageAnswer) return languageAnswer;
      const a = isWhyFaq(item.q) && whyAnswer ? whyAnswer : s(item.a);
      return { q: s(item.q), a };
    }),
  };
}
