export { type ProxyConfig, proxyFetch } from "./proxy";
export type {
  CanonicalScrapedEvent,
  ClassifierName,
  ScrapedLabel,
  VenueScrapeResult,
  VenueScraper,
} from "./types";

import type { VenueScraper } from "./types";
import { scrapeDenkbar } from "./venues/denkbar";
import { scrapeEvangelischeAkademie } from "./venues/evangelische-akademie";
import { scrapeMousonturm } from "./venues/mousonturm";
import { scrapeRomanfabrik } from "./venues/romanfabrik";

/**
 * The set of canonical hub scrapers. Each emits canonical-shaped events
 * with multi-label tags so the hub's classifier pass can augment them
 * before persisting. Apps continue to maintain their own per-venue
 * scrapers during the parallel-run window; this catalogue grows as
 * individual venues migrate over.
 */
export const VENUE_SCRAPERS: ReadonlyArray<{ slug: string; run: VenueScraper }> = [
  { slug: "denkbar-frankfurt", run: scrapeDenkbar },
  { slug: "evangelische-akademie-frankfurt", run: scrapeEvangelischeAkademie },
  { slug: "mousonturm", run: scrapeMousonturm },
  { slug: "romanfabrik", run: scrapeRomanfabrik },
];

export { scrapeDenkbar, scrapeEvangelischeAkademie, scrapeMousonturm, scrapeRomanfabrik };
