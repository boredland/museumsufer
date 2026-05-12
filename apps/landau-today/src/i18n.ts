import { type Locale as CoreLocale, detectLocale as coreDetect } from "@museumsufer/core";

export type Locale = Extract<CoreLocale, "de" | "fr">;
export const SUPPORTED_LOCALES: Locale[] = ["de", "fr"];
export const DEFAULT_LOCALE: Locale = "de";

export function detectLocale(request: Request): Locale {
  return coreDetect(request, SUPPORTED_LOCALES, DEFAULT_LOCALE);
}

export interface FaqEntry {
  q: string;
  a: string;
}

export interface Translations {
  // Page chrome
  subtitle: string;
  homeTitle: string;
  homeDescription: string;
  footerLine: string;
  skipToContent: string;
  themeToggle: string;
  // Search
  searchLabel: string;
  searchPlaceholder: string;
  searchEmpty: string;
  // ChipRow + DayHeadline
  chipAll: string;
  ariaCategory: string;
  ariaDate: string;
  nearby: string;
  nearbyHint: string;
  eventSingular: string;
  eventPlural: string;
  emptyDay: string;
  todaysEvents: string;
  today: string;
  // Event row controls
  copyDirectLink: string;
  markVisited: string;
  // Footer + dialog open buttons
  digestSubscribe: string;
  reportProblem: string;
  subscribeCalendar: string;
  imprint: string;
  // FAQ
  faqTitle: string;
  faq: FaqEntry[];
  // Digest cue
  digestCueText: string;
  digestKicker: string;
  // Digest dialog
  digestDialogTitle: string;
  digestDialogIntro: string;
  digestMorning: string;
  digestMorningSub: string;
  digestAfternoon: string;
  digestAfternoonSub: string;
  digestWeekly: string;
  digestWeeklySub: string;
  digestRestrictCategories: string;
  digestRestrictHint: string;
  digestIosHint: string;
  digestBrowserUnsupported: string;
  digestSubscribeBtn: string;
  digestUnsubscribeAll: string;
  digestSchedulesLabel: string;
  // Contact dialog
  contactTitle: string;
  contactIntro: string;
  contactCategoryEvent: string;
  contactCategorySource: string;
  contactCategoryGeneral: string;
  contactEmailLabel: string;
  contactMessageLabel: string;
  contactSendBtn: string;
  // Generic close
  close: string;
  // Imprint
  imprintBack: string;
  imprintTitle: string;
  imprintProvider: string;
  imprintContact: string;
  imprintResponsible: string;
  imprintDataSource: string;
  imprintDataSourceBody: string;
  imprintDisclaimer: string;
  imprintDisclaimerBody: string;
  imprintSource: string;
  // Event detail page
  evPast: string;
  evDirections: string;
  evCalendar: string;
  evMore: string;
  evViewSource: string;
  evShare: string;
  evLinkCopied: string;
  evBackToProgramme: string;
  /** German "Uhr" suffix; empty in FR. */
  timeSuffix: string;
  // a11y
  langSwitchAria: string;
  imprintMetaDescription: string;
  // Error pages
  errInvalidRequest: string;
  err404Title: string;
  err404Body: string;
  err404Back: string;
  err500Title: string;
  err500Body: string;
  err500Back: string;
  // Categories
  categories: Record<string, { label: string; short: string }>;
}

