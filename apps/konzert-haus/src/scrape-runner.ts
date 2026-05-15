import { scrapeAlteOper } from "./scrapers/alte-oper";
import { scrapeAndreasKoehs } from "./scrapers/andreas-koehs";
import { scrapeBadHomburgSchloss } from "./scrapers/bad-homburg-schloss";
import { scrapeBadSoden } from "./scrapers/bad-soden";
import { scrapeBrotfabrik } from "./scrapers/brotfabrik";
import { scrapeDenkbar } from "./scrapers/denkbar";
import { scrapeDrHochs } from "./scrapers/dr-hochs";
import { scrapeEnsembleModern } from "./scrapers/ensemble-modern";
import { scrapeEvangelischeAkademie } from "./scrapers/evangelische-akademie";
import { scrapeHfmdk } from "./scrapers/hfmdk";
import { scrapeHolzhausenschloesschen } from "./scrapers/holzhausenschloesschen";
import { scrapeHrBigband } from "./scrapers/hr-bigband";
import { scrapeHrSinfonieorchester } from "./scrapers/hr-sinfonieorchester";
import { scrapeJazzFrankfurt } from "./scrapers/jazz-frankfurt";
import { scrapeJazzPalmengarten } from "./scrapers/jazz-palmengarten";
import { scrapeKirchenmusikDreikoenig } from "./scrapers/kirchenmusik-dreikoenig";
import { scrapeKronbergAcademy } from "./scrapers/kronberg-academy";
import { scrapeMusikschuleFrankfurt } from "./scrapers/musikschule-frankfurt";
import { scrapeNaxos } from "./scrapers/naxos";
import { scrapeOper } from "./scrapers/oper";
import { scrapeRheingauFestival } from "./scrapers/rheingau-festival";
import { scrapeRomanfabrik } from "./scrapers/romanfabrik";
import { scrapeStKatharinen } from "./scrapers/stk-musik";
import { scrapeWaggong } from "./scrapers/waggong";
import type { ScrapeResult, ScraperName } from "./types";

export async function runScraper(name: ScraperName): Promise<ScrapeResult> {
  switch (name) {
    case "alte-oper":
      return scrapeAlteOper();
    case "oper":
      return scrapeOper();
    case "dr-hochs":
      return scrapeDrHochs();
    case "hfmdk":
      return scrapeHfmdk();
    case "ensemble-modern":
      return scrapeEnsembleModern();
    case "hr-sinfonieorchester":
      return scrapeHrSinfonieorchester();
    case "hr-bigband":
      return scrapeHrBigband();
    case "holzhausenschloesschen":
      return scrapeHolzhausenschloesschen();
    case "jazz-frankfurt":
      return scrapeJazzFrankfurt();
    case "jazz-palmengarten":
      return scrapeJazzPalmengarten();
    case "brotfabrik":
      return scrapeBrotfabrik();
    case "romanfabrik":
      return scrapeRomanfabrik();
    case "andreas-koehs":
      return scrapeAndreasKoehs();
    case "kirchenmusik-dreikoenig":
      return scrapeKirchenmusikDreikoenig();
    case "stk-musik":
      return scrapeStKatharinen();
    case "kronberg-academy":
      return scrapeKronbergAcademy();
    case "rheingau-festival":
      return scrapeRheingauFestival();
    case "bad-homburg-schloss":
      return scrapeBadHomburgSchloss();
    case "bad-soden":
      return scrapeBadSoden();
    case "evangelische-akademie":
      return scrapeEvangelischeAkademie();
    case "denkbar":
      return scrapeDenkbar();
    case "naxos":
      return scrapeNaxos();
    case "waggong":
      return scrapeWaggong();
    case "musikschule-frankfurt":
      return scrapeMusikschuleFrankfurt();
  }
}
