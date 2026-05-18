import { type Locale as CoreLocale, detectLocale as coreDetect, dateLocale } from "@museumsufer/core";

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
  filmKicker: string;
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
  askAiAria: string;
  // FAQ
  faqKicker: string;
  faqItems: { q: string; a: string }[];
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
  homeTitle: "lichtspiel.haus — Heute im Kino in Frankfurt",
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
  filmKicker: "Vorstellung",
  langSwitchAria: "Sprache",
  siblingTemplate: "Nichts dabei? Vielleicht stattdessen {first}, {second} oder {third}?",
  siblingTheaterLabel: "ein Theaterstück",
  siblingMuseumLabel: "ein Museumsbesuch",
  siblingKonzertLabel: "ein Konzert",
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
      q: "Was bedeuten OmU, OmeU, DF, OV?",
      a: "OmU = Originalfassung mit deutschen Untertiteln. OmeU = Originalfassung mit englischen Untertiteln. DF = deutsche Fassung (synchronisiert). OV = Originalfassung ohne Untertitel.",
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
};

const en: Translations = {
  tagline: "Tonight's play of light across Frankfurt's screens.",
  dateStripLabel: "Showing days",
  todayProgrammeTitle: "Tonight's screenings",
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
  homeTitle: "lichtspiel.haus — Tonight at the cinema in Frankfurt",
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
  filmKicker: "Screening",
  langSwitchAria: "Language",
  siblingTemplate: "Nothing for you? How about {first}, {second}, or {third} instead?",
  siblingTheaterLabel: "a play",
  siblingMuseumLabel: "a museum visit",
  siblingKonzertLabel: "a concert",
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
      q: "What do OmU, OmeU, DF, OV mean?",
      a: "OmU = original audio with German subtitles. OmeU = original with English subtitles. DF = German-dubbed version. OV = original version, no subtitles.",
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
};

const TRANSLATIONS: Record<Locale, Translations> = { de, en };

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}
