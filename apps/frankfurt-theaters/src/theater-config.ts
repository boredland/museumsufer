import type { TicketingProvider } from "./types";

export interface TheaterConfig {
  slug: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  website_url: string;
  ticketing_provider: TicketingProvider;
  scraper:
    | "schauspiel"
    | "oper"
    | "english-theatre"
    | "komoedie"
    | "mousonturm"
    | "neues-theater-hoechst"
    | "volksbuehne"
    | "stalburg"
    | "tigerpalast"
    | "schmiere"
    | "dfdc"
    | "dramatische-buehne"
    | "willy-praml"
    | "kellertheater";
}

export const THEATERS: TheaterConfig[] = [
  {
    slug: "schauspiel-frankfurt",
    name: "Schauspiel Frankfurt",
    address: "Neue Mainzer Straße 17, 60311 Frankfurt am Main",
    lat: 50.1078,
    lon: 8.6745,
    website_url: "https://www.schauspielfrankfurt.de",
    ticketing_provider: "eventim_inhouse",
    scraper: "schauspiel",
  },
  {
    slug: "oper-frankfurt",
    name: "Oper Frankfurt",
    address: "Untermainanlage 11, 60311 Frankfurt am Main",
    lat: 50.1077,
    lon: 8.6726,
    website_url: "https://oper-frankfurt.de",
    ticketing_provider: "eventim_inhouse",
    scraper: "oper",
  },
  {
    slug: "english-theatre-frankfurt",
    name: "The English Theatre Frankfurt",
    address: "Gallusanlage 7, 60329 Frankfurt am Main",
    lat: 50.1083,
    lon: 8.6712,
    website_url: "https://english-theatre.de",
    ticketing_provider: "eventim_inhouse",
    scraper: "english-theatre",
  },
  {
    slug: "komoedie-frankfurt",
    name: "Die Komödie Frankfurt",
    address: "Neue Mainzer Straße 18, 60311 Frankfurt am Main",
    lat: 50.1086,
    lon: 8.6739,
    website_url: "https://diekomoedie.de",
    ticketing_provider: "custom",
    scraper: "komoedie",
  },
  {
    slug: "mousonturm",
    name: "Künstlerhaus Mousonturm",
    address: "Waldschmidtstraße 4, 60316 Frankfurt am Main",
    lat: 50.1183,
    lon: 8.7019,
    website_url: "https://www.mousonturm.de",
    ticketing_provider: "reservix",
    scraper: "mousonturm",
  },
  {
    slug: "neues-theater-hoechst",
    name: "Neues Theater Höchst",
    address: "Emmerich-Josef-Straße 46a, 65929 Frankfurt am Main",
    lat: 50.1014,
    lon: 8.5443,
    website_url: "https://neues-theater.de",
    ticketing_provider: "custom",
    scraper: "neues-theater-hoechst",
  },
  {
    slug: "volksbuehne-frankfurt",
    name: "Volksbühne im Großen Hirschgraben",
    address: "Großer Hirschgraben 19, 60311 Frankfurt am Main",
    lat: 50.1116,
    lon: 8.6817,
    website_url: "https://volksbuehne.net",
    ticketing_provider: "reservix",
    scraper: "volksbuehne",
  },
  {
    slug: "stalburg-theater",
    name: "Stalburg Theater",
    address: "Glauburgstraße 80, 60318 Frankfurt am Main",
    lat: 50.1294,
    lon: 8.6885,
    website_url: "https://stalburg.de",
    ticketing_provider: "reservix",
    scraper: "stalburg",
  },
  {
    slug: "tigerpalast-variete",
    name: "Tigerpalast Varieté",
    address: "Heiligkreuzgasse 16-20, 60313 Frankfurt am Main",
    lat: 50.1146,
    lon: 8.6836,
    website_url: "https://www.tigerpalast.de",
    ticketing_provider: "reservix",
    scraper: "tigerpalast",
  },
  {
    slug: "die-schmiere",
    name: "Die Schmiere",
    address: "Seckbächer Gasse 8, 60311 Frankfurt am Main",
    lat: 50.1112,
    lon: 8.6833,
    website_url: "https://die-schmiere.de",
    ticketing_provider: "reservix",
    scraper: "schmiere",
  },
  {
    slug: "dresden-frankfurt-dance-company",
    name: "Dresden Frankfurt Dance Company",
    address: "Bockenheimer Depot, Carlo-Schmid-Platz 1, 60486 Frankfurt am Main",
    lat: 50.1205,
    lon: 8.6463,
    website_url: "https://www.dfdc.de",
    ticketing_provider: "eventim_inhouse",
    scraper: "dfdc",
  },
  {
    slug: "dramatische-buehne",
    name: "Die Dramatische Bühne",
    address: "Frankfurt am Main",
    lat: 50.1109,
    lon: 8.6821,
    website_url: "https://www.diedramatischebuehne.de",
    ticketing_provider: "custom",
    scraper: "dramatische-buehne",
  },
  {
    slug: "theater-willy-praml",
    name: "Theater Willy Praml",
    address: "Naxoshalle, Waldschmidtstraße 19, 60316 Frankfurt am Main",
    lat: 50.1199,
    lon: 8.7037,
    website_url: "https://theaterwillypraml.de",
    ticketing_provider: "custom",
    scraper: "willy-praml",
  },
  {
    slug: "kellertheater-frankfurt",
    name: "Kellertheater Frankfurt",
    address: "Mainstraße 2, 60311 Frankfurt am Main",
    lat: 50.1108,
    lon: 8.6852,
    website_url: "https://www.kellertheater-frankfurt.de",
    ticketing_provider: "frankfurt_ticket",
    scraper: "kellertheater",
  },
];
