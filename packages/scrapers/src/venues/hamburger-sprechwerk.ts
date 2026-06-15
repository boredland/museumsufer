import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://sprechwerk.hamburg";
const SPIELPLAN_URL = `${BASE}/spielplan`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Hamburger Sprechwerk — off-theater and ensemble venue in Horn (Hamburg).
 *
 * The spielplan at sprechwerk.hamburg/spielplan is a Contao CMS page that
 * renders one `<div class="event layout_full block upcoming">` block per
 * performance, using Schema.org Event microdata. Each block has:
 *
 *   - `<time datetime="YYYY-MM-DDTHH:MM:SS+TZ" itemprop="startDate">`
 *   - `<a href="…itemprop="url">` pointing to the show detail page
 *   - `<a href="https://loveyourartist.com/…">` for the ticket link
 *   - `<span itemprop="name">` for the show title
 *
 * The calendar shows ~one month at a time; we iterate through the next
 * several months using `?month=YYYYMM` query parameters.
 */
export async function scrapeHamburgerSprechwerk(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Fetch current month + next 5 months
  const months = buildMonths(today, 6);

  for (const month of months) {
    const url = month === months[0] ? SPIELPLAN_URL : `${SPIELPLAN_URL}?month=${month}`;
    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
          "Accept-Language": "de-DE,de;q=0.9",
        },
      });
      if (!res.ok) {
        console.warn(`Sprechwerk fetch failed: ${res.status} for ${url}`);
        break;
      }
      html = await res.text();
    } catch (err) {
      console.warn("Sprechwerk fetch error:", err);
      break;
    }

    const items = parseEventBlocks(html, today);
    let added = 0;
    for (const item of items) {
      const id = `${slugify(item.title)}|${item.date}|${item.time}`;
      if (seen.has(id)) continue;
      seen.add(id);
      added++;
      events.push(item);
    }
    if (added === 0 && months.indexOf(month) > 0) break; // no new events this month
  }

  return {
    source_slug: "hamburger-sprechwerk",
    display_name: "Hamburger Sprechwerk",
    events,
  };
}

// Match each event block
const _BLOCK_RE =
  /<div\s+class="event\s+layout_full\s+block\s+upcoming"[^>]*itemscope[^>]*>([\s\S]*?)<\/div>\s*(?=<div\s+class="event|<\/div>|$)/g;

function parseEventBlocks(html: string, today: string): CanonicalScrapedEvent[] {
  const out: CanonicalScrapedEvent[] = [];

  // Extract event blocks using the itemprop="startDate" time elements
  const START_DATE_RE = /<time[^>]+datetime="(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/g;
  const NAME_RE = /itemprop="name"[^>]*>([^<]+)</;
  const TICKET_RE = /href="(https:\/\/loveyourartist\.com\/[^"]+)"/;
  const URL_RE = /itemprop="url"[^>]*href="([^"]+)"/;

  // Each event starts with class="event layout_full block upcoming"
  const EVENT_BLOCK_RE =
    /<div\s+class="event\s+layout_full\s+block\s+upcoming"[^>]*>([\s\S]*?)(?=<div\s+class="event\s+layout_full|<\/div>\s*<\/div>\s*<\/div>)/g;

  let m: RegExpExecArray | null;
  while ((m = EVENT_BLOCK_RE.exec(html)) !== null) {
    const block = m[1];

    // Extract startDate
    START_DATE_RE.lastIndex = 0;
    const dateMatch = START_DATE_RE.exec(block);
    if (!dateMatch) continue;
    const rawDateTime = dateMatch[1]; // "YYYY-MM-DDTHH:MM"
    const date = rawDateTime.slice(0, 10);
    if (date < today) continue;
    const time = rawDateTime.slice(11, 16);

    // Extract title from itemprop="name"
    const nameMatch = block.match(NAME_RE);
    const title = nameMatch ? cleanText(nameMatch[1]) : "";
    if (!title) continue;

    // Extract ticket URL (LoveYourArtist)
    const ticketMatch = block.match(TICKET_RE);
    const ticketUrl = ticketMatch ? ticketMatch[1] : null;

    // Extract detail URL from itemprop="url"
    const urlMatch = block.match(URL_RE);
    const detailUrl = urlMatch ? (urlMatch[1].startsWith("http") ? urlMatch[1] : `${BASE}/${urlMatch[1]}`) : null;

    out.push({
      source_event_id: `${slugify(title)}|${date}|${time}`,
      title,
      subtitle: null,
      description: null,
      date,
      time,
      detail_url: detailUrl ?? `${SPIELPLAN_URL}`,
      ticket_url: ticketUrl,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: "Hamburger Sprechwerk",
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

function buildMonths(today: string, count: number): string[] {
  const months: string[] = [];
  const base = new Date(today);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}${mo}`);
  }
  return months;
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
