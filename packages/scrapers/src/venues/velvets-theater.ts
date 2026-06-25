import { todayIso } from "@museumsufer/core/date";
import { decodeEntities } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://velvets-theater.de";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

/**
 * Velvets Theater Wiesbaden — black light, puppet, pantomime, family, revue.
 * The /programm/ page is a static HTML render containing structured `<h3>` tags:
 *   `<h3>Title</h3>`
 *   `<h3>Wochentag, DD.MM. YYYY, HH:MM Uhr</h3>`
 * followed shortly by a detail `<a href="...">`.
 */
export async function scrapeVelvetsTheater(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(`${BASE}/programm/`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`velvets-theater fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Match the block containing the two <h3> tags. We capture the title, the raw date/time string,
  // and the following HTML block up to the next <h3> or end of div, to safely extract the link.
  const blockRe = /<h3[^>]*>([^<]+)<\/h3>\s*<h3[^>]*>([^<]+Uhr[^<]*)<\/h3>([\s\S]*?)(?=<h3|<\/div>)/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(html)) !== null) {
    const rawTitle = match[1];
    const rawDateTime = decodeEntities(match[2].replace(/&nbsp;/g, " ").trim());
    const rest = match[3];

    const title = decodeEntities(rawTitle.trim());

    // Parse "Sonntag, 06.09. 2026, 18:00 Uhr" or "Freitag 25.09. 2026, 20:00 Uhr"
    const dtMatch = rawDateTime.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})[^\d]*(\d{1,2}:\d{2})/);
    if (!dtMatch) continue;

    const day = dtMatch[1].padStart(2, "0");
    const month = dtMatch[2].padStart(2, "0");
    const year = dtMatch[3];
    const time = dtMatch[4];
    const date = `${year}-${month}-${day}`;

    if (date < today) continue;

    const hrefMatch = rest.match(/href="([^"]+)"/);
    const detailUrl = hrefMatch ? (hrefMatch[1].startsWith("http") ? hrefMatch[1] : `${BASE}${hrefMatch[1]}`) : null;

    const dedupKey = `${title}|${date}|${time}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    events.push({
      source_event_id: dedupKey,
      title,
      description: null,
      date,
      time,
      detail_url: detailUrl,
      labels: buildLabels(title),
    });
  }

  return { source_slug: "velvets-theater", display_name: "Velvets Theater", events };
}

function buildLabels(title: string): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [
    { label: "stage:theater", confidence: 0.95, classifier: "scraper-hardcoded" },
  ];
  const t = title.toLowerCase();
  if (t.includes("revue") || t.includes("kabarett") || t.includes("comedy")) {
    labels.push({ label: "stage:comedy", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (t.includes("kinder") || t.includes("prinz") || t.includes("zauberflöte")) {
    labels.push({ label: "stage:junges-theater", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  return labels;
}
