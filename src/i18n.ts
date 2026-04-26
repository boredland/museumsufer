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
  llmTip: "Frag dein LLM",
  llmPrompt: "Was ist heute am Frankfurter Museumsufer los? Lies https://museumsufer.app/llms.txt und nutz die API, um die aktuellen Ausstellungen und Veranstaltungen abzurufen.",
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
  llmTip: "Ask your LLM",
  llmPrompt: "What's on at Frankfurt's Museumsufer today? Read https://museumsufer.app/llms.txt and use the API to get current exhibitions and events.",
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
  llmTip: "Demandez a votre LLM",
  llmPrompt: "Qu'est-ce qui se passe au Museumsufer de Francfort aujourd'hui ? Lis https://museumsufer.app/llms.txt et utilise l'API pour obtenir les expositions et evenements actuels.",
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
};

const ALL: Record<Locale, Translations> = { de, en, fr };

export function getTranslations(locale: Locale): Translations {
  return ALL[locale];
}
