import { decodeEntities, normalizeUrl, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Klabauter Theater — inclusive ensemble (actors with learning disabilities)
 * of Stiftung Das Rauhe Haus in Hamburg-Horn. The WordPress site (and its
 * `/spielplan/`, now 404) was replaced by a Wix site whose `/tickets` page is
 * the programme. Wix renders no list markup: each performance is a run of
 * `<h2>`s in document order — `FR, 20.11.2026`, `18.00 Uhr`, `Reihe<br>Titel` —
 * followed by an INFOS link (own site) and a TICKETS link (Reservix). Month
 * and year `<h2>`s between them structure the page and carry no performance;
 * announced-but-undated productions appear as a bare month plus "INFOS FOLGEN".
 * The apex domain redirects to `www.`.
 */
const SPIELPLAN_URL = "https://www.klabauter-theater.de/tickets";
const BASE = "https://www.klabauter-theater.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const H2_RE = /<h2\b[^>]*>([\s\S]*?)<\/h2>/g;
const DATE_RE = /^(?:[A-Za-zäöüÄÖÜ]+,\s*)?(\d{2})\.(\d{2})\.(\d{4})$/;
const TIME_RE = /^((?:\d{1,2}[.:]\d{2}\s*(?:,|&|und)?\s*)+)\s*Uhr$/i;
const MONTH_RE = /^(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)$/i;

interface Pending {
  date: string;
  times: string[];
  lines: string[];
  links: string[];
}

export async function scrapeKlabauterTheater(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`klabauter-theater fetch failed: ${res.status}`);
  const html = await res.text();
  const today = todayIso();

  const headings = [...html.matchAll(H2_RE)];
  // The month headings are the page skeleton; without them the layout changed and an empty list would hide that.
  if (!headings.some((h) => MONTH_RE.test(headingLines(h[1]).join(" ")))) {
    throw new Error("klabauter-theater: no month headings on /tickets");
  }

  const shows: Pending[] = [];
  let current: Pending | null = null;
  headings.forEach((h, i) => {
    const lines = headingLines(h[1]);
    const text = lines.join(" ");
    const date = text.match(DATE_RE);
    if (date) {
      current = { date: `${date[3]}-${date[2]}-${date[1]}`, times: [], lines: [], links: [] };
      shows.push(current);
    } else if (current) {
      const time = text.match(TIME_RE);
      if (time && current.times.length === 0) {
        current.times = [...time[1].matchAll(/(\d{1,2})[.:](\d{2})/g)].map((t) => `${t[1].padStart(2, "0")}:${t[2]}`);
      } else if (current.lines.length === 0 && !MONTH_RE.test(text) && !/^\d{4}$/.test(text)) {
        current.lines = lines;
      }
    }
    if (current) {
      const end = headings[i + 1]?.index ?? html.length;
      const between = html.slice(h.index + h[0].length, end);
      current.links.push(...[...between.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => decodeEntities(m[1])));
    }
  });

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  for (const show of shows) {
    if (show.date < today || show.lines.length === 0) continue;
    // "Reihe<br>Titel": the first line is the series the production belongs to.
    const series = show.lines.length > 1 ? show.lines[0] : null;
    const title = titleCase(show.lines.slice(series ? 1 : 0).join(" "));
    if (!title) continue;

    const detailLink = show.links.find((l) => l.includes("klabauter-theater.de"));
    const ticketLink = show.links.find((l) => /reservix|eventim|ticket/i.test(l) && !l.includes("klabauter-theater.de"));
    const detailUrl = detailLink ? normalizeUrl(detailLink.replace(/^http:/, "https:"), BASE) : SPIELPLAN_URL;

    for (const time of show.times.length ? show.times : [null]) {
      const sourceEventId = `${show.date}|${time ?? ""}|${title}`;
      if (seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);
      events.push({
        source_event_id: sourceEventId,
        title,
        subtitle: series,
        description: null,
        date: show.date,
        time,
        detail_url: detailUrl,
        ticket_url: ticketLink ?? detailUrl,
        image_url: null,
        price_min: null,
        price_max: null,
        performers: null,
        venue_room: null,
        raw_category: series,
        labels: resolveStageLabels({
          title,
          subtitle: series,
          // The inclusive ensemble's listing mixes Theaterstücke, szenische
          // Lesungen and Workshops; the "Theater" anchor guarantees a
          // stage label so the row survives the theater derive's filter.
          hint: "Theater inklusives Ensemble",
          defaultLabel: "stage:theater",
          confidence: 0.85,
          classifier: "scraper-hardcoded",
        }),
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
  return { source_slug: "klabauter-theater", display_name: "Klabauter Theater", events };
}

/** Heading HTML → text lines; `<br>` is the only line separator Wix emits inside one heading. */
function headingLines(inner: string): string[] {
  return decodeEntities(inner.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((l) => l.replace(/[\s\u200b]+/g, " ").trim())
    .filter(Boolean);
}

/** The Wix headings are set in capitals; keep mixed-case titles ("Dustfall") untouched. */
function titleCase(s: string): string {
  if (!s || s !== s.toUpperCase() || s === s.toLowerCase()) return s;
  return s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
}
