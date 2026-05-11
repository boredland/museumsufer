import { dateOffset, slugify, stripHtml, todayIso } from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

const BASE = "https://www.badhomburger-schlosskonzerte.de";
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";

/**
 * The site is a Jimdo-hosted static page (not a Vue SPA as initially suspected).
 * Its WordPress REST endpoint is locked (`wp-json/` returns 403) and the ztix
 * ticketing calendar at api.ztix-technik.de/public/organizers/400/calendars/101/
 * is empty between seasons (it only carries individual concert show-IDs once
 * pre-sale opens, around mid-June for the following season).
 *
 * The actual season schedule lives as a plaintext listing on the public season
 * landing page (`/konzerte-25-26/`) in the form:
 *
 *   DD.MM.YYYY: <category / number> [optional "subtitle"] <performers…>
 *   DD.MM.YYYY: <category / number> …
 *
 * The page is updated to preview the *following* season once the current one
 * winds down (so during May 2026 the page shows the preliminary 2026/27 dates).
 * We probe the known season slugs, fall through to whichever is reachable,
 * and parse the date-prefixed list.
 *
 * Venue room is set to "Schlosskirche" — every concert in the series uses the
 * castle chapel at Bad Homburg Castle (confirmed across all 2025/26 subpages).
 * Times, prices, ticket URLs and images are not published in the preview; they
 * appear on the per-concert detail pages once pre-sale opens in June.
 */

const SEASON_PATHS = ["/konzerte-25-26/", "/konzerte-26-27/", "/konzerte-27-28/"];
const HORIZON_DAYS = 300;
const THROTTLE_MS = 200;
const VENUE_ROOM = "Schlosskirche";

const DATE_PREFIX_RE = /\b(\d{1,2})\.(\d{1,2})\.(20\d{2}):/g;
const MONTH_LABEL_RE =
  /^(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(?:\s|$)/i;
const HEAD_RE =
  /^(?:\d+\s*\.\s*)?(?:Orchesterkonzert|Kammerkonzert|Meisterpianisten\s+[IVX]+|Weihnachtskonzert|Vortrag|Festival[^\s"„]*|Konzert)(?:\s*\([^)]+\))?/i;
const LEADING_QUOTE_RE = /^[\s,:.-]*[„"“]([^"“”„]+)[“”"]/;

export async function scrapeBadHomburgSchloss(): Promise<ScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(HORIZON_DAYS);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const path of SEASON_PATHS) {
    const html = await fetchSeason(path);
    if (!html) {
      await sleep(THROTTLE_MS);
      continue;
    }
    const detailUrl = `${BASE}${path}`;
    for (const e of parseSeasonListing(html, detailUrl)) {
      if (e.date < today || e.date > horizon) continue;
      const dedup = `${e.date}|${e.title}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      events.push(e);
    }
    await sleep(THROTTLE_MS);
  }

  return { venue_slug: "bad-homburger-schlosskonzerte", events };
}

async function fetchSeason(path: string): Promise<string | null> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`bad-homburg-schloss fetch failed: ${path} → ${res.status}`);
  return res.text();
}

export function parseSeasonListing(html: string, detailUrl: string): ScrapedEvent[] {
  const text = htmlToText(html);
  const matches = [...text.matchAll(DATE_PREFIX_RE)];
  if (matches.length === 0) return [];

  const out: ScrapedEvent[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3];
    const date = `${year}-${month}-${day}`;

    const segStart = m.index! + m[0].length;
    const segEnd = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const raw = stripMonthLabelTail(text.slice(segStart, segEnd)).trim();
    if (!raw) continue;

    const { title, subtitle, performers } = splitSegment(raw);
    if (!title) continue;

    const genre = classify(title, subtitle, null, "classical");
    const slug = `${date}-${slugify(title)}`;

    out.push({
      slug,
      title,
      subtitle: subtitle || null,
      description: null,
      date,
      time: null,
      end_time: null,
      genre,
      image_url: null,
      detail_url: detailUrl,
      ticket_url: null,
      price_min: null,
      price_max: null,
      venue_room: VENUE_ROOM,
      performers: performers || null,
    });
  }
  return out;
}

function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  return stripHtml(stripped);
}

/**
 * Trailing month-name dividers ("November", "Dezember", "Mai") segment the
 * monthly groups in the source listing and would otherwise leak into the
 * performers field of the preceding entry.
 */
function stripMonthLabelTail(segment: string): string {
  const trimmed = segment.trim();
  const tokens = trimmed.split(/\s+/);
  while (tokens.length > 0 && MONTH_LABEL_RE.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/**
 * Splits a segment like `Orchesterkonzert "Sound of Classics" Niels Kaiser …`
 * or `1. Kammerkonzert Verquer (Querflötenquartett)` into title / subtitle /
 * performers.
 *
 * Title: the leading event-type heading. Recognised heads cover every entry
 * type in the 2025/26 and 2026/27 previews; an unknown shape falls back to
 * treating the whole segment as the title.
 *
 * Subtitle: a quoted phrase immediately following the head, if present.
 *
 * Performers: whatever remains after head + optional quoted subtitle.
 */
function splitSegment(seg: string): { title: string; subtitle: string | null; performers: string | null } {
  const cleaned = seg.replace(/\s+/g, " ").trim();

  const headMatch = cleaned.match(HEAD_RE);
  if (!headMatch) {
    return { title: cleaned, subtitle: null, performers: null };
  }

  const titleText = headMatch[0].replace(/(\d+)\s+\.\s*/g, "$1. ").trim();
  const tail = cleaned.slice(headMatch[0].length).trim();

  const quoteMatch = tail.match(LEADING_QUOTE_RE);
  if (!quoteMatch) {
    return { title: titleText, subtitle: null, performers: tail || null };
  }

  return {
    title: titleText,
    subtitle: quoteMatch[1].trim() || null,
    performers: tail.slice(quoteMatch[0].length).trim() || null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
