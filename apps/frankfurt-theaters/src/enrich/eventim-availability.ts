import type { AvailabilityStatus } from "../types";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const FEW_LEFT_THRESHOLD = 30;

export interface AvailabilityResult {
  available_seats: number;
  total_seats: number;
  status: AvailabilityStatus;
}

/**
 * Fetches live seat availability for a single Eventim Inhouse event.
 *
 * Two-step protocol observed on schauspielfrankfurt.eventim-inhouse.de:
 *   1. GET /webshop/webticket/seatmap?eventId=<id>
 *      → 200 HTML containing inline JS with the signed
 *        `getSeatMapInfo("inhouserest-<mandant>-<eventId>?...&a_signature=...")` URL
 *   2. GET that signed URL on `public-api.eventim.com/seatmap/api/public/availability/...`
 *      → JSON `{ seats: [[priceCat, status], ...] }` where status 0 = free.
 *
 * Akamai bot management protects the inhouse host. From a Cloudflare Worker
 * (or any clean IP), the call works on the first request; from a flagged IP it
 * times out. We swallow all failures to keep the scraper resilient — callers
 * fall back to whatever status the spielplan HTML reported.
 */
export async function fetchEventimAvailability(
  inhouseHost: string,
  eventId: string,
): Promise<AvailabilityResult | null> {
  try {
    const seatmapUrl = `https://${inhouseHost}/webshop/webticket/seatmap?eventId=${eventId}`;
    const html = await fetchText(seatmapUrl);
    if (!html) return null;

    const apiUrl = extractAvailabilityUrl(html, eventId);
    if (!apiUrl) return null;

    const data = await fetchJson(apiUrl, { Origin: `https://${inhouseHost}`, Referer: seatmapUrl });
    if (!data || !Array.isArray(data.seats)) return null;

    const total = data.seats.length;
    let available = 0;
    for (const seat of data.seats) {
      if (Array.isArray(seat) && seat[1] === 0) available++;
    }

    return {
      available_seats: available,
      total_seats: total,
      status: deriveStatus(available),
    };
  } catch (err) {
    console.warn(`Eventim availability fetch failed for ${eventId}:`, err);
    return null;
  }
}

function deriveStatus(available: number): AvailabilityStatus {
  if (available === 0) return "sold_out";
  if (available <= FEW_LEFT_THRESHOLD) return "few_left";
  return "available";
}

function extractAvailabilityUrl(html: string, eventId: string): string | null {
  const re = new RegExp(
    `https?://public-api\\.eventim\\.com/seatmap/api/public/availability/inhouserest-\\d+-${eventId}\\?[^"'\\s<]+`,
    "i",
  );
  const match = html.match(re);
  return match ? decodeHtmlEntities(match[0]) : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchText(url: string): Promise<string | null> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "de-DE,de;q=0.9",
    },
    redirect: "follow",
  });
  if (!resp.ok) return null;
  return resp.text();
}

async function fetchJson(url: string, extraHeaders: Record<string, string>): Promise<{ seats: unknown[] } | null> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      ...extraHeaders,
    },
  });
  if (!resp.ok) return null;
  return (await resp.json()) as { seats: unknown[] };
}
