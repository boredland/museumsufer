import type { ScrapeResult } from "../types";

export async function scrapeJazzFrankfurt(): Promise<ScrapeResult> {
  return { venue_slug: "jazz-frankfurt", events: [] };
}
