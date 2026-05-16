import type { VenueScrapeResult } from "../types";
import { scrapeHrVenue } from "./_hr-common";

export async function scrapeHrBigband(): Promise<VenueScrapeResult> {
  return scrapeHrVenue({
    sourceSlug: "hr-bigband",
    baseUrl: "https://www.hr-bigband.de",
    listPath: "veranstaltungen-112",
    defaultGenre: "jazz",
    slugPrefix: "hrbb",
  });
}
