import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.schauspielhaus.de";
const SPIELPLAN_URL = `${BASE}/spielplan`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const ITEM_RE = /<div\s+class="list-row-item"[^>]*>([\s\S]*?)<\/li>/g;
const DATE_RE = /data-taiko-date="(\d{2})\/(\d{2})"/i;
const TITLE_LINK_RE = /<a\s+class="list-row-item__main-link"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
const INFO_RE = /<div\s+class="list-row-item__main-info">([\s\S]*?)<\/div>/i;
const DESC_RE = /<div\s+class="list-row-item__info-content">([\s\S]*?)<\/div>/i;
const TICKET_BLOCK_RE = /<div\s+class="list-row-item__ticket">([\s\S]*?)<\/div>/i;

export async function scrapeDeutschesSchauspielhaus(): Promise<VenueScrapeResult> {
  const spielplanHtml = await fetchHtml(SPIELPLAN_URL);
  const today = todayIso();
  const perfs = parseSpielplan(spielplanHtml, today);
  const imageBySlug = await enrichImages(perfs);

  const events: CanonicalScrapedEvent[] = perfs.map((p) => {
    return {
      source_event_id: `${p.showSlug}|${p.date}|${p.time ?? ""}|${p.venueRoom ?? ""}`,
      title: p.title,
      subtitle: p.description,
      description: p.description,
      date: p.date,
      time: p.time,
      detail_url: p.detailUrl,
      ticket_url: p.ticketUrl,
      image_url: imageBySlug.get(p.showSlug) ?? null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: p.venueRoom,
      raw_category: null,
      labels: resolveStageLabels({ title: p.title, subtitle: p.description, confidence: 0.9 }),
    };
  });

  return { source_slug: "deutsches-schauspielhaus", display_name: "Deutsches Schauspielhaus", events };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

interface RawPerf {
  showSlug: string;
  title: string;
  date: string;
  time: string | null;
  venueRoom: string | null;
  detailUrl: string;
  ticketUrl: string | null;
  description: string | null;
}

function parseSpielplan(html: string, today: string): RawPerf[] {
  const matches = [...html.matchAll(ITEM_RE)];
  const out: RawPerf[] = [];
  const seen = new Set<string>();

  for (const m of matches) {
    const block = m[1];

    const dateMatch = block.match(DATE_RE);
    if (!dateMatch) continue;
    const date = parseYearForDate(dateMatch[1], dateMatch[2]);
    if (date < today) continue;

    const titleLinkMatch = block.match(TITLE_LINK_RE);
    if (!titleLinkMatch) continue;
    const href = titleLinkMatch[1];
    const title = cleanText(titleLinkMatch[2]).replace(/­/g, ""); // strip soft hyphens
    const showSlug = deriveSlug(href, title);

    const infoMatch = block.match(INFO_RE);
    let time: string | null = null;
    let venueRoom: string | null = null;
    if (infoMatch) {
      const infoHtml = infoMatch[1];
      const cleanedInfo = cleanText(infoHtml);
      const parts = cleanedInfo.split("/");

      const timePart = parts[0]?.trim();
      const roomPart = parts[1]?.trim() ?? null;

      const timeMatch = timePart?.match(/(\d{1,2})[.:](\d{2})/);
      if (timeMatch) {
        time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
        venueRoom = roomPart;
      } else {
        venueRoom = timePart || null;
      }
    }

    const descMatch = block.match(DESC_RE);
    const description = descMatch ? cleanText(descMatch[1]) : null;

    const ticketBlockMatch = block.match(TICKET_BLOCK_RE);
    let ticketUrl: string | null = null;
    if (ticketBlockMatch) {
      const hrefMatch = ticketBlockMatch[1].match(/href="([^"]+)"/i);
      if (hrefMatch) ticketUrl = decodeEntities(hrefMatch[1]);
    }

    const dedup = `${showSlug}|${date}|${time ?? ""}|${venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    out.push({
      showSlug,
      title,
      date,
      time,
      venueRoom,
      detailUrl: normalizeUrl(href || "", BASE) || `${BASE}/spielplan`,
      ticketUrl,
      description,
    });
  }

  return out;
}

async function enrichImages(perfs: RawPerf[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const seen = new Set<string>();
  for (const p of perfs) {
    if (seen.has(p.showSlug) || !p.detailUrl) continue;
    seen.add(p.showSlug);
    try {
      const html = await fetchHtml(p.detailUrl);
      const imgMatch = html.match(/src="([^"]*\/sites\/default\/files\/styles\/[^"]+)"/i);
      if (imgMatch?.[1]) {
        out.set(p.showSlug, normalizeUrl(decodeEntities(imgMatch[1]) || "", BASE) || "");
      }
    } catch (err) {
      console.warn(`deutsches-schauspielhaus detail enrichment failed for ${p.showSlug}:`, err);
    }
  }
  return out;
}

function parseYearForDate(day: string, month: string): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const m = parseInt(month, 10);
  const year = m < currentMonth - 2 ? currentYear + 1 : currentYear;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}

function deriveSlug(href: string, title: string): string {
  const m = href.match(/\/stuecke\/([^/]+)/);
  return m ? m[1] : slugify(title);
}
