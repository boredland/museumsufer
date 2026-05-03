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
  upcoming: "Alle 7 Tage",
  upcomingDays: "Nächste {n} Tage",
  events: "Veranstaltungen",
  exhibitions: "Ausstellungen",
  noEvents: "Keine Veranstaltungen an diesem Tag.",
  noExhibitions: "Keine Ausstellungen gefunden.",
  loadError: "Fehler beim Laden.",
  calendar: "Kalender",
  calendarAria: "Zum Kalender hinzufügen",
  githubAria: "Quellcode auf GitHub",
  meta: "Aktuelle Ausstellungen und Veranstaltungen am Frankfurter Museumsufer",
  pageTitle: "Museumsufer Frankfurt – Ausstellungen & Events heute",
  metaLong:
    "Alle Ausstellungen und Veranstaltungen am Frankfurter Museumsufer auf einen Blick. Kalender, Preise, Wegbeschreibung und mehr für 40 Museen.",
  llmTip: "Frag dein LLM",
  llmPrompt:
    "Was ist heute am Frankfurter Museumsufer los? Lies https://museumsufer.app/llms.txt und nutz die API, um die aktuellen Ausstellungen und Veranstaltungen abzurufen.",
  llmCopied: "Kopiert!",
  apiDocs: "API",
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
  reachable: "Erreichbar",
  tight: "Knapp",
  started: "Bereits begonnen",
  permanentCollection: "Ständige Sammlung",
  notMuseumsufer: "Nicht in der Museumsufercard enthalten",
  switchTheme: "Farbschema wechseln",
  themeDark: "Dunkel",
  themeLight: "Hell",
  daysSingular: "Tag",
  daysPlural: "Tage",
  heartPrompt: "Hat es dir gefallen?",
  heartYes: "Gefällt mir",
  heartDismiss: "Überspringen",
  popular: "Beliebt",
  privacyNote: "Datenschutz",
  privacyText:
    "Likes werden anonym mit einem täglichen Hash deiner IP-Adresse gespeichert. Wenn du die Entfernungssortierung aktivierst, wird dein Standort auf ein Raster (~200 m) gerundet und an die RMV-API gesendet, um Fahrzeiten zu schätzen — deine genaue Position wird niemals gespeichert oder weitergegeben. Es werden keine personenbezogenen Daten erhoben.",
  whyTitle: "Warum diese App?",
  whyText:
    "Frankfurt hat über 40 Museen — und die verdienen einen besseren Überblick als den, den sie haben. Diese App bündelt die Ausstellungen und Veranstaltungen aller Museen auf einer schnellen, durchsuchbaren Seite. Kein App-Store, kein Konto, kein Aufwand.",
  imprint: "Impressum",
  imprintTitle: "Impressum — Museumsufer Frankfurt",
  imprintHeading: "Impressum",
  imprintTmgHeading: "Angaben gemäß § 5 TMG",
  imprintContactHeading: "Kontakt",
  imprintResponsibleHeading: "Verantwortlich für den Inhalt",
  imprintDataSourceHeading: "Datenquellen",
  imprintDataSourceText:
    "Inhalte werden täglich automatisch von den Webseiten der ~40 beteiligten Museen gesammelt. Übersetzungen erfolgen über DeepL. Die Anwendung steht in keiner offiziellen Verbindung zur Kulturdezernat oder zur Museumsufer-Initiative der Stadt Frankfurt am Main.",
  imprintDisclaimerHeading: "Haftungsausschluss",
  imprintDisclaimerText:
    "Trotz sorgfältiger Aufbereitung können einzelne Termine, Preise oder Beschreibungen veraltet oder unvollständig sein. Verbindliche Informationen bitte direkt beim jeweiligen Museum prüfen.",
  back: "Zurück",
  byline: "Erstellt von Jonas Strassel",
  contact: "Kontakt",
  contactTitle: "Wie kann ich helfen?",
  contactCategoryLabel: "Worum geht's?",
  contactCategoryEvent: "Veranstaltung fehlt oder falsch",
  contactCategoryInstitution: "Museum fehlt oder falsch",
  contactCategoryFeedback: "Allgemeines Feedback",
  contactEmailLabel: "E-Mail",
  contactEmailPlaceholder: "deine@email.de",
  contactMessageLabel: "Nachricht",
  contactMessagePlaceholder: "Worum geht es?",
  contactEmail: "info@jonas-strassel.de",
  aiDisclosure: "Daten täglich automatisch von Museumswebseiten gesammelt · Übersetzungen via DeepL",
  aboutHeading: "Was ist das Frankfurter Museumsufer?",
  introText:
    "Das Frankfurter Museumsufer vereint rund 40 Museen entlang beider Mainufer zwischen Eisernem Steg und Friedensbrücke – eines der dichtesten Museumsviertel Europas. Große Häuser wie das Städel Museum, das Senckenberg Naturmuseum, die Schirn Kunsthalle, das Liebieghaus und das Historische Museum Frankfurt liegen nur wenige Gehminuten voneinander entfernt. Das Angebot reicht von Alter Kunst über Naturkunde und Film bis zu zeitgenössischer Fotografie und angewandter Kunst. Diese App sammelt täglich die aktuellen Ausstellungen und Veranstaltungen – nicht nur von den offiziellen Museumsufer-Häusern, sondern auch von weiteren Frankfurter Museen und Ausstellungsorten. Alles auf einer einzigen, durchsuchbaren Seite mit Preisen, Kalender-Export und Nahverkehrsanbindung über den RMV.",
  faqTitle: "Häufige Fragen",
  faq1Q: "Welche Museen werden erfasst?",
  faq1A:
    "Die App erfasst die rund 40 Museen des offiziellen Museumsufers sowie weitere Frankfurter Museen und Ausstellungsorte darüber hinaus – darunter das Städel Museum, das Senckenberg Naturmuseum, die Schirn Kunsthalle und viele mehr.",
  faq2Q: "Was ist die Museumsufercard?",
  faq2A:
    "Die Museumsufercard ist ein Jahrespass, der freien Eintritt in alle teilnehmenden Museen bietet. Daneben gibt es das Museumsuferticket für zwei aufeinanderfolgende Tage. Beide sind über museumsufer.de erhältlich.",
  faq3Q: "Wie oft wird der Veranstaltungskalender aktualisiert?",
  faq3A:
    "Die Daten werden täglich um 6 Uhr morgens automatisch von den Webseiten der teilnehmenden Museen gesammelt. Übersetzungen ins Englische und Französische erfolgen über DeepL.",
  faq4Q: "Ist die App kostenlos?",
  faq4A:
    "Ja, museumsufer.app ist vollständig kostenlos, ohne Registrierung und ohne App-Store. Die Seite funktioniert als Progressive Web App direkt im Browser.",
  faq5Q: "In welchen Sprachen ist die Seite verfügbar?",
  faq5A:
    "Die App ist auf Deutsch, Englisch und Französisch verfügbar. Veranstaltungstitel und Beschreibungen werden automatisch übersetzt.",
  faq6Q: "Warum diese App?",
  faq6A:
    "Frankfurt hat über 40 Museen — und die verdienen einen besseren Überblick als den, den sie haben. Diese App bündelt die Ausstellungen und Veranstaltungen aller Museen auf einer schnellen, durchsuchbaren Seite. Kein App-Store, kein Konto, kein Aufwand.",
  faq7Q: "Wie geht die App mit meinen Daten um?",
  faq7A:
    "Likes werden anonym mit einem täglichen Hash deiner IP-Adresse gespeichert. Wenn du die Entfernungssortierung aktivierst, wird dein Standort auf ein Raster (~200 m) gerundet und an die RMV-API gesendet, um Fahrzeiten zu schätzen — deine genaue Position wird niemals gespeichert oder weitergegeben. Es werden keine personenbezogenen Daten erhoben.",
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
  upcoming: "Next 7 days",
  upcomingDays: "Next {n} days",
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
  apiDocs: "API",
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
  reachable: "Reachable",
  tight: "Tight",
  started: "Already started",
  permanentCollection: "Permanent collection",
  notMuseumsufer: "Not included in Museumsufercard",
  switchTheme: "Switch theme",
  themeDark: "Dark",
  themeLight: "Light",
  daysSingular: "day",
  daysPlural: "days",
  heartPrompt: "Did you enjoy it?",
  heartYes: "Liked it",
  heartDismiss: "Skip",
  popular: "Popular",
  privacyNote: "Privacy",
  privacyText:
    "Likes are stored anonymously using a daily hash of your IP address. When you enable distance sorting, your location is rounded to a grid (~200 m) and sent to the RMV API to estimate travel times — your exact position is never stored or shared. No personal data is collected.",
  whyTitle: "Why this app?",
  whyText:
    "Frankfurt has over 40 museums — and they deserve a better overview than the one they got. This app pulls exhibitions and events from every museum into one fast, searchable page. No app store, no account, no fuss.",
  imprint: "Imprint",
  imprintTitle: "Imprint — Museumsufer Frankfurt",
  imprintHeading: "Imprint",
  imprintTmgHeading: "Information according to § 5 TMG",
  imprintContactHeading: "Contact",
  imprintResponsibleHeading: "Responsible for content",
  imprintDataSourceHeading: "Data sources",
  imprintDataSourceText:
    "Content is collected automatically every day from the websites of the ~40 participating museums. Translations are produced by DeepL. This site is not officially affiliated with the City of Frankfurt's cultural department or the Museumsufer initiative.",
  imprintDisclaimerHeading: "Disclaimer",
  imprintDisclaimerText:
    "Despite careful processing, individual dates, prices or descriptions may be outdated or incomplete. For binding information please check directly with the respective museum.",
  back: "Back",
  byline: "Built by Jonas Strassel",
  contact: "Contact",
  contactTitle: "How can I help?",
  contactCategoryLabel: "What's it about?",
  contactCategoryEvent: "Event missing or incorrect",
  contactCategoryInstitution: "Museum missing or incorrect",
  contactCategoryFeedback: "General feedback",
  contactEmailLabel: "Email",
  contactEmailPlaceholder: "your@email.com",
  contactMessageLabel: "Message",
  contactMessagePlaceholder: "What's on your mind?",
  contactEmail: "info@jonas-strassel.de",
  aiDisclosure: "Data collected daily from museum websites · Translations by DeepL",
  aboutHeading: "What is Frankfurt's Museumsufer?",
  introText:
    "Frankfurt's Museumsufer (Museum Embankment) unites around 40 museums along both banks of the Main between Eiserner Steg and Friedensbrücke — one of the densest museum districts in Europe. Major institutions such as the Städel Museum, Senckenberg Nature Museum, Schirn Kunsthalle, Liebieghaus and the Historical Museum Frankfurt are just a few minutes' walk from each other. The range spans Old Masters and natural history to film, contemporary photography and applied art. This app collects all current exhibitions and events daily — not only from the official Museumsufer museums, but also from additional Frankfurt museums and exhibition venues. Everything on a single, searchable page with prices, calendar export and public transport connections via RMV.",
  faqTitle: "FAQ",
  faq1Q: "Which museums are covered?",
  faq1A:
    "The app covers the roughly 40 museums of the official Museumsufer as well as additional Frankfurt museums and exhibition venues beyond that — including the Städel Museum, Senckenberg Nature Museum, Schirn Kunsthalle and many more.",
  faq2Q: "What is the Museumsufercard?",
  faq2A:
    "The Museumsufercard is an annual pass that grants free admission to all participating museums. There is also a Museumsuferticket for two consecutive days. Both are available via museumsufer.de.",
  faq3Q: "How often is the event calendar updated?",
  faq3A:
    "Data is collected automatically from participating museum websites every day at 6 a.m. Translations into English and French are provided by DeepL.",
  faq4Q: "Is the app free to use?",
  faq4A:
    "Yes, museumsufer.app is completely free, with no registration and no app store required. The site works as a Progressive Web App directly in the browser.",
  faq5Q: "Which languages does the site support?",
  faq5A:
    "The app is available in German, English and French. Event titles and descriptions are translated automatically.",
  faq6Q: "Why this app?",
  faq6A:
    "Frankfurt has over 40 museums — and they deserve a better overview than the one they got. This app pulls exhibitions and events from every museum into one fast, searchable page. No app store, no account, no fuss.",
  faq7Q: "How does the app handle my data?",
  faq7A:
    "Likes are stored anonymously using a daily hash of your IP address. When you enable distance sorting, your location is rounded to a grid (~200 m) and sent to the RMV API to estimate travel times — your exact position is never stored or shared. No personal data is collected.",
};

