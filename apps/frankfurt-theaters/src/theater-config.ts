import { SYNTHESIZED_THEATERS } from "./synthesized-theaters";
import type { TicketingProvider } from "./types";

export interface TheaterConfig {
  slug: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  website_url: string;
  ticketing_provider: TicketingProvider;
  /** Wikidata Q-id (without the "Q" prefix). Major Frankfurt
   *  theaters have Wikidata entries; populated only where known.
   *  Surfaced as schema.org `sameAs` for entity disambiguation. */
  wikidata?: string;
  /** Short editorial blurb shown on /theater/:slug above the
   *  performance list + as the schema.org `description`. Lifts the
   *  page above thin-content threshold for venues with quiet
   *  programming weeks. */
  description?: string;
  /** Public phone number, when listed. Surfaced in the
   *  PerformingArtsTheater schema -- key NAP signal for local pack. */
  telephone?: string;
}

/** Hand-curated theater list. Combined with auto-generated
 *  SYNTHESIZED_THEATERS (from scripts/scrape.ts) below to form the final
 *  THEATERS export. */
export const CURATED_THEATERS: TheaterConfig[] = [
  {
    slug: "schauspiel-frankfurt",
    name: "Schauspiel Frankfurt",
    address: "Neue Mainzer Straße 17, 60311 Frankfurt am Main",
    lat: 50.1078,
    lon: 8.6745,
    website_url: "https://www.schauspielfrankfurt.de",
    ticketing_provider: "eventim_inhouse",
    wikidata: "Q183842",
    telephone: "+49 69 21237333",
    description:
      "Städtisches Sprechtheater in den Doppelanlagen am Willy-Brandt-Platz. Spielstätten: Schauspielhaus, Kammerspiele, Box. Programmatisch breit aufgestellt zwischen Klassikerpflege und zeitgenössischen Stoffen.",
  },
  {
    slug: "oper-frankfurt",
    name: "Oper Frankfurt",
    address: "Untermainanlage 11, 60311 Frankfurt am Main",
    lat: 50.1077,
    lon: 8.6726,
    website_url: "https://oper-frankfurt.de",
    ticketing_provider: "eventim_inhouse",
    wikidata: "Q570869",
    telephone: "+49 69 21249494",
    description:
      "Vom Magazin Opernwelt mehrfach zum „Opernhaus des Jahres“ gekürtes Repertoire-Theater am Willy-Brandt-Platz. Drei Bühnen: Großes Haus, Bockenheimer Depot, Holzfoyer. Heimat des Frankfurter Opern- und Museumsorchesters.",
  },
  {
    slug: "english-theatre-frankfurt",
    name: "The English Theatre Frankfurt",
    address: "Gallusanlage 7, 60329 Frankfurt am Main",
    lat: 50.1083,
    lon: 8.6712,
    website_url: "https://english-theatre.de",
    ticketing_provider: "eventim_inhouse",
    wikidata: "Q1346554",
    telephone: "+49 69 24231620",
    description:
      "Größte englischsprachige Bühne auf dem europäischen Festland. Spielt Klassiker und zeitgenössische Stücke im Block-Rotation-Modell in den Galluspassagen über dem Hauptbahnhof.",
  },
  {
    slug: "komoedie-frankfurt",
    name: "Die Komödie Frankfurt",
    address: "Neue Mainzer Straße 18, 60311 Frankfurt am Main",
    lat: 50.1086,
    lon: 8.6739,
    website_url: "https://diekomoedie.de",
    ticketing_provider: "custom",
    telephone: "+49 69 28448580",
    description:
      "Boulevard- und Unterhaltungstheater im Zentrum, direkt gegenüber Schauspiel Frankfurt. Schwerpunkt auf Komödien, Musicals, Soloabenden und Gastspielen aus dem Volkstheater-Repertoire.",
  },
  {
    slug: "mousonturm",
    name: "Künstlerhaus Mousonturm",
    address: "Waldschmidtstraße 4, 60316 Frankfurt am Main",
    lat: 50.1183,
    lon: 8.7019,
    website_url: "https://www.mousonturm.de",
    ticketing_provider: "reservix",
    wikidata: "Q1655234",
    telephone: "+49 69 405895-20",
    description:
      "Festes Haus für freie Künste im Frankfurter Ostend, untergebracht in einer ehemaligen Tabakfabrik. Zeitgenössischer Tanz, Performance, Neue Musik; Gastgeber der Cresc-Biennale und vieler internationaler Gastspiele.",
  },
  {
    slug: "neues-theater-hoechst",
    name: "Neues Theater Höchst",
    address: "Emmerich-Josef-Straße 46a, 65929 Frankfurt am Main",
    lat: 50.1014,
    lon: 8.5443,
    website_url: "https://neues-theater.de",
    ticketing_provider: "custom",
  },
  {
    slug: "volksbuehne-frankfurt",
    name: "Volksbühne im Großen Hirschgraben",
    address: "Großer Hirschgraben 19, 60311 Frankfurt am Main",
    lat: 50.1116,
    lon: 8.6817,
    website_url: "https://volksbuehne.net",
    ticketing_provider: "reservix",
  },
  {
    slug: "stalburg-theater",
    name: "Stalburg Theater",
    address: "Glauburgstraße 80, 60318 Frankfurt am Main",
    lat: 50.1294,
    lon: 8.6885,
    website_url: "https://stalburg.de",
    ticketing_provider: "reservix",
  },
  {
    slug: "tigerpalast-variete",
    name: "Tigerpalast Varieté",
    address: "Heiligkreuzgasse 16-20, 60313 Frankfurt am Main",
    lat: 50.1146,
    lon: 8.6836,
    website_url: "https://www.tigerpalast.de",
    ticketing_provider: "reservix",
    wikidata: "Q2419946",
    telephone: "+49 69 9200220",
    description:
      "Traditionsreiches Varieté-Haus in der Frankfurter Altstadt mit jährlich wechselndem Programm aus Akrobatik, Magie und Musik. Programmblöcke laufen über mehrere Monate, ergänzt durch Soiree- und Gastspielreihen.",
  },
  {
    slug: "die-schmiere",
    name: "Die Schmiere",
    address: "Seckbächer Gasse 8, 60311 Frankfurt am Main",
    lat: 50.1112,
    lon: 8.6833,
    website_url: "https://die-schmiere.de",
    ticketing_provider: "reservix",
  },
  {
    slug: "dresden-frankfurt-dance-company",
    name: "Dresden Frankfurt Dance Company",
    address: "Bockenheimer Depot, Carlo-Schmid-Platz 1, 60486 Frankfurt am Main",
    lat: 50.1205,
    lon: 8.6463,
    website_url: "https://www.dfdc.de",
    ticketing_provider: "eventim_inhouse",
  },
  {
    slug: "dramatische-buehne",
    name: "Die Dramatische Bühne",
    address: "Frankfurt am Main",
    lat: 50.1109,
    lon: 8.6821,
    website_url: "https://www.diedramatischebuehne.de",
    ticketing_provider: "custom",
  },
  {
    slug: "theater-willy-praml",
    name: "Theater Willy Praml",
    address: "Naxoshalle, Waldschmidtstraße 19, 60316 Frankfurt am Main",
    lat: 50.1199,
    lon: 8.7037,
    website_url: "https://theaterwillypraml.de",
    ticketing_provider: "custom",
  },
  {
    slug: "kellertheater-frankfurt",
    name: "Kellertheater Frankfurt",
    address: "Mainstraße 2, 60311 Frankfurt am Main",
    lat: 50.1108,
    lon: 8.6852,
    website_url: "https://www.kellertheater-frankfurt.de",
    ticketing_provider: "frankfurt_ticket",
  },
  {
    slug: "gallus-theater",
    name: "Gallus Theater",
    address: "Kleyerstraße 15, 60326 Frankfurt am Main",
    lat: 50.101,
    lon: 8.6334,
    website_url: "https://www.gallustheater.de",
    ticketing_provider: "custom",
  },
  {
    slug: "theaterhaus-frankfurt",
    name: "Theaterhaus Frankfurt",
    address: "Schützenstraße 12, 60311 Frankfurt am Main",
    lat: 50.1116,
    lon: 8.6877,
    website_url: "https://www.theaterhaus-frankfurt.de",
    ticketing_provider: "custom",
  },
  {
    slug: "hessisches-staatsballett",
    name: "Hessisches Staatsballett",
    address: "Hessisches Staatstheater Wiesbaden, Christian-Zais-Straße 3, 65189 Wiesbaden",
    lat: 50.0823,
    lon: 8.2417,
    website_url: "https://www.hessisches-staatsballett.de",
    ticketing_provider: "custom",
    description:
      "Gemeinsame Tanzkompanie der Staatstheater Wiesbaden und Darmstadt. Zeitgenössisches Ballett, neoklassische Wiederaufnahmen, Festivals wie Tanzfestival Rhein-Main und Fokus Neuer Zirkus — Vorstellungen abwechselnd in beiden Häusern.",
  },
  {
    slug: "internationales-theater",
    name: "Internationales Theater Frankfurt",
    address: "Hanauer Landstraße 5-7, 60314 Frankfurt am Main",
    lat: 50.1135,
    lon: 8.6976,
    website_url: "https://www.internationales-theater.de",
    ticketing_provider: "custom",
  },
  {
    slug: "papageno-musiktheater",
    name: "Papageno Musiktheater",
    address: "Palmengartenstraße 11, 60325 Frankfurt am Main",
    lat: 50.1228,
    lon: 8.6533,
    website_url: "https://www.papageno-theater.de",
    ticketing_provider: "frankfurt_ticket",
  },
  {
    slug: "galli-theater",
    name: "Galli Theater Frankfurt",
    address: "Hasengasse 2, 60311 Frankfurt am Main",
    lat: 50.1116,
    lon: 8.6841,
    website_url: "https://www.galli-frankfurt.de",
    ticketing_provider: "custom",
  },
  {
    slug: "theater-alte-bruecke",
    name: "Theater Alte Brücke",
    address: "Alte Brücke 4, 60594 Frankfurt am Main",
    lat: 50.1078,
    lon: 8.6874,
    website_url: "https://www.theater-alte-bruecke.de",
    ticketing_provider: "reservix",
  },
  {
    slug: "die-kaes",
    name: "Die Käs",
    address: "Waldschmidtstraße 19, 60316 Frankfurt am Main",
    lat: 50.1196,
    lon: 8.7041,
    website_url: "https://www.diekaes.de",
    ticketing_provider: "reservix",
  },
  {
    slug: "theater-lempenfieber",
    name: "Theater Lempenfieber",
    address: "Berkersheimer Weg 31, 60433 Frankfurt am Main",
    lat: 50.1856,
    lon: 8.6824,
    website_url: "https://www.lempenfieber.de",
    ticketing_provider: "reservix",
  },
  {
    slug: "landungsbruecken",
    name: "Landungsbrücken Frankfurt",
    address: "Gutleutstraße 294, 60327 Frankfurt am Main",
    lat: 50.0976,
    lon: 8.6519,
    website_url: "https://landungsbruecken.org",
    ticketing_provider: "custom",
  },
];

// Curated entries win over any synthesised duplicates (the scraper
// produces address-empty stubs that the curated list overrides).
const CURATED_SLUGS = new Set(CURATED_THEATERS.map((t) => t.slug));
export const THEATERS: TheaterConfig[] = [
  ...CURATED_THEATERS,
  ...SYNTHESIZED_THEATERS.filter((t) => !CURATED_SLUGS.has(t.slug)),
];
