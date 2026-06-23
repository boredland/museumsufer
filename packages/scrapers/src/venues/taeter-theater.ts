import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.taeter-theater.de";
const SPIELPLAN_URL = `${BASE}/spielplan/`;
const RESERVATION_URL = `${BASE}/info/online-reservieren/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.407;
const LON = 8.683;

/**
 * Taeter Theater Heidelberg — intimate repertory theatre in the Bergheim
 * district. The spielplan page is a server-rendered WordPress/Elementor
 * table: one row per performance with date, time, title link, subtitle and
 * cast. There is no per-event ticket URL; reservations are handled via a
 * generic contact form / email page.
 */
export async function scrapeTaeterTheater(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(SPIELPLAN_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Taeter Theater fetch failed: ${res.status}`);
  const html = await res.text();

  const events = parseRows(html, today);
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return {
    source_slug: "taeter-theater",
    display_name: "Taeter Theater Heidelberg",
    events,
  };
}

function parseRows(html: string, today: string): CanonicalScrapedEvent[] {
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const rm of html.matchAll(rowRe)) {
    const row = rm[1];
    if (!row?.includes("<td")) continue;

    const cells = extractCells(row);
    if (cells.length < 2) continue;

    const metaText = cleanText(cells[0]);
    const titleCell = cells[1];
    const performers = cells[2] ? cleanText(cells[2]) : null;

    const metaMatch = metaText.match(/(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/);
    if (!metaMatch) continue;

    const year = parseTwoDigitYear(metaMatch[3]);
    const date = `${year}-${metaMatch[2]}-${metaMatch[1]}`;
    if (date < today) continue;

    const startTime = `${metaMatch[4]}:${metaMatch[5]}`;
    const endTime = `${metaMatch[6]}:${metaMatch[7]}`;

    const titleLinkMatch = titleCell.match(/<a\s+[^>]*href="([^"]+)"[^>]*>\s*<strong>([\s\S]*?)<\/strong>/i);
    const detailHref = titleLinkMatch?.[1] ?? null;
    const title = cleanText(titleLinkMatch?.[2] ?? extractFirst(titleCell, /<strong>([\s\S]*?)<\/strong>/i));
    if (!title) continue;

    const subtitle = extractSubtitle(titleCell);

    const sourceEventId = `${slugify(title)}|${date}|${startTime}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const isSoldOut = /Aus-?\s*verkauft/i.test(metaText);
    const isCancelled = /Fällt leider aus/i.test(metaText);

    out.push({
      source_event_id: sourceEventId,
      title,
      subtitle,
      description: subtitle,
      date,
      time: startTime,
      end_time: endTime && endTime !== startTime ? endTime : null,
      detail_url: detailHref ? absoluteUrl(detailHref) : null,
      ticket_url: RESERVATION_URL,
      price_min: null,
      price_max: null,
      performers,
      venue_room: null,
      availability: isSoldOut ? "sold_out" : null,
      raw_category: isCancelled ? "cancelled" : null,
      city: "heidelberg",
      lat: LAT,
      lon: LON,
      labels: resolveStageLabels({
        title,
        subtitle,
        hint: performers,
        defaultLabel: "stage:theater",
        classifier: "scraper-hardcoded",
        confidence: 0.85,
      }),
    });
  }

  return out;
}

function extractCells(row: string): string[] {
  const cells: string[] = [];
  const re = /<td[\s\S]*?>([\s\S]*?)<\/td>/gi;
  for (const m of row.matchAll(re)) {
    cells.push(m[1]);
  }
  return cells;
}

function extractSubtitle(titleCell: string): string | null {
  // The subtitle follows the title <br /> in the second cell.
  const parts = titleCell.split(/<br\s*\/?>/i);
  if (parts.length < 2) return null;
  const sub = cleanText(parts.slice(1).join(" "));
  return sub || null;
}

function parseTwoDigitYear(yy: string): number {
  const n = parseInt(yy, 10);
  return n < 50 ? 2000 + n : 1900 + n;
}

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${BASE}${path}`;
}

function extractFirst(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

function cleanText(raw: string | null): string {
  if (!raw) return "";
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
