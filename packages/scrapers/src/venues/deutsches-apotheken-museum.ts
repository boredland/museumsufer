import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.deutsches-apotheken-museum.de";
const EVENTS_URL = `${BASE}/fuehrungen/oeffentliche-veranstaltungen`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.4106;
const LON = 8.7155;
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

export async function scrapeDeutschesApothekenMuseum(): Promise<VenueScrapeResult> {
  const listingHtml = await fetchText(EVENTS_URL);
  const links = parseEventLinks(listingHtml);

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    try {
      const detail = await fetchText(link);
      const ev = parseEventDetail(detail, link);
      if (!ev) continue;
      if (seen.has(ev.source_event_id)) continue;
      seen.add(ev.source_event_id);
      events.push(ev);
    } catch {
      // skip individual failing detail pages
    }
  }

  return {
    source_slug: "deutsches-apotheken-museum",
    display_name: "Deutsches Apotheken-Museum",
    events: events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")),
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`Apotheken-Museum fetch failed for ${url}: ${res.status}`);
  return res.text();
}

function parseEventLinks(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  // Each event teaser has an <h2> with a date like "03.07.26" and a following [weiter lesen] link.
  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let h2Match: RegExpExecArray | null;
  while ((h2Match = h2Re.exec(html)) !== null) {
    const heading = stripHtml(decodeEntities(h2Match[1])).trim();
    if (!/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(heading)) continue;

    // The [weiter lesen] anchor sits at the tail of the teaser; slice up to the
    // next date <h2> (or end) so a long teaser body can't push it out of range.
    const teaserStart = h2Match.index + h2Match[0].length;
    const nextH2 = html.indexOf("<h2", teaserStart);
    const after = html.slice(teaserStart, nextH2 === -1 ? undefined : nextH2);
    const linkMatch = after.match(/<a\s+[^>]*href="([^"]+)"[^>]*>\[?weiter lesen\]?/i);
    if (!linkMatch) continue;

    const url = normalizeUrl(decodeEntities(linkMatch[1]), BASE);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    links.push(url);
  }

  return links;
}

function parseEventDetail(html: string, detailUrl: string): CanonicalScrapedEvent | null {
  const today = todayIso();

  const title = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if (!title) return null;

  const bodyMatch = html.match(
    /<h1[^>]*>[\s\S]*?<\/h1>([\s\S]*?)<footer|<h1[^>]*>[\s\S]*?<\/h1>([\s\S]*?)<div class="social/,
  );
  const bodyHtml = bodyMatch ? (bodyMatch[1] ?? bodyMatch[2]) : html;

  const description = extractDescription(bodyHtml ?? html);

  const dateText = findMetaLine(bodyHtml ?? html, "Datum");
  const date = parseGermanDate(dateText);
  if (!date || date < today) return null;

  const time = extractTime(findMetaLine(bodyHtml ?? html, "Uhrzeit") ?? findMetaLine(bodyHtml ?? html, "Beginn"));
  const price = parsePrice(findMetaLine(bodyHtml ?? html, "Preis"));

  const slug = deriveSlug(detailUrl, title);
  const id = `deutsches-apotheken-museum|event|${date}|${slug}`;

  return {
    source_event_id: id,
    title,
    subtitle: null,
    description,
    date,
    time,
    end_date: null,
    end_time: null,
    detail_url: detailUrl,
    ticket_url: null,
    image_url: null,
    city: CITY,
    lat: LAT,
    lon: LON,
    price_min: price,
    venue_room: null,
    labels: labelsForEvent(title, description),
  };
}

function extractDescription(bodyHtml: string): string | null {
  const firstP = bodyHtml.match(/<p>([\s\S]*?)<\/p>/i)?.[1] ?? "";
  const text = cleanText(firstP);
  return text && text.length > 10 ? text : null;
}

function findMetaLine(html: string, label: string): string | null {
  const re = new RegExp(`<strong>${label}</strong>\\s*:\\s*([\\s\\S]*?)(?:<br>|<\\/p>|<\\/div>|<\\/li>)`, "i");
  const m = html.match(re);
  return m ? cleanText(m[1]) : null;
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

function extractTime(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2})[:.](\d{2})\s*Uhr/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return null;
}

function parsePrice(text: string | null): number | null {
  if (!text) return null;
  const normalized = text.replace(",", ".");
  const m = normalized.match(/€\s*(\d+(?:\.\d{2})?)/) ?? normalized.match(/(\d+(?:\.\d{2})?)\s*€/);
  return m ? parseFloat(m[1]) : null;
}

function labelsForEvent(title: string, description: string | null): ScrapedLabel[] {
  const type = classifyEvent(title, description);
  if (type === "Vortrag") {
    return [
      { label: "talk:vortrag", confidence: 0.85, classifier: "keyword:event" },
      { label: "museum:vortrag", confidence: 0.85, classifier: "keyword:event" },
    ];
  }
  const mapped = eventTypeToLabel(type);
  if (mapped) return [{ label: mapped, confidence: 0.85, classifier: "keyword:event" }];
  // Public tours at this museum are guided tours by default.
  if (/führung|themenführung|rundgang/i.test(title) || /führung/i.test(description ?? "")) {
    return [{ label: "museum:fuehrung", confidence: 0.9, classifier: "scraper-hardcoded" }];
  }
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
