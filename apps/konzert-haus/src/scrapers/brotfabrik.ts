import type { ScrapeResult } from "../types";

export async function scrapeBrotfabrik(): Promise<ScrapeResult> {
  return { venue_slug: "brotfabrik", events: [] };
}
