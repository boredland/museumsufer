import type { ScrapeResult } from "../types";

export async function scrapeBadSoden(): Promise<ScrapeResult> {
  return { venue_slug: "bad-soden", events: [] };
}
