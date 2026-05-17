import { classifyMusic } from "@museumsufer/classify";
import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Musikschule Frankfurt (Städtische Musikschule). Lists the season's concerts,
 * Fortbildungen, and Jamsessions on one TYPO3 page with an accordion grouped
 * by month. Each event is a single <p> like:
 *
 *   <p>
 *     <strong>Di, 23.09.2025, 19:30 Uhr<br></strong>
 *     <a href="files/...pdf">
 *       <strong>Musikschule in Concert<br></strong>
 *       Herbstimpressionen – Klassik am Abend
 *     </a><br>
 *     &gt; Zentralbibliothek, Foyer<br>
 *     Hasengasse 4, Innenstadt
 *   </p>
 *
 * Fortbildungen (Lehrkräfte-only) are dropped because they're not open to the
 * public — different category from a concert at a stage venue, so they don't
 * fit the canonical "keep, with label" rule.
 */

const URL = "https://www.musikschule-frankfurt.de/index.php?article_id=130";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const P_RE = /<p[^>]*>([\s\S]+?)<\/p>/g;
const STRONG_RE = /<strong[^>]*>([\s\S]+?)<\/strong>/g;
const DATE_RE =
  /(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)[a-zäöü]*\b[,.]?\s*)?(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s*(\d{1,2})[:.](\d{2})/;

export async function scrapeMusikschuleFrankfurt(): Promise<VenueScrapeResult> {
  const html = await fetchText(URL);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(P_RE)) {
    const block = m[1];
    const text = cleanInline(block);
    if (!text) continue;

    const dateMatch = text.match(DATE_RE);
    if (!dateMatch) continue;
    const [, dd, mm, yyRaw, hh, mi] = dateMatch;
    const year = yyRaw.length === 2 ? 2000 + parseInt(yyRaw, 10) : parseInt(yyRaw, 10);
    const date = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    if (date < today) continue;
    const time = `${hh.padStart(2, "0")}:${mi}`;

    const strongs = [...block.matchAll(STRONG_RE)].map((s) => cleanInline(s[1])).filter(Boolean);
    const titleCandidates = strongs.filter((s) => !DATE_RE.test(s));
    const title = titleCandidates[0]?.replace(/[<>]+$/, "").trim();
    if (!title) continue;
    if (/^Fortbildung\b|\bFoBi\b/i.test(title)) continue;

    let body = block.replace(STRONG_RE, "");
    body = body.replace(/<a[^>]*>|<\/a>/g, "");
    let plain = cleanInline(body);
    plain = plain.replace(/>\s*[\s\S]+$/, "").trim();
    const description = plain.length > 4 ? plain.slice(0, 400) : null;

    const slug = `musikschule-ffm-${slugify(title)}-${date}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const genre = classifyMusic(title, null, description, "classical");

    events.push({
      source_event_id: slug,
      title,
      description,
      date,
      time,
      end_time: null,
      detail_url: URL,
      ticket_url: null,
      image_url: null,
      labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "musikschule-frankfurt", display_name: "Städtische Musikschule Frankfurt", events };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`musikschule-frankfurt fetch failed: ${res.status}`);
  return res.text();
}

function cleanInline(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
