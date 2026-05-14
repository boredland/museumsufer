import { detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { ScrapedEvent } from "../types";
import { talkCategory } from "./shared";

const API_BASE = "https://frankfurt.deutsch-israelische-gesellschaft.de/wp-json/tribe/events/v1/events";
const UA = "lehrhaus crawler / contact: jonas@bgdlabs.com";

interface TribeEvent {
  title: string;
  url: string;
  start_date: string;
  end_date: string;
  description: string;
}

interface TribeResponse {
  events: TribeEvent[];
  total_pages: number;
}

export async function scrapeDigFrankfurt(): Promise<ScrapedEvent[]> {
  const today = todayIso();
  const events: ScrapedEvent[] = [];
  let page = 1;

  while (true) {
    const url = `${API_BASE}?per_page=100&start_date=${today}&page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`dig-frankfurt fetch failed: ${res.status}`);

    const data: TribeResponse = await res.json();

    for (const e of data.events) {
      const date = e.start_date.slice(0, 10);
      const time = e.start_date.slice(11, 16);
      const end_time = e.end_date.slice(0, 10) === date ? e.end_date.slice(11, 16) : null;
      const description = stripHtml(e.description).trim().slice(0, 600) || null;

      events.push({
        title: e.title,
        date,
        time: time !== "00:00" ? time : null,
        end_time,
        description,
        detail_url: e.url,
        category: talkCategory(e.title, description),
        language: detectTalkLanguage(e.title, description),
      });
    }

    if (page >= data.total_pages) break;
    page++;
  }

  return events;
}
