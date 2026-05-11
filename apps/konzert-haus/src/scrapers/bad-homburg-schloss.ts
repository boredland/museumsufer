import type { ScrapeResult } from "../types";

export async function scrapeBadHomburgSchloss(): Promise<ScrapeResult> {
  return { venue_slug: "bad-homburger-schlosskonzerte", events: [] };
}
