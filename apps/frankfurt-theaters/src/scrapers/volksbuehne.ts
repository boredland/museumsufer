import { todayIso } from "../date";
import { decodeEntities, normalizeUrl, nullIfMidnight, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://volksbuehne.net";
const PROGRAMM_URL = `${BASE}/programm/`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Fliegende Volksbühne (volksbuehne.net) lists productions on /programm/
 * as `<div class="teaser">` cards. Each card links to a detail page
 * `/programm/<slug>?base=aktuell` whose Termine section carries the
 * actual schedule:
 *
 *   <ul>
 *     <li[ class="highlight"]>
 *       <div class="event">
 *         <h4>Fr 04.09.2026</h4>
 *         <h4>19.30&nbsp;Uhr [optional suffix like "BEI UNS ZU GAST"]</h4>
 *         <p>Volksbühne im Großen Hirschgraben - STUDIOBÜHNE
 *            <br/>Großer Hirschgraben 19, 60311 Frankfurt</p>
 *         <div class="programme">…per-performance blurb…</div>
 *         <div class="buttons">
 *           <a href="https://volksbuehne.reservix.de/p/reservix/event/<id>"
 *              class="tickets available">Karten</a>
 *           <a class="ical">ical</a>
 *
 * The ticket-link's second class is the status (`available`, presumably
 * `soldout` / `cancelled` / `unavailable` if anything else appears). Tickets
 * mostly go to volksbuehne.reservix.de but guest performances link out to
 * the host promoter's vendor (other Reservix subdomains, Eventim,
 * Ticketmaster). Not enough data to establish a public price source.
 */

export async function scrapeVolksbuehne(): Promise<ScrapeResult> {
  const listingHtml = await fetchHtml(PROGRAMM_URL);
  const showStubs = parseListing(listingHtml);

  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const stub of showStubs) {
    let detailHtml: string;
    try {
      detailHtml = await fetchHtml(`${BASE}/programm/${stub.slug}?base=aktuell`);
    } catch (err) {
      console.warn(`Volksbühne detail fetch failed for ${stub.slug}:`, err);
      continue;
    }

    const events = parseEvents(detailHtml);
    if (!events.length) continue;

    showsBySlug.set(stub.slug, {
      slug: stub.slug,
      title: stub.title,
      subtitle: stub.subtitle,
      description: stub.subtitle,
      image_url: stub.image,
      detail_url: `${BASE}/programm/${stub.slug}`,
    });

    for (const e of events) {
      if (e.date < today) continue;
      const dedup = `${stub.slug}|${e.date}|${e.time ?? ""}|${e.venueRoom ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      performances.push({
        show_slug: stub.slug,
        date: e.date,
        time: e.time,
        end_time: null,
        venue_room: e.venueRoom,
        provider_event_id: e.providerEventId,
        ticket_url: e.ticketUrl,
        status: e.status,
      });
    }
  }

  return {
    theater_slug: "volksbuehne-frankfurt",
    shows: [...showsBySlug.values()],
    performances,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

interface ShowStub {
  slug: string;
  title: string;
  subtitle: string | null;
  image: string | null;
}

const TEASER_RE = /<div\s+class="teaser"\s*>([\s\S]*?)(?=<div\s+class="teaser"\s*>|<\/main\b|<footer\b)/g;

function parseListing(html: string): ShowStub[] {
  const out: ShowStub[] = [];
  for (const m of html.matchAll(TEASER_RE)) {
    const block = m[1];
    const linkMatch = block.match(
      /<a\s+href="https?:\/\/(?:www\.)?volksbuehne\.net\/programm\/([a-z0-9-]+)[^"]*"\s+class="teaser-link-wrapper"[^>]*\btitle="([^"]+)"/i,
    );
    if (!linkMatch) continue;
    const slug = linkMatch[1];
    const fullTitle = decodeEntities(linkMatch[2]);
    const [titleHead, ...titleTailParts] = fullTitle.split(/\s*\.\s*/);
    const title = titleHead?.trim() || fullTitle;
    const subtitleRaw = titleTailParts.join(". ").trim();
    const subtitle = subtitleRaw || null;

    const img = block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null;

    out.push({ slug, title, subtitle, image: img ? normalizeUrl(img, BASE) : null });
  }
  return out;
}

interface ParsedEvent {
  date: string;
  time: string | null;
  venueRoom: string | null;
  ticketUrl: string | null;
  providerEventId: string | null;
  status: ScrapedPerformance["status"];
}

const TERMINE_SECTION_RE = /<div\s+class="calendar-wrapper">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/i;
const EVENT_RE = /<li[^>]*>\s*<div\s+class="event">([\s\S]*?)<\/li>/g;

function parseEvents(html: string): ParsedEvent[] {
  const wrapper = html.match(TERMINE_SECTION_RE)?.[1] ?? html;
  const out: ParsedEvent[] = [];
  for (const m of wrapper.matchAll(EVENT_RE)) {
    const block = m[1];
    const dateMatch = block.match(/<h4>\s*\w{2}\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\s*<\/h4>/);
    if (!dateMatch) continue;
    const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;

    const timeMatch = block.match(/<h4>\s*(\d{1,2})(?:[.:](\d{2}))?\s*&nbsp;\s*Uhr/i);
    const hour = timeMatch ? timeMatch[1].padStart(2, "0") : null;
    const minute = timeMatch?.[2] ?? "00";
    const time = hour ? nullIfMidnight(`${hour}:${minute}`) : null;

    const venueLine = block.match(/<p>([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const venueRoom = stripHtml(venueLine.split(/<br\s*\/?>/i)[0] ?? "") || null;

    const ticketMatch = block.match(/<a\s+href="(https?:\/\/[^"]+)"\s+class="tickets\s+([\w-]+)"/i);
    const ticketUrl = ticketMatch ? decodeEntities(ticketMatch[1]) : null;
    const ticketState = ticketMatch?.[2] ?? null;
    const status = mapStatus(ticketState, ticketUrl);
    const providerEventId = ticketUrl?.match(/\/event\/(\d+)/)?.[1] ?? null;

    out.push({ date, time, venueRoom, ticketUrl, providerEventId, status });
  }
  return out;
}

function mapStatus(state: string | null, ticketUrl: string | null): ScrapedPerformance["status"] {
  if (!state) return ticketUrl ? "available" : "unknown";
  switch (state.toLowerCase()) {
    case "available":
      return "available";
    case "soldout":
    case "sold-out":
      return "sold_out";
    case "cancelled":
    case "canceled":
    case "abgesagt":
      return "cancelled";
    case "few-left":
    case "fewleft":
    case "restkarten":
      return "few_left";
    default:
      return "available";
  }
}

// Re-export for tests
export const _internals = { parseListing, parseEvents };
