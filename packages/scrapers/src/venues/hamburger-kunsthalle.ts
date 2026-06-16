import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.hamburger-kunsthalle.de";
const AUSSTELLUNGEN_URL = `${BASE}/de/unsere-ausstellungen`;
const TICKET_URL = "https://tickets.hamburger-kunsthalle.de/webshop/webticket/startpage";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeHamburgerKunsthalle(): Promise<VenueScrapeResult> {
  const res = await fetch(AUSSTELLUNGEN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Kunsthalle fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Extract blocks (views-row or slick__slide)
  const blocks = html.split(/class="views-row"|class="slick__slide/);
  // The first block is header/preamble, skip it
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    // Only parse active/current exhibitions
    if (!block.includes("views-field-title") || !block.includes("views-field-field-datum-range")) {
      continue;
    }

    const titleLinkMatch = block.match(
      /<div class="views-field views-field-title">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!titleLinkMatch) continue;

    const href = decodeEntities(titleLinkMatch[1]);
    const title = cleanText(titleLinkMatch[2]);
    const subtitleMatch =
      block.match(/<div class="views-field views-field-title">[\s\S]*?<\/h3>\s*<h4[^>]*>([\s\S]*?)<\/h4>/i) ||
      block.match(/<div class="views-field views-field-title">[\s\S]*?<\/h3>\s*<h4>([\s\S]*?)<\/h4>/i);
    const subtitle = subtitleMatch ? cleanText(subtitleMatch[1]) : null;

    const dateMatch = block.match(
      /<div class="views-field views-field-field-datum-range">[\s\S]*?<div class="field-content[^"]*">([\s\S]*?)<\/div>/i,
    );
    if (!dateMatch) continue;
    const dateStr = cleanText(dateMatch[1]);
    const parsedDates = parseDateString(dateStr);

    // An exhibition must have an end date to be scraped as exhibition
    if (!parsedDates.end) continue;
    const date = parsedDates.start ?? today;
    const endDate = parsedDates.end;

    if (endDate < today) continue;

    const imgMatch = block.match(
      /<div class="field field--name-field-media-image[^"]*">[\s\S]*?<img[^>]*src="([^"]+)"/i,
    );
    const imageUrl = imgMatch ? normalizeUrl(decodeEntities(imgMatch[1]), BASE) : null;

    const showSlug = deriveSlug(href, title);
    const sourceEventId = `hamburger-kunsthalle|exhibition|${showSlug}`;

    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const detailUrl = normalizeUrl(href, BASE);

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle,
      description: subtitle,
      date,
      end_date: endDate !== date ? endDate : null,
      time: null,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: TICKET_URL,
      image_url: imageUrl,
      labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return {
    source_slug: "hamburger-kunsthalle",
    display_name: "Hamburger Kunsthalle",
    events,
  };
}

function deriveSlug(href: string, title: string): string {
  const parts = href.split("/");
  const last = parts[parts.length - 1];
  return last ? last : slugify(title);
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}

function parseDateString(str: string): { start: string | null; end: string | null } {
  const clean = str.replace(/\s+/g, " ").trim();
  const bisMatch = clean.match(/Bis\s+(\d{2})\.(\d{2})\.(\d{4})/i);
  if (bisMatch) {
    const end = `${bisMatch[3]}-${bisMatch[2]}-${bisMatch[1]}`;
    return { start: null, end };
  }

  const rangeMatch = clean.match(/(\d{2})\.(\d{2})\.(\d{4})\s*(?:bis|[-–])\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  if (rangeMatch) {
    const start = `${rangeMatch[3]}-${rangeMatch[2]}-${rangeMatch[1]}`;
    const end = `${rangeMatch[6]}-${rangeMatch[5]}-${rangeMatch[4]}`;
    return { start, end };
  }

  const shortRangeMatch = clean.match(/(\d{2})\.(\d{2})\.\s*(?:bis|[-–])\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  if (shortRangeMatch) {
    const start = `${shortRangeMatch[5]}-${shortRangeMatch[2]}-${shortRangeMatch[1]}`;
    const end = `${shortRangeMatch[5]}-${shortRangeMatch[4]}-${shortRangeMatch[3]}`;
    return { start, end };
  }

  return { start: null, end: null };
}
