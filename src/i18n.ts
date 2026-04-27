export type Locale = "de" | "en" | "fr";

export const SUPPORTED_LOCALES: Locale[] = ["de", "en", "fr"];

const LOCALE_DATE_FORMATS: Record<Locale, string> = {
  de: "de-DE",
  en: "en-GB",
  fr: "fr-FR",
};

export function dateLocale(locale: Locale): string {
  return LOCALE_DATE_FORMATS[locale];
}

export function detectLocale(request: Request): Locale {
  const url = new URL(request.url);
  const param = url.searchParams.get("lang");
  if (param && isLocale(param)) return param;

  const accept = request.headers.get("Accept-Language") || "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(tag)) return tag;
  }

  return "de";
}

function isLocale(v: string): v is Locale {
  return SUPPORTED_LOCALES.includes(v as Locale);
}

type Translations = Record<string, string>;

const de: Translations = {
  subtitle: "Ausstellungen & Veranstaltungen",
  today: "Heute",
  tomorrow: "Morgen",
  saturday: "Samstag",
  sunday: "Sonntag",
  pickDate: "Datum auswählen",
  dateNav: "Datum",
  skipLink: "Zum Inhalt",
  loading: "Laden",
  events: "Veranstaltungen",
  exhibitions: "Ausstellungen",
  noEvents: "Keine Veranstaltungen an diesem Tag.",
  noExhibitions: "Keine Ausstellungen gefunden.",
  loadError: "Fehler beim Laden.",
  calendar: "Kalender",
  calendarAria: "Zum Kalender hinzufügen",
  githubAria: "Quellcode auf GitHub",
  meta: "Aktuelle Ausstellungen und Veranstaltungen am Frankfurter Museumsufer",
  pageTitle: "Museumsufer Frankfurt — Ausstellungen & Veranstaltungen heute",
  metaLong:
    "Alle Ausstellungen und Veranstaltungen am Frankfurter Museumsufer auf einen Blick. Kalender, Preise, Wegbeschreibung und mehr fur 40 Museen.",
  llmTip: "Frag dein LLM",
  llmPrompt:
    "Was ist heute am Frankfurter Museumsufer los? Lies https://museumsufer.app/llms.txt und nutz die API, um die aktuellen Ausstellungen und Veranstaltungen abzurufen.",
  llmCopied: "Kopiert!",
  missingEvent: "Veranstaltung fehlt?",
  subscribeCal: "Kalender abonnieren",
  rssFeed: "RSS-Feed",
  endingSoon: "Endet bald",
  lastDays: "Letzte Tage",
  visited: "Besucht",
  alreadyVisited: "Bereits besucht",
  details: "Details",
  copyPrompt: "Kopieren",
  nearMe: "In der Nähe",
  minWalk: "min",
  navigate: "Navigation starten",
  addToCalendar: "Zum Kalender hinzufügen",
  markVisited: "Als besucht markieren",
  unmarkVisited: "Markierung entfernen",
  search: "Suchen",
  searchPlaceholder: "Museum, Ausstellung oder Veranstaltung suchen...",
  noResults: "Keine Ergebnisse.",
  passPromo: "Alle 39 Museen entdecken",
  passCard: "Museumsufercard",
  passTicket: "Museumsuferticket",
  museums: "Museen",
  permanentCollection: "Ständige Sammlung",
  notMuseumsufer: "Nicht in der Museumsufercard enthalten",
  daysSingular: "Tag",
  daysPlural: "Tage",
  heartPrompt: "Hat es dir gefallen?",
  heartYes: "Gefällt mir",
  heartDismiss: "Überspringen",
  popular: "Beliebt",
  privacyNote: "Datenschutz",
  privacyText:
    "Likes werden anonym gespeichert. Es wird ein tagesaktueller Hash deiner IP-Adresse verwendet — keine personenbezogenen Daten.",
  whyTitle: "Warum diese App?",
  whyText:
    "Frankfurt hat über 40 Museen — und die verdienen einen besseren Überblick als den, den sie haben. Diese App bündelt die Ausstellungen und Veranstaltungen aller Museen auf einer schnellen, durchsuchbaren Seite. Kein App-Store, kein Konto, kein Aufwand.",
};

