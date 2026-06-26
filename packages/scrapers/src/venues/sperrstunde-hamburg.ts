import { todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * sperrstunde.org — Hamburg left-alternative / DIY culture aggregator.
 * Successor to bewegungsmelder.org. Covers ~80 venues (Rote Flora,
 * Golden Pudel, MS Stubnitz, Hafenklang, Gängeviertel, …) that mostly
 * have no structured ticketing. The front page lists ~65 upcoming events
 * with structured HTML: `.event` blocks containing `.event-title h2 a`
 * (title + slug), `.event-venue` (linked or plain text), `.event-date`
 * (DD.MM.YYYY), `.event-time` (HH:MM), `.event-categories` (labels).
 */
const BASE = "https://sperrstunde.org";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// Hamburg centroid — all sperrstunde venues are in Hamburg.
const LAT = 53.55;
const LON = 9.99;

/** Categories we skip — political actions, walks, markets, etc. */
const SKIP_CATEGORIES = new Set(["demo", "kundgebung", "spaziergang"]);

/** Map venue slug → canonical display name for known venues. */
const VENUE_NAMES: Record<string, string> = {
  "3001-kino": "3001 Kino",
  "abaton-kino": "Abaton Kino",
  "b-movie": "B-Movie",
  "buttclub": "Buttclub",
  "cafe-treibeis": "Café Treibeis",
  "chemnitzstrasse-3-7": "Chemnitzstraße 3-7",
  "gaengeviertel": "Gängeviertel",
  "golden-pudel-club": "Golden Pudel Club",
  "hafenklang-goldener-salon": "Hafenklang Goldener Salon",
  "haus73": "Haus73",
  "jolly-roger": "Jolly Roger",
  "koelibri": "Kölibri",
  "mikropol": "Mikropol",
  "ms-stubnitz": "MS Stubnitz",
  "rote-flora": "Rote Flora",
  "semtex": "Semtex",
  "tiefgang-bar": "Tiefgang Bar",
  "turtur": "Turtur",
};

export async function scrapeSperrstunde(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(BASE, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`sperrstunde fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Split on event blocks
  const blocks = html.split(/(?=<div\s+class="event\s+event-published)/);

  for (const block of blocks) {
    // Extract title + slug from the h2 > a link
    const titleMatch = block.match(
      /<div\s+class="event-title">\s*<h2>\s*<a[^>]*href="\/events\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/,
    );
    if (!titleMatch) continue;

    const eventSlug = titleMatch[1];
    const title = decodeEntities(titleMatch[2].replace(/<[^>]+>/g, "").trim());
    if (!title) continue;

    // Extract date from the event slug: "2026-06-26-slug-text"
    const dateMatch = eventSlug.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const date = dateMatch[1];
    if (date < today) continue;

    // Extract venue — linked or plain text
    const venueMatch = block.match(
      /<div\s+class="event-venue">\s*(?:<a[^>]*href="\/venues\/([^"]*)"[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*<\/div>/,
    );
    const venueSlug = venueMatch?.[1] || null;
    const venueName = venueMatch
      ? decodeEntities(venueMatch[2].replace(/<[^>]+>/g, "").trim())
      : null;

    // Extract categories
    const catMatches = [...block.matchAll(/<span\s+class="category-label"[^>]*>\s*([\s\S]*?)\s*<\/span>/gi)];
    const categories = catMatches.map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, "").trim().toLowerCase()));

    // Skip non-cultural events
    if (categories.some((c) => SKIP_CATEGORIES.has(c))) continue;

    // Extract time
    const timeMatch = block.match(/<div\s+class="div event-time">\s*(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : null;

    // Extract description
    const descMatch = block.match(/<div\s+class="event-text">\s*<p>([\s\S]*?)<\/p>/);
    const description = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()) : null;

    // Extract external link
    const linkMatch = block.match(/<a\s+class="event-link"\s+href="(https?:\/\/[^"]+)"/);
    const detailUrl = linkMatch ? linkMatch[1] : `${BASE}/events/${eventSlug}`;

    // Dedup by slug (date is in the slug)
    if (seen.has(eventSlug)) continue;
    seen.add(eventSlug);

    // Build source_event_id from the slug
    const sourceEventId = `sperrstunde|${eventSlug}`;

    events.push({
      source_event_id: sourceEventId,
      title,
      description: description || null,
      date,
      time,
      detail_url: detailUrl,
      labels: labelsFromCategories(categories, title),
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { source_slug: "sperrstunde-hamburg", display_name: "Sperrstunde Hamburg", events };
}

function labelsFromCategories(
  categories: string[],
  title: string,
): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [];
  const t = title.toLowerCase();

  if (categories.includes("konzert") || categories.includes("party") || t.includes("live")) {
    labels.push({ label: "music:rock", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (categories.includes("film")) {
    labels.push({ label: "cinema:arthaus", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (categories.includes("theater")) {
    labels.push({ label: "stage:theater", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (categories.includes("lesung") || categories.includes("vortrag") || categories.includes("diskussion")) {
    labels.push({ label: "talk:reading", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (categories.includes("workshop") || categories.includes("diy")) {
    labels.push({ label: "talk:workshop", confidence: 0.7, classifier: "scraper-hardcoded" });
  }

  // Fallback
  if (labels.length === 0) {
    labels.push({ label: "music:rock", confidence: 0.5, classifier: "scraper-hardcoded" });
  }
  return labels;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"");
}
