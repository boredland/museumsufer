import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.staatsoper-hamburg.de";
const SPIELPLAN_URL = `${BASE}/de/spielplan/kalender.php`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface RawPerf {
  showSlug: string;
  title: string;
  subtitle: string | null;
  date: string;
  time: string | null;
  venueRoom: string | null;
  detailUrl: string;
  ticketUrl: string | null;
}

export async function scrapeHamburgischeStaatsoper(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`staatsoper fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const perfs = parseCalendar(html, today);
  const imageBySlug = await enrichImages(perfs);

  const events: CanonicalScrapedEvent[] = perfs.map((p) => {
    return {
      source_event_id: `${p.showSlug}|${p.date}|${p.time ?? ""}|${p.venueRoom ?? ""}`,
      title: p.title,
      subtitle: p.subtitle,
      description: p.subtitle,
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
      labels: resolveStageLabels({
        title: p.title,
        subtitle: p.subtitle,
        defaultLabel: "stage:opera",
        confidence: 0.9,
      }),
    };
  });

  return { source_slug: "hamburgische-staatsoper", display_name: "Hamburgische Staatsoper", events };
}

function parseCalendar(html: string, today: string): RawPerf[] {
  const out: RawPerf[] = [];

  const daySplit = html.split(/<div\s+class="cal__day"\s+data-day="([^"]+)"/);
  for (let i = 1; i < daySplit.length; i += 2) {
    const date = daySplit[i];
    const dayContent = daySplit[i + 1] || "";

    if (date < today) continue;

    const entries = dayContent.split("</li>");
    for (const entry of entries) {
      if (!entry.includes("event-entry")) continue;

      const titleMatch = entry.match(/<div\s+class="event__title">[\s\S]*?<span>([\s\S]*?)<\/span>/i);
      if (!titleMatch) continue;
      const title = cleanText(titleMatch[1]);

      const subtitleMatch = entry.match(/<div\s+class="event__subtitle">[\s\S]*?<span>([\s\S]*?)<\/span>/i);
      const subtitle = subtitleMatch ? cleanText(subtitleMatch[1]) : null;

      const timeMatch = entry.match(/<span\s+class="event__datetime">(\d{2}:\d{2})<\/span>/i);
      const time = timeMatch ? timeMatch[1] : null;

      const locMatch = entry.match(/<div\s+class="event__location">[\s\S]*?<span>([\s\S]*?)<\/span>/i);
      const venueRoomRaw = locMatch ? cleanText(locMatch[1]) : null;
      const venueRoom = venueRoomRaw ? venueRoomRaw.replace(/^Staatsoper,\s*/i, "") : null;

      const detailMatch = entry.match(/href="(\/de\/programm\/[^"]+)"/i);
      if (!detailMatch?.[1]) continue;
      const detailUrl = normalizeUrl(detailMatch[1], BASE) || `${BASE}/de/spielplan/kalender.php`;
      const showSlug = deriveSlug(detailUrl, title);

      const ticketMatch = entry.match(/href="(https:\/\/webshop\.staatsoper-hamburg\.de\/[^"]+)"/i);
      const ticketUrl = ticketMatch ? decodeEntities(ticketMatch[1]) : null;

      out.push({
        showSlug,
        title,
        subtitle,
        date,
        time,
        venueRoom,
        detailUrl,
        ticketUrl,
      });
    }
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
      const res = await fetch(p.detailUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const html = await res.text();
      const imgMatch = html.match(/<div class="media">[\s\S]*?<img[^>]*data-src="([^"]+)"/i);
      if (imgMatch?.[1]) {
        out.set(p.showSlug, normalizeUrl(decodeEntities(imgMatch[1]) || "", BASE) || "");
      }
    } catch (err) {
      console.warn(`Enrichment failed for ${p.showSlug}:`, err);
    }
  }
  return out;
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}

function deriveSlug(url: string, title: string): string {
  const parts = url.split("/");
  const last = parts[parts.length - 1];
  return last ? last : slugify(title);
}
