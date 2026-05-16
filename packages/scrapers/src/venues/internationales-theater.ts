import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.internationales-theater.de";
const PROGRAMM_URL = `${BASE}/programm-ticketkauf`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Internationales Theater Frankfurt runs Joomla + VikEvents.
 * `/programm-ticketkauf` lists all upcoming performances as
 * `<div class="event_item event_id_<id> data-month data-year>`.
 *
 * Status `cancelled` is detected via `hinweis_message` ("Abgesagt"/"Entfällt")
 * and rides in raw_category. Titles are screaming-uppercase; title-cased.
 */

const GERMAN_SHORT_MONTHS: Record<string, number> = {
  jan: 1,
  januar: 1,
  feb: 2,
  februar: 2,
  mar: 3,
  mär: 3,
  märz: 3,
  maerz: 3,
  apr: 4,
  april: 4,
  mai: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dez: 12,
  dezember: 12,
};

const ITEM_RE =
  /<div\s+class="event_item[^"]*event_id_(\d+)[^"]*"[^>]*\bdata-month="([^"]+)"\s+data-year="(\d{4})"[^>]*>([\s\S]*?)(?=<div\s+class="event_item|<\/main\b|<footer\b)/g;

export async function scrapeInternationalesTheater(): Promise<VenueScrapeResult> {
  const res = await fetch(PROGRAMM_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`internationales-theater fetch failed: ${res.status}`);
  return parse(await res.text());
}

function parse(html: string): VenueScrapeResult {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ITEM_RE)) {
    const eventId = m[1];
    const monthDe = m[2].toLowerCase().normalize("NFKD").replace(/̈/g, "");
    const month = GERMAN_SHORT_MONTHS[monthDe];
    const year = parseInt(m[3], 10);
    const block = m[4];
    if (!month) continue;

    const dayMatch = block.match(/<span\s+class="event_date_tag">[\s\S]*?(\d{1,2})\.\s*</);
    if (!dayMatch) continue;
    const day = parseInt(dayMatch[1], 10);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date < today) continue;

    const timeMatch = block.match(/<span\s+class="event_date_jahr">[\s\S]*?(\d{1,2}):(\d{2})/);
    const time = timeMatch ? nullIfMidnight(`${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`) : null;

    const titleAnchor = block.match(/<a\s+class="event-title"\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    if (!titleAnchor) continue;
    const detailHref = decodeEntities(titleAnchor[1]);
    const titleRaw = stripHtml(titleAnchor[2]);
    if (!titleRaw) continue;
    const title = formatTitle(titleRaw);

    const subtitle = stripHtml(block.match(/<h4\s+class="tagline">\s*([\s\S]*?)\s*<\/h4>/i)?.[1] ?? "") || null;
    const category =
      stripHtml(block.match(/<div\s+class="promotion_text">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "") || null;

    const thumbBg = block.match(
      /<div\s+class="thumb">[\s\S]*?<a[^>]+style="background-image:\s*url\(['"]([^'"]+)['"]\)/i,
    )?.[1];
    const image = thumbBg ? decodeEntities(thumbBg) : null;

    const isCancelled =
      /class=['"]hinweis_message['"][^>]*>\s*(?:Abgesagt|Entf[äa]llt)/i.test(block) || /event_stroke_class/.test(block);

    const slug = deriveSlug(detailHref) || slugify(title);
    const sourceEventId = `${eventId}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle,
      description: subtitle ?? category,
      date,
      time,
      detail_url: normalizeUrl(detailHref, BASE),
      ticket_url: normalizeUrl(detailHref, BASE),
      image_url: image ? normalizeUrl(image, BASE) : null,
      venue_room: category,
      raw_category: isCancelled ? "cancelled" : category,
      labels: resolveStageLabels({ title, subtitle, hint: category, confidence: 0.9 }),
    });
    // Mark slug for potential downstream show-grouping (used by the keyword pass
    // to keep alike productions joined even though source_event_id is per-date).
    void slug;
  }

  return { source_slug: "internationales-theater", events };
}

function deriveSlug(href: string): string | null {
  const m = href.match(/\/programm-ticketkauf\/([^/?#]+)/i);
  if (!m) return null;
  return m[1].replace(/^\d+-/, "");
}

/** ITF writes titles in screaming uppercase; title-case them. */
function formatTitle(t: string): string {
  if (!t || t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(" ")
    .map((w) => {
      if (/^(?:in|on|of|the|and|or|to|a|an|for|with|by|at|from|de|von|und|oder|aus|der|die|das)$/i.test(w)) return w;
      if (/^[ivxlcdm]+$/i.test(w)) return w.toUpperCase();
      if (/^#?\d+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}
