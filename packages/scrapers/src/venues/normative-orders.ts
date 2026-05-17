import { detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_BASE = "https://normativeorders.net/wp-json/tribe/events/v1/events";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

interface TribeTag {
  name: string;
  slug: string;
}

interface TribeEvent {
  id: number;
  title: string;
  url: string;
  start_date: string;
  end_date: string;
  description: string;
  tags?: TribeTag[];
}

interface TribeResponse {
  events: TribeEvent[];
  total_pages: number;
}

/**
 * Forschungsverbund Normative Ordnungen — WordPress + Tribe Events Calendar.
 * Tags on each event ("podiumsdiskussion", "vortrag", "ringvorlesungen",
 * "konferenz", "lesung") are stable enough to drive labels directly.
 */
export async function scrapeNormativeOrders(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  let page = 1;

  while (true) {
    const url = `${API_BASE}?per_page=100&start_date=${today}&page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`normative-orders fetch failed: ${res.status}`);

    const data: TribeResponse = await res.json();

    for (const e of data.events) {
      const date = e.start_date.slice(0, 10);
      const time = e.start_date.slice(11, 16);
      const endTime = e.end_date.slice(0, 10) === date ? e.end_date.slice(11, 16) : null;
      const description = stripHtml(e.description).trim().slice(0, 600) || null;
      const tags = (e.tags ?? []).map((t) => t.slug);

      events.push({
        source_event_id: String(e.id),
        title: stripHtml(e.title).trim(),
        date,
        time: time !== "00:00" ? time : null,
        end_time: endTime,
        description,
        detail_url: e.url,
        language: detectTalkLanguage(e.title, description),
        raw_category: tags.join(","),
        labels: [
          {
            label: labelFromTags(tags, e.title, description),
            confidence: 0.95,
            classifier: "upstream-tag",
          },
        ],
      });
    }

    if (page >= data.total_pages) break;
    page++;
  }

  return { source_slug: "normative-orders", display_name: "Forschungsverbund Normative Ordnungen", events };
}

function labelFromTags(tagSlugs: string[], title: string, description: string | null): string {
  const set = new Set(tagSlugs);
  if (set.has("podiumsdiskussion") || set.has("diskussion")) return "talk:diskussion";
  if (set.has("lesung") || set.has("buchpraesentation") || set.has("buchvorstellung")) return "talk:lesung";
  if (set.has("vortrag") || set.has("ringvorlesungen") || set.has("konferenz")) return "talk:vortrag";
  const haystack = `${title} ${description ?? ""}`.toLowerCase();
  if (/diskussion|podium|debatte|streitgespräch/.test(haystack)) return "talk:diskussion";
  if (/lesung|buchpräsentation|buchvorstellung/.test(haystack)) return "talk:lesung";
  return "talk:vortrag";
}
