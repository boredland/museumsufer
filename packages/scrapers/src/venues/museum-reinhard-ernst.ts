import { todayIso } from "@museumsufer/core/date";
import { decodeEntities } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.museum-re.de";
const KALENDER_URL = `${BASE}/de/besuch/veranstaltungskalender/`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

/**
 * Museum Reinhard Ernst (mre) — abstract-art museum in Wiesbaden, opened
 * 2024 in a Fumihiko Maki building. Its WordPress site renders the event
 * programme as server-side HTML with `<div class="teaser">` cards; each
 * card carries a `<p class="teaser-date">` (German format without year,
 * e.g. "Fr. 26.6. 12:30 Uhr"), an `<h4 class="teaser-title">`, a detail
 * `<a href>`, and a `<img>` poster. We parse these from the `/kalender`
 * page and skip events before today. The page renders ~30 upcoming events
 * in a single request — no pagination needed.
 */
export async function scrapeMuseumRe(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(KALENDER_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`mre fetch failed: ${res.status}`);
  const html = await res.text();
  // Parse each <a href="…/veranstaltungskalender/…"><figure>…</figure></a>
  // block. The figure contains the teaser-date and teaser-title.
  const eventRe = /<a href="([^"]*\/veranstaltungskalender\/[^"]*)"[^>]*>\s*<figure>([\s\S]*?)<\/figure>\s*<\/a>/g;
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  const currentYear = new Date().getFullYear();

  let match: RegExpExecArray | null;
  while ((match = eventRe.exec(html)) !== null) {
    const href = match[1];
    const figureHtml = match[2];
    const img = figureHtml.match(/<img[^>]*src="([^"]*)"[^>]*>/)?.[1];
    const dateText = figureHtml.match(/<p class="teaser-date">([^<]+)<\/p>/)?.[1];
    const titleText = figureHtml.match(/<h4 class="teaser-title">([^<]+)<\/h4>/)?.[1];
    if (!href || !dateText || !titleText) continue;

    const title = decodeEntities(titleText.trim());
    const parsed = parseMreDate(dateText.trim(), currentYear);
    if (!parsed) continue;
    const { date, time } = parsed;
    if (date < today) continue;

    const detailUrl = href.startsWith("http") ? href : `${BASE}${href}`;
    const dedupKey = `${detailUrl}|${date}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    events.push({
      source_event_id: dedupKey,
      title,
      date,
      time,
      detail_url: detailUrl,
      image_url: img || null,
      labels: buildLabels(title),
    });
  }

  return { source_slug: "museum-reinhard-ernst", display_name: "Museum Reinhard Ernst (mre)", events };
}

// ─── date parsing ──────────────────────────────────────────────────────

/** Parse the German date format used in teaser-date paragraphs.
 *  Examples: "Fr. 26.6. 12:30 Uhr", "Sa. 27.6. 14 Uhr", "Do. 2.7. 10:30 Uhr"
 *  The year is *absent* — we compute it by comparing against today and
 *  rolling over if the parsed month is earlier than the current month
 *  (a December→January boundary). */
function parseMreDate(text: string, currentYear: number): { date: string; time: string | null } | null {
  const m = text.match(/^[A-Z][a-z]{1,2}\.\s*(\d{1,2})\.(\d{1,2})\.?\s*(\d{1,2})(?::(\d{2}))?\s*(?:Uhr)?$/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const hour = parseInt(m[3], 10);
  const minute = m[4] ? parseInt(m[4], 10) : 0;

  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  // Year rollover: if the event month is earlier than the current month,
  // it's next year (e.g. current month = December, event = January).
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-indexed
  const year = month < currentMonth && month <= 6 ? currentYear + 1 : currentYear;

  const d = String(day).padStart(2, "0");
  const mo = String(month).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");

  return { date: `${year}-${mo}-${d}`, time: `${h}:${mi}` };
}

// ─── labels ─────────────────────────────────────────────────────────────

function buildLabels(title: string): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [
    { label: "museum:event", confidence: 0.95, classifier: "scraper-hardcoded" },
  ];
  const t = title.toLowerCase();
  if (t.includes("führung") || t.includes("rundgang")) {
    labels.push({ label: "museum:fuehrung", confidence: 0.8, classifier: "scraper-hardcoded" });
  } else if (t.includes("vortrag") || t.includes("gespräch") || t.includes("diskussion")) {
    labels.push({ label: "talk:lecture", confidence: 0.7, classifier: "scraper-hardcoded" });
  } else if (t.includes("workshop") || t.includes("farblabor") || t.includes("atelier")) {
    labels.push({ label: "museum:workshop", confidence: 0.7, classifier: "scraper-hardcoded" });
  } else if (t.includes("konzert") || t.includes("musik") || t.includes("jazz")) {
    labels.push({ label: "music:classical", confidence: 0.6, classifier: "scraper-hardcoded" });
  }
  return labels;
}
