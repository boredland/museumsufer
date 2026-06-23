import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { decodeEntities, normalizeUrl, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.kunsthalle-darmstadt.de";
const EXHIBITIONS_URL = `${BASE}/Programm_3_0_gid_1_pid_0.html`;
const EVENTS_URL = `${BASE}/Programm_3_0_gid_4_pid_0.html`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.874;
const LON = 8.636;
const CITY = "darmstadt";

export async function scrapeKunsthalleDarmstadt(): Promise<VenueScrapeResult> {
  const [exhibitionHtml, eventsHtml] = await Promise.all([
    fetch(EXHIBITIONS_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } }).then((r) => {
      if (!r.ok) throw new Error(`Kunsthalle exhibitions fetch failed: ${r.status}`);
      return r.text();
    }),
    fetch(EVENTS_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } }).then((r) => {
      if (!r.ok) throw new Error(`Kunsthalle events fetch failed: ${r.status}`);
      return r.text();
    }),
  ]);

  const exhibitions = parseExhibitions(exhibitionHtml);
  const events = parseEvents(eventsHtml);

  return {
    source_slug: "kunsthalle-darmstadt",
    display_name: "Kunsthalle Darmstadt",
    events: [...exhibitions, ...events].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
    ),
  };
}

function parseExhibitions(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const listMatch = html.match(/<div class="list gid1[^"]*">[\s\S]*?<ul class="items">([\s\S]*?)<\/ul>/i);
  const listHtml = listMatch ? listMatch[1] : "";
  const blocks = listHtml.split(/<div class="titelblock">/i).slice(1);

  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = decodeEntities(linkMatch[1]);
    const detailUrl = normalizeUrl(href, BASE);

    const titleHtml = linkMatch[2];
    const title = cleanText(titleHtml.replace(/<br\s*\/?>/gi, " "));
    if (!title) continue;

    const slug = deriveSlug(detailUrl ?? href, title);
    const id = `kunsthalle-darmstadt|exhibition|${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const dateText = cleanText(block.match(/<\/a>\s*([\s\S]*?)(?:<br>\s*<br>|$)/i)?.[1] ?? null);
    const { start, end } = parseExhibitionDate(dateText);
    const startDate = start ?? today;

    events.push({
      source_event_id: id,
      title,
      subtitle: null,
      description: null,
      date: startDate,
      time: null,
      end_date: end && end !== startDate ? end : null,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: null,
      city: CITY,
      lat: LAT,
      lon: LON,
      labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return events;
}

function parseEvents(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const listMatch = html.match(/<div class="list gid4[^"]*">[\s\S]*?<ul class="items">([\s\S]*?)<\/ul>/i);
  const listHtml = listMatch ? listMatch[1] : "";
  const blocks = listHtml.split(/<div class="titelblock">/i).slice(1);

  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = decodeEntities(linkMatch[1]);
    const detailUrl = normalizeUrl(href, BASE);
    const dateTimeText = cleanText(linkMatch[2]);
    const { date, time, endTime } = parseEventDateTime(dateTimeText);
    if (!date || date < today) continue;

    const bodyMatch = block.match(/<\/a>\s*([\s\S]*?)(?:<br>\s*<br>|$)/i)?.[1] ?? "";
    const bodyHtml = bodyMatch.replace(/<div class="titel">([\s\S]*?)<\/div>/i, "$1");
    const fullTitle = cleanText(bodyHtml.replace(/<br\s*\/?>/gi, " "));
    if (!fullTitle) continue;

    const slug = deriveSlug(detailUrl ?? href, fullTitle);
    const id = `kunsthalle-darmstadt|event|${date}|${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const labels = labelsForEvent(fullTitle, null);

    events.push({
      source_event_id: id,
      title: fullTitle,
      subtitle: null,
      description: null,
      date,
      time,
      end_date: null,
      end_time: endTime,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: null,
      city: CITY,
      lat: LAT,
      lon: LON,
      labels,
    });
  }

  return events;
}

function parseExhibitionDate(text: string | null): { start: string | null; end: string | null } {
  if (!text) return { start: null, end: null };
  const clean = text.toLowerCase().replace(/\s+/g, " ");

  const matches = [...clean.matchAll(/(\d{1,2})\s+(\d{1,2})\s+(\d{2,4})/g)];
  if (matches.length >= 2) {
    const start = toIsoDate(matches[0][1], matches[0][2], matches[0][3]);
    const end = toIsoDate(matches[1][1], matches[1][2], matches[1][3]);
    return { start, end };
  }
  if (matches.length === 1) {
    const iso = toIsoDate(matches[0][1], matches[0][2], matches[0][3]);
    return { start: iso, end: iso };
  }
  return { start: null, end: null };
}

function parseEventDateTime(text: string | null): { date: string | null; time: string | null; endTime: string | null } {
  if (!text) return { date: null, time: null, endTime: null };
  const clean = text.toLowerCase().replace(/\s+/g, " ");

  const dateMatch = clean.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!dateMatch) return { date: null, time: null, endTime: null };
  const date = toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3]);

  // "18.00 - 20.00 Uhr"
  const rangeMatch = clean.match(/(\d{1,2})\.(\d{2})\s*[-–]\s*(\d{1,2})\.(\d{2})\s*uhr/);
  if (rangeMatch) {
    return {
      date,
      time: `${rangeMatch[1].padStart(2, "0")}:${rangeMatch[2]}`,
      endTime: `${rangeMatch[3].padStart(2, "0")}:${rangeMatch[4]}`,
    };
  }

  // "18 - 20 Uhr"
  const wholeRangeMatch = clean.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*uhr/);
  if (wholeRangeMatch) {
    return {
      date,
      time: `${wholeRangeMatch[1].padStart(2, "0")}:00`,
      endTime: `${wholeRangeMatch[2].padStart(2, "0")}:00`,
    };
  }

  // "15 Uhr" / "15.00 Uhr"
  const singleMatch = clean.match(/(\d{1,2})(?:\.(\d{2}))?\s*uhr/);
  if (singleMatch) {
    const minutes = singleMatch[2] ?? "00";
    return { date, time: `${singleMatch[1].padStart(2, "0")}:${minutes}`, endTime: null };
  }

  return { date, time: null, endTime: null };
}

function toIsoDate(day: string, month: string, year: string): string | null {
  const y = year.length === 2 ? `20${year}` : year;
  if (!/^\d{4}$/.test(y)) return null;
  return `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function labelsForEvent(title: string, description: string | null): ScrapedLabel[] {
  const type = classifyEvent(title, description);
  if (type === "Vortrag") {
    return [
      { label: "talk:vortrag", confidence: 0.85, classifier: "keyword:event" },
      { label: "museum:vortrag", confidence: 0.85, classifier: "keyword:event" },
    ];
  }
  if (type === "Film") {
    return [
      { label: "film:cinema", confidence: 0.85, classifier: "keyword:event" },
      { label: "museum:film", confidence: 0.85, classifier: "keyword:event" },
    ];
  }
  const mapped = eventTypeToLabel(type);
  if (mapped) return [{ label: mapped, confidence: 0.85, classifier: "keyword:event" }];
  return [{ label: "museum:event", confidence: 0.5, classifier: "scraper-hardcoded" }];
}

function deriveSlug(href: string, title: string): string {
  try {
    const url = new URL(href, BASE);
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (last && last !== "html" && /\d/.test(last)) return last;
  } catch {
    // fall through to title-based slug
  }
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function cleanText(raw: string | null): string | null {
  if (!raw) return null;
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
