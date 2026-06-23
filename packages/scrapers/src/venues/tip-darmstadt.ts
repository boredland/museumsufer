import { todayIso } from "@museumsufer/core/date";
import type { VenueScrapeResult } from "../types";
import { scrapeZtixVenue } from "./_ztix";

/**
 * Theater im Pädagog (TIP) — socio-cultural theatre and concert venue in
 * Darmstadt. Its The-Events-Calendar programme is rendered client-side, but
 * each individual event page is server-rendered and contains the ztix booking
 * link. We discover current event pages via the public WordPress REST API and
 * feed them to the shared ztix adapter.
 */
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface TecEvent {
  id: number;
  url: string;
  start_date: string;
}
interface TecApiResponse {
  events?: TecEvent[];
}

async function collectListingUrls(): Promise<string[]> {
  const today = todayIso();
  const apiUrl = "https://paedagogtheater.de/wp-json/tribe/events/v1/events?per_page=100";
  try {
    const res = await fetch(apiUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const data = (await res.json()) as TecApiResponse;
    return (data.events ?? []).filter((e) => e.url && (e.start_date ?? "").slice(0, 10) >= today).map((e) => e.url);
  } catch {
    return [];
  }
}

export async function scrapeTipDarmstadt(): Promise<VenueScrapeResult> {
  const listingUrls = await collectListingUrls();
  return scrapeZtixVenue({
    org: "tip",
    listingUrls,
    source_slug: "tip-darmstadt",
    display_name: "Theater im Pädagog",
    city: "darmstadt",
    lat: 49.8745,
    lon: 8.6505,
    defaultLabel: "stage:theater",
  });
}
