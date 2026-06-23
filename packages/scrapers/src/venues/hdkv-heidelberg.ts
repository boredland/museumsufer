import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.hdkv.de";
const EVENTS_URL = `${BASE}/de/veranstaltungen`;
const EXHIBITIONS_URL = `${BASE}/de/ausstellungen`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.411;
const LON = 8.705;
const CITY = "heidelberg";

export async function scrapeHdkvHeidelberg(): Promise<VenueScrapeResult> {
  const [eventsHtml, exhibitionsHtml] = await Promise.all([fetchText(EVENTS_URL), fetchText(EXHIBITIONS_URL)]);

  const events = parseEvents(extractFlightField(eventsHtml, "events") ?? []);
  const exhibitions = parseExhibitions(extractFlightField(exhibitionsHtml, "exhibitions") ?? []);

  return {
    source_slug: "hdkv-heidelberg",
    display_name: "Heidelberger Kunstverein",
    events: [...events, ...exhibitions].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
    ),
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`HdKV fetch failed for ${url}: ${res.status}`);
  return res.text();
}

function extractFlightField(html: string, key: string): unknown[] | null {
  const pushes = html.matchAll(/<script[^>]*>self\.__next_f\.push\(\[1,"(.*?)"\]\)<\/script>/g);
  for (const m of pushes) {
    const raw = m[1];
    if (!raw.includes(`"${key}":`) && !raw.includes(`\\"${key}\\":`)) continue;
    try {
      const decoded = JSON.parse(`"${raw}"`);
      if (typeof decoded !== "string" || !decoded.startsWith("5:")) continue;
      const flight = JSON.parse(decoded.slice(2));
      const found = findKey(flight, key);
      if (Array.isArray(found)) return found;
    } catch {
      // ignore malformed pushes
    }
  }
  return null;
}

function findKey(node: unknown, key: string): unknown | null {
  if (node && typeof node === "object") {
    if (Array.isArray(node)) {
      for (const item of node) {
        const r = findKey(item, key);
        if (r !== null) return r;
      }
    } else {
      const obj = node as Record<string, unknown>;
      if (key in obj) return obj[key];
      for (const v of Object.values(obj)) {
        const r = findKey(v, key);
        if (r !== null) return r;
      }
    }
  }
  return null;
}

function parseEvents(items: unknown[]): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    const it = raw as Record<string, unknown>;
    const title = typeof it.title === "string" ? it.title.trim() : "";
    const slug = typeof it.slug === "string" ? it.slug : "";
    const dateIso = typeof it.date === "string" ? it.date : null;
    if (!title || !dateIso) continue;

    const date = toBerlinDate(new Date(dateIso));
    if (date < today) continue;

    const time = toBerlinTime(new Date(dateIso));
    const description = extractSanityText(it.previewTxt);
    const category =
      Array.isArray(it.categories) && it.categories.length > 0
        ? String((it.categories[0] as Record<string, unknown>).slug ?? "")
        : "";

    const id = `hdkv-heidelberg|event|${date}|${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    events.push({
      source_event_id: id,
      title,
      subtitle: null,
      description,
      date,
      time: time === "00:00" ? null : time,
      end_date: null,
      end_time: null,
      detail_url: EVENTS_URL,
      ticket_url: null,
      image_url: null,
      city: CITY,
      lat: LAT,
      lon: LON,
      labels: labelsForEvent(category, title, description),
    });
  }

  return events;
}

function parseExhibitions(items: unknown[]): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    const it = raw as Record<string, unknown>;
    const title = typeof it.title === "string" ? it.title.trim() : "";
    const slug = typeof it.slug === "string" ? it.slug : "";
    const startIso = typeof it.start === "string" ? it.start : typeof it.event === "string" ? it.event : null;
    const endIso = typeof it.end === "string" ? it.end : null;
    if (!title) continue;

    const start = startIso ? toBerlinDate(new Date(startIso)) : today;
    const end = endIso ? toBerlinDate(new Date(endIso)) : null;
    if (end && end < today) continue;

    const id = `hdkv-heidelberg|exhibition|${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    events.push({
      source_event_id: id,
      title,
      subtitle: typeof it.category === "string" ? it.category : null,
      description: extractSanityText(it.previewTxt) ?? extractSanityText(it.shortTxt),
      date: start,
      time: null,
      end_date: end,
      end_time: null,
      detail_url: `${EXHIBITIONS_URL}/${slug}`,
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

function extractSanityText(blocks: unknown): string | null {
  if (!Array.isArray(blocks)) return null;
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const children = (block as Record<string, unknown>).children;
    if (!Array.isArray(children)) continue;
    for (const child of children) {
      if (child && typeof child === "object" && typeof (child as Record<string, unknown>).text === "string") {
        parts.push((child as Record<string, unknown>).text as string);
      }
    }
  }
  const text = parts.join(" ").trim();
  return text || null;
}

function labelsForEvent(categorySlug: string, title: string, description: string | null): ScrapedLabel[] {
  if (categorySlug === "fuehrungen") {
    return [{ label: "museum:fuehrung", confidence: 0.9, classifier: "upstream-category" }];
  }
  if (categorySlug === "vortraege" || categorySlug === "artist-talk") {
    return [
      { label: "talk:vortrag", confidence: 0.9, classifier: "upstream-category" },
      { label: "museum:vortrag", confidence: 0.9, classifier: "upstream-category" },
    ];
  }

  const type = classifyEvent(title, description);
  if (type === "Vortrag") {
    return [
      { label: "talk:vortrag", confidence: 0.85, classifier: "keyword:event" },
      { label: "museum:vortrag", confidence: 0.85, classifier: "keyword:event" },
    ];
  }
  const mapped = eventTypeToLabel(type);
  if (mapped) return [{ label: mapped, confidence: 0.85, classifier: "keyword:event" }];
  return [{ label: "museum:event", confidence: 0.5, classifier: "scraper-hardcoded" }];
}
