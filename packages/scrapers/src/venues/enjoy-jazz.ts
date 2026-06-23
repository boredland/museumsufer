import { HEIDELBERG_BBOX, inBbox } from "@museumsufer/core/cities";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const BASE = "https://enjoyjazz.de";
const LISTING_URLS = [`${BASE}/veranstaltungen/`, `${BASE}/veranstaltungen/liste/seite/2/`];

/**
 * Hand-curated venue coordinates for the Enjoy Jazz festival venues.
 * Determined via OpenStreetMap/Nominatim during development; the festival moves
 * between a small, stable set of venues in Heidelberg, Mannheim, Ludwigshafen
 * and neighbouring towns.
 */
const VENUE_COORDS: Record<string, { lat: number; lon: number }> = {
  "alte-aula": { lat: 49.4124627, lon: 8.7006019 },
  "alte-feuerwache": { lat: 49.4955359, lon: 8.474117 },
  "basf-feierabendhaus": { lat: 49.492162, lon: 8.4269735 },
  "basf-gesellschaftshaus": { lat: 49.4932251, lon: 8.4315039 },
  chapel: { lat: 49.389375, lon: 8.6867566 },
  dashaus: { lat: 49.4822788, lon: 8.4431571 },
  "epple-heidelberg": { lat: 49.4089398, lon: 8.6823783 },
  "franz-danzi-saal": { lat: 49.3865386, lon: 8.5724576 },
  "friedenskirche-ludwigshafen": { lat: 49.4947581, lon: 8.4257703 },
  "hambacher-schloss": { lat: 49.3250999, lon: 8.1179374 },
  "jugendkulturzentrum-forum": { lat: 49.494532, lon: 8.4787963 },
  karlstorbahnhof: { lat: 49.3865921, lon: 8.6811425 },
  "kino-im-karlstorbahnhof": { lat: 49.3865921, lon: 8.6811425 },
  klubk: { lat: 49.3865921, lon: 8.6811425 },
  "konzerthaus-stadthalle-heidelberg": { lat: 49.412301, lon: 8.7001919 },
  "metropolinks-commissary": { lat: 49.3740304, lon: 8.6296925 },
  rokokotheater: { lat: 49.3853803, lon: 8.5686088 },
  rosengarten: { lat: 49.4851702, lon: 8.4777176 },
  saalbau: { lat: 49.3507709, lon: 8.1393723 },
  "sammlung-prinzhorn": { lat: 49.4098077, lon: 8.6887542 },
  "zwinger-1": { lat: 49.4106641, lon: 8.7092445 },
};

interface TecEvent {
  id: number;
  url: string;
  title: string;
  description: string;
  image?: { url?: string } | null;
  start_date: string;
  end_date: string;
  venue?: {
    slug?: string;
    venue?: string;
    city?: string;
  } | null;
}

interface TecEventsResponse {
  events: TecEvent[];
}

export async function scrapeEnjoyJazz(): Promise<VenueScrapeResult> {
  const events = await fetchFutureEvents();
  const tickets = await fetchTicketMap();

  const out: CanonicalScrapedEvent[] = [];
  for (const ev of events) {
    const venueSlug = ev.venue?.slug;
    if (!venueSlug) continue;
    const coords = VENUE_COORDS[venueSlug];
    if (!coords) {
      console.warn(`Enjoy Jazz: unknown venue slug "${venueSlug}" for ${ev.url}`);
      continue;
    }

    const [dateRaw, clock] = ev.start_date.split(" ");
    const date = dateRaw ?? "";
    const time = clock?.slice(0, 5) ?? null;
    const [endDateRaw, endClock] = ev.end_date.split(" ");
    const endDate = endDateRaw ?? "";
    const endTime = endClock?.slice(0, 5) ?? null;
    const detailUrl = ev.url;
    const relativeDetail = detailUrl.startsWith(BASE) ? detailUrl.slice(BASE.length) : detailUrl;
    const ticketUrl = tickets.get(detailUrl) ?? tickets.get(relativeDetail) ?? null;
    const title = decodeEntities(stripHtml(ev.title));

    const rawDescription = stripHtml(ev.description);
    const description =
      rawDescription.length === 0
        ? null
        : rawDescription.length <= 800
          ? rawDescription
          : (() => {
              const cut = rawDescription.lastIndexOf(" ", 800);
              return `${cut > 0 ? rawDescription.slice(0, cut) : rawDescription.slice(0, 800)} …`;
            })();

    const inHeidelberg = inBbox(coords.lat, coords.lon, HEIDELBERG_BBOX);

    out.push({
      source_event_id: `${ev.id}`,
      title,
      subtitle: null,
      description,
      date,
      time,
      end_date: endDate === date ? null : endDate,
      end_time: endDate === date ? endTime : null,
      detail_url: detailUrl,
      ticket_url: ticketUrl,
      image_url: ev.image?.url ?? null,
      venue_room: ev.venue?.venue ?? null,
      city: inHeidelberg ? "heidelberg" : null,
      lat: coords.lat,
      lon: coords.lon,
      labels: resolveStageLabels({
        title,
        subtitle: description,
        defaultLabel: "music:jazz",
        classifier: "scraper-hardcoded",
        confidence: 0.9,
      }),
    });
  }

  out.sort(
    (a, b) =>
      `${a.date}T${a.time ?? ""}`.localeCompare(`${b.date}T${b.time ?? ""}`) ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return { source_slug: "enjoy-jazz", display_name: "Enjoy Jazz", events: out };
}

async function fetchFutureEvents(): Promise<TecEvent[]> {
  const today = todayIso();
  const out: TecEvent[] = [];
  for (let page = 1; page <= 5; page++) {
    const url = new URL(`${BASE}/wp-json/tribe/events/v1/events`);
    url.searchParams.set("per_page", "50");
    url.searchParams.set("start_date", today);
    url.searchParams.set("end_date", "2028-12-31");
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), { headers: { "User-Agent": UA } });
    if (!res.ok) break;
    const data = (await res.json()) as TecEventsResponse;
    if (!Array.isArray(data.events) || data.events.length === 0) break;
    out.push(...data.events);
  }
  return out;
}

async function fetchTicketMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const url of LISTING_URLS) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) continue;
    const html = await res.text();
    for (const block of html.split('class="event-buttons"')) {
      const detail = block.match(/<a\s+href="([^"]+)"\s+class="mehr-erfahren"/)?.[1];
      const ticket = block.match(/<a\s+href="([^"]+)"\s+class="ticket-kaufen"/)?.[1];
      if (detail && ticket) {
        map.set(decodeEntities(detail), decodeEntities(ticket));
        map.set(
          decodeEntities(detail).startsWith(BASE) ? decodeEntities(detail).slice(BASE.length) : decodeEntities(detail),
          decodeEntities(ticket),
        );
      }
    }
  }
  return map;
}
