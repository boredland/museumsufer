import { type Locale as CoreLocale, detectLocale as coreDetect, dateLocale } from "@museumsufer/core";

export type Locale = Extract<CoreLocale, "de" | "en" | "fr">;
export const SUPPORTED_LOCALES: Locale[] = ["de", "en", "fr"];
export const DEFAULT_LOCALE: Locale = "de";

export function detectLocale(request: Request): Locale {
  return coreDetect(request, SUPPORTED_LOCALES, DEFAULT_LOCALE);
}

export { dateLocale };

export interface Translations {
  tagline: string;
  genre: string;
  genreAll: string;
  genreClassical: string;
  genreJazz: string;
  genreSacred: string;
  genreWorld: string;
  genreExperimental: string;
  genreChamber: string;
  dateStripLabel: string;
  todayProgrammeTitle: string;
  emptyTitle: string;
  emptyTodayAfterPast: string;
  pastNote: (n: number) => string;
  empty: string;
  ticketsAction: string;
  freeEntry: string;
  toCalendar: string;
  reportConcert: string;
  themeToggle: string;
  weekOverview: string;
  reportProblem: string;
  imprint: string;
  digestKicker: string;
  digestCueText: string;
  digestTitle: string;
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
  contactIntro: string;
  contactCategoryGeneral: string;
  contactCategoryConcert: string;
  contactCategoryVenue: string;
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
  // Venue + genre pages
  endTimePrefix: string;
  venueKicker: string;
  genreKicker: string;
  emptyGenre: (genre: string) => string;
  emptyVenue: string;
  icalSubscribe: string;
  jsonLink: string;
  websiteLink: string;
  venueDescription: (venue: string, count: number) => string;
  genreDescription: (genre: string, count: number) => string;
  // a11y
  langSwitchAria: string;
  // Cross-app suggestion strap (theater + museum)
  siblingTemplate: string;
  siblingTheaterLabel: string;
  siblingMuseumLabel: string;
}

const de: Translations = {
  tagline: "Was heute in Frankfurt und Umgebung erklingt.",
  genre: "Genre",
  genreAll: "Alle",
  genreClassical: "Klassik",
  genreJazz: "Jazz",
  genreSacred: "Kirchenmusik",
  genreWorld: "Weltmusik",
  genreExperimental: "Neue Musik",
  genreChamber: "Kammermusik",
  dateStripLabel: "Konzerttage",
  todayProgrammeTitle: "Heutige Konzerte",
  emptyTitle: "Heute keine Konzerte gemeldet.",
  emptyTodayAfterPast: "Heute keine kommenden Konzerte mehr.",
  pastNote: (n) => `${n} Konzert${n === 1 ? "" : "e"} heute bereits begonnen — verborgen.`,
  empty: "Schau morgen wieder vorbei oder wechsle das Datum oben.",
  ticketsAction: "Karten",
  freeEntry: "Eintritt frei",
  toCalendar: "Zum Kalender",
  reportConcert: "Fehler bei diesem Konzert melden",
  themeToggle: "Farbthema wechseln",
  weekOverview: "Wochenüberblick",
  reportProblem: "Problem melden",
  imprint: "Impressum",
  digestKicker: "Push-Digest",
  digestCueText: "Erfahre morgens, was heute klingt.",
  digestTitle: "Konzerte abonnieren",
  digestSubscribe: "Push abonnieren",
  digestSchedules: "Digest-Zeitpunkte",
  digestMorning: "Jeden Morgen",
  digestAfternoon: "Jeden Nachmittag",
  digestSunday: "Sonntag-Digest",
  digestMorningSub: "Programm für den heutigen Tag.",
  digestAfternoonSub: "Was heute Abend noch läuft.",
  digestSundaySub: "Wochenüberblick — die kommende Woche.",
  digestFilterLabel: "Genres einschränken",
  digestFilterHint: "leer = alle",
  digestSaving: "Wird gespeichert…",
  digestSaved: "Gespeichert.",
  digestUnsubscribing: "Wird abbestellt…",
  digestUnsubscribed: "Abbestellt.",
  digestError: "Speichern fehlgeschlagen.",
  digestClose: "Schließen",
  contactTitle: "Feedback & Korrekturen",
  contactIntro: "Was stimmt nicht?",
  contactCategoryGeneral: "Allgemein — Feedback / Funktionen",
  contactCategoryConcert: "Konzert — falsche Daten",
  contactCategoryVenue: "Spielort — fehlt oder Korrektur",
  contactCategoryBrowser: "Browser",
  contactRegarding: "Betrifft",
  contactMessage: "Nachricht",
  contactEmail: "E-Mail (optional, für Rückfragen)",
  contactSend: "Senden",
  contactSending: "Wird gesendet…",
  contactSent: "Vielen Dank — wir sehen es uns an.",
  contactErr: "Senden fehlgeschlagen.",
  homeTitle: "konzert.haus — Konzerte heute in Frankfurt",
  homeDescription:
    "Klassik, Jazz, Kammermusik, Kirchenmusik und Neue Musik — täglich aktualisiertes Programm aus Frankfurt und der Rhein-Main-Region.",
  endTimePrefix: "bis",
  venueKicker: "Spielort",
  genreKicker: "Genre",
  emptyGenre: (genre) => `Aktuell keine angekündigten ${genre}-Konzerte.`,
  emptyVenue: "Noch kein angekündigtes Programm.",
  icalSubscribe: "iCal abonnieren",
  jsonLink: "JSON",
  websiteLink: "Website",
  venueDescription: (venue, count) =>
    `Konzerte bei ${venue}. ${count} Termin${count === 1 ? "" : "e"} in den nächsten 60 Tagen.`,
  genreDescription: (genre, count) =>
    `${genre}-Konzerte in Frankfurt und Umgebung. ${count} Termin${count === 1 ? "" : "e"} in den nächsten 60 Tagen.`,
  langSwitchAria: "Sprache",
  siblingTemplate: "Nichts dabei? Wie wäre es stattdessen mit einem {first} oder {second}?",
  siblingTheaterLabel: "Theaterstück",
  siblingMuseumLabel: "Museumsbesuch",
};

