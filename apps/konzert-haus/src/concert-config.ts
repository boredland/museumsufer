import { SYNTHESIZED_VENUES } from "./synthesized-venues";
import type { Genre } from "./types";

export interface VenueConfig {
  slug: string;
  name: string;
  short_name?: string;
  address: string;
  lat: number;
  lon: number;
  city: string;
  website_url: string;
  default_genre: Genre;
  /** Wikidata Q-id (without the "Q" prefix) — emitted as schema.org
   *  `sameAs` for entity disambiguation. Major Frankfurt venues have
   *  Wikidata entries; smaller ones stay null. */
  wikidata?: string;
  /** Short editorial blurb shown on the venue page above the event
   *  list. Lifts pages with quiet programming above the thin-content
   *  threshold the audit flagged. */
  description?: string;
}

/** Hand-curated venue list. Combined with auto-generated SYNTHESIZED_VENUES
 *  (from scripts/scrape.ts) below to form the final VENUES export. */
export const CURATED_VENUES: VenueConfig[] = [
  {
    slug: "alte-oper",
    name: "Alte Oper Frankfurt",
    short_name: "Alte Oper",
    address: "Opernplatz 1, 60313 Frankfurt am Main",
    lat: 50.1158,
    lon: 8.6713,
    city: "frankfurt",
    website_url: "https://www.alteoper.de",
    default_genre: "classical",
    wikidata: "Q679177",
    description:
      "Frankfurts Konzerthaus im historischen Opernhaus von 1880, 1981 am Opernplatz wieder eröffnet. Großer Saal mit ~2.400 Plätzen für Orchester, Liederabende und Klavierrezitals; der Mozart Saal bietet Kammermusikprogramme. Gastgeber der wichtigsten Klassik-Gastspiele der Rhein-Main-Region.",
  },
  {
    slug: "oper-frankfurt-konzerte",
    name: "Oper Frankfurt",
    short_name: "Oper Frankfurt",
    address: "Untermainanlage 11, 60311 Frankfurt am Main",
    lat: 50.1077,
    lon: 8.6726,
    city: "frankfurt",
    website_url: "https://oper-frankfurt.de",
    default_genre: "classical",
    wikidata: "Q570869",
    description:
      "Vom Magazin Opernwelt mehrfach zum „Opernhaus des Jahres“ gekürtes Repertoire-Theater am Willy-Brandt-Platz. Neben Opern programmiert das Haus regelmäßig Sinfoniekonzerte, Liederabende und Kammermusik des Frankfurter Opern- und Museumsorchesters.",
  },
  {
    slug: "dr-hochs-konservatorium",
    name: "Dr. Hoch's Konservatorium",
    short_name: "Dr. Hoch's",
    address: "Sonnemannstraße 16, 60314 Frankfurt am Main",
    lat: 50.1115,
    lon: 8.7016,
    city: "frankfurt",
    website_url: "https://www.dr-hochs.de",
    default_genre: "classical",
  },
  {
    slug: "hfmdk",
    name: "Hochschule für Musik und Darstellende Kunst Frankfurt",
    short_name: "HfMDK",
    address: "Eschersheimer Landstraße 29-39, 60322 Frankfurt am Main",
    lat: 50.1232,
    lon: 8.6749,
    city: "frankfurt",
    website_url: "https://www.hfmdk-frankfurt.de",
    default_genre: "classical",
  },
  {
    slug: "ensemble-modern",
    name: "Ensemble Modern",
    short_name: "Ensemble Modern",
    address: "Schwedlerstraße 2-4, 60314 Frankfurt am Main",
    lat: 50.1125,
    lon: 8.7128,
    city: "frankfurt",
    website_url: "https://www.ensemble-modern.com",
    default_genre: "experimental",
  },
  {
    slug: "hr-sinfonieorchester",
    name: "hr-Sinfonieorchester",
    short_name: "hr-Sinfonieorchester",
    address: "Bertramstraße 8, 60320 Frankfurt am Main",
    lat: 50.1314,
    lon: 8.6634,
    city: "frankfurt",
    website_url: "https://www.hr-sinfonieorchester.de",
    default_genre: "classical",
  },
  {
    slug: "hr-bigband",
    name: "hr-Bigband",
    short_name: "hr-Bigband",
    address: "Bertramstraße 8, 60320 Frankfurt am Main",
    lat: 50.1314,
    lon: 8.6634,
    city: "frankfurt",
    website_url: "https://www.hr-bigband.de",
    default_genre: "jazz",
    wikidata: "Q588884",
    description:
      "Die Bigband des Hessischen Rundfunks am Funkhaus Bertramstraße. Konzerte in Eigenproduktionen wie der Reihe „hr-Bigband Open“ und als Gastband bei Festivals im Sendesaal.",
  },
  {
    slug: "holzhausenschloesschen",
    name: "Holzhausenschlösschen",
    short_name: "Holzhausenschlösschen",
    address: "Justinianstraße 5, 60322 Frankfurt am Main",
    lat: 50.1289,
    lon: 8.6764,
    city: "frankfurt",
    website_url: "https://www.frankfurter-buergerstiftung.de",
    default_genre: "chamber",
  },
  {
    // Aggregator listing (media outlet, not a single physical venue),
    // so address is intentionally empty -- the schema generator skips
    // streetAddress for entries with no real street component.
    slug: "jazz-frankfurt",
    name: "Jazz in Frankfurt",
    short_name: "jazz-frankfurt.de",
    address: "",
    lat: 50.1109,
    lon: 8.6821,
    city: "frankfurt",
    website_url: "https://www.jazz-frankfurt.de",
    default_genre: "jazz",
    description:
      "Redaktioneller Jazz-Kalender für Frankfurt und Rhein-Main. Die Programminformationen verteilen sich über Häuser wie Mousonturm, hr-Sendesaal und kleinere Clubs in der Stadt.",
  },
  {
    slug: "jazz-palmengarten",
    name: "Jazz im Palmengarten",
    short_name: "Palmengarten",
    address: "Siesmayerstraße 61, 60323 Frankfurt am Main",
    lat: 50.1241,
    lon: 8.6584,
    city: "frankfurt",
    website_url: "https://www.palmengarten.de",
    default_genre: "jazz",
  },
  {
    slug: "club-voltaire",
    name: "Club Voltaire",
    short_name: "Club Voltaire",
    address: "Kleine Hochstraße 5, 60313 Frankfurt am Main",
    lat: 50.1151,
    lon: 8.674,
    city: "frankfurt",
    website_url: "https://www.club-voltaire.de",
    default_genre: "jazz",
    description:
      "Politisch-kulturelle Kneipe in der Frankfurter Innenstadt, seit 1962 als gemeinnütziger Verein geführt. Programmatischer Mix aus Diskussionsabenden und Konzertreihen; die monatlichen ClubJazz-Abende (meist letzter Freitag im Monat) bringen Kammer-Jazz auf die kleine Bühne. Kapazität ca. 60 Plätze, Reservierung empfohlen.",
  },
  {
    slug: "jazzkeller",
    name: "Jazzkeller Frankfurt",
    short_name: "Jazzkeller",
    address: "Kleine Bockenheimer Straße 18a, 60313 Frankfurt am Main",
    lat: 50.1144,
    lon: 8.6737,
    city: "frankfurt",
    website_url: "https://jazzkeller.com",
    default_genre: "jazz",
    wikidata: "Q1685091",
    description:
      "1952 in einem ehemaligen Luftschutzkeller in der Fressgass eröffneter Jazzclub, einer der ältesten Europas. Bühne für internationale Gastspiele (u. a. Louis Armstrong, Dizzy Gillespie, Ella Fitzgerald), heute Programm zwischen Bebop, Modern Jazz und Hausband-Sets mit Jam Sessions jeden Mittwoch.",
  },
  {
    slug: "mampf",
    name: "Jazzlokal Mampf",
    short_name: "Mampf",
    address: "Sandweg 64, 60316 Frankfurt am Main",
    lat: 50.1199,
    lon: 8.699,
    city: "frankfurt",
    website_url: "https://www.mampf-jazz.com",
    default_genre: "jazz",
    description:
      "Kleinste Live-Jazz-Bar Frankfurts an der Ecke Sandweg/Habsburgerallee im Nordend, mit Live-Konzerten drei Mal die Woche ab 20:30 Uhr und mediterraner Küche bis spät in die Nacht.",
  },
  {
    slug: "brotfabrik",
    name: "Brotfabrik",
    short_name: "Brotfabrik",
    address: "Bachmannstraße 2-4, 60488 Frankfurt am Main",
    lat: 50.1303,
    lon: 8.6071,
    city: "frankfurt",
    website_url: "https://www.brotfabrik.info",
    default_genre: "world",
  },
  {
    slug: "romanfabrik",
    name: "Romanfabrik",
    short_name: "Romanfabrik",
    address: "Hanauer Landstraße 186, 60314 Frankfurt am Main",
    lat: 50.1149,
    lon: 8.7124,
    city: "frankfurt",
    website_url: "https://www.romanfabrik.de",
    default_genre: "world",
  },
  {
    slug: "evangelische-akademie-frankfurt",
    name: "Evangelische Akademie Frankfurt",
    short_name: "Ev. Akademie",
    address: "Römerberg 9, 60311 Frankfurt am Main",
    lat: 50.1102,
    lon: 8.6824,
    city: "frankfurt",
    website_url: "https://www.evangelische-akademie.de",
    default_genre: "chamber",
  },
  {
    slug: "andreas-koehs",
    name: "Kirchenmusik Andreas Köhs",
    short_name: "Andreas Köhs",
    address: "Hasengasse 6, 60311 Frankfurt am Main",
    lat: 50.1115,
    lon: 8.6839,
    city: "frankfurt",
    website_url: "https://www.andreas-koehs.de",
    default_genre: "sacred",
  },
  {
    slug: "kirchenmusik-dreikoenig",
    name: "Kirchenmusik Dreikönigsgemeinde",
    short_name: "Dreikönigskirche",
    address: "Färberstraße 41, 60594 Frankfurt am Main",
    lat: 50.1051,
    lon: 8.6863,
    city: "frankfurt",
    website_url: "https://www.dreikoenigsgemeinde.de",
    default_genre: "sacred",
  },
  {
    slug: "st-katharinen",
    name: "Kantorei St. Katharinen",
    short_name: "St. Katharinen",
    address: "An der Hauptwache 1, 60313 Frankfurt am Main",
    lat: 50.1138,
    lon: 8.679,
    city: "frankfurt",
    website_url: "https://www.st-katharinengemeinde.de",
    default_genre: "sacred",
  },
  {
    slug: "kronberg-academy",
    name: "Kronberg Academy / Casals Forum",
    short_name: "Kronberg Academy",
    address: "Hainstraße 11, 61476 Kronberg im Taunus",
    lat: 50.1828,
    lon: 8.5202,
    city: "kronberg",
    website_url: "https://www.kronbergacademy.de",
    default_genre: "classical",
  },
  {
    slug: "rheingau-musikfestival",
    name: "Rheingau Musik Festival",
    short_name: "Rheingau Festival",
    address: "Postfach 1125, 65367 Oestrich-Winkel",
    lat: 50.0058,
    lon: 8.0464,
    city: "eltville",
    website_url: "https://www.rheingau-musik-festival.de",
    default_genre: "classical",
  },
  {
    slug: "bad-homburger-schlosskonzerte",
    name: "Bad Homburger Schlosskonzerte",
    short_name: "Bad Homburger Schloss",
    address: "Schloss Bad Homburg, 61348 Bad Homburg vor der Höhe",
    lat: 50.2275,
    lon: 8.6172,
    city: "bad-homburg",
    website_url: "https://www.bad-homburger-schlosskonzerte.de",
    default_genre: "classical",
  },
  {
    slug: "denkbar-frankfurt",
    name: "Denkbar Frankfurt",
    short_name: "Denkbar",
    address: "Spohrstraße 46a, 60327 Frankfurt am Main",
    lat: 50.1189,
    lon: 8.6601,
    city: "frankfurt",
    website_url: "https://denkbar-ffm.de",
    default_genre: "jazz",
  },
  {
    slug: "bad-soden",
    name: "Bad Sodener Kammerkonzerte",
    short_name: "Bad Soden",
    address: "Kurpark, 65812 Bad Soden am Taunus",
    lat: 50.1411,
    lon: 8.4985,
    city: "bad-soden",
    website_url: "https://www.bad-soden.de",
    default_genre: "chamber",
  },
  {
    slug: "naxos-hallenkonzerte",
    name: "Naxos Hallenkonzerte",
    short_name: "Naxos",
    address: "Waldschmidtstraße 19, 60316 Frankfurt am Main",
    lat: 50.1198,
    lon: 8.7027,
    city: "frankfurt",
    website_url: "https://naxoshallenkonzerte.de",
    default_genre: "experimental",
  },
  {
    slug: "waggong",
    name: "Waggong e.V. — Kulturwerkstatt Germaniastraße",
    short_name: "Waggong",
    address: "Germaniastraße 89, 60389 Frankfurt am Main",
    lat: 50.1304,
    lon: 8.7081,
    city: "frankfurt",
    website_url: "https://waggong.de",
    default_genre: "jazz",
  },
  {
    slug: "musikschule-frankfurt",
    name: "Städtische Musikschule Frankfurt",
    short_name: "Musikschule Ffm",
    address: "Bethmannstraße 8, 60311 Frankfurt am Main",
    lat: 50.1107,
    lon: 8.6809,
    city: "frankfurt",
    website_url: "https://www.musikschule-frankfurt.de",
    default_genre: "classical",
  },
  {
    slug: "mousonturm",
    name: "Künstler*innenhaus Mousonturm",
    short_name: "Mousonturm",
    address: "Waldschmidtstraße 4, 60316 Frankfurt am Main",
    lat: 50.1183,
    lon: 8.7019,
    city: "frankfurt",
    website_url: "https://www.mousonturm.de",
    default_genre: "experimental",
    wikidata: "Q1655234",
    description:
      "Festes Haus für freie Künste im Frankfurter Ostend, untergebracht in einer ehemaligen Tabakfabrik. Programmatisch nah an zeitgenössischem Tanz, Performance und Neuer Musik; Gastgeber von Ensemble-Modern-Reihen und Cresc Biennale.",
  },
];

// Curated entries win over synthesised duplicates -- the scraper
// records auto-generated stubs (empty address etc.); the curated
// CURATED_VENUES list above contains the hand-verified data and must
// take precedence.
const CURATED_SLUGS = new Set(CURATED_VENUES.map((v) => v.slug));
export const VENUES: VenueConfig[] = [
  ...CURATED_VENUES,
  ...SYNTHESIZED_VENUES.filter((v) => !CURATED_SLUGS.has(v.slug)),
];
