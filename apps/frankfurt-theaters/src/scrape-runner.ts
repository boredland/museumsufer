import { scrapeAlteBruecke } from "./scrapers/alte-bruecke";
import { scrapeDfdc } from "./scrapers/dfdc";
import { scrapeDramatischeBuehne } from "./scrapers/dramatische-buehne";
import { scrapeEnglishTheatre } from "./scrapers/english-theatre";
import { scrapeGalli } from "./scrapers/galli";
import { scrapeGallusTheater } from "./scrapers/gallus";
import { scrapeInternationalesTheater } from "./scrapers/internationales-theater";
import { scrapeKaes } from "./scrapers/kaes";
import { scrapeKellertheater } from "./scrapers/kellertheater";
import { scrapeKomoedieFrankfurt } from "./scrapers/komoedie";
import { scrapeLandungsbruecken } from "./scrapers/landungsbruecken";
import { scrapeLempenfieber } from "./scrapers/lempenfieber";
import { scrapeMousonturm } from "./scrapers/mousonturm";
import { scrapeNeuesTheaterHoechst } from "./scrapers/neues-theater-hoechst";
import { scrapeOperFrankfurt } from "./scrapers/oper";
import { scrapePapageno } from "./scrapers/papageno";
import { scrapeSchauspielFrankfurt } from "./scrapers/schauspiel";
import { scrapeSchmiere } from "./scrapers/schmiere";
import { scrapeStalburg } from "./scrapers/stalburg";
import { scrapeTheaterhaus } from "./scrapers/theaterhaus";
import { scrapeTigerpalast } from "./scrapers/tigerpalast";
import { scrapeVolksbuehne } from "./scrapers/volksbuehne";
import { scrapeWillyPraml } from "./scrapers/willy-praml";
import type { TheaterConfig } from "./theater-config";
import type { ScrapeResult } from "./types";

/** Dispatch a scraper by config name. Used by the GH-Action-driven
 *  `scripts/scrape.ts` to walk every theater and aggregate results into
 *  the bundled `src/scrape-data.ts`. */
export async function runScraper(name: TheaterConfig["scraper"]): Promise<ScrapeResult> {
  switch (name) {
    case "schauspiel":
      return scrapeSchauspielFrankfurt();
    case "oper":
      return scrapeOperFrankfurt();
    case "english-theatre":
      return scrapeEnglishTheatre();
    case "komoedie":
      return scrapeKomoedieFrankfurt();
    case "mousonturm":
      return scrapeMousonturm();
    case "neues-theater-hoechst":
      return scrapeNeuesTheaterHoechst();
    case "volksbuehne":
      return scrapeVolksbuehne();
    case "stalburg":
      return scrapeStalburg();
    case "tigerpalast":
      return scrapeTigerpalast();
    case "schmiere":
      return scrapeSchmiere();
    case "dfdc":
      return scrapeDfdc();
    case "dramatische-buehne":
      return scrapeDramatischeBuehne();
    case "willy-praml":
      return scrapeWillyPraml();
    case "kellertheater":
      return scrapeKellertheater();
    case "gallus":
      return scrapeGallusTheater();
    case "theaterhaus":
      return scrapeTheaterhaus();
    case "internationales-theater":
      return scrapeInternationalesTheater();
    case "papageno":
      return scrapePapageno();
    case "galli":
      return scrapeGalli();
    case "alte-bruecke":
      return scrapeAlteBruecke();
    case "kaes":
      return scrapeKaes();
    case "lempenfieber":
      return scrapeLempenfieber();
    case "landungsbruecken":
      return scrapeLandungsbruecken();
  }
}
