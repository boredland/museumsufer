import { todayIso } from "@museumsufer/core";
import { proxyFetch } from "../proxy";
import type { CanonicalScrapedEvent, ScraperContext, VenueScrapeResult } from "../types";

/**
 * First Stage Theater in Altona sells tickets via Vivenu.
 * We fetch events directly from the Vivenu public listings API.
 */
export async function scrapeFirstStageTheater(ctx: ScraperContext): Promise<VenueScrapeResult> {
  const sellerId = "669543d6ee111e1c837d2bb8";
  const url = `https://vivenu.com/api/events/public/listings?sellerId=${sellerId}&top=1000`;

  let events: any[] = [];
  try {
    const res = await proxyFetch(url, ctx.proxy, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Vivenu API responded with status ${res.status}`);
    }
    events = await res.json();
  } catch (e: any) {
    console.error(`[first-stage-theater] API fetch failed: ${e.message}`);
    return {
      source_slug: "first-stage-theater",
      display_name: "First Stage Theater",
      events: [],
    };
  }

  const today = todayIso();
  const out: CanonicalScrapedEvent[] = [];

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const timeFormatter = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  for (const e of events) {
    // Skip vouchers/packages and administrative entries
    if (e.name === "Gutscheine" || e.name === "Stuhlpatenschaft") continue;
    if (e.eventType === "ROOT") continue; // We only want individual showtimes

    let dateStr = "";
    let timeStr = "";
    try {
      const d = new Date(e.start);
      dateStr = dateFormatter.format(d);
      timeStr = timeFormatter.format(d);
    } catch (_err) {
      continue;
    }

    if (dateStr < today) continue; // Only keep future/today events

    out.push({
      source_event_id: e._id,
      title: e.name,
      description: "",
      date: dateStr,
      time: timeStr,
      detail_url: `https://tickets.firststagehamburg.de/event/${e.url}`,
      ticket_url: `https://tickets.firststagehamburg.de/event/${e.url}`,
      image_url: e.image || null,
      price_min: e.startingPrice || null,
      price_max: null,
      performers: null,
      labels: [
        {
          label: "stage:musical",
          confidence: 1,
          classifier: "scraper-hardcoded",
        },
      ],
    });
  }

  return {
    source_slug: "first-stage-theater",
    display_name: "First Stage Theater",
    events: out,
  };
}
