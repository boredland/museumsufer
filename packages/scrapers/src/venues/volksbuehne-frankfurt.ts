import { decodeEntities, normalizeUrl, nullIfMidnight, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://volksbuehne.net";
const PROGRAMM_URL = `${BASE}/programm/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Fliegende Volksbühne (volksbuehne.net) lists productions on /programm/
 * as `<div class="teaser">` cards. Each card links to a detail page
 * `/programm/<slug>?base=aktuell` whose Termine section carries the actual
 * schedule. The ticket-link's second class is the status flag
 * (available / soldout / cancelled / few-left); rides in raw_category.
 */

interface ShowStub {
  slug: string;
  title: string;
  subtitle: string | null;
  image: string | null;
}

interface ParsedEvent {
  date: string;
  time: string | null;
  venueRoom: string | null;
  ticketUrl: string | null;
  providerEventId: string | null;
  status: string;
}

export async function scrapeVolksbuehneFrankfurt(): Promise<VenueScrapeResult> {
  const listingHtml = await fetchHtml(PROGRAMM_URL);
  const showStubs = parseListing(listingHtml);

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const stub of showStubs) {
    let detailHtml: string;
    try {
      detailHtml = await fetchHtml(`${BASE}/programm/${stub.slug}?base=aktuell`);
    } catch (err) {
      console.warn(`volksbuehne-frankfurt detail fetch failed for ${stub.slug}:`, err);
      continue;
    }

    for (const e of parseEvents(detailHtml)) {
      if (e.date < today) continue;
      const sourceEventId = e.providerEventId ?? `${stub.slug}|${e.date}|${e.time ?? ""}`;
      if (seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);

      events.push({
        source_event_id: sourceEventId,
        title: stub.title,
        subtitle: stub.subtitle,
        description: stub.subtitle,
        date: e.date,
        time: e.time,
        detail_url: `${BASE}/programm/${stub.slug}`,
        ticket_url: e.ticketUrl,
        image_url: stub.image,
        venue_room: e.venueRoom,
        raw_category: e.status,
        labels: resolveStageLabels({ title: stub.title, subtitle: stub.subtitle, confidence: 0.85 }),
      });
    }
  }

  return { source_slug: "volksbuehne-frankfurt", display_name: "Volksbühne im Großen Hirschgraben", events };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
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
    const providerEventId = ticketUrl?.match(/\/event\/(\d+)/)?.[1] ?? null;

    out.push({
      date,
      time,
      venueRoom,
      ticketUrl,
      providerEventId,
      status: mapStatus(ticketState, ticketUrl),
    });
  }
  return out;
}

function mapStatus(state: string | null, ticketUrl: string | null): string {
  if (!state) return ticketUrl ? "available" : "unknown";
  switch (state.toLowerCase()) {
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
