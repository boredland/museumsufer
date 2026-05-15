import { detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { Category, ScrapedEvent } from "../types";

/**
 * Forschungsverbund Normative Ordnungen — the Goethe-University Frankfurt
 * research centre that's the direct institutional descendant of the
 * Frankfurt School / Cluster of Excellence "Normative Ordnungen" (2007–2019).
 * Hosts public lectures, Ringvorlesungen, and Podiumsdiskussionen across
 * political theory, ethics, jurisprudence.
 *
 * The site is WordPress + Tribe Events Calendar — same REST API used by
 * dig-frankfurt. Tags on each event ("Podiumsdiskussion", "Vortrag",
 * "Ringvorlesungen", "Konferenz") map straight to our three formats.
 */

const API_BASE = "https://normativeorders.net/wp-json/tribe/events/v1/events";
const UA = "lehrhaus crawler / contact: jonas@bgdlabs.com";

interface TribeTag {
  name: string;
  slug: string;
}

interface TribeEvent {
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

export async function scrapeNormativeOrders(): Promise<ScrapedEvent[]> {
  const today = todayIso();
  const events: ScrapedEvent[] = [];
  let page = 1;

  while (true) {
    const url = `${API_BASE}?per_page=100&start_date=${today}&page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`normative-orders fetch failed: ${res.status}`);

    const data: TribeResponse = await res.json();

    for (const e of data.events) {
      const date = e.start_date.slice(0, 10);
      const time = e.start_date.slice(11, 16);
      const end_time = e.end_date.slice(0, 10) === date ? e.end_date.slice(11, 16) : null;
      const description = stripHtml(e.description).trim().slice(0, 600) || null;
      const tags = (e.tags ?? []).map((t) => t.slug);

      events.push({
        title: stripHtml(e.title).trim(),
        date,
        time: time !== "00:00" ? time : null,
        end_time,
        description,
        detail_url: e.url,
        category: classifyByTags(tags, e.title, description),
        language: detectTalkLanguage(e.title, description),
      });
    }

    if (page >= data.total_pages) break;
    page++;
  }

  return events;
}

function classifyByTags(tagSlugs: string[], title: string, description: string | null): Category {
  // Tribe tag slugs on this site are lowercase Germanised: "podiumsdiskussion",
  // "vortrag", "ringvorlesungen", "konferenz", "buchpraesentation", "lesung".
  const set = new Set(tagSlugs);
  if (set.has("podiumsdiskussion") || set.has("diskussion")) return "Diskussion";
  if (set.has("lesung") || set.has("buchpraesentation") || set.has("buchvorstellung")) return "Lesung";
  if (set.has("vortrag") || set.has("ringvorlesungen") || set.has("konferenz")) return "Vortrag";
  // Fallback to title/description heuristic.
  const haystack = `${title} ${description ?? ""}`.toLowerCase();
  if (/diskussion|podium|debatte|streitgespräch/.test(haystack)) return "Diskussion";
  if (/lesung|buchpräsentation|buchvorstellung/.test(haystack)) return "Lesung";
  return "Vortrag";
}
