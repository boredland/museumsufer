import type { ScrapeResult } from "../types";

export async function scrapeHrBigband(): Promise<ScrapeResult> {
  return { venue_slug: "hr-bigband", events: [] };
}
