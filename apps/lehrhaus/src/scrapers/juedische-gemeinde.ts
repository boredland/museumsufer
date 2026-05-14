import { detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import type { ScrapedEvent } from "../types";
import { talkCategory } from "./shared";

const API_URL = "https://jg-ffm.de/api/events.json";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface JgEvent {
  id: number;
  url: string;
  title: string;
  start: string;
  end: string;
  category: { title: string };
}

// Categories on jg-ffm.de that can contain public talks
const TALK_CATEGORIES = new Set(["Kultur & Events", "Museen und Bildung"]);

// Title-level exclusions for non-talk event types that slip through
const EXCLUDE_RE = /führung|konzert|liraz|markt|ausflug|gottesdienst|shabbat|kiddusch/i;

export async function scrapeJuedischeGemeinde(): Promise<ScrapedEvent[]> {
  const today = todayIso();
  const res = await fetch(API_URL, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`jg-ffm fetch failed: ${res.status}`);

  const events: JgEvent[] = await res.json();
  const results: ScrapedEvent[] = [];

  for (const e of events) {
    const date = e.start.slice(0, 10);
    if (date < today) continue;
    if (!TALK_CATEGORIES.has(e.category?.title)) continue;
    if (EXCLUDE_RE.test(e.title)) continue;

    const timeRaw = e.start.slice(11, 16);
    const time = timeRaw !== "00:00" ? timeRaw : null;

    results.push({
      title: e.title,
      date,
      time,
      detail_url: e.url,
      category: talkCategory(e.title),
      language: detectTalkLanguage(e.title),
    });
  }

  return results;
}
