import { type Locale as CoreLocale, detectLocale as coreDetect } from "@museumsufer/core";

export type Locale = Extract<CoreLocale, "de" | "fr">;
export const SUPPORTED_LOCALES: Locale[] = ["de", "fr"];
export const DEFAULT_LOCALE: Locale = "de";

export function detectLocale(request: Request): Locale {
  return coreDetect(request, SUPPORTED_LOCALES, DEFAULT_LOCALE);
}

export interface Translations {
  subtitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchEmpty: string;
  chipAll: string;
  chipNearby: string;
  chipNearbyHint: string;
  emptyDay: string;
  todaysEvents: string;
  today: string;
  digestSubscribe: string;
  reportProblem: string;
  subscribeCalendar: string;
  imprint: string;
  faqTitle: string;
  themeToggle: string;
  skipToContent: string;
  homeTitle: string;
  homeDescription: string;
  footerLine: string;
  backToList: string;
}

const de: Translations = {
  subtitle: "Veranstaltungsblatt für die Südliche Weinstraße",
  searchLabel: "Suchen",
  searchPlaceholder: "Suchen — Konzert, Theater, Veranstalter, Ort …",
  searchEmpty: "Keine Treffer",
  chipAll: "Alle",
  chipNearby: "In der Nähe",
  chipNearbyHint: "Sortiert nach Entfernung zu deinem Standort",
  emptyDay: "Heute kein Programm gefunden.",
  todaysEvents: "Heutige Termine",
  today: "heute",
  digestSubscribe: "Push abonnieren",
  reportProblem: "Problem melden",
  subscribeCalendar: "Kalender abonnieren",
  imprint: "Impressum",
  faqTitle: "Fragen & Antworten",
  themeToggle: "Hell/Dunkel",
  skipToContent: "Zum Inhalt",
  homeTitle: "landau.today — Veranstaltungen heute in Landau in der Pfalz",
  homeDescription:
    "Veranstaltungen in Landau in der Pfalz und an der Südlichen Weinstraße — Konzert, Theater, Tanz, Lesung, Weinfest, Ausstellung, Stadtführung.",
  footerLine: "Landau heute · Heimatzeitung für Veranstaltungen",
  backToList: "Zurück zum Veranstaltungsblatt",
};

const fr: Translations = {
  subtitle: "Le journal des événements de la Route du Vin du Sud",
  searchLabel: "Rechercher",
  searchPlaceholder: "Rechercher — concert, théâtre, organisateur, lieu…",
  searchEmpty: "Aucun résultat",
  chipAll: "Tous",
  chipNearby: "À proximité",
  chipNearbyHint: "Trié par distance depuis ta position",
  emptyDay: "Aucun programme trouvé pour aujourd'hui.",
  todaysEvents: "Événements du jour",
  today: "aujourd'hui",
  digestSubscribe: "S'abonner",
  reportProblem: "Signaler un problème",
  subscribeCalendar: "S'abonner au calendrier",
  imprint: "Mentions légales",
  faqTitle: "Questions & réponses",
  themeToggle: "Clair/obscur",
  skipToContent: "Aller au contenu",
  homeTitle: "landau.today — événements aujourd'hui à Landau in der Pfalz",
  homeDescription:
    "Événements à Landau in der Pfalz et sur la Route du Vin du Sud — concert, théâtre, danse, lecture, fête du vin, exposition, visite guidée.",
  footerLine: "Landau aujourd'hui · journal local des événements",
  backToList: "Retour au journal des événements",
};

const TRANSLATIONS: Record<Locale, Translations> = { de, fr };

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}
