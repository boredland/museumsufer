import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import PQueue from "p-queue";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.sammlung-prinzhorn.de";
const EVENTS_URL = `${BASE}/veranstaltungen`;
const EXHIBITIONS_URL = `${BASE}/ausstellungen`;
const PREVIEW_URL = `${BASE}/vorschau`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.418;
const LON = 8.672;
const CITY = "heidelberg";

const DE_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

export async function scrapeSammlungPrinzhorn(): Promise<VenueScrapeResult> {
  const [eventsHtml, exhibitionsHtml, previewHtml] = await Promise.all([
    fetchText(EVENTS_URL),
    fetchText(EXHIBITIONS_URL),
    fetchText(PREVIEW_URL),
  ]);

  const events = await parseEvents(eventsHtml);
  const exhibitions = parseExhibitions(exhibitionsHtml, false);
  const previews = parseExhibitions(previewHtml, true);

  return {
    source_slug: "sammlung-prinzhorn",
    display_name: "Sammlung Prinzhorn",
    events: [...events, ...exhibitions, ...previews].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
    ),
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`Sammlung Prinzhorn fetch failed for ${url}: ${res.status}`);
  return res.text();
}

async function parseEvents(html: string): Promise<CanonicalScrapedEvent[]> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const itemRe = /<li class="b_news__item">([\s\S]*?)<\/li>/gi;
  const items: { title: string; dateText: string; href: string; imageUrl: string | null }[] = [];

  for (const m of html.matchAll(itemRe)) {
    const block = m[1];
    const title = cleanText(block.match(/<header class="b_news__title">([\s\S]*?)<\/header>/i)?.[1]);
    const dateText = cleanText(block.match(/<p class="b_news__categories">([\s\S]*?)<\/p>/i)?.[1]);
    const href = decodeEntities(block.match(/<a class="b_news__link[^"]*"\s+href="([^"]+)"/i)?.[1] ?? "");
    const imgMatch = block.match(/<img[^>]*class="b_news__image"[^>]*src="([^"]+)"/i);
    const imageUrl = imgMatch ? normalizeUrl(decodeEntities(imgMatch[1]), BASE) : null;

    if (!title || !dateText || !href) continue;
    const date = parseGermanDate(dateText);
    if (!date || date < today) continue;

    items.push({ title, dateText, href, imageUrl });
  }

  const queue = new PQueue({ concurrency: 5 });
  const detailResults = await Promise.all(
    items.map((it) =>
      queue.add(async () => {
        try {
          const detail = await fetchText(normalizeUrl(it.href, BASE)!);
          return parseEventDetail(detail, it);
        } catch {
          return listEventFallback(it);
        }
      }),
    ),
  );

  for (const ev of detailResults) {
    if (!ev) continue;
    if (seen.has(ev.source_event_id)) continue;
    seen.add(ev.source_event_id);
    events.push(ev);
  }

  return events;
}

function parseEventDetail(
  detail: string,
  it: { title: string; dateText: string; href: string; imageUrl: string | null },
): CanonicalScrapedEvent | null {
  const today = todayIso();
  const subheader = cleanText(detail.match(/<h2 class="b_pageheader__subheader">([\s\S]*?)<\/h2>/i)?.[1]);
  const body = cleanText(detail.match(/<p class="b_rte__bodytext">([\s\S]*?)<\/p>/i)?.[1]);
  const description = body ?? subheader;

  const date = parseGermanDate(it.dateText) ?? parseGermanDate(subheader ?? "") ?? today;
  if (date < today) return null;

  const time = extractTime(subheader ?? body ?? "") ?? extractTime(it.title);

  const slug = deriveSlug(it.href, it.title);
  const id = `sammlung-prinzhorn|event|${date}|${slug}`;

  return {
    source_event_id: id,
    title: it.title,
    subtitle: subheader,
    description,
    date,
    time,
    end_date: null,
    end_time: null,
    detail_url: normalizeUrl(it.href, BASE),
    ticket_url: null,
    image_url: it.imageUrl,
    city: CITY,
    lat: LAT,
    lon: LON,
    labels: labelsForEvent(it.title, description),
  };
}

