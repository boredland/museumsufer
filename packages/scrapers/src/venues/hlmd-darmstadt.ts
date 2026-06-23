import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.hlmd.de";
const EXHIBITIONS_URL = `${BASE}/de/entdecken/sonderausstellungen/`;
const CALENDAR_URL = `${BASE}/de/besuchen/kalender/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.873;
const LON = 8.65;
const CITY = "darmstadt";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export async function scrapeHlmdDarmstadt(): Promise<VenueScrapeResult> {
  const [exhibitionHtml, calendarHtml] = await Promise.all([
    fetch(EXHIBITIONS_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } }).then((r) => {
      if (!r.ok) throw new Error(`HLMD exhibitions fetch failed: ${r.status}`);
      return r.text();
    }),
    fetch(CALENDAR_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } }).then((r) => {
      if (!r.ok) throw new Error(`HLMD calendar fetch failed: ${r.status}`);
      return r.text();
    }),
  ]);

  const exhibitions = parseNextDataExhibitions(exhibitionHtml);
  const events = parseNextDataEvents(calendarHtml);

  return {
    source_slug: "hlmd-darmstadt",
    display_name: "Hessisches Landesmuseum Darmstadt",
    events: [...exhibitions, ...events].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
    ),
  };
}

function parseNextDataExhibitions(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const data = extractNextData(html);
  if (!data) return events;

  const components = getComponents(data);
  const seen = new Set<string>();

  for (const comp of components) {
    const items = Array.isArray(comp.data) ? comp.data : [];
    for (const item of items) {
      if (!isRecord(item)) continue;
      const stage = getStage(item);
      if (!stage) continue;

      const title = cleanText(stage.title);
      if (!title) continue;

      const slug = typeof item.slug === "string" ? item.slug : slugify(title);
      const id = `hlmd-darmstadt|exhibition|${slug}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const dateRange = parseExhibitionDate(stage.additionalInfo);
      const start = dateRange.start ?? today;
      const end = dateRange.end;

      const detailUrl = buildPublicUrl(item.full_slug);
      const imageUrl = extractImageUrl(stage);

      events.push({
        source_event_id: id,
        title,
        subtitle: cleanText(stage.subtitle) ?? null,
        description: extractRichTextDescription(item),
        date: start,
        time: null,
        end_date: end && end !== start ? end : null,
        end_time: null,
        detail_url: detailUrl,
        ticket_url: null,
        image_url: imageUrl,
        city: CITY,
        lat: LAT,
        lon: LON,
        labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return events;
}

function parseNextDataEvents(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const data = extractNextData(html);
  if (!data) return events;

  const components = getComponents(data);
  const seen = new Set<string>();

  for (const comp of components) {
    const items = Array.isArray(comp.data) ? comp.data : [];
    for (const item of items) {
      if (!isRecord(item)) continue;
      const stage = getStage(item);
      if (!stage) continue;

      const startDate = parseDateTime(stage.startDate);
      if (!startDate || startDate.date < today) continue;

      const title = cleanText(stage.title);
      const subtitle = cleanText(stage.subtitle);
      const displayTitle = subtitle ? `${title}: ${subtitle}` : title;
      if (!displayTitle) continue;

      const slug = typeof item.slug === "string" ? item.slug : slugify(displayTitle);
      const id = `hlmd-darmstadt|event|${startDate.date}|${slug}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const endDate = parseDateTime(stage.endDate);
      const description = extractRichTextDescription(item);
      const labels = labelsForEvent(displayTitle, description);

      events.push({
        source_event_id: id,
        title: displayTitle,
        subtitle: null,
        description,
        date: startDate.date,
        time: startDate.time,
        end_date: endDate && endDate.date !== startDate.date ? endDate.date : null,
        end_time: endDate && endDate.date === startDate.date ? endDate.time : null,
        detail_url: buildPublicUrl(item.full_slug),
        ticket_url: null,
        image_url: extractImageUrl(stage),
        city: CITY,
        lat: LAT,
        lon: LON,
        labels,
      });
    }
  }

  return events;
}

function extractNextData(html: string): unknown | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function getComponents(data: unknown): Array<{ data?: unknown[]; [key: string]: unknown }> {
  if (typeof data !== "object" || data === null) return [];
  const props = (data as Record<string, unknown>).props;
  if (typeof props !== "object" || props === null) return [];
  const pageProps = (props as Record<string, unknown>).pageProps;
  if (typeof pageProps !== "object" || pageProps === null) return [];
  const content = (pageProps as Record<string, unknown>).content;
  if (typeof content !== "object" || content === null) return [];
  const components = (content as Record<string, unknown>).components;
  return Array.isArray(components)
    ? components.filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    : [];
}

function getStage(item: Record<string, unknown>): Record<string, unknown> | null {
  const content = item.content;
  if (typeof content !== "object" || content === null) return null;
  const stage = (content as Record<string, unknown>).stage;
  if (Array.isArray(stage) && stage.length > 0 && typeof stage[0] === "object" && stage[0] !== null) {
    return stage[0] as Record<string, unknown>;
  }
  if (typeof stage === "object" && stage !== null) return stage as Record<string, unknown>;
  return null;
}

function extractImageUrl(stage: Record<string, unknown>): string | null {
  const image = stage.image;
  if (!Array.isArray(image) || image.length === 0) return null;
  const first = image[0];
  if (typeof first !== "object" || first === null) return null;
  const asset = (first as Record<string, unknown>).asset;
  if (typeof asset !== "object" || asset === null) return null;
  const filename = (asset as Record<string, unknown>).filename;
  return typeof filename === "string" ? filename : null;
}

function extractRichTextDescription(item: Record<string, unknown>): string | null {
  const content = item.content;
  if (typeof content !== "object" || content === null) return null;
  const components = (content as Record<string, unknown>).components;
  if (!Array.isArray(components)) return null;

  const texts: string[] = [];
  for (const comp of components) {
    if (typeof comp !== "object" || comp === null) continue;
    if ((comp as Record<string, unknown>).component !== "richText") continue;
    const richContent = (comp as Record<string, unknown>).content;
    if (typeof richContent === "object" && richContent !== null) {
      walkRichText(richContent as Record<string, unknown>, texts);
    }
  }
  const joined = texts.join(" ").trim();
  return joined || null;
}

function walkRichText(node: Record<string, unknown>, out: string[]): void {
  if (typeof node.text === "string") {
    out.push(node.text);
    return;
  }
  const content = node.content;
  if (Array.isArray(content)) {
    for (const child of content) {
      if (typeof child === "object" && child !== null) {
        walkRichText(child as Record<string, unknown>, out);
      }
    }
  }
}

function buildPublicUrl(fullSlug: unknown): string | null {
  if (typeof fullSlug !== "string" || !fullSlug) return null;
  const publicPath = fullSlug.replace(/^corporate-website\/de/, "de");
  return `${BASE}/${publicPath}`;
}

function parseExhibitionDate(text: unknown): { start: string | null; end: string | null } {
  if (typeof text !== "string" || !text) return { start: null, end: null };
  const clean = text.toLowerCase().replace(/\s+/g, "");

  const rangeMatch = clean.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})[–-](\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (rangeMatch) {
    const start = `${rangeMatch[3]}-${rangeMatch[2].padStart(2, "0")}-${rangeMatch[1].padStart(2, "0")}`;
    const end = `${rangeMatch[6]}-${rangeMatch[5].padStart(2, "0")}-${rangeMatch[4].padStart(2, "0")}`;
    return { start, end };
  }

  const singleMatch = clean.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (singleMatch) {
    const iso = `${singleMatch[3]}-${singleMatch[2].padStart(2, "0")}-${singleMatch[1].padStart(2, "0")}`;
    return { start: iso, end: iso };
  }

  return { start: null, end: null };
}

function parseDateTime(raw: unknown): { date: string; time: string } | null {
  if (typeof raw !== "string" || !raw) return null;
  const [datePart, timePart] = raw.split(" ");
  if (!datePart || !/\d{4}-\d{2}-\d{2}/.test(datePart)) return null;
  const time = timePart && /^\d{2}:\d{2}$/.test(timePart) ? timePart : null;
  return { date: datePart, time: time ?? "" };
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

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function cleanText(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
