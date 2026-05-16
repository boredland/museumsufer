import { classifyMusic } from "@museumsufer/classify";
import { decodeEntities, GERMAN_MONTHS, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Naxos Hallenkonzerte — Frankfurt concert series at the Naxos-Halle
 * (Waldschmidtstraße, Ostend), genre-wise mostly contemporary classical /
 * experimental / improvisation. WordPress + Oxygen-builder home page renders
 * each upcoming event as:
 *
 *   <a class="ct-link future-event …" href="…/slug/">
 *     <span class="ct-span">Title</span>
 *     <h3>Sa13.Jun26</h3>          ← weekday + DD + MonthAbbr + YY
 *     <h3>20H00</h3>               ← HHHMM
 *     <h3>Chemie</h3><h3>Experimental</h3><h3>Fotografie</h3>  ← genre tags
 *   </a>
 *
 * Past events live in a separate `.slider-archiv` block which we skip via
 * the `future-event` class filter. The WP REST API has post bodies but no
 * event-date custom field, so the home-page card is the canonical source.
 */

const BASE = "https://naxoshallenkonzerte.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const COMPACT_DATE_RE = /(?:Mo|Di|Mi|Do|Fr|Sa|So)\s*(\d{1,2})\.\s*([A-Za-zäöü]{2,4})\s*(\d{2})/;
const COMPACT_TIME_RE = /(\d{1,2})H(\d{2})/;
const FUTURE_EVENT_RE =
  /<a[^>]*class="[^"]*future-event[^"]*"[^>]*href="(https?:\/\/naxoshallenkonzerte\.de\/[a-z0-9-]+\/?)"[^>]*>([\s\S]*?)<\/a>/g;
const TITLE_SPAN_RE = /<span[^>]*class="[^"]*ct-span[^"]*"[^>]*>([\s\S]*?)<\/span>/;
const H3_RE = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
const IMG_RE = /<img[^>]+(?:srcset|src)="([^"]+)"/;

const MONTH_ABBR: Record<string, number> = {
  jan: 1,
  feb: 2,
  mrz: 3,
  mar: 3,
  mär: 3,
  apr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  okt: 10,
  nov: 11,
  dez: 12,
};

export async function scrapeNaxos(): Promise<VenueScrapeResult> {
  const html = await fetchText(BASE);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(FUTURE_EVENT_RE)) {
    const detailUrl = m[1];
    const card = m[2];
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const titleRaw = card.match(TITLE_SPAN_RE)?.[1] ?? "";
    const title = clean(titleRaw);
    if (!title) continue;

    const h3s = [...card.matchAll(H3_RE)].map((h) => clean(h[1])).filter(Boolean);
    let date: string | null = null;
    let time: string | null = null;
    const tags: string[] = [];
    for (const h of h3s) {
      if (!date) {
        const dm = h.match(COMPACT_DATE_RE);
        if (dm) {
          const day = dm[1].padStart(2, "0");
          const month = parseMonth(dm[2]);
          if (!month) continue;
          const year = 2000 + parseInt(dm[3], 10);
          date = `${year}-${String(month).padStart(2, "0")}-${day}`;
          continue;
        }
      }
      if (date && !time) {
        const tm = h.match(COMPACT_TIME_RE);
        if (tm) {
          time = `${tm[1].padStart(2, "0")}:${tm[2]}`;
          continue;
        }
      }
      tags.push(h);
    }
    if (!date || date < today) continue;

    const imageUrl = card.match(IMG_RE)?.[1];
    const description = tags.length ? tags.join(" · ") : null;
    const slug = `naxos-${slugify(detailUrl.split("/").filter(Boolean).pop() || title)}`;
    const genre = classifyMusic(title, null, description, "experimental");

    events.push({
      source_event_id: slug,
      title,
      description,
      date,
      time,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: detailUrl,
      image_url: imageUrl ?? null,
      raw_category: tags.length ? tags.join(",") : null,
      labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "naxos-hallenkonzerte", events };
}

function parseMonth(s: string): number | null {
  const key = s.toLowerCase().replace(/[^a-zäöü]/g, "");
  return MONTH_ABBR[key] ?? GERMAN_MONTHS[key] ?? null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`naxos fetch failed: ${res.status} ${url}`);
  return res.text();
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
