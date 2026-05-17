import { classifyEvent, classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

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

/**
 * jg-ffm.de's `/api/events.json` returns the full calendar — concerts,
 * exhibitions, talks, screenings. We label each event from the classifier
 * pass and let consumer apps choose by namespace. (Previously this scraper
 * dropped non-talks; the hub keeps them with their actual labels.)
 */
export async function scrapeJuedischeGemeinde(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(API_URL, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`jg-ffm fetch failed: ${res.status}`);

  const events: JgEvent[] = await res.json();
  const out: CanonicalScrapedEvent[] = [];

  for (const e of events) {
    // The API returns UTC timestamps (suffix Z) — convert to Berlin time so
    // a 12:00 CEST event isn't filed as 10:00.
    const start = new Date(e.start);
    if (Number.isNaN(start.getTime())) continue;
    const date = toBerlinDate(start);
    if (date < today) continue;

    const catTitle = e.category?.title?.replace(/ /g, " ") ?? "";
    if (catTitle !== "Kultur & Events" && catTitle !== "Museen und Bildung") continue;

    const timeRaw = toBerlinTime(start);
    const time = timeRaw !== "00:00" ? timeRaw : null;
    const classified = classifyEvent(e.title);

    let label: string;
    let classifier: "keyword:event" | "keyword:talk" = "keyword:talk";
    switch (classified) {
      case "Konzert":
        label = "music:classical";
        classifier = "keyword:event";
        break;
      case "Film":
        label = "museum:film";
        classifier = "keyword:event";
        break;
      case "Führung":
        label = "museum:fuehrung";
        classifier = "keyword:event";
        break;
      case "Workshop":
        label = "museum:workshop";
        classifier = "keyword:event";
        break;
      case "Vernissage":
        label = "museum:vernissage";
        classifier = "keyword:event";
        break;
      case "Familie":
        label = "museum:familie";
        classifier = "keyword:event";
        break;
      default:
        label = `talk:${classifyTalk(e.title).toLowerCase()}`;
    }

    out.push({
      source_event_id: String(e.id),
      title: e.title,
      date,
      time,
      detail_url: e.url,
      raw_category: catTitle,
      language: detectTalkLanguage(e.title),
      labels: [{ label, confidence: classified ? 0.85 : 0.7, classifier }],
    });
  }

  return { source_slug: "juedische-gemeinde-frankfurt", display_name: "Jüdische Gemeinde Frankfurt", events: out };
}