const en: Translations = {
  tagline: "What's playing tonight in Frankfurt and around.",
  genre: "Genre",
  genreAll: "All",
  genreClassical: "Classical",
  genreJazz: "Jazz",
  genreSacred: "Sacred music",
  genreWorld: "World music",
  genreExperimental: "New music",
  genreChamber: "Chamber",
  dateStripLabel: "Concert days",
  todayProgrammeTitle: "Tonight's concerts",
  emptyTitle: "No concerts announced today.",
  emptyTodayAfterPast: "No more upcoming concerts today.",
  pastNote: (n) => `${n} concert${n === 1 ? "" : "s"} already started today — hidden.`,
  empty: "Check back tomorrow or change the date above.",
  ticketsAction: "Tickets",
  freeEntry: "Free entry",
  toCalendar: "Add to calendar",
  reportConcert: "Report an issue with this concert",
  themeToggle: "Toggle colour theme",
  weekOverview: "Weekly overview",
  reportProblem: "Report a problem",
  imprint: "Imprint",
  digestKicker: "Push digest",
  digestCueText: "Wake up to what's on tonight.",
  digestTitle: "Subscribe to concerts",
  digestSubscribe: "Subscribe",
  digestSchedules: "Digest times",
  digestMorning: "Every morning",
  digestAfternoon: "Every afternoon",
  digestSunday: "Sunday digest",
  digestMorningSub: "Today's programme.",
  digestAfternoonSub: "What's still on tonight.",
  digestSundaySub: "The week ahead at a glance.",
  digestFilterLabel: "Restrict to genres",
  digestFilterHint: "empty = all",
  digestSaving: "Saving…",
  digestSaved: "Saved.",
  digestUnsubscribing: "Unsubscribing…",
  digestUnsubscribed: "Unsubscribed.",
  digestError: "Saving failed.",
  digestClose: "Close",
  contactTitle: "Feedback & corrections",
  contactIntro: "What's wrong?",
  contactCategoryGeneral: "General — feedback / features",
  contactCategoryConcert: "Concert — wrong data",
  contactCategoryVenue: "Venue — missing or correction",
  contactCategoryBrowser: "Browser",
  contactRegarding: "Regarding",
  contactMessage: "Message",
  contactEmail: "Email (optional, for follow-up)",
  contactSend: "Send",
  contactSending: "Sending…",
  contactSent: "Thank you — we'll take a look.",
  contactErr: "Sending failed.",
  homeTitle: "konzert.haus — concerts today in Frankfurt",
  homeDescription:
    "Classical, jazz, chamber, sacred and new music — daily programme from Frankfurt and the Rhine-Main region.",
  endTimePrefix: "until",
  venueKicker: "Venue",
  genreKicker: "Genre",
  emptyGenre: (genre) => `No ${genre.toLowerCase()} concerts currently announced.`,
  emptyVenue: "No programme announced yet.",
  icalSubscribe: "Subscribe via iCal",
  jsonLink: "JSON",
  websiteLink: "Website",
  venueDescription: (venue, count) =>
    `Concerts at ${venue}. ${count} ${count === 1 ? "event" : "events"} in the next 60 days.`,
  genreDescription: (genre, count) =>
    `${genre} concerts in Frankfurt and around. ${count} ${count === 1 ? "event" : "events"} in the next 60 days.`,
  langSwitchAria: "Language",
  siblingTemplate: "Nothing for you? How about {first} or {second} instead?",
  siblingTheaterLabel: "a play",
  siblingMuseumLabel: "a museum visit",
};

