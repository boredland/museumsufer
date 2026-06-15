import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://kampnagel.de";
const KALENDER_URL = `${BASE}/kalender`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Kampnagel embeds a full JSON event calendar in the `data-initial-state`
 * attribute of `.calendar` on the `/kalender` page. Each item has:
 *   - `id`          unique performance id
 *   - `title`       primary headline (artist/company name)
 *   - `subline`     work/show title
 *   - `topline`     context label (festival name, etc.)
 *   - `eventStart.date`  "YYYY-MM-DD HH:MM:SS.000000"
 *   - `time`        "HH:MM" (local Berlin time)
 *   - `ticketUrl`   direct ticket link
 *   - `href`        production detail URL
 *   - `image.src`   100×100 thumbnail – we pick the 800w variant from srcset
 *   - `location.title`  hall/stage name
 *   - `productionId`    groups multiple performances of the same show
 *
 * To extend beyond the initial window the page exposes an `?from=YYYY-MM-DD`
 * query parameter that shifts the calendar forward; we iterate through
 * 3-month windows until we get no new events.
 */
export async function scrapeKampnagel(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const seen = new Set<number>();
  const events: CanonicalScrapedEvent[] = [];

  // Build a set of start dates, one per calendar window (each ~4 weeks ahead)
  const windowStarts = buildWindowStarts(today, 9); // ~9 months ahead

  for (const from of windowStarts) {
    const url = from === today ? KALENDER_URL : `${KALENDER_URL}?from=${from}`;
    let html: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
      });
      if (!res.ok) {
        console.warn(`Kampnagel fetch failed: ${res.status} on ${url}`);
        break;
      }
      html = await res.text();
    } catch (err) {
      console.warn(`Kampnagel fetch error for ${url}:`, err);
      break;
    }

    const items = parseKalenderHtml(html, today);
    let newCount = 0;
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      newCount++;
      events.push(mapItem(item));
    }
    if (newCount === 0) break; // no new events – we've reached the end
  }

  return { source_slug: "kampnagel", display_name: "Kampnagel", events };
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface KpnItem {
  id: number;
  title: string;
  subline: string | null;
  topline: string | null;
  time: string;
  dateStr: string; // ISO "YYYY-MM-DD"
  href: string;
  ticketUrl: string | null;
  imageUrl: string | null;
  locationTitle: string | null;
  productionId: number | null;
  info: string | null;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseKalenderHtml(html: string, today: string): KpnItem[] {
  // The calendar JSON is in: <div class="calendar" data-initial-state="…">
  const m = html.match(/class="calendar"[^>]*data-initial-state="([^"]+)"/i);
  if (!m) return [];

  let jsonStr: string;
  try {
    jsonStr = decodeEntities(m[1]);
    // The attribute is HTML-entity-encoded; decodeEntities handles &quot; → "
  } catch {
    return [];
  }

  let root: { blocks?: unknown[] };
  try {
    root = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  const blocks = root.blocks;
  if (!Array.isArray(blocks)) return [];

  const out: KpnItem[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const items = b.items;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;

      const id = Number(it.id);
      if (!Number.isFinite(id)) continue;

      // Parse date from eventStart.date
      const eventStart = it.eventStart as Record<string, unknown> | null;
      const rawDate = (eventStart?.date as string) ?? "";
      const dateStr = rawDate.slice(0, 10); // "YYYY-MM-DD"
      if (!dateStr || dateStr < today) continue;

      const time = (it.time as string) ?? "";
      const title = String(it.title ?? "").trim();
      if (!title) continue;

      const subline = (it.subline as string | null) ?? null;
      const topline = (it.topline as string | null) ?? null;

      const href = (it.href as string) || `${BASE}/kalender`;
      const ticketUrl = (it.ticketUrl as string | null) ?? null;

      // Pick 800w image from srcset when available
      const imageObj = it.image as Record<string, unknown> | null;
      let imageUrl: string | null = null;
      if (imageObj) {
        const srcset = (imageObj.srcset as string) ?? "";
        const m800 = srcset.match(/(\S+)\s+800w/);
        if (m800) {
          imageUrl = m800[1];
        } else {
          imageUrl = (imageObj.src as string | null) ?? null;
        }
      }

      const locationObj = it.location as Record<string, unknown> | null;
      const locationTitle = locationObj ? ((locationObj.title as string | null) ?? null) : null;

      const productionId = it.productionId ? Number(it.productionId) : null;
      const infoHtml = (it.info as string | null) ?? null;
      const info = infoHtml ? cleanText(infoHtml) : null;

      out.push({
        id,
        title,
        subline: subline || null,
        topline: topline || null,
        time,
        dateStr,
        href,
        ticketUrl: ticketUrl || null,
        imageUrl,
        locationTitle,
        productionId,
        info,
      });
    }
  }
  return out;
}

function mapItem(item: KpnItem): CanonicalScrapedEvent {
  // Combine topline + subline into a compound title when present
  const subtitle = [item.subline, item.topline].filter(Boolean).join(" – ") || null;
  const description = item.info || subtitle;

  return {
    source_event_id: String(item.id),
    title: item.title,
    subtitle,
    description,
    date: item.dateStr,
    time: item.time || null,
    end_time: null,
    detail_url: item.href,
    ticket_url: item.ticketUrl,
    image_url: item.imageUrl,
    price_min: null,
    price_max: null,
    performers: null,
    venue_room: item.locationTitle,
    raw_category: null,
    labels: resolveStageLabels({
      title: item.title,
      subtitle,
      defaultLabel: "stage:dance",
      confidence: 0.85,
    }),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a list of ISO dates spaced ~4 weeks apart starting from today. */
function buildWindowStarts(today: string, count: number): string[] {
  const starts: string[] = [today];
  const base = new Date(today);
  for (let i = 1; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 28);
    starts.push(d.toISOString().slice(0, 10));
  }
  return starts;
}

function cleanText(html: string): string {
  return stripHtml(decodeEntities(html)).replace(/\s+/g, " ").trim();
}
