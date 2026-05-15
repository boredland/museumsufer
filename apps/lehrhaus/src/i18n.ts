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
  category: string;
  categoryAll: string;
  categoryVortrag: string;
  categoryDiskussion: string;
  categoryLesung: string;
  dateStripLabel: string;
  todayProgrammeTitle: string;
  emptyTitle: string;
  emptyTodayAfterPast: string;
  emptyHint: string;
  pastNote: (n: number) => string;
  emptyDirection: string;
  empty: string;
  ticketsAction: string;
  freeEntry: string;
  toCalendar: string;
  reportEvent: string;
  themeToggle: string;
  weekOverview: string;
  reportProblem: string;
  imprint: string;
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
  contactTitle: string;
  contactBody: string;
  contactCategoryLabel: string;
  contactEmailPlaceholder: string;
  contactIntro: string;
  contactCategoryGeneral: string;
  contactCategoryEvent: string;
  contactCategorySource: string;
  contactCategoryBrowser: string;
  contactRegarding: string;
  contactMessage: string;
  contactEmail: string;
  contactSend: string;
  contactSending: string;
  contactSent: string;
  contactErr: string;
  homeTitle: string;
  homeDescription: string;
  endTimePrefix: string;
  sourceKicker: string;
  categoryKicker: string;
  emptyCategory: (category: string) => string;
  emptySource: string;
  icalSubscribe: string;
  jsonLink: string;
  websiteLink: string;
  sourceDescription: (source: string, count: number) => string;
  categoryDescription: (category: string, count: number) => string;
  languageBadge: (lang: string) => string;
  langSwitchAria: string;
  siblingTemplate: string;
  siblingTheaterLabel: string;
  siblingMuseumLabel: string;
  siblingConcertLabel: string;
  askAiLabel: string;
  askAiPrompt: (date: string) => string;
  askAiAria: string;
  faqKicker: string;
  faqItems: { q: string; a: string }[];
}

