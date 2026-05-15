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
  emptyHint: string;
  pastNote: (n: number) => string;
  castLabel: string;
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
  digestIntro: string;
  digestIosHint: string;
  digestUnsupported: string;
  digestUnsubAll: string;
  /** Button label after the user has an existing subscription — saving changes. */
  digestSave: string;
  /** Button label when no schedule is checked but the user is subscribed — confirm unsubscribe. */
  digestUnsubscribeBtn: string;
  /** Long error shown when the browser refused notification permission. */
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
  /** Body paragraph shown beneath the contact-dialog title. */
  contactBody: string;
  /** Localised category-select label (Kategorie / Category / Catégorie). */
  contactCategoryLabel: string;
  /** Placeholder shown in the e-mail input. */
  contactEmailPlaceholder: string;
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
  siblingLehrLabel: string;
  // Ask AI
  askAiLabel: string;
  askAiPrompt: (date: string) => string;
  askAiAria: string;
  // FAQ
  faqKicker: string;
  faqItems: { q: string; a: string }[];
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
  emptyHint: "Schau morgen wieder vorbei oder wechsle das Datum oben.",
  pastNote: (n) => `${n} Konzert${n === 1 ? "" : "e"} heute bereits begonnen — verborgen.`,
  castLabel: "Mit",
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
  contactBody: "Falsche Zeit, fehlendes Konzert, Tippfehler? Wir freuen uns über jeden Hinweis.",
  contactCategoryLabel: "Kategorie",
  contactEmailPlaceholder: "dein@email.de",
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
  siblingTemplate: "Nichts dabei? Vielleicht stattdessen ein {first}, ein {second} oder ein {third}?",
  siblingTheaterLabel: "Theaterstück",
  siblingMuseumLabel: "Museumsbesuch",
  siblingLehrLabel: "Vortrag",
  askAiLabel: "Frag eine KI",
  askAiPrompt: (date) =>
    `Was wird am ${date} in Frankfurt und Umgebung gespielt? Quelle: https://frankfurt.konzert.haus`,
  askAiAria: "Frag eine KI nach dem heutigen Konzertprogramm",
  faqKicker: "Häufige Fragen",
  faqItems: [
    {
      q: "Welche Spielorte sind hier vertreten?",
      a: "Aktuell 19 Häuser und Reihen in Frankfurt und Umgebung: Alte Oper Frankfurt, Oper Frankfurt, Dr. Hoch's Konservatorium, Hochschule für Musik und Darstellende Kunst Frankfurt (HfMDK), Ensemble Modern, hr-Sinfonieorchester, hr-Bigband, Holzhausenschlösschen, Jazz in Frankfurt, Jazz im Palmengarten, Brotfabrik, Romanfabrik, Kirchenmusik Andreas Köhs, Kirchenmusik Dreikönigsgemeinde, Kantorei St. Katharinen, Kronberg Academy / Casals Forum, Rheingau Musik Festival, Bad Homburger Schlosskonzerte und Bad Sodener Kammerkonzerte.",
    },
    {
      q: "Wie aktuell ist das Programm?",
      a: "Die Daten werden stündlich zwischen 09 und 21 Uhr direkt von den Webseiten der Häuser abgerufen. Absagen, Ausverkauft-Hinweise oder Programmänderungen erscheinen in der Regel innerhalb einer Stunde.",
    },
    {
      q: "Kann ich hier Karten kaufen?",
      a: "Nein — die Tickets-Schaltfläche an jedem Konzert führt direkt auf die Buchungsseite des jeweiligen Hauses oder Vorverkäufers. Diese Seite verkauft selbst keine Karten und nimmt keine Provision.",
    },
    {
      q: "Welche Genres werden abgedeckt?",
      a: "Klassik, Jazz, Kammermusik, Kirchenmusik, Weltmusik und Neue Musik. Pop, Rock und Schlager bewusst nicht — dafür gibt es bessere Plattformen.",
    },
    {
      q: "Was passiert mit Konzerten, die schon angefangen haben?",
      a: "Auf der heutigen Ansicht werden Konzerte 30 Minuten nach Beginn ausgeblendet, damit nur noch erreichbare Termine sichtbar sind. Eine kleine Notiz unter der Liste zeigt, wie viele bereits gestartet sind.",
    },
    {
      q: "Warum diese Seite?",
      a: "Frankfurt hat eine außergewöhnliche Dichte an klassischen und improvisierten Konzerten, aber kein gemeinsames Programmheft. Diese Seite legt alle Häuser auf eine durchsuchbare Tagesansicht — ein Konzertkalender für die ganze Stadt.",
    },
    {
      q: "Wie funktionieren die Push-Mitteilungen?",
      a: "Push-Mitteilungen lassen sich über die »Push-Digest«-Schaltfläche oder den Link im Footer abonnieren. Drei Zeitfenster stehen zur Wahl: morgens (07:00 Uhr), nachmittags (17:00 Uhr) und ein wöchentlicher Sonntagsüberblick (09:00 Uhr). Optional lassen sich die Mitteilungen auf bestimmte Genres einschränken. Die Anmeldung ist anonym — kein Konto, keine E-Mail — und jederzeit kündbar. Auf iOS muss die Seite vorher als Web-App zum Home-Bildschirm hinzugefügt werden.",
    },
  ],
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
  emptyHint: "Check back tomorrow or change the date above.",
  pastNote: (n) => `${n} concert${n === 1 ? "" : "s"} already started today — hidden.`,
  castLabel: "With",
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
  digestFilterLabel: "Restrict to genres",
  digestFilterHint: "empty = all",
  digestSaving: "Saving…",
  digestSaved: "Saved.",
  digestUnsubscribing: "Unsubscribing…",
  digestUnsubscribed: "Unsubscribed.",
  digestError: "Saving failed.",
  digestClose: "Close",
  contactTitle: "Feedback & corrections",
  contactBody: "Wrong time, missing concert, typo? Every hint is welcome.",
  contactCategoryLabel: "Category",
  contactEmailPlaceholder: "you@email.com",
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
  siblingTemplate: "Nothing for you? How about {first}, {second}, or {third} instead?",
  siblingTheaterLabel: "a play",
  siblingMuseumLabel: "a museum visit",
  siblingLehrLabel: "a lecture",
  askAiLabel: "Ask an AI",
  askAiPrompt: (date) =>
    `What's on in Frankfurt and the wider region on ${date}? Source: https://frankfurt.konzert.haus`,
  askAiAria: "Ask an AI about today's concert programme",
  faqKicker: "Frequently asked",
  faqItems: [
    {
      q: "Which venues are covered?",
      a: "Currently 19 venues and series in Frankfurt and the surrounding area: Alte Oper Frankfurt, Oper Frankfurt, Dr Hoch's Konservatorium, Hochschule für Musik und Darstellende Kunst Frankfurt (HfMDK), Ensemble Modern, hr-Sinfonieorchester, hr-Bigband, Holzhausenschlösschen, Jazz in Frankfurt, Jazz im Palmengarten, Brotfabrik, Romanfabrik, Kirchenmusik Andreas Köhs, Kirchenmusik Dreikönigsgemeinde, Kantorei St. Katharinen, Kronberg Academy / Casals Forum, Rheingau Music Festival, Bad Homburg Castle Concerts and Bad Soden Chamber Concerts.",
    },
    {
      q: "How current is the programme?",
      a: "Data is scraped hourly between 09:00 and 21:00 Berlin time directly from venue websites. Cancellations, sold-out flags, and programme changes usually surface within an hour.",
    },
    {
      q: "Can I buy tickets here?",
      a: "No — the Tickets button on each concert links directly to the venue's or pre-sale's own booking page. This site doesn't sell tickets and takes no commission.",
    },
    {
      q: "Which genres are covered?",
      a: "Classical, jazz, chamber music, sacred music, world music and new/experimental music. Pop, rock and Schlager are deliberately out of scope — other platforms cover those better.",
    },
    {
      q: "What happens to concerts that have already started?",
      a: "On today's view, concerts are hidden 30 minutes after their start time, so only reachable performances remain visible. A small note at the bottom shows how many have already begun.",
    },
    {
      q: "Why this site?",
      a: "Frankfurt has an unusually dense classical and improvised concert scene, but no shared programme. This site lays every house onto one searchable day view — a concert calendar for the whole city.",
    },
    {
      q: "How do push notifications work?",
      a: 'Subscribe via the "Push Digest" button or the footer link. Three time slots are available: morning (07:00), afternoon (17:00) and a weekly Sunday overview (09:00). Notifications can optionally be restricted to specific genres. Sign-up is anonymous — no account, no email — and can be cancelled at any time. On iOS, the site must first be added to the home screen as a web app.',
    },
  ],
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
  emptyHint: "Repasse demain ou choisis une autre date ci-dessus.",
  pastNote: (n) =>
    `${n} concert${n === 1 ? "" : "s"} déjà commencé${n === 1 ? "" : "s"} aujourd'hui — masqué${n === 1 ? "" : "s"}.`,
  castLabel: "Avec",
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
  digestIntro: "Messages push directement sur l'appareil — pas d'e-mail, pas de compte. Annulable à tout moment.",
  digestIosHint:
    "<strong>iPhone :</strong> Appuie sur « Partager » puis « Ajouter à l'écran d'accueil ». Ouvre ensuite depuis l'icône — c'est seulement à ce moment que les notifications push fonctionnent.",
  digestUnsupported:
    "Ton navigateur ne prend pas en charge les notifications push. Essaie Safari (macOS), Chrome, Firefox ou Edge.",
  digestUnsubAll: "Tout désabonner",
  digestSave: "Enregistrer",
  digestUnsubscribeBtn: "Se désabonner",
  digestPermissionDenied: "Les notifications ont été bloquées. Autorise-les dans les paramètres du navigateur.",
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
  contactBody: "Heure erronée, concert manquant, faute de frappe ? Toute remarque est la bienvenue.",
  contactCategoryLabel: "Catégorie",
  contactEmailPlaceholder: "toi@email.fr",
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
  siblingTemplate: "Rien pour toi ? Pourquoi pas {first}, {second} ou {third} à la place ?",
  siblingTheaterLabel: "une pièce",
  siblingMuseumLabel: "une visite au musée",
  siblingLehrLabel: "une conférence",
  askAiLabel: "Demande à une IA",
  askAiPrompt: (date) =>
    `Que joue-t-on à Francfort et dans la région le ${date} ? Source : https://frankfurt.konzert.haus`,
  askAiAria: "Demande à une IA le programme de concerts du jour",
  faqKicker: "Questions fréquentes",
  faqItems: [
    {
      q: "Quelles salles sont couvertes ?",
      a: "Actuellement 19 salles et séries à Francfort et ses environs : Alte Oper Frankfurt, Oper Frankfurt, Dr. Hoch's Konservatorium, Hochschule für Musik und Darstellende Kunst Frankfurt (HfMDK), Ensemble Modern, hr-Sinfonieorchester, hr-Bigband, Holzhausenschlösschen, Jazz in Frankfurt, Jazz im Palmengarten, Brotfabrik, Romanfabrik, Kirchenmusik Andreas Köhs, Kirchenmusik Dreikönigsgemeinde, Kantorei St. Katharinen, Kronberg Academy / Casals Forum, Rheingau Musik Festival, Bad Homburger Schlosskonzerte et Bad Sodener Kammerkonzerte.",
    },
    {
      q: "À quel point le programme est-il à jour ?",
      a: "Les données sont collectées toutes les heures entre 09h et 21h depuis les sites des salles. Les annulations, les complets et les modifications de programme apparaissent généralement en moins d'une heure.",
    },
    {
      q: "Puis-je acheter des billets ici ?",
      a: "Non — le bouton Billets de chaque concert renvoie directement à la page de réservation de la salle ou du prévendeur. Ce site ne vend pas de billets et ne perçoit aucune commission.",
    },
    {
      q: "Quels genres sont couverts ?",
      a: "Classique, jazz, musique de chambre, musique sacrée, musiques du monde et musique contemporaine. Pop, rock et Schlager sont volontairement exclus — d'autres plateformes les couvrent mieux.",
    },
    {
      q: "Et les concerts déjà commencés ?",
      a: "Sur la vue du jour, les concerts sont masqués 30 minutes après leur heure de début, pour ne montrer que ceux encore accessibles. Une petite note en bas indique combien ont déjà commencé.",
    },
    {
      q: "Pourquoi ce site ?",
      a: "Francfort possède une scène classique et improvisée d'une densité rare, mais aucun programme commun. Ce site rassemble toutes les salles dans une vue quotidienne consultable — un calendrier de concerts pour toute la ville.",
    },
    {
      q: "Comment fonctionnent les notifications push ?",
      a: "Il est possible de s'abonner aux notifications push via le bouton « Push-Digest » ou le lien dans le pied de page. Trois plages horaires sont disponibles : le matin (07h00), l'après-midi (17h00) et un aperçu hebdomadaire le dimanche (09h00). En option, il est possible de limiter les notifications à certains genres. L'inscription est anonyme — pas de compte, pas d'e-mail — et résiliable à tout moment. Sur iOS, le site doit d'abord être ajouté à l'écran d'accueil en tant qu'application web.",
    },
  ],
};

const TRANSLATIONS: Record<Locale, Translations> = { de, en, fr };

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}
