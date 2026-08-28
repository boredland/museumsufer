import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const CITY_URL = "https://standup-republic.de/cities/Frankfurt";
const EVENT_BASE = "https://standup-republic.de/events";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/** The club at Weißfrauenstraße 2-8. The city page also carries Standup
 *  Republic's shows at other Frankfurt addresses — Wiesenhüttenstr. 39,
 *  Pfingstweidstraße 2, and Waldschmidtstr. 19, which is Die Käs and already
 *  has its own scraper — so we filter to the club's own address rather than
 *  re-listing venues the hub covers elsewhere. */
const VENUE_STREET = "Weißfrauenstraße 2-8";
const VENUE_COORDS = { lat: 50.109848, lon: 8.676846 };

/**
 * Comedy Club Frankfurt — the stand-up room at Weißfrauenstraße 2-8, programmed
 * through the Standup Republic network (Comedyflash, Comedy Nation, open mics
 * and touring solo shows).
 *
 * The site is a Next.js app with no JSON-LD and no public API, but the city
 * page ships its whole programme in the RSC flight payload: one object per
 * performance carrying title, description, `duration` (start + end), street,
 * city, image and `ticket_details` (price, sold-out). That is a single request
 * for the full listing, so we parse the payload instead of crawling ~200
 * detail pages.
 */
export async function scrapeComedyClubFrankfurt(): Promise<VenueScrapeResult> {
  const res = await fetch(CITY_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`comedy-club-frankfurt fetch failed: ${res.status}`);
  const flight = decodeFlightPayload(await res.text());

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<number>();

  for (const raw of extractEventObjects(flight)) {
    if (raw.location?.trim() !== VENUE_STREET) continue;
    const when = parseDuration(raw.duration);
    if (!when || when.date < today) continue;
    // The payload repeats an event once per carousel it appears in.
    if (seen.has(raw.eventId)) continue;
    seen.add(raw.eventId);

    const title = raw.title.trim();
    const ticket = raw.ticket_details?.find((t) => t.active) ?? raw.ticket_details?.[0];
    const prices = (raw.ticket_details ?? []).map((t) => t.price).filter((p): p is number => typeof p === "number");

    events.push({
      source_event_id: String(raw.eventId),
      title,
      description: raw.description?.replace(/\s+/g, " ").trim() || null,
      date: when.date,
      time: when.time,
      end_time: when.endTime,
      detail_url: `${EVENT_BASE}/${slugForEvent(title, raw.eventId)}`,
      ticket_url: `${EVENT_BASE}/${slugForEvent(title, raw.eventId)}`,
      image_url: raw.imageUrl ? `https://standup-republic.de/${raw.imageUrl.replace(/^\/+/, "")}` : null,
      price_min: prices.length ? Math.min(...prices) : null,
      price_max: prices.length ? Math.max(...prices) : null,
      venue_room: "Comedy Club Frankfurt",
      city: "Frankfurt am Main",
      lat: VENUE_COORDS.lat,
      lon: VENUE_COORDS.lon,
      ...(ticket?.sold_out ? { availability: "sold_out" as const } : {}),
      labels: labelsFor(),
    });
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title),
  );
  return { source_slug: "comedy-club-frankfurt", display_name: "Comedy Club Frankfurt", events };
}

interface TicketDetail {
  price?: number | null;
  active?: boolean;
  sold_out?: boolean;
}

interface FlightEvent {
  eventId: number;
  title: string;
  description?: string | null;
  /** JSON-encoded `["YYYY-MM-DD HH:MM:SS", "YYYY-MM-DD HH:MM:SS"]`. */
  duration: string;
  location?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  ticket_details?: TicketDetail[];
}

/** Next.js streams the RSC payload as a sequence of `self.__next_f.push` calls
 *  whose arguments are JS string literals; concatenating the decoded chunks
 *  reconstitutes the flight document the page was rendered from. */
function decodeFlightPayload(html: string): string {
  let out = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      out += JSON.parse(`"${m[1]}"`);
    } catch {}
  }
  return out;
}

/** The flight document is not valid JSON as a whole, so we scan for the event
 *  objects by their opening shape and brace-match each one out. */
function extractEventObjects(flight: string): FlightEvent[] {
  const out: FlightEvent[] = [];
  for (const m of flight.matchAll(/\{"id":\d+,"external_url"/g)) {
    let depth = 0;
    let end = m.index;
    for (; end < flight.length; end++) {
      if (flight[end] === "{") depth++;
      else if (flight[end] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    try {
      const parsed = JSON.parse(flight.slice(m.index, end + 1)) as FlightEvent;
      if (parsed.eventId && parsed.title && parsed.duration) out.push(parsed);
    } catch {}
  }
  return out;
}

function parseDuration(duration: string): { date: string; time: string | null; endTime: string | null } | null {
  let span: unknown;
  try {
    span = JSON.parse(duration);
  } catch {
    return null;
  }
  if (!Array.isArray(span) || typeof span[0] !== "string") return null;
  const start = span[0].match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (!start) return null;
  const end = typeof span[1] === "string" ? span[1].match(/[ T](\d{2}:\d{2})/) : null;
  return { date: start[1], time: start[2], endTime: end?.[1] ?? null };
}

/** Detail URLs are `<title-slug>_<eventId>`; the id is what actually resolves,
 *  but the slug keeps the link human-readable and matches the site's own form. */
function slugForEvent(title: string, eventId: number): string {
  const slug = title
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}_${eventId}`;
}

/** Everything this room programmes is stand-up. */
function labelsFor(): ScrapedLabel[] {
  return [{ label: "stage:comedy", confidence: 0.95, classifier: "scraper-hardcoded" }];
}
