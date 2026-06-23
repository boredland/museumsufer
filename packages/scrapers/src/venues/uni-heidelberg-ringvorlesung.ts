/**
 * Ruperto Carola Ringvorlesung (Heidelberg University public lecture series).
 *
 * Source: the official series landing page, which is server-rendered and lists
 * every date of the current semester under "Veranstaltungstermine".
 */

import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const SERIES_URL = "https://www.uni-heidelberg.de/de/transfer/kommunikation/ruperto-carola-ringvorlesung";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const COORDS = { lat: 49.4108, lon: 8.706 };
const TIME = "18:15";

const MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

function cleanText(raw: string): string {
  return decodeEntities(stripHtml(raw)).replace(/\s+/g, " ").trim();
}

/** "11. Mai 2026" -> "2026-05-11" */
function parseGermanDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\.\s*([A-Za-zäÄöÖüÜ]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

function extractEventBlocks(html: string): string[] {
  // The dates appear inside <h3><strong>11. Mai 2026</strong></h3> blocks.
  const idx = html.indexOf("Veranstaltungstermine");
  const relevant = idx >= 0 ? html.slice(idx) : html;
  const blocks: string[] = [];
  const re = /<h3>\s*<strong>(\d{1,2}\.\s*[^<]+?)<\/strong>\s*<\/h3>/g;
  let match;
  while ((match = re.exec(relevant)) !== null) {
    const start = match.index;
    const next = relevant.slice(start + 1).search(/<h3>\s*<strong>\d{1,2}\./);
    const end = next >= 0 ? start + 1 + next : relevant.length;
    blocks.push(relevant.slice(start, end));
  }
  return blocks;
}

function parseBlock(block: string): CanonicalScrapedEvent | null {
  const dateMatch = block.match(/<h3>\s*<strong>([^<]+)<\/strong>\s*<\/h3>/);
  const date = dateMatch ? parseGermanDate(cleanText(dateMatch[1])) : null;
  if (!date) return null;

  // Title: all <strong> text in the first <p> after the date heading.
  const titleMatch = block.match(/<\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>/);
  if (!titleMatch) return null;
  const title = cleanText(titleMatch[1].replace(/<br\s*\/?>/gi, " "));
  if (!title) return null;

  // Speaker / affiliation: the next <p> with line breaks.
  const speakerMatch = block.match(/<\/h3>[\s\S]*?<\/p>[\s\S]*?<p>([\s\S]*?)<\/p>/);
  const performers = speakerMatch ? cleanText(speakerMatch[1].replace(/<br\s*\/?>/gi, ", ")) : null;

  // Detail link.
  const linkMatch = block.match(/href="([^"]+ruperto-carola-ringvorlesung[^"]*)"/);
  const detailUrl = linkMatch ? new URL(linkMatch[1], SERIES_URL).href : SERIES_URL;

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const sourceEventId = `${date}-${slug}`;

  return {
    source_event_id: sourceEventId,
    title,
    subtitle: null,
    description: null,
    performers,
    date,
    time: TIME,
    detail_url: detailUrl,
    ticket_url: null,
    city: "heidelberg",
    lat: COORDS.lat,
    lon: COORDS.lon,
    venue_room: "Aula der Alten Universität",
    labels: [{ label: "talk:vortrag", confidence: 0.9, classifier: "scraper-hardcoded" }],
  };
}

export async function scrapeUniHeidelbergRingvorlesung(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(SERIES_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Heidelberg Ringvorlesung fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  for (const block of extractEventBlocks(html)) {
    const event = parseBlock(block);
    if (event && event.date >= today) {
      events.push(event);
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  return {
    source_slug: "uni-heidelberg-ringvorlesung",
    display_name: "Ruperto Carola Ringvorlesung",
    events,
  };
}
