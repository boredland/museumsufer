import type { ScrapeResult } from "../types";

export async function scrapeOper(): Promise<ScrapeResult> {
  return { venue_slug: "oper-frankfurt", events: [] };
}
