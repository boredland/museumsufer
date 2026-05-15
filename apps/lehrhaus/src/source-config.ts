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
  {
    slug: "institut-fuer-sozialforschung",
    name: "Institut für Sozialforschung Frankfurt",
    short_name: "IfS Frankfurt",
    url: "https://www.ifs.uni-frankfurt.de",
    lat: 50.1217,
    lon: 8.6558,
  },
  {
    slug: "evangelische-akademie-frankfurt",
    name: "Evangelische Akademie Frankfurt",
    short_name: "Ev. Akademie",
    url: "https://www.evangelische-akademie.de",
    lat: 50.1102,
    lon: 8.6824,
  },
  {
    slug: "romanfabrik",
    name: "Romanfabrik Frankfurt",
    short_name: "Romanfabrik",
    url: "https://www.romanfabrik.de",
    lat: 50.1183,
    lon: 8.7078,
  },
  {
    slug: "denkbar-frankfurt",
    name: "Denkbar Frankfurt",
    short_name: "Denkbar",
    url: "https://denkbar-ffm.de",
    lat: 50.1189,
    lon: 8.6601,
  },
  {
    slug: "sigmund-freud-institut",
    name: "Sigmund-Freud-Institut Frankfurt",
    short_name: "Freud-Institut",
    url: "https://sigmund-freud-institut.de",
    lat: 50.117,
    lon: 8.6557,
  },
  {
    slug: "dig-frankfurt",
    name: "Deutsch-Israelische Gesellschaft Frankfurt",
    short_name: "DIG Frankfurt",
    url: "https://frankfurt.deutsch-israelische-gesellschaft.de",
    lat: 50.1109,
    lon: 8.6821,
  },
  {
    slug: "roemerberggespraeche",
    name: "Römerberggespräche Frankfurt",
    short_name: "Römerberggespräche",
    url: "https://roemerberggespraeche-ffm.de",
    // Chagallsaal, Schauspiel Frankfurt
    lat: 50.1077,
    lon: 8.6726,
  },
  {
    slug: "mousonturm",
    name: "Künstler*innenhaus Mousonturm",
    short_name: "Mousonturm",
    url: "https://www.mousonturm.de",
    // Waldschmidtstraße 4, Ostend
    lat: 50.1158,
    lon: 8.7011,
  },
  // Evaluated — not viable:
  // fpi-frankfurt: https://fpi.de — public events page requires login
  // institut-francais-frankfurt: https://www.institutfrancais.de/de/frankfurt-am-main/... — Drupal AJAX, mostly courses/films/concerts
  // instituto-cervantes-frankfurt: https://frankfurt.cervantes.es — no structured event data
  // bnai-brith-frankfurt: domain NXDOMAIN, no web presence
  // loge-zur-einigkeit: domain TLS broken, inaccessible
  // house-of-finance: hof.uni-frankfurt.de — scrappable but content is academic research seminars/conferences, not general public
  // juedische-akademie: juedische-akademie.de — domain not launched yet (TLS broken); revisit Sept 2026
  {
    slug: "openbooks-frankfurt",
    name: "OPEN BOOKS Frankfurt",
    short_name: "Open Books",
    url: "https://www.openbooks-frankfurt.de",
    lat: 50.1109,
    lon: 8.6821,
  },

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
