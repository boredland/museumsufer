import type { LehrhausSource } from "./types";

export const SOURCES: LehrhausSource[] = [
  {
    slug: "polytechnische-gesellschaft",
    name: "Polytechnische Gesellschaft Frankfurt",
    short_name: "Polytechnische",
    url: "https://polytechnische.de",
    lat: 50.1136,
    lon: 8.6833,
  },
  {
    slug: "haus-am-dom",
    name: "Haus am Dom – Kath. Akademie Rabanus Maurus",
    short_name: "Haus am Dom",
    url: "https://hausamdom-frankfurt.de",
    lat: 50.1107,
    lon: 8.6826,
  },
  {
    slug: "kfw-stiftung",
    name: "KfW Stiftung – Philosophie-Salon Villa 102",
    short_name: "KfW Stiftung",
    url: "https://www.kfw-stiftung.de",
    lat: 50.1214,
    lon: 8.6606,
  },
  // v2 sources (not yet scraped)
  // sigmund-freud-institut: https://sigmund-freud-institut.de/index.php/category/veranstaltungen/
  // fpi-frankfurt: https://fpi.de/veranstaltungen/veranstaltungskalender (Fritz-Perls-Institut, depth psychology)
  // institut-francais-frankfurt: https://www.institutfrancais.de/de/frankfurt-am-main/veranstaltungen-frankfurt-am-main#/ (French cultural institute)
  // instituto-cervantes-frankfurt: https://frankfurt.cervantes.es/de/kultur_spanisch/kulturprogramm.htm (Spanish cultural institute)

  // Cross-imports — not independently scraped; events flow from existing apps.
  {
    slug: "frankfurt-museums",
    name: "Frankfurter Museen",
    short_name: "Museen",
    url: "https://museumsufer.app",
  },
  {
    slug: "frankfurt-theaters",
    name: "Frankfurter Theater",
    short_name: "Theater",
    url: "https://ins.theater",
  },
];
