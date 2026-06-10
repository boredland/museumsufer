import { classifyMusic } from "@museumsufer/classify";
import { decodeEntities, GERMAN_MONTHS, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Naxos Hallenkonzerte — Frankfurt concert series at the Naxos-Halle
 * (Waldschmidtstraße, Ostend), genre-wise mostly contemporary classical /
 * experimental / improvisation.
 *
 * The series moved from naxoshallenkonzerte.de (now a 301 redirect) to the
 * merged Produktionshaus NAXOS site at produktionshausnaxos.de. The
 * Hallenkonzerte landing page is:
 *   https://produktionshausnaxos.de/gruppen/naxos-hallenkonzerte/
 *
 * The site is WordPress + Oxygen-builder. Each concert card is an Oxygen
 * <a href="…/{lang}/event/{slug}/"> block containing title (ct-span) and
 * h3 elements for date / time / genre tags. The date format is compact
 * "Sa13.Jun26" style; time is "20H00" or "20:00 Uhr".
 *
 * Note: the old naxoshallenkonzerte.de site marked upcoming concerts with a
 * `future-event` CSS class; the merged produktionshausnaxos.de site does NOT
 * use that class. Event links are now identified by the /event/ path segment
 * in the href. Past events are filtered out by the date >= today check.
 */

const BASE = "https://produktionshausnaxos.de";
const SPIELPLAN_URL = `${BASE}/gruppen/naxos-hallenkonzerte/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

// Compact date on event cards: "Sa13.Jun26" (old and new site style)
const COMPACT_DATE_RE = /(?:Mo|Di|Mi|Do|Fr|Sa|So)\s*(\d{1,2})\.\s*([A-Za-zäöü]{2,4})\s*(\d{2})/;
// Full German date as fallback: "13. Juni 2026" or "13.06.2026"
const FULL_DATE_RE =
  /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i;
const NUMERIC_DATE_RE = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/;
const COMPACT_TIME_RE = /(\d{1,2})H(\d{2})/;
const COLON_TIME_RE = /\b(\d{1,2})[.:](\d{2})\s*Uhr\b/i;
// Event card: any <a> whose href points to an event detail page.
// Accepts both absolute (https://produktionshausnaxos.de/…/event/…) and
// root-relative (/de/event/…) hrefs; past events are excluded via the
// date >= today check below rather than by CSS class.
const FUTURE_EVENT_RE =
  /<a[^>]+href="((?:https?:\/\/produktionshausnaxos\.de)?\/[^"]*\/event\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
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
  const html = await fetchText(SPIELPLAN_URL);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(FUTURE_EVENT_RE)) {
    const rawUrl = m[1];
    const detailUrl = rawUrl.startsWith("http") ? rawUrl : `${BASE}${rawUrl}`;
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
        // Compact format: "Sa13.Jun26"
        const dm = h.match(COMPACT_DATE_RE);
        if (dm) {
          const day = dm[1].padStart(2, "0");
          const month = parseMonth(dm[2]);
          if (!month) continue;
          const year = 2000 + parseInt(dm[3], 10);
          date = `${year}-${String(month).padStart(2, "0")}-${day}`;
          continue;
        }
        // Full German date: "13. Juni 2026"
        const fd = h.match(FULL_DATE_RE);
        if (fd) {
          const day = fd[1].padStart(2, "0");
          const month = parseMonth(fd[2]);
          if (month) {
            date = `${fd[3]}-${String(month).padStart(2, "0")}-${day}`;
            continue;
          }
        }
        // Numeric date: "13.06.2026"
        const nd = h.match(NUMERIC_DATE_RE);
        if (nd) {
          date = `${nd[3]}-${nd[2].padStart(2, "0")}-${nd[1].padStart(2, "0")}`;
          continue;
        }
      }
      if (!time) {
        // Compact time: "20H00"
        const tm = h.match(COMPACT_TIME_RE);
        if (tm) {
          time = `${tm[1].padStart(2, "0")}:${tm[2]}`;
          continue;
        }
        // Colon time: "20:00 Uhr" / "20.00 Uhr"
        const ct = h.match(COLON_TIME_RE);
        if (ct) {
          time = `${ct[1].padStart(2, "0")}:${ct[2]}`;
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

  return { source_slug: "naxos-hallenkonzerte", display_name: "Naxos Hallenkonzerte", events };
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
