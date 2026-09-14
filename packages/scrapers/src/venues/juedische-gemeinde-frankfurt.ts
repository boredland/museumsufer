import { classifyEvent, classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_URL = "https://jg-ffm.de/api/events.json";
/** Community-internal categories: synagogue services, social/advice sessions,
 *  school and seniors' groups. Everything else is public programming. */
const INTERNAL_CATEGORIES = new Set(["Religiöses Leben", "Beratung & Soziales", "Senioren", "Schule & Erziehung"]);
/** "Gemeinde" mixes public programming with the community's own governance
 *  calendar (council sittings, the annual members' assembly), which is not an
 *  event a visitor can attend. */
const GOVERNANCE_RE = /Sitzung des Gemeinderats|Gemeindeversammlung/i;
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
 *
 * The feed files public programming across several categories, and which one
 * a given event lands in is editorial: the same concert series has appeared
 * under "Kultur & Events" and under "Jüdische Veranstaltungen". Internal
 * categories ("Religiöses Leben" — services; "Beratung & Soziales" — advice
 * sessions and members' clubs; "Senioren", "Schule & Erziehung") are not
 * public programming, so those are the ones we exclude, rather than
 * allow-listing two category names that upstream keeps re-sorting.
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

    const catTitle = e.category?.title?.replace(/\u00A0/g, " ") ?? "";
    if (INTERNAL_CATEGORIES.has(catTitle)) continue;
    if (GOVERNANCE_RE.test(e.title)) continue;

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
        label = "film:cinema";
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