const de: Translations = {
  tagline: "Vorträge & Diskussionen heute in Frankfurt.",
  category: "Format",
  categoryAll: "Alle",
  categoryVortrag: "Vortrag",
  categoryDiskussion: "Diskussion",
  categoryLesung: "Lesung",
  dateStripLabel: "Tage",
  todayProgrammeTitle: "Heute im lehr.salon",
  emptyTitle: "Heute kein Eintrag — der Saal bleibt zu.",
  emptyTodayAfterPast: "Keine weiteren Vorträge mehr für heute.",
  emptyHint: "Morgen wieder versuchen oder oben ein anderes Datum wählen.",
  pastNote: (n) => `${n} Vortr${n === 1 ? "ag" : "äge"} heute bereits begonnen — ausgeblendet.`,
  emptyDirection: "Pagina vacua",
  empty: "Morgen wieder versuchen oder oben ein anderes Datum wählen.",
  ticketsAction: "Vormerken",
  freeEntry: "Eintritt frei",
  toCalendar: "Zum Kalender",
  reportEvent: "Fehler bei diesem Eintrag melden",
  themeToggle: "Farbthema wechseln",
  weekOverview: "Wochenüberblick",
  reportProblem: "Problem melden",
  imprint: "Impressum",
  digestKicker: "Push-Digest",
  digestCueText: "Morgens lesen, was heute in Frankfurt diskutiert wird.",
  digestTitle: "lehr.salon abonnieren",
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
  digestMorningSub: "Was heute im lehr.salon zu hören ist.",
  digestAfternoonSub: "Was heute Abend noch beginnt.",
  digestSundaySub: "Wochenüberblick — die kommenden sieben Tage.",
  digestFilterLabel: "Auf Format einschränken",
  digestFilterHint: "leer = alle",
  digestSaving: "Wird gespeichert…",
  digestSaved: "Gespeichert.",
  digestUnsubscribing: "Wird abbestellt…",
  digestUnsubscribed: "Abbestellt.",
  digestError: "Speichern fehlgeschlagen.",
  digestClose: "Schließen",
  contactTitle: "Feedback & Korrekturen",
  contactBody: "Falsche Zeit, fehlender Vortrag, Tippfehler? Wir freuen uns über jeden Hinweis.",
  contactCategoryLabel: "Kategorie",
  contactEmailPlaceholder: "dein@email.de",
  contactIntro: "Was stimmt nicht?",
  contactCategoryGeneral: "Allgemein — Feedback / Funktionen",
  contactCategoryEvent: "Eintrag — falsche Daten",
  contactCategorySource: "Quelle — fehlt oder Korrektur",
  contactCategoryBrowser: "Browser",
  contactRegarding: "Betrifft",
  contactMessage: "Nachricht",
  contactEmail: "E-Mail (optional, für Rückfragen)",
  contactSend: "Senden",
  contactSending: "Wird gesendet…",
  contactSent: "Vielen Dank — wir sehen es uns an.",
  contactErr: "Senden fehlgeschlagen.",
  homeTitle: "lehr.salon — Vorträge und Diskussionen heute in Frankfurt",
  homeDescription:
    "Öffentliche Vorträge, Lesungen und Diskussionen in Frankfurt — täglich aktualisiert aus Universität, Akademien, Stiftungen und Salons.",
  endTimePrefix: "bis",
  sourceKicker: "Quelle",
  categoryKicker: "Format",
  emptyCategory: (cat) => `Aktuell keine angekündigten ${cat.toLowerCase()}e.`,
  emptySource: "Noch kein angekündigtes Programm.",
  icalSubscribe: "iCal abonnieren",
  jsonLink: "JSON",
  websiteLink: "Website",
  sourceDescription: (source, count) =>
    `Vorträge und Gespräche bei ${source}. ${count} Termin${count === 1 ? "" : "e"} in den nächsten 60 Tagen.`,
  categoryDescription: (cat, count) =>
    `${cat}-Termine in Frankfurt. ${count} Termin${count === 1 ? "" : "e"} in den nächsten 60 Tagen.`,
  languageBadge: (lang) => `auf ${lang}`,
  langSwitchAria: "Sprache",
  siblingTemplate: "Nichts dabei? Vielleicht stattdessen {first}, {second} oder {third}?",
  siblingTheaterLabel: "ein Theaterstück",
  siblingMuseumLabel: "ein Museumsbesuch",
  siblingConcertLabel: "ein Konzert",
  askAiLabel: "Frag eine KI",
  askAiPrompt: (date) =>
    `Welche Vorträge und Diskussionen finden am ${date} in Frankfurt statt? Quelle: https://frankfurt.lehr.salon`,
  askAiAria: "Frag eine KI nach dem heutigen Programm",
  faqKicker: "Häufige Fragen",
  faqItems: [
    {
      q: "Welche Häuser sind hier vertreten?",
      a: "Aktuell mehr als zehn Frankfurter Institutionen: Polytechnische Gesellschaft, Haus am Dom (Kath. Akademie Rabanus Maurus), Jüdische Gemeinde, FGZ StreitClub, Literaturhaus Frankfurt, Goethe-Uni Bürgeruniversität, Institut für Sozialforschung, Evangelische Akademie, Sigmund-Freud-Institut, Denkbar, Romanfabrik, Deutsch-Israelische Gesellschaft, OPEN BOOKS. Hinzu kommen Vortragstermine aus den Schwesterseiten museumsufer.app und ins.theater.",
    },
    {
      q: "Was zählt als Vortrag, Lesung oder Diskussion?",
      a: "»Vortrag« meint einen monologischen Beitrag — eine Person spricht zum Publikum (Forschungsvortrag, akademische Rede, öffentlicher Vortrag). »Lesung« meint literarische Formate — Autorinnen und Autoren lesen aus ihrem Werk, Buchpräsentationen, Buchmesse-Termine. »Diskussion« meint dialogische Formate mit mehreren Stimmen — Podien, Streitgespräche, Roundtables. Die Zuordnung erfolgt automatisch anhand der Ankündigung; in Grenzfällen entscheidet die Veranstaltungsbeschreibung.",
    },
    {
      q: "Wie aktuell ist das Programm?",
      a: "Die Daten werden mehrmals täglich direkt von den Webseiten der Häuser abgerufen. Absagen oder Programmänderungen erscheinen in der Regel innerhalb weniger Stunden.",
    },
    {
      q: "Sind die Veranstaltungen kostenlos?",
      a: "Viele schon — universitäre Vorträge, Vorträge der Polytechnischen, viele Akademieabende. Andere verlangen einen kleinen Beitrag oder bitten um Anmeldung. Der Vermerk steht jeweils am Eintrag; im Zweifel hilft die Detailseite des Hauses.",
    },
    {
      q: "Warum diese Seite?",
      a: "Frankfurt hat eine außergewöhnliche Dichte an öffentlichen Vortrags- und Gesprächsformaten — von der universitären Bürgeruni über kirchliche Akademien bis zu unabhängigen Salons und Stiftungen. Aber kein gemeinsames Programmheft. Diese Seite legt alle Häuser auf eine durchsuchbare Tagesansicht.",
    },
    {
      q: "Wie funktionieren die Push-Mitteilungen?",
      a: "Über die »Push abonnieren«-Schaltfläche im Header oder Footer. Drei Zeitfenster stehen zur Wahl: morgens (07:00 Uhr), nachmittags (16:00 Uhr) und ein wöchentlicher Sonntagsüberblick (09:00 Uhr). Optional lassen sich die Mitteilungen auf ein Format (Vortrag oder Diskussion) einschränken. Die Anmeldung ist anonym — kein Konto, keine E-Mail — und jederzeit kündbar. Auf iOS muss die Seite vorher als Web-App zum Home-Bildschirm hinzugefügt werden.",
    },
  ],
};

