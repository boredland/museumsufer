import type { ScrapeResult } from "../types";

export async function scrapeStKatharinen(): Promise<ScrapeResult> {
  return { venue_slug: "st-katharinen", events: [] };
}
