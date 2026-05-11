import type { ScrapeResult } from "../types";

export async function scrapeJazzPalmengarten(): Promise<ScrapeResult> {
  return { venue_slug: "jazz-palmengarten", events: [] };
}