const en: Translations = {
  tagline: "Public lectures & discussions in Frankfurt today.",
  category: "Format",
  categoryAll: "All",
  categoryVortrag: "Lecture",
  categoryDiskussion: "Discussion",
  categoryLesung: "Reading",
  dateStripLabel: "Days",
  todayProgrammeTitle: "Today at lehr.salon",
  emptyTitle: "No entry today — the hall is closed.",
  emptyTodayAfterPast: "No more lectures left today.",
  emptyHint: "Try tomorrow, or pick another date above.",
  pastNote: (n) => `${n} talk${n === 1 ? "" : "s"} already started today — hidden.`,
  emptyDirection: "Pagina vacua",
  empty: "Try tomorrow, or pick another date above.",
  ticketsAction: "Reserve",
  freeEntry: "Free entry",
  toCalendar: "Add to calendar",
  reportEvent: "Report an issue with this entry",
  themeToggle: "Toggle colour theme",
  weekOverview: "Weekly overview",
  reportProblem: "Report a problem",
  imprint: "Imprint",
  digestKicker: "Push digest",
  digestCueText: "Read in the morning what Frankfurt will discuss today.",
  digestTitle: "Subscribe to lehr.salon",
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
  digestAfternoonSub: "What still starts tonight.",
  digestSundaySub: "The week ahead at a glance.",
  digestFilterLabel: "Restrict to format",
  digestFilterHint: "empty = all",
  digestSaving: "Saving…",
  digestSaved: "Saved.",
  digestUnsubscribing: "Unsubscribing…",
  digestUnsubscribed: "Unsubscribed.",
  digestError: "Saving failed.",
  digestClose: "Close",
  contactTitle: "Feedback & corrections",
  contactBody: "Wrong time, missing event, typo? Every hint is welcome.",
  contactCategoryLabel: "Category",
  contactEmailPlaceholder: "you@email.com",
  contactIntro: "What's wrong?",
  contactCategoryGeneral: "General — feedback / features",
  contactCategoryEvent: "Entry — wrong data",
  contactCategorySource: "Source — missing or correction",
  contactCategoryBrowser: "Browser",
  contactRegarding: "Regarding",
  contactMessage: "Message",
  contactEmail: "Email (optional, for follow-up)",
  contactSend: "Send",
  contactSending: "Sending…",
  contactSent: "Thank you — we'll take a look.",
  contactErr: "Sending failed.",
  homeTitle: "lehr.salon — lectures and discussions today in Frankfurt",
  homeDescription:
    "Public lectures, readings and discussions in Frankfurt — daily updates from the university, academies, foundations and salons.",
  endTimePrefix: "until",
  sourceKicker: "Source",
  categoryKicker: "Format",
  emptyCategory: (cat) => `No ${cat.toLowerCase()}s currently announced.`,
  emptySource: "No programme announced yet.",
  icalSubscribe: "Subscribe via iCal",
  jsonLink: "JSON",
  websiteLink: "Website",
  sourceDescription: (source, count) =>
    `Talks and discussions at ${source}. ${count} ${count === 1 ? "event" : "events"} in the next 60 days.`,
  categoryDescription: (cat, count) =>
    `${cat}s in Frankfurt. ${count} ${count === 1 ? "event" : "events"} in the next 60 days.`,
  languageBadge: (lang) => `in ${lang}`,
  langSwitchAria: "Language",
  siblingTemplate: "Nothing for you? How about {first}, {second}, or {third} instead?",
  siblingTheaterLabel: "a play",
  siblingMuseumLabel: "a museum visit",
  siblingConcertLabel: "a concert",
  askAiLabel: "Ask an AI",
  askAiPrompt: (date) =>
    `Which lectures and discussions are happening in Frankfurt on ${date}? Source: https://frankfurt.lehr.salon`,
  askAiAria: "Ask an AI about today's lecture programme",
  faqKicker: "Frequently asked",
  faqItems: [
    {
      q: "Which institutions are covered?",
      a: "Currently more than ten Frankfurt institutions: Polytechnische Gesellschaft, Haus am Dom (Catholic Academy), Jewish Community, FGZ StreitClub, Literaturhaus Frankfurt, Goethe University Citizens' Programme, Institute for Social Research, Protestant Academy, Sigmund Freud Institute, Denkbar, Romanfabrik, German-Israeli Society, OPEN BOOKS. In addition, lecture-format events are cross-imported from the sister sites museumsufer.app and ins.theater.",
    },
    {
      q: "What counts as a lecture, a reading, or a discussion?",
      a: '"Lecture" means a monologic contribution — one person addresses the audience (research talk, academic address, public lecture). "Reading" means literary formats — authors reading from their work, book launches, Buchmesse events. "Discussion" means dialogic formats with multiple voices — panels, debates, roundtables. The classification is automatic from the announcement; in edge cases, the description tips the balance.',
    },
    {
      q: "How current is the programme?",
      a: "Data is scraped several times a day directly from venue websites. Cancellations or programme changes usually surface within a few hours.",
    },
    {
      q: "Are the events free?",
      a: "Many of them — university talks, Polytechnische lectures, many academy evenings. Others ask for a small contribution or registration. The note is shown on each entry; if in doubt, check the venue's detail page.",
    },
    {
      q: "Why this site?",
      a: "Frankfurt has an unusually dense public-lecture and discussion culture — from the university's citizens' programme through ecclesial academies to independent salons and foundations. But no shared programme. This site lays every house onto one searchable day view.",
    },
    {
      q: "How do push notifications work?",
      a: 'Via the "Subscribe" button in the header or footer. Three time slots are available: morning (07:00), afternoon (16:00), and a weekly Sunday overview (09:00). Notifications can optionally be restricted to one format (lecture or discussion). Sign-up is anonymous — no account, no email — and can be cancelled at any time. On iOS, the site must first be added to the home screen as a web app.',
    },
  ],
};

const TRANSLATIONS: Record<Locale, Translations> = { de, en };

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}
