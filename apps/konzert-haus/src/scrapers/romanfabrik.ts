import type { ScrapeResult } from "../types";

export async function scrapeRomanfabrik(): Promise<ScrapeResult> {
  return { venue_slug: "romanfabrik", events: [] };
}
