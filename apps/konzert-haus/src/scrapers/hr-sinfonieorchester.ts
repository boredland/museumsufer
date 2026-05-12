import type { ScrapeResult } from "../types";
import { scrapeHrVenue } from "./_hr-common";

export async function scrapeHrSinfonieorchester(): Promise<ScrapeResult> {
  return scrapeHrVenue({
    venueSlug: "hr-sinfonieorchester",
    baseUrl: "https://www.hr-sinfonieorchester.de",
    listPath: "veranstaltungen-110",
    defaultGenre: "classical",
    slugPrefix: "hrso",
  });
}