const de: Translations = {
  subtitle: "Veranstaltungsblatt für die Südliche Weinstraße",
  homeTitle: "landau.today — Veranstaltungen heute in Landau in der Pfalz",
  homeDescription:
    "Veranstaltungen in Landau in der Pfalz und an der Südlichen Weinstraße — Konzert, Theater, Tanz, Lesung, Weinfest, Ausstellung, Stadtführung.",
  footerLine: "Landau heute · Heimatzeitung für Veranstaltungen",
  skipToContent: "Zum Inhalt",
  themeToggle: "Hell/Dunkel wechseln",
  searchLabel: "Suchen",
  searchPlaceholder: "Suchen — Konzert, Theater, Veranstalter, Ort …",
  searchEmpty: "Keine Treffer",
  chipAll: "Alle",
  ariaCategory: "Kategorie",
  ariaDate: "Datum",
  nearby: "In der Nähe",
  nearbyHint: "Sortiert nach Entfernung zu deinem Standort",
  eventSingular: "Veranstaltung",
  eventPlural: "Veranstaltungen",
  emptyDay: "Heute kein Programm gefunden.",
  todaysEvents: "Heutige Termine",
  today: "heute",
  copyDirectLink: "Direktlink kopieren",
  markVisited: "Als besucht markieren",
  digestSubscribe: "Push abonnieren",
  reportProblem: "Problem melden",
  subscribeCalendar: "Kalender abonnieren",
  imprint: "Impressum",
  faqTitle: "Fragen & Antworten",
  faq: [
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
    {
      q: "Wie funktionieren die Push-Mitteilungen?",
      a: "Push-Mitteilungen lassen sich über die »Push-Digest«-Schaltfläche oder den Link im Footer abonnieren. Drei Zeitfenster stehen zur Wahl: morgens (07:00 Uhr), nachmittags (17:00 Uhr) und ein wöchentlicher Sonntagsüberblick (09:00 Uhr). Optional lassen sich die Mitteilungen auf bestimmte Kategorien einschränken. Die Anmeldung ist anonym — kein Konto, keine E-Mail — und jederzeit kündbar. Auf iOS muss die Seite vorher als Web-App zum Home-Bildschirm hinzugefügt werden.",
    },
  ],
  digestCueText: "Erfahre morgens, was heute in der Pfalz läuft.",
  digestKicker: "Push-Digest",
  digestDialogTitle: "Veranstaltungen abonnieren",
  digestDialogIntro: "Push-Nachrichten direkt aufs Gerät — keine E-Mail, kein Konto. Jederzeit abbestellbar.",
  digestMorning: "Jeden Morgen",
  digestMorningSub: "Heutige Termine",
  digestAfternoon: "Jeden Nachmittag",
  digestAfternoonSub: "Was läuft heute Abend?",
  digestWeekly: "Sonntag-Digest",
  digestWeeklySub: "Wochenüberblick",
  digestRestrictCategories: "Kategorien einschränken",
  digestRestrictHint: "leer = alle",
  digestIosHint:
    "Auf iPhone/iPad: Tippe »Teilen« und »Zum Home-Bildschirm hinzufügen«. Öffne die Seite anschließend über das App-Icon — erst dann sind Push-Nachrichten möglich.",
  digestBrowserUnsupported:
    "Dein Browser unterstützt keine Push-Nachrichten. Probier es in Safari (macOS), Chrome, Firefox oder Edge.",
  digestSubscribeBtn: "Abonnieren",
  digestUnsubscribeAll: "Alle abbestellen",
  digestSchedulesLabel: "Digest-Zeitpunkte",
  contactTitle: "Feedback & Korrekturen",
  contactIntro: "Fehlende Veranstaltung, falsche Zeit, Tippfehler? Wir freuen uns über jeden Hinweis.",
  contactCategoryEvent: "Veranstaltung — fehlt oder falsch",
  contactCategorySource: "Quelle — neue Seite vorschlagen",
  contactCategoryGeneral: "Allgemein — Feedback / Funktionen",
  contactEmailLabel: "E-Mail (optional, für Rückfragen)",
  contactMessageLabel: "Nachricht",
  contactSendBtn: "Senden",
  close: "Schließen",
  imprintBack: "Zurück zum Veranstaltungsblatt",
  imprintTitle: "Impressum",
  imprintProvider: "Anbieter (TMG §5)",
  imprintContact: "Kontakt",
  imprintResponsible: "Inhaltlich Verantwortlicher gemäß §18 Abs. 2 MStV",
  imprintDataSource: "Datenherkunft",
  imprintDataSourceBody:
    "Veranstaltungstermine werden automatisiert aus öffentlichen Quellen aggregiert: Kulturnetz Landau, Stadt Landau, Stiftung Hambacher Schloss, RPTU Kaiserslautern-Landau, Pfalz.de und Südliche Weinstraße Tourismus. Die Rechte an den Inhalten verbleiben bei den jeweiligen Veranstaltern. Diese Seite hat keinerlei kommerzielle Beziehung zu den gelisteten Veranstaltern und übernimmt keine Verantwortung für die Richtigkeit der angezeigten Daten — bitte prüfen Sie alle Angaben vor Ihrem Besuch beim Veranstalter.",
  imprintDisclaimer: "Haftungsausschluss",
  imprintDisclaimerBody:
    "Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.",
  imprintSource: "Quellcode",
  evPast: "vorbei",
  evDirections: "Anfahrt",
  evCalendar: "Kalender",
  evMore: "Mehr",
  evViewSource: "Quelle ansehen",
  evShare: "Teilen",
  evLinkCopied: "Link kopiert",
  evBackToProgramme: "Zurück zum Programm",
  timeSuffix: "Uhr",
  langSwitchAria: "Sprache",
  imprintMetaDescription: "Kontakt, Verantwortlichkeit und rechtliche Hinweise zu landau.today.",
  errInvalidRequest: "Ungültige Anfrage.",
  err404Title: "Nicht gefunden",
  err404Body: "Diese Seite existiert nicht.",
  err404Back: "Zurück zum Programm",
  err500Title: "Fehler",
  err500Body: "Etwas ist schief gegangen.",
  err500Back: "Zur Startseite",
  categories: {
    konzert: { label: "Konzert", short: "Konzert" },
    theater: { label: "Theater", short: "Theater" },
    tanz: { label: "Tanz", short: "Tanz" },
    kino: { label: "Kino", short: "Kino" },
    kabarett: { label: "Kabarett & Comedy", short: "Kabarett" },
    literatur: { label: "Literatur", short: "Literatur" },
    vortrag: { label: "Vortrag", short: "Vortrag" },
    ausstellung: { label: "Ausstellung", short: "Ausstellung" },
    feste: { label: "Feste & Feiern", short: "Feste" },
    "junge-kultur": { label: "Junge Kultur", short: "Junge Kultur" },
    kurse: { label: "Kurse & Workshops", short: "Kurse" },
    nachtleben: { label: "Nachtleben", short: "Nachtleben" },
    gedenken: { label: "Gedenken", short: "Gedenken" },
    exkursion: { label: "Exkursion", short: "Exkursion" },
    sport: { label: "Sport", short: "Sport" },
    sonstiges: { label: "Sonstiges", short: "Sonstiges" },
  },
};

