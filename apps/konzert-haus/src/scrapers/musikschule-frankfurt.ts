import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

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
 * Date format: "Wochentag(,)? DD.MM.YY(YY), HH:MM Uhr" — weekday optional,
 * year may be 2- or 4-digit. We're permissive on both.
 *
 * The page is curated by hand and tends to stay on the previous season for
 * weeks after a new one starts; expect 0 events between season boundaries.
 * Fortbildungen (Lehrkräfte-only) are filtered out as not public concerts.
 */

const URL = "https://www.musikschule-frankfurt.de/index.php?article_id=130";
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";

const P_RE = /<p[^>]*>([\s\S]+?)<\/p>/g;
const STRONG_RE = /<strong[^>]*>([\s\S]+?)<\/strong>/g;
// "Di, 23.09.2025, 19:30 Uhr" / "Mo 15.09.25, 10:00 – 12:00 Uhr"
const DATE_RE =
  /(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)[a-zäöü]*\b[,.]?\s*)?(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s*(\d{1,2})[:.](\d{2})/;

export async function scrapeMusikschuleFrankfurt(): Promise<ScrapeResult> {
  const html = await fetchText(URL);
  const today = todayIso();
  const events: ScrapedEvent[] = [];
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

    // Title = the first <strong> AFTER the date-bearing one. The date is
    // typically in the page's first <strong>; the next is the event title.
    const strongs = [...block.matchAll(STRONG_RE)].map((s) => cleanInline(s[1])).filter(Boolean);
    // Drop any <strong> that matches the date itself.
    const titleCandidates = strongs.filter((s) => !DATE_RE.test(s));
    const title = titleCandidates[0]?.replace(/[<>]+$/, "").trim();
    if (!title) continue;
    // Skip teacher-training events ("Fortbildung …", "FoBi", "LeLoLai
    // Fortbildung") — not open to the public.
    if (/^Fortbildung\b|\bFoBi\b/i.test(title)) continue;

    // Description: subtitle from inline non-strong text right after title.
    // We approximate by stripping out all <strong> spans and using what
    // remains, minus the trailing venue lines (starting with ">").
    let body = block.replace(STRONG_RE, "");
    body = body.replace(/<a[^>]*>|<\/a>/g, "");
    let plain = cleanInline(body);
    // Drop the venue trailer (the part after the ">" marker).
    plain = plain.replace(/>\s*[\s\S]+$/, "").trim();
    const description = plain.length > 4 ? plain.slice(0, 400) : null;

    const slug = `musikschule-ffm-${slugify(title)}-${date}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    events.push({
      slug,
      title,
      description,
      date,
      time,
      end_time: null,
      genre: classify(title, null, description, "classical"),
      detail_url: URL,
      ticket_url: null,
    });
  }

  return { venue_slug: "musikschule-frankfurt", events };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`musikschule-frankfurt fetch failed: ${res.status}`);
  return res.text();
}

function cleanInline(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
