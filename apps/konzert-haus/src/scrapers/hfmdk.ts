import type { ScrapeResult } from "../types";

export async function scrapeHfmdk(): Promise<ScrapeResult> {
  return { venue_slug: "hfmdk", events: [] };
}
