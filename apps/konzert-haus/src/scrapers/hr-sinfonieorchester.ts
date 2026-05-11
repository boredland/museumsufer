import type { ScrapeResult } from "../types";

export async function scrapeHrSinfonieorchester(): Promise<ScrapeResult> {
  return { venue_slug: "hr-sinfonieorchester", events: [] };
}
