import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { Category, ScrapedEvent } from "../types";

/**
 * Forschungskolleg Humanwissenschaften (Bad Homburg) — Goethe-University
 * research institute hosting public lecture series, colloquia, and
 * conferences in the human sciences. Joomla CMS with a table-based events
 * listing (no API, no usable feed).
 *
 * Each <tr> row has:
 *   <td>DD.MM.YYYY<br>HH:MM Uhr</td>
 *   <td>
 *     <a href="/index.php/archive/events/NNNN?view=item">Title</a>
 *     Speaker(s)
 *     Type label (Vortrag, FKH Kolloquium, Vortragsreihe, …)
 *     <em>Series / organizer</em>
 *   </td>
 *
 * Past events are listed alongside upcoming ones; we filter by date.
 * Titles prefixed with "FÄLLT AUS!" are cancelled — also filtered.
 */

const BASE = "https://www.forschungskolleg-humanwissenschaften.de";
const LISTING_URL = `${BASE}/index.php/archive/events`;
const UA = "lehrhaus crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const ROW_RE = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
const DATE_RE = /(\d{2})\.(\d{2})\.(\d{4})\s*<br[^>]*>\s*(\d{1,2}):(\d{2})\s*Uhr/;
const LINK_RE = /<a[^>]+href="(\/index\.php\/archive\/events\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/;
const ROW_DIVS_RE = /<div[^>]*>([\s\S]*?)<\/div>/g;
const ORG_RE = /<em[^>]*>([\s\S]*?)<\/em>/;

export async function scrapeForschungskollegHumanwissenschaften(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml(LISTING_URL);
  const today = todayIso();
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ROW_RE)) {
    const row = m[1];
    const dateMatch = row.match(DATE_RE);
    if (!dateMatch) continue;
    const [, dd, mm, yyyy, hh, mi] = dateMatch;
    const date = `${yyyy}-${mm}-${dd}`;
    if (date < today) continue;

    const linkMatch = row.match(LINK_RE);
    if (!linkMatch) continue;
    const detailUrl = `${BASE}${linkMatch[1]}`;
    const titleRaw = cleanText(linkMatch[2]);
    if (!titleRaw) continue;
    // Skip cancelled events ("FÄLLT AUS!" prefix).
    if (/^FÄLLT AUS!?/i.test(titleRaw)) continue;
    const title = stripQuotes(titleRaw);
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    // The row has several <div>s — the first wraps the title link, the rest
    // are speaker / type / series. Skip any div that contains the title text
    // (which we already render as `title`).
    const titleStripped = stripQuotes(title);
    const divs = [...row.matchAll(ROW_DIVS_RE)].map((d) => cleanText(d[1])).filter(Boolean);
    const descParts = divs
      .filter((s) => !stripQuotes(s).includes(titleStripped))
      // Drop the "DD.MM.YYYY HH:MM Uhr" cell — we already render that separately.
      .filter((s) => !/^\d{1,2}\.\d{1,2}\.\d{4}\b/.test(s));
    const organizer = cleanText(row.match(ORG_RE)?.[1] ?? "");
    if (organizer && !descParts.some((p) => p.includes(organizer))) descParts.push(organizer);
    const description = descParts.join(" — ").slice(0, 600) || null;

    events.push({
      title,
      date,
      time: `${hh.padStart(2, "0")}:${mi}`,
      detail_url: detailUrl,
      description,
      category: classify(descParts, title),
      language: detectEnglish(title, description) ? "en" : null,
    });
  }

  return events;
}

function classify(parts: string[], title: string): Category {
  const haystack = `${parts.join(" ")} ${title}`.toLowerCase();
  if (/diskussion|podium|debatte|streitgespräch|gespräch/.test(haystack)) return "Diskussion";
  if (/lesung|buchpräsentation|buchvorstellung/.test(haystack)) return "Lesung";
  return "Vortrag";
}

function detectEnglish(title: string, _description: string | null): boolean {
  // FKH events are mixed DE/EN. The title is the most reliable signal —
  // descriptions often quote the English title within a German wrapper.
  // Require: no German function words AND multiple English function words.
  const t = title.toLowerCase();
  if (/[äöüß]/.test(t)) return false;
  // Common German function words / articles. If any of these appear,
  // assume German even with English keywords mixed in.
  if (/\b(der|die|das|den|dem|eine?|und|oder|nicht|von|zu|im|am|ist|wie|als|für|bei|mit|aus|über|durch)\b/.test(t)) {
    return false;
  }
  return /\b(the|of|and|on|to|in|is|with|how|why)\b.+\b(the|of|and|on|to|in|is|with)\b/.test(t);
}

function stripQuotes(s: string): string {
  return s.replace(/^[»„"„“‚'](.*)[«"”“’']$/, "$1").trim();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`forschungskolleg-humanwissenschaften fetch failed: ${res.status}`);
  return res.text();
}

function cleanText(s: string): string {
  return stripHtml(s).replace(/\s+/g, " ").trim();
}