const fr: Translations = {
  tagline: "Ce qui résonne aujourd'hui à Francfort et alentour.",
  genre: "Genre",
  genreAll: "Tous",
  genreClassical: "Classique",
  genreJazz: "Jazz",
  genreSacred: "Musique sacrée",
  genreWorld: "Musique du monde",
  genreExperimental: "Musique contemporaine",
  genreChamber: "Musique de chambre",
  dateStripLabel: "Jours de concert",
  todayProgrammeTitle: "Concerts de ce soir",
  emptyTitle: "Aucun concert annoncé aujourd'hui.",
  emptyTodayAfterPast: "Plus de concerts à venir aujourd'hui.",
  pastNote: (n) =>
    `${n} concert${n === 1 ? "" : "s"} déjà commencé${n === 1 ? "" : "s"} aujourd'hui — masqué${n === 1 ? "" : "s"}.`,
  empty: "Repasse demain ou choisis une autre date ci-dessus.",
  ticketsAction: "Billets",
  freeEntry: "Entrée libre",
  toCalendar: "Ajouter à l'agenda",
  reportConcert: "Signaler une erreur sur ce concert",
  themeToggle: "Changer de thème",
  weekOverview: "Aperçu de la semaine",
  reportProblem: "Signaler un problème",
  imprint: "Mentions légales",
  digestKicker: "Digest push",
  digestCueText: "Découvre chaque matin ce qui résonne aujourd'hui.",
  digestTitle: "S'abonner aux concerts",
  digestSubscribe: "S'abonner",
  digestSchedules: "Horaires du digest",
  digestMorning: "Tous les matins",
  digestAfternoon: "Chaque après-midi",
  digestSunday: "Digest du dimanche",
  digestMorningSub: "Programme de la journée.",
  digestAfternoonSub: "Ce qui passe encore ce soir.",
  digestSundaySub: "La semaine à venir en un coup d'œil.",
  digestFilterLabel: "Filtrer par genre",
  digestFilterHint: "vide = tous",
  digestSaving: "Enregistrement…",
  digestSaved: "Enregistré.",
  digestUnsubscribing: "Désabonnement…",
  digestUnsubscribed: "Désabonné.",
  digestError: "Échec de l'enregistrement.",
  digestClose: "Fermer",
  contactTitle: "Retours & corrections",
  contactIntro: "Qu'est-ce qui ne va pas ?",
  contactCategoryGeneral: "Général — retours / fonctionnalités",
  contactCategoryConcert: "Concert — données erronées",
  contactCategoryVenue: "Salle — manquante ou correction",
  contactCategoryBrowser: "Navigateur",
  contactRegarding: "Concerne",
  contactMessage: "Message",
  contactEmail: "E-mail (facultatif, pour suivi)",
  contactSend: "Envoyer",
  contactSending: "Envoi…",
  contactSent: "Merci — nous allons regarder cela.",
  contactErr: "Échec de l'envoi.",
  homeTitle: "konzert.haus — concerts à Francfort aujourd'hui",
  homeDescription:
    "Classique, jazz, musique de chambre, musique sacrée et contemporaine — programme actualisé quotidiennement de Francfort et de la région Rhin-Main.",
  endTimePrefix: "jusqu'à",
  venueKicker: "Salle",
  genreKicker: "Genre",
  emptyGenre: (genre) => `Aucun concert de ${genre.toLowerCase()} annoncé pour l'instant.`,
  emptyVenue: "Aucun programme annoncé pour l'instant.",
  icalSubscribe: "S'abonner à iCal",
  jsonLink: "JSON",
  websiteLink: "Site",
  venueDescription: (venue, count) => `Concerts à ${venue}. ${count} rendez-vous dans les 60 prochains jours.`,
  genreDescription: (genre, count) =>
    `Concerts de ${genre.toLowerCase()} à Francfort et alentour. ${count} rendez-vous dans les 60 prochains jours.`,
  langSwitchAria: "Langue",
  siblingTemplate: "Rien pour toi ? Pourquoi pas {first} ou {second} à la place ?",
  siblingTheaterLabel: "une pièce",
  siblingMuseumLabel: "une visite au musée",
};

const TRANSLATIONS: Record<Locale, Translations> = { de, en, fr };

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}
