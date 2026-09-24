import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Von der Heydt-Museum, Wuppertal — exhibitions. The WordPress site keeps
 * them in an `exhibitions` post type tagged with an `ausstellungsstatus`
 * term (20 = Aktuell, 21 = Vorschau). The REST API carries no dates: each
 * exhibition page renders its run as a JetEngine dynamic field
 * ("21. März – 12. September 2027", "Bis Mai 2027"), so we read the list
 * from the API and the run from each page.
 *
 * The museum's events come through bergisch-live, which files the portal's
 * "Von der Heydt-Museum" listings under this slug.
 */
const BASE = "https://von-der-heydt-museum.de";
const LIST_URL = `${BASE}/wp-json/wp/v2/exhibitions?ausstellungsstatus=20,21&per_page=50&_fields=id,title,link`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
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

const FIELD_RE = /class="jet-listing-dynamic-field__content"\s*>([\s\S]*?)<\/div>/g;
const IMAGE_RE = /<img[^>]+src="(https:\/\/von-der-heydt-museum\.de\/wp-content\/uploads\/[^"]+)"/;
/** "[21.] [März] [2027] – [12.] September 2027", "–" or "bis" between. */
const RANGE_RE =
  /^(?:(\d{1,2})\.\s*)?([a-zäöü]+)?\s*(\d{4})?\s*(?:–|-|bis)\s*(?:(\d{1,2})\.\s*)?([a-zäöü]+)\s+(\d{4})/i;
/** "Bis [12.] [Mai] 2027" — already running. */
const UNTIL_RE = /^bis\s+(?:(\d{1,2})\.\s*)?(?:([a-zäöü]+)\s+)?(\d{4})/i;

interface WpExhibition {
  id: number;
  title: { rendered: string };
  link: string;
}

export async function scrapeVonDerHeydtMuseum(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`von-der-heydt-museum fetch failed: ${res.status}`);
  const list = (await res.json()) as WpExhibition[];

  const pages = await Promise.all(
    list.map(async (ex) => {
      const page = await fetch(ex.link, { headers: { "User-Agent": UA } });
      if (!page.ok) throw new Error(`von-der-heydt-museum ${ex.link}: ${page.status}`);
      return { ex, html: await page.text() };
    }),
  );

  const events: CanonicalScrapedEvent[] = [];
  for (const { ex, html } of pages) {
    const fields = [...html.matchAll(FIELD_RE)].map((m) => clean(m[1]));
    const range = fields.map((f) => parseRun(f, today)).find((r) => r !== null);
    if (!range || range.end < today) continue;
    const [subtitle, , intro] = fields;
    events.push({
      source_event_id: `exhibition|${ex.id}`,
      title: clean(ex.title.rendered),
      subtitle: subtitle && !parseRun(subtitle, today) ? subtitle : null,
      description: intro || null,
      date: range.start,
      end_date: range.end !== range.start ? range.end : null,
      detail_url: ex.link,
      image_url: html.match(IMAGE_RE)?.[1] ?? null,
      labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }
  return { source_slug: "von-der-heydt-museum", display_name: "Von der Heydt-Museum", events };
}

/** A run without a start day or month begins on its first; an end without
 *  them closes on the last. "Bis …" runs are open now, so they start today. */
function parseRun(text: string, today: string): { start: string; end: string } | null {
  const until = text.match(UNTIL_RE);
  if (until) return { start: today, end: endOf(Number(until[3]), month(until[2]), until[1]) };
  const m = text.match(RANGE_RE);
  if (!m) return null;
  const endYear = Number(m[6]);
  const endMonth = month(m[5]);
  if (!endMonth) return null;
  const startMonth = month(m[2]) ?? endMonth;
  const startYear = m[3] ? Number(m[3]) : startMonth > endMonth ? endYear - 1 : endYear;
  return { start: iso(startYear, startMonth, Number(m[1] ?? 1)), end: endOf(endYear, endMonth, m[4]) };
}

function endOf(year: number, monthNo: number | null, day: string | undefined): string {
  if (!monthNo) return iso(year, 12, 31);
  return iso(year, monthNo, day ? Number(day) : new Date(Date.UTC(year, monthNo, 0)).getUTCDate());
}

function month(name: string | undefined): number | null {
  return name ? (MONTHS[name.toLowerCase()] ?? null) : null;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s.replace(/<br\s*\/?>/gi, " ")))
    .replace(/\s+/g, " ")
    .trim();
}
