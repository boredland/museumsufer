import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_URL = "https://hsw-6a25.kxcdn.com/api/schedule";
const BASE = "https://www.staatstheater-wiesbaden.de";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

/**
 * Hessisches Staatstheater Wiesbaden — flagship five-branch theatre. Its
 * `/api/schedule` endpoint returns a JSON object with a `schedule` HTML
 * string containing `<div itemtype="http://schema.org/Event">` blocks
 * for every performance over ~3 months. Each block carries:
 * - `<meta itemprop="startDate" content="YYYY-MM-DDTHH:MM:SS">`
 * - `<span itemprop="name">TITLE</span>` inside `<h4 class="performance__title">`
 * - `performance__stage`, `performance__category`, `performance__age`
 * - `performance__authorcomposer` (subtitle/credits)
 * - Detail URL with production + performance IDs
 */
export async function scrapeStaatstheaterWiesbaden(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(API_URL, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`hsw api fetch failed: ${res.status}`);
  const body = (await res.json()) as ScheduleResponse;
  const schedule = body.schedule ?? "";

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const eventRe =
    /<div\s+class="performance[^"]*"\s+id="(\d{4}-\d{2}-\d{2}-p\d+)"[^>]*itemscope\s+itemtype="http:\/\/schema.org\/Event"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;

  let match: RegExpExecArray | null;
  while ((match = eventRe.exec(schedule)) !== null) {
    const block = match[0];
    const perfId = match[1];

    const startDateMatch = block.match(/<meta\s+itemprop="startDate"\s+content="([^"]+)"/);
    if (!startDateMatch) continue;
    const startRaw = startDateMatch[1];
    const startDate = new Date(startRaw);
    if (isNaN(startDate.getTime())) continue;
    const date = toBerlinDate(startDate);
    if (date < today) continue;
    const time = toBerlinTime(startDate);

    const endDateMatch = block.match(/<meta\s+itemprop="endDate"\s+content="([^"]+)"/);
    let endTime: string | null = null;
    if (endDateMatch) {
      const endDate = new Date(endDateMatch[1]);
      if (!isNaN(endDate.getTime())) endTime = toBerlinTime(endDate);
    }

    const titleMatch = block.match(
      /<h4\s+class="performance__title"[^>]*>\s*<a[^>]*>\s*<span\s+itemprop="name">([^<]+)<\/span>/,
    );
    if (!titleMatch) continue;
    const title = decodeEntities(titleMatch[1].trim().replace(/:$/, ""));

    const stageMatch = block.match(/<span\s+class="performance__stage">([^<]+)<\/span>/);
    const venueRoom = stageMatch ? decodeEntities(stageMatch[1].trim().replace(/:$/, "")) : null;

    const catMatch = block.match(/<span\s+class="performance__category">([^<]+)<\/span>/);
    const rawCategory = catMatch ? decodeEntities(catMatch[1].trim().replace(/:$/, "")) : null;

    const subtitleMatch = block.match(/<div\s+class="performance__authorcomposer">([^<]+)<\/div>/);
    const subtitle = subtitleMatch ? decodeEntities(subtitleMatch[1].trim()) : null;

    const ageMatch = block.match(/<div\s+class="performance__age">([^<]+)<\/div>/);
    const age = ageMatch ? ageMatch[1].trim() : null;

    const detailUrlMatch = block.match(/<h4\s+class="performance__title">\s*<a\s+href="([^"]+)"/);
    const detailUrl = detailUrlMatch ? `${BASE}${detailUrlMatch[1]}` : null;

    const colorMatch = block.match(/performance--layoutscheme-set\d-(\w+)/);
    const genreColor = colorMatch ? colorMatch[1] : null;

    if (seen.has(perfId)) continue;
    seen.add(perfId);

    const description = [subtitle, age ? `Altersempfehlung: ${age}` : null].filter(Boolean).join(" · ") || null;

    events.push({
      source_event_id: perfId,
      title,
      description,
      date,
      time,
      end_time: endTime,
      detail_url: detailUrl,
      venue_room: venueRoom,
      raw_category: rawCategory,
      labels: buildLabels(title, rawCategory, genreColor),
    });
  }

  return {
    source_slug: "hessisches-staatstheater-wiesbaden",
    display_name: "Hessisches Staatstheater Wiesbaden",
    events,
  };
}

function buildLabels(
  title: string,
  category: string | null,
  color: string | null,
): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [
    { label: "stage:theater", confidence: 0.95, classifier: "scraper-hardcoded" },
  ];
  const t = title.toLowerCase();

  if (color === "yellow" || category === "JUST") {
    labels.push({ label: "stage:junges-theater", confidence: 0.8, classifier: "scraper-hardcoded" });
  }
  if (category === "Oper" || t.includes("oper")) {
    labels.push({ label: "music:opera", confidence: 0.8, classifier: "scraper-hardcoded" });
  } else if (category === "Ballett" || category === "Tanz" || t.includes("ballett") || t.includes("tanz")) {
    labels.push({ label: "stage:dance", confidence: 0.8, classifier: "scraper-hardcoded" });
  } else if (category === "Konzert" || t.includes("konzert") || t.includes("symphonie") || t.includes("orchester")) {
    labels.push({ label: "music:classical", confidence: 0.8, classifier: "scraper-hardcoded" });
  } else if (category === "Schauspiel" || t.includes("schauspiel")) {
    labels.push({ label: "stage:drama", confidence: 0.8, classifier: "scraper-hardcoded" });
  }

  return labels;
}

interface ScheduleResponse {
  datesFrom?: string;
  datesTo?: string;
  calendar?: string;
  schedule?: string;
}