const fr: Translations = {
  subtitle: "Expositions & Événements",
  today: "Auj.",
  tomorrow: "Demain",
  saturday: "Samedi",
  sunday: "Dimanche",
  pickDate: "Choisir une date",
  dateNav: "Date",
  skipLink: "Aller au contenu",
  loading: "Chargement",
  upcoming: "7 prochains jours",
  upcomingDays: "{n} prochains jours",
  events: "Événements",
  exhibitions: "Expositions",
  noEvents: "Aucun événement ce jour.",
  noExhibitions: "Aucune exposition trouvée.",
  loadError: "Erreur de chargement.",
  calendar: "Calendrier",
  calendarAria: "Ajouter au calendrier",
  githubAria: "Voir le code source sur GitHub",
  meta: "Expositions et événements actuels au Museumsufer de Francfort",
  pageTitle: "Museumsufer Frankfurt – Expositions & Événements",
  metaLong:
    "Toutes les expositions et événements au Museumsufer de Francfort. Calendrier, prix, itinéraire et plus pour 40 musées.",
  llmTip: "Demandez à votre LLM",
  llmPrompt:
    "Qu'est-ce qui se passe au Museumsufer de Francfort aujourd'hui ? Lis https://museumsufer.app/llms.txt et utilise l'API pour obtenir les expositions et événements actuels.",
  llmCopied: "Copié !",
  apiDocs: "API",
  missingEvent: "Événement manquant ?",
  subscribeCal: "S'abonner au calendrier",
  rssFeed: "Flux RSS",
  endingSoon: "Se termine bientôt",
  lastDays: "Derniers jours",
  visited: "Visité",
  alreadyVisited: "Déjà visité",
  details: "Détails",
  copyPrompt: "Copier",
  nearMe: "Près de moi",
  minWalk: "min",
  navigate: "Itinéraire",
  addToCalendar: "Ajouter au calendrier",
  markVisited: "Marquer comme visité",
  unmarkVisited: "Retirer le marquage",
  search: "Rechercher",
  searchPlaceholder: "Rechercher musées, expositions ou événements...",
  noResults: "Aucun résultat.",
  passPromo: "Découvrez les 39 musées",
  passCard: "Carte annuelle",
  passTicket: "Pass 2 jours",
  museums: "Musées",
  reachable: "Accessible",
  tight: "Juste",
  started: "Déjà commencé",
  permanentCollection: "Collection permanente",
  notMuseumsufer: "Non inclus dans la Museumsufercard",
  switchTheme: "Changer le thème",
  themeDark: "Sombre",
  themeLight: "Clair",
  daysSingular: "jour",
  daysPlural: "jours",
  heartPrompt: "Cela vous a plu ?",
  heartYes: "J'ai aimé",
  heartDismiss: "Passer",
  popular: "Populaire",
  privacyNote: "Confidentialité",
  privacyText:
    "Les likes sont stockés de manière anonyme en utilisant un hachage quotidien de votre adresse IP. Lorsque vous activez le tri par distance, votre position est arrondie à une grille (~200 m) et envoyée à l'API RMV pour estimer les temps de trajet — votre position exacte n'est jamais stockée ou partagée. Aucune donnée personnelle n'est collectée.",
  whyTitle: "Pourquoi cette application ?",
  whyText:
    "Francfort compte plus de 40 musées — et ils méritent une meilleure vue d'ensemble que celle qu'ils ont. Cette application rassemble les expositions et les événements de chaque musée en une seule page rapide et consultable. Pas de magasin d'applications, pas de compte, pas d'ennuis.",
  imprint: "Mentions légales",
  imprintTitle: "Mentions légales — Museumsufer Frankfurt",
  imprintHeading: "Mentions légales",
  imprintTmgHeading: "Informations conformément au § 5 TMG",
  imprintContactHeading: "Contact",
  imprintResponsibleHeading: "Responsable du contenu",
  imprintDataSourceHeading: "Sources des données",
  imprintDataSourceText:
    "Le contenu est collecté automatiquement chaque jour à partir des sites web des ~40 musées participants. Les traductions sont fournies par DeepL. Ce site n'est pas officiellement affilié au département culturel de la Ville de Francfort ni à l'initiative Museumsufer.",
  imprintDisclaimerHeading: "Avertissement",
  imprintDisclaimerText:
    "Malgré un traitement soigneux, certaines dates, prix ou descriptions peuvent être obsolètes ou incomplets. Pour des informations contractuelles, veuillez vérifier directement auprès du musée concerné.",
  back: "Retour",
  byline: "Réalisé par Jonas Strassel",
  contact: "Contact",
  contactTitle: "Comment puis-je aider ?",
  contactCategoryLabel: "De quoi s'agit-il ?",
  contactCategoryEvent: "Événement manquant ou incorrect",
  contactCategoryInstitution: "Musée manquant ou incorrect",
  contactCategoryFeedback: "Retour général",
  contactEmailLabel: "E-mail",
  contactEmailPlaceholder: "votre@email.fr",
  contactMessageLabel: "Message",
  contactMessagePlaceholder: "Qu'avez-vous en tête ?",
  contactEmail: "info@jonas-strassel.de",
  aiDisclosure: "Données collectées quotidiennement depuis les sites des musées · Traductions par DeepL",
  aboutHeading: "Qu'est-ce que le Museumsufer de Francfort ?",
  introText:
    "Le Museumsufer de Francfort (rive des musées) réunit environ 40 musées le long des deux rives du Main entre l'Eiserner Steg et le Friedensbrücke — l'un des quartiers muséaux les plus denses d'Europe. De grandes institutions comme le Städel Museum, le Senckenberg Naturmuseum, la Schirn Kunsthalle, le Liebieghaus et le Historisches Museum Frankfurt se trouvent à quelques minutes de marche les uns des autres. L'offre va des maîtres anciens aux sciences naturelles, en passant par le cinéma, la photographie contemporaine et les arts appliqués. Cette application collecte chaque jour les expositions et événements — non seulement des musées officiels du Museumsufer, mais aussi d'autres musées et lieux d'exposition de Francfort. Le tout sur une seule page consultable avec tarifs, export calendrier et liaisons en transports en commun via le RMV.",
  faqTitle: "Questions fréquentes",
  faq1Q: "Quels musées sont couverts ?",
  faq1A:
    "L'application couvre les quelque 40 musées du Museumsufer officiel ainsi que d'autres musées et lieux d'exposition de Francfort — dont le Städel Museum, le Senckenberg Naturmuseum, la Schirn Kunsthalle et bien d'autres.",
  faq2Q: "Qu'est-ce que la Museumsufercard ?",
  faq2A:
    "La Museumsufercard est un pass annuel offrant l'entrée gratuite dans tous les musées participants. Il existe également un Museumsuferticket pour deux jours consécutifs. Les deux sont disponibles sur museumsufer.de.",
  faq3Q: "À quelle fréquence le calendrier des événements est-il mis à jour ?",
  faq3A:
    "Les données sont collectées automatiquement chaque jour à 6 heures du matin à partir des sites des musées participants. Les traductions en anglais et en français sont fournies par DeepL.",
  faq4Q: "L'application est-elle gratuite ?",
  faq4A:
    "Oui, museumsufer.app est entièrement gratuite, sans inscription et sans téléchargement. Le site fonctionne comme une Progressive Web App directement dans le navigateur.",
  faq5Q: "Dans quelles langues le site est-il disponible ?",
  faq5A:
    "L'application est disponible en allemand, en anglais et en français. Les titres et descriptions des événements sont traduits automatiquement.",
  faq6Q: "Pourquoi cette application ?",
  faq6A:
    "Francfort compte plus de 40 musées — et ils méritent une meilleure vue d'ensemble que celle qu'ils ont. Cette application rassemble les expositions et les événements de chaque musée en une seule page rapide et consultable. Pas de magasin d'applications, pas de compte, pas d'ennuis.",
  faq7Q: "Comment l'application gère-t-elle mes données ?",
  faq7A:
    "Les likes sont stockés de manière anonyme en utilisant un hachage quotidien de votre adresse IP. Lorsque vous activez le tri par distance, votre position est arrondie à une grille (~200 m) et envoyée à l'API RMV pour estimer les temps de trajet — votre position exacte n'est jamais stockée ou partagée. Aucune donnée personnelle n'est collectée.",
};

const ALL: Record<Locale, Translations> = { de, en, fr };

export function getTranslations(locale: Locale): Translations {
  return ALL[locale];
}
