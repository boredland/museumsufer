import { classifyEvent, detectTalkLanguage } from "@museumsufer/core/classify";
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

// JGF events rarely say "Vortrag" in the title, so classifyEvent is used as a
// negative filter only: exclude anything that classifies as a non-talk type.
const NON_TALK_TYPES = new Set(["Konzert", "Film", "Führung", "Workshop", "Vernissage", "Familie"]);

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

    // jg-ffm uses non-breaking spaces in category names
    const catTitle = e.category?.title?.replace(/ /g, " ") ?? "";
    if (catTitle !== "Kultur & Events" && catTitle !== "Museen und Bildung") continue;

    const classified = classifyEvent(e.title);
    if (classified !== null && NON_TALK_TYPES.has(classified)) continue;

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
