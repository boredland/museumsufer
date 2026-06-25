import { todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_BASE = "https://k28v8tpq.api.sanity.io/v1/data/query/production";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

/**
 * Kunsthalle Mainz — contemporary art institution in Mainz. Its site is
 * powered by Sanity CMS; we query the public API for published events,
 * expand each event's `singleEventTimes` into individual dated entries,
 * and map event categories to labels. Images are Sanity asset refs
 * resolved to CDN URLs.
 */
export async function scrapeKunsthalleMainz(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const q = encodeURIComponent(
    '*[_type == "event" && isPublished == true]{_id, title, eventCategory, singleEventTimes, image, text}',
  );
  const res = await fetch(`${API_BASE}?query=${q}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`kunsthalle-mainz fetch failed: ${res.status}`);
  const body = (await res.json()) as SanityQueryResult;
  const rawEvents: SanityEvent[] = body.result ?? [];

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const ev of rawEvents) {
    const title = ev.title?.de?.trim();
    if (!title) continue;

    const description = extractText(ev.text?.de);
    const categoryName = ev.eventCategory ?? null;
    const imageUrl = buildImageUrl(ev.image);

    const times = ev.singleEventTimes ?? [];
    for (const t of times) {
      if (!t.date) continue;
      if (t.date < today) continue;

      const dedupKey = `${ev._id}|${t.date}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const endTime = t.endTime && t.endTime !== t.startTime ? t.endTime : null;

      events.push({
        source_event_id: dedupKey,
        title,
        description: description || null,
        date: t.date,
        time: t.startTime || null,
        end_time: endTime,
        detail_url: null,
        image_url: imageUrl,
        labels: buildLabels(title, categoryName),
      });
    }
  }

  return { source_slug: "kunsthalle-mainz", display_name: "Kunsthalle Mainz", events };
}

// ─── helpers ────────────────────────────────────────────────────────────

function extractText(blocks: SanityBlock[] | null | undefined): string | null {
  if (!blocks?.length) return null;
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block.children) continue;
    for (const child of block.children) {
      if (child.text) parts.push(child.text);
    }
  }
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined.slice(0, 2000) || null;
}

function buildImageUrl(ref: SanityImageRef | null | undefined): string | null {
  const assetRef = ref?.image?.asset?._ref ?? ref?.asset?._ref;
  if (!assetRef) return null;
  const m = assetRef.match(/^image-([^-]+)-(\d+x\d+)-(\w+)$/);
  if (!m) return null;
  const [, id, dimensions, fmt] = m;
  return `https://cdn.sanity.io/images/k28v8tpq/production/${id}-${dimensions}.${fmt}`;
}

function buildLabels(
  title: string,
  category: string | null,
): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [
    { label: "museum:event", confidence: 0.95, classifier: "scraper-hardcoded" },
  ];
  const t = title.toLowerCase();
  if (t.includes("führung") || t.includes("rundgang") || category === "guided-tours") {
    labels.push({ label: "museum:fuehrung", confidence: 0.8, classifier: "scraper-hardcoded" });
  }
  if (t.includes("vortrag") || t.includes("gespräch") || t.includes("diskussion") || category === "talks") {
    labels.push({ label: "talk:lecture", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (
    t.includes("workshop") ||
    t.includes("werkstatt") ||
    category === "workshops" ||
    category === "children-and-young-people"
  ) {
    labels.push({ label: "museum:workshop", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  return labels;
}

// ─── Sanity API types ────────────────────────────────────────────────────

interface SanityQueryResult {
  result?: SanityEvent[];
}

interface SanityEvent {
  _id: string;
  title?: { de?: string; en?: string } | null;
  eventCategory?: string | null;
  singleEventTimes?: SanityEventTime[] | null;
  image?: SanityImageRef | null;
  text?: { de?: SanityBlock[] } | null;
}

interface SanityEventTime {
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
}

interface SanityImageRef {
  image?: { asset?: { _ref?: string } | null } | null;
  asset?: { _ref?: string } | null;
}

interface SanityBlock {
  children?: Array<{ text?: string }> | null;
}
