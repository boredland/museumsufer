import { slugify, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const API_URL =
  "https://public-api.eventim.com/websearch/search/api/exploration/v1/products?webId=web__eventim-de&search_term=Hansa+Theater&categories=37";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeHansaTheater(): Promise<VenueScrapeResult> {
  let events: CanonicalScrapedEvent[] = [];
  try {
    const res = await fetch(API_URL, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Hansa-Theater API fetch failed: ${res.status}`);
    const data = (await res.json()) as any;
    events = parseEventimProducts(data);
  } catch (err) {
    console.warn("Hansa-Theater fetch error:", err);
  }

  return {
    source_slug: "hansa-theater",
    display_name: "Hansa-Theater",
    events,
  };
}

function parseEventimProducts(data: any): CanonicalScrapedEvent[] {
  const today = todayIso();
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const products = data.products || [];
  for (const product of products) {
    // Only Hansa-Theater / Hansa Theatersaal events
    const venueName = (product.venueName || "").toLowerCase();
    if (!venueName.includes("hansa-theater") && !venueName.includes("hansa theatersaal")) {
      continue;
    }

    const title = product.name;
    if (!title) continue;

    // Date
    const startDateRaw = product.startDate; // YYYY-MM-DD
    if (!startDateRaw) continue;
    const date = startDateRaw.slice(0, 10);
    if (date < today) continue;

    const time = product.startTime || "19:30";
    const uid = `${slugify(title)}|${date}|${time}`;
    if (seen.has(uid)) continue;
    seen.add(uid);

    const ticketUrl = product.link ? `https://www.eventim.de${product.link}` : "https://www.hansa-theater.com/";
    const imageUrl = product.imageUrl || null;

    out.push({
      source_event_id: uid,
      title,
      subtitle: null,
      description: null,
      date,
      time,
      detail_url: ticketUrl,
      ticket_url: ticketUrl,
      image_url: imageUrl,
      price_min: product.priceMin ? parseFloat(product.priceMin) : null,
      price_max: product.priceMax ? parseFloat(product.priceMax) : null,
      performers: null,
      venue_room: "Hansa-Theater",
      raw_category: null,
      labels: resolveStageLabels({
        title,
        subtitle: null,
        defaultLabel: "stage:theater",
        confidence: 0.85,
      }),
    });
  }

  return out;
}