const en: Translations = {
  subtitle: "Exhibitions & Events",
  today: "Today",
  tomorrow: "Tomorrow",
  saturday: "Saturday",
  sunday: "Sunday",
  pickDate: "Pick a date",
  dateNav: "Date",
  skipLink: "Skip to content",
  loading: "Loading",
  events: "Events",
  exhibitions: "Exhibitions",
  noEvents: "No events on this day.",
  noExhibitions: "No exhibitions found.",
  loadError: "Failed to load.",
  calendar: "Calendar",
  calendarAria: "Add to calendar",
  githubAria: "View source on GitHub",
  meta: "Current exhibitions and events at Frankfurt's Museumsufer",
  pageTitle: "Museumsufer Frankfurt — Exhibitions & Events Today",
  metaLong:
    "All exhibitions and events at Frankfurt's Museumsufer at a glance. Calendar, prices, directions and more for 40 museums.",
  llmTip: "Ask your LLM",
  llmPrompt:
    "What's on at Frankfurt's Museumsufer today? Read https://museumsufer.app/llms.txt and use the API to get current exhibitions and events.",
  llmCopied: "Copied!",
  missingEvent: "Event missing?",
  subscribeCal: "Subscribe to calendar",
  rssFeed: "RSS feed",
  endingSoon: "Ending soon",
  lastDays: "Last days",
  visited: "Visited",
  alreadyVisited: "Already visited",
  details: "Details",
  copyPrompt: "Copy",
  nearMe: "Near me",
  minWalk: "min",
  navigate: "Get directions",
  addToCalendar: "Add to calendar",
  markVisited: "Mark as visited",
  unmarkVisited: "Remove visited mark",
  search: "Search",
  searchPlaceholder: "Search museums, exhibitions or events...",
  noResults: "No results.",
  passPromo: "Explore all 39 museums",
  passCard: "Annual Pass",
  passTicket: "2-Day Pass",
  museums: "Museums",
  permanentCollection: "Permanent collection",
  notMuseumsufer: "Not included in Museumsufercard",
  daysSingular: "day",
  daysPlural: "days",
  heartPrompt: "Did you enjoy it?",
  heartYes: "Liked it",
  heartDismiss: "Skip",
  popular: "Popular",
  privacyNote: "Privacy",
  privacyText: "Likes are stored anonymously. A daily hash of your IP address is used — no personal data is collected.",
  whyTitle: "Why this app?",
  whyText:
    "Frankfurt has over 40 museums — and they deserve a better overview than the one they got. This app pulls exhibitions and events from every museum into one fast, searchable page. No app store, no account, no fuss.",
};

const fr: Translations = {
  subtitle: "Expositions & Événements",
  today: "Aujourd'hui",
  tomorrow: "Demain",
  saturday: "Samedi",
  sunday: "Dimanche",
  pickDate: "Choisir une date",
  dateNav: "Date",
  skipLink: "Aller au contenu",
  loading: "Chargement",
  events: "Événements",
  exhibitions: "Expositions",
  noEvents: "Aucun événement ce jour.",
  noExhibitions: "Aucune exposition trouvée.",
  loadError: "Erreur de chargement.",
  calendar: "Calendrier",
  calendarAria: "Ajouter au calendrier",
  githubAria: "Voir le code source sur GitHub",
  meta: "Expositions et événements actuels au Museumsufer de Francfort",
  pageTitle: "Museumsufer Frankfurt — Expositions & Evenements du jour",
  metaLong:
    "Toutes les expositions et evenements au Museumsufer de Francfort. Calendrier, prix, itineraire et plus pour 40 musees.",
  llmTip: "Demandez a votre LLM",
  llmPrompt:
    "Qu'est-ce qui se passe au Museumsufer de Francfort aujourd'hui ? Lis https://museumsufer.app/llms.txt et utilise l'API pour obtenir les expositions et evenements actuels.",
  llmCopied: "Copie !",
  missingEvent: "Evenement manquant ?",
  subscribeCal: "S'abonner au calendrier",
  rssFeed: "Flux RSS",
  endingSoon: "Se termine bientot",
  lastDays: "Derniers jours",
  visited: "Visite",
  alreadyVisited: "Deja visite",
  details: "Details",
  copyPrompt: "Copier",
  nearMe: "Pres de moi",
  minWalk: "min",
  navigate: "Itineraire",
  addToCalendar: "Ajouter au calendrier",
  markVisited: "Marquer comme visite",
  unmarkVisited: "Retirer le marquage",
  search: "Rechercher",
  searchPlaceholder: "Rechercher musees, expositions ou evenements...",
  noResults: "Aucun resultat.",
  passPromo: "Découvrez les 39 musées",
  passCard: "Carte annuelle",
  passTicket: "Pass 2 jours",
  museums: "Musées",
  permanentCollection: "Collection permanente",
  notMuseumsufer: "Non inclus dans la Museumsufercard",
  daysSingular: "jour",
  daysPlural: "jours",
  heartPrompt: "Cela vous a plu ?",
  heartYes: "J'ai aimé",
  heartDismiss: "Passer",
  popular: "Populaire",
  privacyNote: "Confidentialité",
  privacyText:
    "Les likes sont enregistrés de manière anonyme. Un hash quotidien de votre adresse IP est utilisé — aucune donnée personnelle n'est collectée.",
  whyTitle: "Pourquoi cette application ?",
  whyText:
    "Francfort compte plus de 40 musées — et ils méritent une meilleure vue d'ensemble que celle qu'ils ont. Cette application rassemble les expositions et les événements de chaque musée en une seule page rapide et consultable. Pas de magasin d'applications, pas de compte, pas d'ennuis.",
};

const ALL: Record<Locale, Translations> = { de, en, fr };

export function getTranslations(locale: Locale): Translations {
  return ALL[locale];
}