function listEventFallback(it: {
  title: string;
  dateText: string;
  href: string;
  imageUrl: string | null;
}): CanonicalScrapedEvent | null {
  const today = todayIso();
  const date = parseGermanDate(it.dateText);
  if (!date || date < today) return null;

  const slug = deriveSlug(it.href, it.title);
  const id = `sammlung-prinzhorn|event|${date}|${slug}`;

  return {
    source_event_id: id,
    title: it.title,
    subtitle: null,
    description: null,
    date,
    time: extractTime(it.title),
    end_date: null,
    end_time: null,
    detail_url: normalizeUrl(it.href, BASE),
    ticket_url: null,
    image_url: it.imageUrl,
    city: CITY,
    lat: LAT,
    lon: LON,
    labels: labelsForEvent(it.title, null),
  };
}

function parseExhibitions(html: string, isPreview: boolean): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const blockRe = /<a href="([^"]+)" class="b_textmediateaser__link">([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(blockRe)) {
    const href = decodeEntities(m[1]);
    const block = m[2];

    const topic = cleanText(block.match(/<p class="b_textmediateaser__topic-header">([\s\S]*?)<\/p>/i)?.[1]);
    const header = cleanText(block.match(/<h4 class="b_textmediateaser__header">([\s\S]*?)<\/h4>/i)?.[1]);
    const teaser = cleanText(block.match(/<p class="b_textmediateaser__teasertext">([\s\S]*?)<\/p>/i)?.[1]);

    const title = header ?? topic ?? "Ausstellung";
    const _isPermanent =
      (header ?? "").toLowerCase().includes("dauerausstellung") ||
      (topic ?? "").toLowerCase().includes("dauerausstellung");

    let date = today;
    let endDate: string | null = null;

    const range = parseExhibitionDateRange(topic ?? "");
    if (range) {
      date = range.start ?? today;
      endDate = range.end;
    } else if (isPreview) {
      const start = parseGermanDate(topic ?? "");
      if (start) date = start;
    }

    const slug = deriveSlug(href, title);
    const id = `sammlung-prinzhorn|exhibition|${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    events.push({
      source_event_id: id,
      title,
      subtitle: topic,
      description: teaser,
      date,
      time: null,
      end_date: endDate,
      end_time: null,
      detail_url: normalizeUrl(href, BASE),
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

function parseGermanDate(text: string | null): string | null {
  if (!text) return null;
  const clean = text.toLowerCase();

  const numeric = clean.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (numeric) {
    return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  }

  const textual = clean.match(/(\d{1,2})\.?\s*([a-zäöü]+)\s*(\d{4})/);
  if (textual) {
    const month = DE_MONTHS[textual[2].toLowerCase()];
    if (month) {
      return `${textual[3]}-${month}-${textual[1].padStart(2, "0")}`;
    }
  }

  return null;
}

function parseExhibitionDateRange(text: string): { start: string | null; end: string | null } | null {
  const clean = text.toLowerCase();
  const rangeMatch = clean.match(/(\d{1,2})\.\s*([a-zäöü]+)\s*(?:bis|[-–])\s*(\d{1,2})\.\s*([a-zäöü]+)\s*(\d{4})/);
  if (rangeMatch) {
    const startMonth = DE_MONTHS[rangeMatch[2].toLowerCase()];
    const endMonth = DE_MONTHS[rangeMatch[4].toLowerCase()];
    if (!startMonth || !endMonth) return null;
    return {
      start: `${rangeMatch[5]}-${startMonth}-${rangeMatch[1].padStart(2, "0")}`,
      end: `${rangeMatch[5]}-${endMonth}-${rangeMatch[3].padStart(2, "0")}`,
    };
  }
  return null;
}

function extractTime(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2})[:.](\d{2})\s*Uhr/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  const m2 = text.match(/(\d{1,2})\s*Uhr/);
  if (m2) return `${m2[1].padStart(2, "0")}:00`;
  return null;
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
    const path = new URL(href, BASE).pathname;
    const last = path.split("/").filter(Boolean).pop();
    return last && last !== "html" ? last : slugify(title);
  } catch {
    return slugify(title);
  }
}

function cleanText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
