import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.museum-heidelberg.de";
const EXHIBITIONS_URL = `${BASE}/Museum-Heidelberg/startseite/ausstellungen.html`;
const EVENTS_RSS = `${BASE}/site/Museum-Heidelberg/zmrss/1361882/rss.xml`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.411;
const LON = 8.705;
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

export async function scrapeKurpfaelzischesMuseum(): Promise<VenueScrapeResult> {
  const [exhibitionHtml, rssText] = await Promise.all([
    fetch(EXHIBITIONS_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } }).then((r) => {
      if (!r.ok) throw new Error(`Kurpfälzisches exhibitions fetch failed: ${r.status}`);
      return r.text();
    }),
    fetch(EVENTS_RSS, { headers: { "User-Agent": UA } }).then((r) => {
      if (!r.ok) throw new Error(`Kurpfälzisches events RSS fetch failed: ${r.status}`);
      return r.text();
    }),
  ]);

  const exhibitions = parseExhibitions(exhibitionHtml);
  const events = parseEventsRss(rssText);

  return {
    source_slug: "kurpfaelzisches-museum",
    display_name: "Kurpfälzisches Museum",
    events: [...exhibitions, ...events].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
    ),
  };
}

function parseExhibitions(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Each exhibition is an <article> with a figure + a composedcontent-dvv-box.
  const blocks = html.split(/<article\s+class="composedcontent-standardseite-museum-heidelberg[^"]*"/i);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block.includes("<h2>")) continue;

    const boxMatch = block.match(/<div class="composedcontent-dvv-box[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i);
    const box = boxMatch ? boxMatch[0] : block;

    const title = cleanText(box.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
    if (!title) continue;

    const subtitle = cleanText(box.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? null);
    const dateText = cleanText(box.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1] ?? null);
    const { start, end, isPermanent } = parseExhibitionDate(dateText);

    const href = decodeEntities(
      block.match(/<a\s+[^>]*class="[^"]*(?:internerLink|externerLink)[^"]*"\s+href="([^"]+)"/i)?.[1] ?? "",
    );
    const detailUrl = normalizeUrl(href, BASE);

    const imgMatch = block.match(/<img[^>]*src="([^"]+)"/i);
    const imageUrl = imgMatch ? normalizeUrl(decodeEntities(imgMatch[1]), BASE) : null;

    const slug = detailUrl ? deriveSlug(detailUrl, title) : slugify(title);
    const id = `kurpfaelzisches-museum|exhibition|${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    let date = start ?? today;
    if (date < today && !isPermanent) date = today;
    const endDate = end && end !== date ? end : null;

    events.push({
      source_event_id: id,
      title,
      subtitle,
      description: subtitle,
      date,
      time: null,
      end_date: endDate,
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

  return events;
}

function parseEventsRss(rss: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  for (const itemMatch of rss.matchAll(itemRe)) {
    const item = itemMatch[1];
    const link = getXmlTag(item, "link");
    const title = getXmlTag(item, "title");
    const description = getXmlTag(item, "description");
    if (!link || !title || !description) continue;

    const date = description.match(/<span\s+class="dtstart"\s+title="(\d{4}-\d{2}-\d{2})">/i)?.[1] ?? null;
    if (!date || date < today) continue;

    const timeRaw = description.match(/<span\s+class="uhr">([\s\S]*?)<\/span>/i)?.[1] ?? null;
    const { time, endTime } = parseEventTime(timeRaw);

    // Title from RSS is prefixed with "DD-MM-YYYY  ". Strip that.
    const cleanTitle = cleanText(title.replace(/^\d{2}-\d{2}-\d{4}\s+/, ""));
    if (!cleanTitle) continue;

    const desc = cleanText(
      description
        .replace(/<[^>]+>/g, " ")
        .replace(cleanTitle, "")
        .trim(),
    );

    const nodeId = link.match(/nodeID=(\d+)/i)?.[1] ?? slugify(cleanTitle);
    const id = `kurpfaelzisches-museum|event|${date}|${nodeId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const labels = labelsForEvent(cleanTitle, desc);

    events.push({
      source_event_id: id,
      title: cleanTitle,
      subtitle: null,
      description: desc,
      date,
      time,
      end_time: endTime,
      end_date: null,
      detail_url: link,
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

function parseExhibitionDate(text: string | null): { start: string | null; end: string | null; isPermanent: boolean } {
  if (!text) return { start: null, end: null, isPermanent: false };
  const clean = text.toLowerCase();
  if (clean.includes("dauerausstellung")) return { start: null, end: null, isPermanent: true };

  const rangeMatch = clean.match(/(\d{1,2})\.\s*([a-zäöü]+)\s*(?:bis|[-–])\s*(\d{1,2})\.\s*([a-zäöü]+)\s*(\d{4})/i);
  if (rangeMatch) {
    const start = `${rangeMatch[5]}-${DE_MONTHS[rangeMatch[2].toLowerCase()]}-${rangeMatch[1].padStart(2, "0")}`;
    const end = `${rangeMatch[5]}-${DE_MONTHS[rangeMatch[4].toLowerCase()]}-${rangeMatch[3].padStart(2, "0")}`;
    return { start, end, isPermanent: false };
  }

  const numRangeMatch = clean.match(/(\d{1,2})\.(\d{1,2})\.\s*(?:bis|[-–])\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
  if (numRangeMatch) {
    const start = `${numRangeMatch[5]}-${numRangeMatch[2].padStart(2, "0")}-${numRangeMatch[1].padStart(2, "0")}`;
    const end = `${numRangeMatch[5]}-${numRangeMatch[4].padStart(2, "0")}-${numRangeMatch[3].padStart(2, "0")}`;
    return { start, end, isPermanent: false };
  }

  const singleMatch = clean.match(/(\d{1,2})\.\s*([a-zäöü]+)\s*(\d{4})/i);
  if (singleMatch) {
    const iso = `${singleMatch[3]}-${DE_MONTHS[singleMatch[2].toLowerCase()]}-${singleMatch[1].padStart(2, "0")}`;
    return { start: iso, end: iso, isPermanent: false };
  }

  return { start: null, end: null, isPermanent: false };
}

function parseEventTime(raw: string | null): { time: string | null; endTime: string | null } {
  if (!raw) return { time: null, endTime: null };
  const clean = raw.replace(",", ".").trim();
  const rangeMatch = clean.match(/^(\d{1,2})[:.](\d{2})\s*(?:bis|[-–])\s*(\d{1,2})[:.](\d{2})$/i);
  if (rangeMatch) {
    return {
      time: `${rangeMatch[1].padStart(2, "0")}:${rangeMatch[2]}`,
      endTime: `${rangeMatch[3].padStart(2, "0")}:${rangeMatch[4]}`,
    };
  }
  const singleMatch = clean.match(/^(\d{1,2})[:.](\d{2})$/);
  if (singleMatch) return { time: `${singleMatch[1].padStart(2, "0")}:${singleMatch[2]}`, endTime: null };
  return { time: null, endTime: null };
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
  const path = new URL(href).pathname;
  const last = path.split("/").pop();
  return last && last !== "html" ? last : slugify(title);
}

function cleanText(raw: string | null): string | null {
  if (!raw) return null;
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}

function getXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>(?:<![CDATA[)?([sS]*?)(?:]]>)?</${tag}>`, "i");
  const m = xml.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}
