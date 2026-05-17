import { todayIso } from "@museumsufer/core/date";
import { fnv1a } from "@museumsufer/core/hash";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Frankfurter Sparkasse Engagement page — the bank's CSR programme mixes
 * Kunstausstellungen, Konzerte at the Alte Oper, and a monthly "Kleiner
 * Kultursalon" reading series at EASTGRAPE WeinEvents in the Ostend.
 *
 * Two title-block conventions on the same page: `<h2>` for top-level
 * events and `<span class="h2">` for the Kultursalon series. We pick up
 * both and filter to those containing a 'DD. Month YYYY' date.
 */
const BASE = "https://www.frankfurter-sparkasse.de";
const LIST_URL = `${BASE}/de/home/ihre-sparkasse/Engagement.html`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const TITLE_RE = /<(?:h2[^>]*|span\s+class="h2")>\s*([\s\S]*?)\s*<\/(?:h2|span)>/g;
const DATE_RE =
  /(\d{1,2})\.\s*(?:und\s*(\d{1,2})\.\s*)?(januar|februar|m[aä]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})/i;

const MONTHS_DE: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const KEYWORD_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /kunstausstellung|ausstellung/i, label: "museum:ausstellung" },
  { match: /public viewing|konzert|musikfest/i, label: "music:classical" },
  { match: /kultursalon|lesung|buchpräsentation/i, label: "talk:lesung" },
  { match: /vortrag|diskussion|forum/i, label: "talk:vortrag" },
];

export async function scrapeFrankfurterSparkasse(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`frankfurter-sparkasse fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(TITLE_RE)) {
    const raw = stripHtml(decodeEntities(m[1])).replace(/\s+/g, " ").trim();
    if (!raw) continue;

    const dateMatch = raw.match(DATE_RE);
    if (!dateMatch) continue;
    const month = MONTHS_DE[dateMatch[3].toLowerCase().normalize("NFC")];
    if (!month) continue;
    // For "30. und 31. Mai 2026" date ranges, use the END date so multi-day
    // exhibitions don't filter out the day after they open.
    const day = (dateMatch[2] ?? dateMatch[1]).padStart(2, "0");
    const date = `${dateMatch[4]}-${String(month).padStart(2, "0")}-${day}`;
    if (date < today) continue;

    const startDay = dateMatch[1].padStart(2, "0");
    const startDate = `${dateMatch[4]}-${String(month).padStart(2, "0")}-${startDay}`;
    const endDate = dateMatch[2] ? date : null;

    const sourceEventId = fnv1a(`sparkasse|${raw}`);
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const title = raw.replace(/\s*am\s+\d.*$/i, "").trim() || raw;

    events.push({
      source_event_id: sourceEventId,
      title,
      description: null,
      date: startDate,
      time: null,
      end_date: endDate,
      end_time: null,
      detail_url: LIST_URL,
      ticket_url: null,
      image_url: null,
      raw_category: null,
      labels: [labelFor(raw)],
    });
  }

  return { source_slug: "frankfurter-sparkasse", display_name: "Frankfurter Sparkasse Engagement", events };
}

function labelFor(title: string): ScrapedLabel {
  for (const { match, label } of KEYWORD_LABELS) {
    if (match.test(title)) return { label, confidence: 0.8, classifier: "keyword:event" };
  }
  return { label: "museum:event", confidence: 0.5, classifier: "scraper-hardcoded" };
}
