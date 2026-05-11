import type { ScrapeResult } from "../types";

export async function scrapeRheingauFestival(): Promise<ScrapeResult> {
  return { venue_slug: "rheingau-musikfestival", events: [] };
}
