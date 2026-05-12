import type { ScrapeResult } from "../types";
import { scrapeHrVenue } from "./_hr-common";

export async function scrapeHrBigband(): Promise<ScrapeResult> {
  return scrapeHrVenue({
    venueSlug: "hr-bigband",
    baseUrl: "https://www.hr-bigband.de",
    listPath: "veranstaltungen-112",
    defaultGenre: "jazz",
    slugPrefix: "hrbb",
  });
}
