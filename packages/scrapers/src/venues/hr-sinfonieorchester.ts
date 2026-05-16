import type { VenueScrapeResult } from "../types";
import { scrapeHrVenue } from "./_hr-common";

export async function scrapeHrSinfonieorchester(): Promise<VenueScrapeResult> {
  return scrapeHrVenue({
    sourceSlug: "hr-sinfonieorchester",
    baseUrl: "https://www.hr-sinfonieorchester.de",
    listPath: "veranstaltungen-110",
    defaultGenre: "classical",
    slugPrefix: "hrso",
  });
}
