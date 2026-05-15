import { decodeEntities, GERMAN_MONTHS, slugify, stripHtml, todayIso } from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

/**
 * Waggong e.V. — Kulturwerkstatt Germaniastraße. Hosts amateur and youth
 * ensembles (Big Band, Jazz Ladies, Djembe-Ensemble, …) plus Werkstattkonzerte
 * at the Brotfabrik. Low volume: typically 2–4 announced concerts at a time.
 *
 * Structure: WordPress + TablePress. Each event is one <tr> with two cells —
 * column-1 carries Title (in <strong>), image, and date+time; column-2 is the
 * description. Date appears as either "DD.MM.YYYY" or "D. MonthName YYYY".
 */

const URL = "https://waggong.de/konzerte-events/";
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";

const ROW_RE = /<tr[^>]*class="[^"]*row-\d+[^"]*"[^>]*>([\s\S]+?)<\/tr>/g;
const COL1_RE = /<td[^>]*class="[^"]*column-1[^"]*"[^>]*>([\s\S]+?)<\/td>/;
const COL2_RE = /<td[^>]*class="[^"]*column-2[^"]*"[^>]*>([\s\S]+?)<\/td>/;
const TITLE_RE = /<strong[^>]*>([\s\S]+?)<\/strong>/;
const IMG_RE = /<img[^>]+src="([^"]+)"/;

const DATE_NUMERIC_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const DATE_WRITTEN_RE = /(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/;
const TIME_RE = /(?:ab\s+)?(\d{1,2})[:.](\d{2})|ab\s+(\d{1,2})\s*Uhr/i;

export async function scrapeWaggong(): Promise<ScrapeResult> {
  const html = await fetchText(URL);
  const today = todayIso();
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const rowMatch of html.matchAll(ROW_RE)) {
    const row = rowMatch[1];
    const col1 = row.match(COL1_RE)?.[1];
    if (!col1) continue;

    const title = clean(col1.match(TITLE_RE)?.[1] ?? "");
    if (!title) continue;

    const col1Text = clean(col1);
    const date = parseDate(col1Text);
    if (!date) continue;
    if (date < today) continue;

    const time = parseTime(col1Text);
    const description = clean(row.match(COL2_RE)?.[1] ?? "").slice(0, 500) || null;
    const image = col1.match(IMG_RE)?.[1];

    const slug = `waggong-${slugify(title)}-${date}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    events.push({
      slug,
      title,
      description,
      date,
      time,
      end_time: null,
      genre: classify(title, null, description, "jazz"),
      image_url: image ?? null,
      detail_url: URL,
      ticket_url: null,
    });
  }

  return { venue_slug: "waggong", events };
}

function parseDate(text: string): string | null {
  const numeric = text.match(DATE_NUMERIC_RE);
  if (numeric) {
    const [, dd, mm, yyyy] = numeric;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const written = text.match(DATE_WRITTEN_RE);
  if (written) {
    const day = parseInt(written[1], 10);
    const month = GERMAN_MONTHS[written[2].toLowerCase()];
    if (!month) return null;
    const year = parseInt(written[3], 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function parseTime(text: string): string | null {
  const m = text.match(TIME_RE);
  if (!m) return null;
  if (m[1] && m[2]) return `${m[1].padStart(2, "0")}:${m[2]}`;
  if (m[3]) return `${m[3].padStart(2, "0")}:00`;
  return null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`waggong fetch failed: ${res.status}`);
  return res.text();
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