const fr: Translations = {
  subtitle: "Le journal des événements de la Route du Vin du Sud",
  homeTitle: "landau.today — événements aujourd'hui à Landau in der Pfalz",
  homeDescription:
    "Événements à Landau in der Pfalz et sur la Route du Vin du Sud — concert, théâtre, danse, lecture, fête du vin, exposition, visite guidée.",
  footerLine: "Landau aujourd'hui · journal local des événements",
  skipToContent: "Aller au contenu",
  themeToggle: "Clair/obscur",
  searchLabel: "Rechercher",
  searchPlaceholder: "Rechercher — concert, théâtre, organisateur, lieu…",
  searchEmpty: "Aucun résultat",
  chipAll: "Tous",
  ariaCategory: "Catégorie",
  ariaDate: "Date",
  nearby: "À proximité",
  nearbyHint: "Trié par distance depuis ta position",
  eventSingular: "événement",
  eventPlural: "événements",
  emptyDay: "Aucun programme trouvé pour aujourd'hui.",
  todaysEvents: "Événements du jour",
  today: "aujourd'hui",
  copyDirectLink: "Copier le lien direct",
  markVisited: "Marquer comme visité",
  digestSubscribe: "S'abonner",
  reportProblem: "Signaler un problème",
  subscribeCalendar: "S'abonner au calendrier",
  imprint: "Mentions légales",
  faqTitle: "Questions & réponses",
  faq: [
    {
      q: "D'où proviennent les événements ?",
      a: "Agrégés quotidiennement à partir de six sources publiques : Kulturnetz Landau (kulturnetz-landau.de), ville de Landau (landau.de), fondation du château de Hambach, RPTU Kaiserslautern-Landau (filtrée sur Landau), Pfalz.de et Südliche Weinstraße Tourismus. Nous renvoyons vers les originaux pour chaque événement.",
    },
    {
      q: "Pourquoi certains événements ne sont-ils pas à Landau, mais dans les villages environnants ?",
      a: "landau.today se veut un journal des événements de Landau et de la Route du Vin du Sud. Concerts, fêtes du vin et visites guidées de Bornheim, Edenkoben, Annweiler et des quartiers de Landau font partie du quotidien de beaucoup d'habitant·e·s — et c'est cette région qui est le foyer thématique du site.",
    },
    {
      q: "Comment signaler un événement qui manque ici ?",
      a: "Écris directement à la source d'origine : la ville de Landau gère une entrée ouverte sur landau.de/Tourismus-Kultur/Veranstaltungen, Kulturnetz Landau a un formulaire de participation sur kulturnetz-landau.de/mitmachen. Ce qui y est saisi apparaît automatiquement ici le lendemain.",
    },
    {
      q: "Que signifie la carte avec le symbole boussole « À proximité » ?",
      a: "C'est un filtre optionnel : si tu l'actives et que le navigateur demande ta position, nous trions les événements par distance à vol d'oiseau depuis ta position actuelle. Les données de localisation ne quittent pas le navigateur — le calcul est fait localement.",
    },
    {
      q: "Puis-je m'abonner au calendrier ?",
      a: "Oui. /feed.ics est un abonnement iCalendar des 14 prochains jours ; ajoute-le simplement dans Apple Calendar, Google Calendar ou Outlook. Pour les lecteurs RSS, /feed.xml couvre les 7 prochains jours.",
    },
    {
      q: "Mes données sont-elles suivies ?",
      a: "Non. Pas d'analytics, pas de cookies, pas de compte. Le service worker stocke uniquement le contenu des pages dans le cache du navigateur pour une utilisation hors-ligne.",
    },
    {
      q: "Comment fonctionnent les notifications push ?",
      a: "Il est possible de s'abonner aux notifications push via le bouton « Push-Digest » ou le lien dans le pied de page. Trois plages horaires sont disponibles : le matin (07h00), l'après-midi (17h00) et un aperçu hebdomadaire le dimanche (09h00). En option, il est possible de limiter les notifications à certaines catégories. L'inscription est anonyme — pas de compte, pas d'e-mail — et résiliable à tout moment. Sur iOS, le site doit d'abord être ajouté à l'écran d'accueil en tant qu'application web.",
    },
  ],
  digestCueText: "Découvre chaque matin ce qui se passe aujourd'hui dans le Palatinat.",
  digestKicker: "Digest push",
  digestDialogTitle: "S'abonner aux événements",
  digestDialogIntro:
    "Notifications push directement sur ton appareil — pas d'e-mail, pas de compte. Désabonnement à tout moment.",
  digestMorning: "Tous les matins",
  digestMorningSub: "Événements du jour",
  digestAfternoon: "Tous les après-midis",
  digestAfternoonSub: "Ce qui passe ce soir",
  digestWeekly: "Digest du dimanche",
  digestWeeklySub: "Aperçu de la semaine",
  digestRestrictCategories: "Filtrer par catégorie",
  digestRestrictHint: "vide = tout",
  digestIosHint:
    "Sur iPhone/iPad : appuie sur « Partager » puis « Sur l'écran d'accueil ». Ouvre ensuite la page via l'icône — c'est seulement là que les notifications push deviennent possibles.",
  digestBrowserUnsupported:
    "Ton navigateur ne supporte pas les notifications push. Essaie Safari (macOS), Chrome, Firefox ou Edge.",
  digestSubscribeBtn: "S'abonner",
  digestUnsubscribeAll: "Tout désabonner",
  digestSchedulesLabel: "Horaires du digest",
  contactTitle: "Retours & corrections",
  contactIntro: "Événement manquant, mauvaise heure, faute de frappe ? Toute remarque est bienvenue.",
  contactCategoryEvent: "Événement — manquant ou incorrect",
  contactCategorySource: "Source — proposer un nouveau site",
  contactCategoryGeneral: "Général — retours / fonctionnalités",
  contactEmailLabel: "E-mail (optionnel, pour suivi)",
  contactMessageLabel: "Message",
  contactSendBtn: "Envoyer",
  close: "Fermer",
  imprintBack: "Retour au journal des événements",
  imprintTitle: "Mentions légales",
  imprintProvider: "Éditeur (TMG §5)",
  imprintContact: "Contact",
  imprintResponsible: "Responsable du contenu selon §18 al. 2 MStV",
  imprintDataSource: "Origine des données",
  imprintDataSourceBody:
    "Les dates d'événements sont agrégées automatiquement à partir de sources publiques : Kulturnetz Landau, ville de Landau, fondation du château de Hambach, RPTU Kaiserslautern-Landau, Pfalz.de et Südliche Weinstraße Tourismus. Les droits sur les contenus restent la propriété des organisateurs respectifs. Ce site n'a aucune relation commerciale avec les organisateurs listés et décline toute responsabilité quant à l'exactitude des données affichées — merci de vérifier toutes les informations auprès de l'organisateur avant ta visite.",
  imprintDisclaimer: "Clause de non-responsabilité",
  imprintDisclaimerBody:
    "Malgré un contrôle attentif des contenus, nous déclinons toute responsabilité concernant le contenu des liens externes. Seuls les exploitants des pages liées sont responsables de leur contenu.",
  imprintSource: "Code source",
  evPast: "passé",
  evDirections: "Itinéraire",
  evCalendar: "Calendrier",
  evMore: "Plus",
  evViewSource: "Voir la source",
  evShare: "Partager",
  evLinkCopied: "Lien copié",
  evBackToProgramme: "Retour au programme",
  timeSuffix: "",
  langSwitchAria: "Langue",
  imprintMetaDescription: "Contact, responsabilité et mentions légales de landau.today.",
  errInvalidRequest: "Requête invalide.",
  err404Title: "Page introuvable",
  err404Body: "Cette page n'existe pas.",
  err404Back: "Retour au programme",
  err500Title: "Erreur",
  err500Body: "Quelque chose a mal tourné.",
  err500Back: "Vers la page d'accueil",
  categories: {
    konzert: { label: "Concert", short: "Concert" },
    theater: { label: "Théâtre", short: "Théâtre" },
    tanz: { label: "Danse", short: "Danse" },
    kino: { label: "Cinéma", short: "Cinéma" },
    kabarett: { label: "Cabaret & comédie", short: "Cabaret" },
    literatur: { label: "Littérature", short: "Littérature" },
    vortrag: { label: "Conférence", short: "Conférence" },
    ausstellung: { label: "Exposition", short: "Exposition" },
    feste: { label: "Fêtes & célébrations", short: "Fêtes" },
    "junge-kultur": { label: "Culture jeune", short: "Culture jeune" },
    kurse: { label: "Cours & ateliers", short: "Cours" },
    nachtleben: { label: "Vie nocturne", short: "Vie nocturne" },
    gedenken: { label: "Commémoration", short: "Commémoration" },
    exkursion: { label: "Excursion", short: "Excursion" },
    sport: { label: "Sport", short: "Sport" },
    sonstiges: { label: "Autres", short: "Autres" },
  },
};

const TRANSLATIONS: Record<Locale, Translations> = { de, fr };

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}

export function categoryLabel(slug: string, tr: Translations): { label: string; short: string } {
  return tr.categories[slug] ?? tr.categories.sonstiges;
}
