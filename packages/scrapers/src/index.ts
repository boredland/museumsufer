export { type ProxyConfig, proxyFetch } from "./proxy";
export type {
  CanonicalScrapedEvent,
  ClassifierName,
  ScrapedLabel,
  ScraperContext,
  VenueScrapeResult,
  VenueScraper,
} from "./types";

import type { ScraperContext, VenueScraper } from "./types";
import { scrapeBuergeruniversitaet } from "./venues/buergeruniversitaet";
import { scrapeDenkbar } from "./venues/denkbar";
import { scrapeDigFrankfurt } from "./venues/dig-frankfurt";
import { scrapeEvangelischeAkademie } from "./venues/evangelische-akademie";
import { scrapeJuedischeGemeinde } from "./venues/juedische-gemeinde-frankfurt";
import { scrapeLiteraturhaus } from "./venues/literaturhaus-frankfurt";
import { scrapeMousonturm } from "./venues/mousonturm";
import { scrapeRomanfabrik } from "./venues/romanfabrik";
import { scrapeSigmundFreudInstitut } from "./venues/sigmund-freud-institut";
import { scrapeStadtbuechereiFrankfurt } from "./venues/stadtbuecherei-frankfurt";

/**
 * The set of canonical hub scrapers. Each emits canonical-shaped events
 * with multi-label tags so the hub's classifier pass can augment them
 * before persisting. Apps continue to maintain their own per-venue
 * scrapers during the parallel-run window; this catalogue grows as
 * individual venues migrate over.
 */
export const VENUE_SCRAPERS: ReadonlyArray<{ slug: string; run: VenueScraper }> = [
  { slug: "buergeruniversitaet", run: (_ctx: ScraperContext) => scrapeBuergeruniversitaet() },
  { slug: "denkbar-frankfurt", run: (_ctx: ScraperContext) => scrapeDenkbar() },
  { slug: "dig-frankfurt", run: (_ctx: ScraperContext) => scrapeDigFrankfurt() },
  { slug: "evangelische-akademie-frankfurt", run: (_ctx: ScraperContext) => scrapeEvangelischeAkademie() },
  { slug: "juedische-gemeinde-frankfurt", run: (_ctx: ScraperContext) => scrapeJuedischeGemeinde() },
  { slug: "literaturhaus-frankfurt", run: (_ctx: ScraperContext) => scrapeLiteraturhaus() },
  { slug: "mousonturm", run: (_ctx: ScraperContext) => scrapeMousonturm() },
  { slug: "romanfabrik", run: (_ctx: ScraperContext) => scrapeRomanfabrik() },
  { slug: "sigmund-freud-institut", run: (_ctx: ScraperContext) => scrapeSigmundFreudInstitut() },
  { slug: "stadtbuecherei-frankfurt", run: (ctx: ScraperContext) => scrapeStadtbuechereiFrankfurt(ctx.proxy) },
];

export {
  scrapeBuergeruniversitaet,
  scrapeDenkbar,
  scrapeDigFrankfurt,
  scrapeEvangelischeAkademie,
  scrapeJuedischeGemeinde,
  scrapeLiteraturhaus,
  scrapeMousonturm,
  scrapeRomanfabrik,
  scrapeSigmundFreudInstitut,
  scrapeStadtbuechereiFrankfurt,
};
