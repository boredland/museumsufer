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
    slug: "juedische-gemeinde-frankfurt",
    name: "Jüdische Gemeinde Frankfurt",
    short_name: "Jüd. Gemeinde",
    url: "https://jg-ffm.de",
    lat: 50.1167,
    lon: 8.6712,
  },
  {
    slug: "fgz-streitclub",
    name: "FGZ StreitClub",
    short_name: "StreitClub",
    url: "https://fgz-risc.uni-frankfurt.de",
    lat: 50.1108,
    lon: 8.6622,
  },
  {
    slug: "literaturhaus-frankfurt",
    name: "Literaturhaus Frankfurt",
    short_name: "Literaturhaus",
    url: "https://www.literaturhaus-frankfurt.de",
    lat: 50.1173,
    lon: 8.6814,
  },
  {
    slug: "buergeruniversitaet",
    name: "Goethe-Uni Bürgeruniversität",
    short_name: "Bürger-Uni",
    url: "https://aktuelles.uni-frankfurt.de",
    lat: 50.1284,
    lon: 8.6679,
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
