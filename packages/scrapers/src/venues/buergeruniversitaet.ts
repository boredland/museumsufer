import { detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_BASE = "https://aktuelles.uni-frankfurt.de/wp-json/tribe/events/v1/events";
// The Events Calendar category IDs on aktuelles.uni-frankfurt.de
// 114=Vorträge, 121=Diskussionen, 218=Podiumsgespräch, 322=Science Talk
const CATEGORIES = "114,121,218,322";
const DISKUSSION_CATS = new Set([121, 218]);

interface TribeEvent {
  id: number;
  title: string;
  url: string;
  start_date: string;
  end_date: string;
  description: string;
  categories: Array<{ id: number; name: string }>;
}

interface TribeResponse {
  events: TribeEvent[];
  total: number;
  total_pages: number;
}

export async function scrapeBuergeruniversitaet(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  let page = 1;

  while (true) {
    const url = `${API_BASE}?categories=${CATEGORIES}&per_page=100&start_date=${today}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`buergeruniversitaet fetch failed: ${res.status}`);

    const data: TribeResponse = await res.json();

    for (const e of data.events) {
      const date = e.start_date.slice(0, 10);
      const time = e.start_date.slice(11, 16);
      const endTime = e.end_date.slice(0, 10) === date ? e.end_date.slice(11, 16) : null;
      const description = stripHtml(e.description).trim().slice(0, 600) || null;
      const isDiskussion = e.categories.some((c) => DISKUSSION_CATS.has(c.id));

      events.push({
        source_event_id: String(e.id),
        title: e.title,
        date,
        time: time !== "00:00" ? time : null,
        end_time: endTime,
        description,
        detail_url: e.url,
        language: detectTalkLanguage(e.title, description),
        labels: [
          {
            label: isDiskussion ? "talk:diskussion" : "talk:vortrag",
            confidence: 1.0,
            classifier: "upstream-category",
          },
        ],
      });
    }

    if (page >= data.total_pages) break;
    page++;
  }

  return { source_slug: "buergeruniversitaet", display_name: "Goethe-Uni Bürgeruniversität", events };
}
