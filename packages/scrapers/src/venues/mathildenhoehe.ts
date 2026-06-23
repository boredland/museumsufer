import { decodeEntities, normalizeUrl, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.mathildenhoehe.eu";
const EXHIBITIONS_URL = `${BASE}/ausstellungen/aktuell/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.8773;
const LON = 8.666;
const CITY = "darmstadt";

export async function scrapeMathildenhoehe(): Promise<VenueScrapeResult> {
  const html = await fetch(EXHIBITIONS_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  }).then((r) => {
    if (!r.ok) throw new Error(`Mathildenhöhe exhibitions fetch failed: ${r.status}`);
    return r.text();
  });

  // The site currently states explicitly that no exhibitions are listed in this category.
  // We still parse the page so the scraper becomes active automatically once entries appear.
  const exhibitions = parseExhibitions(html);

  return {
    source_slug: "mathildenhoehe",
    display_name: "Institut Mathildenhöhe",
    events: exhibitions.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")),
  };
}

function parseExhibitions(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];

  // SilverStripe renders each exhibition as an <article> inside .inner-left.
  // When empty, the page contains the marker sentence below.
  if (html.includes("Es sind derzeit keine Ausstellungen in dieser Kategorie eingetragen")) {
    return events;
  }

  const articleRe = /<article[^>]*>[\s\S]*?<\/article>/gi;
  const seen = new Set<string>();

  for (const articleMatch of html.matchAll(articleRe)) {
    const article = articleMatch[0];
    const title = cleanText(article.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? null);
    if (!title) continue;

    const href = decodeEntities(article.match(/<a\s+[^>]*href="([^"]+)"/i)?.[1] ?? "");
    const detailUrl = href ? normalizeUrl(href, BASE) : null;

    const imgMatch = article.match(/<img[^>]*src="([^"]+)"/i);
    const imageUrl = imgMatch ? normalizeUrl(decodeEntities(imgMatch[1]), BASE) : null;

    const slug = detailUrl ? deriveSlug(detailUrl, title) : title.toLowerCase().replace(/\s+/g, "-");
    const id = `mathildenhoehe|exhibition|${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const dateText = cleanText(article.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1] ?? null);
    const { start, end } = parseExhibitionDate(dateText);

    events.push({
      source_event_id: id,
      title,
      subtitle: null,
      description: null,
      date: start ?? today,
      time: null,
      end_date: end,
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

function parseExhibitionDate(text: string | null): { start: string | null; end: string | null } {
  if (!text) return { start: null, end: null };
  const clean = text.toLowerCase();

  const rangeMatch = clean.match(/(\d{1,2})\.(\d{1,2})\.\s*(?:bis|[-–])\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (rangeMatch) {
    const start = `${rangeMatch[5]}-${rangeMatch[2].padStart(2, "0")}-${rangeMatch[1].padStart(2, "0")}`;
    const end = `${rangeMatch[5]}-${rangeMatch[4].padStart(2, "0")}-${rangeMatch[3].padStart(2, "0")}`;
    return { start, end };
  }

  const singleMatch = clean.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (singleMatch) {
    const iso = `${singleMatch[3]}-${singleMatch[2].padStart(2, "0")}-${singleMatch[1].padStart(2, "0")}`;
    return { start: iso, end: iso };
  }

  return { start: null, end: null };
}

function deriveSlug(href: string, title: string): string {
  try {
    const path = new URL(href).pathname;
    const last = path.split("/").filter(Boolean).pop();
    return last && last !== "html" ? last : title.toLowerCase().replace(/\s+/g, "-");
  } catch {
    return title.toLowerCase().replace(/\s+/g, "-");
  }
}

function cleanText(raw: string | null): string | null {
  if (!raw) return null;
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
