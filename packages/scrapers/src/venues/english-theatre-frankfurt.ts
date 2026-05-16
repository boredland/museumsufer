import { decodeEntities, normalizeUrl, nullIfMidnight, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://english-theatre.de";
const BUY_URL = `${BASE}/tickets/buy-online/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * The English Theatre's `/tickets/buy-online/` page is a single HTML table
 * where every row is one performance:
 *
 *   <tr class="<production-slug>">
 *     <td>DD.MM.YYYY</td>
 *     <td>HH:MM</td>
 *     <td>
 *       <a href="…eventim-inhouse…?event=<id>">TITLE</a>
 *       <p>byline.</p>
 *     </td>
 *   </tr>
 *
 * No sold-out indicator, no per-room data, no per-show prices on this page —
 * every row gets a flat play-tier range (31–43 € adult plays). Language is
 * hardcoded to `en` (the venue's defining trait).
 */

const ETF_PRICE_MIN = 31;
const ETF_PRICE_MAX = 43;

const ROW_RE =
  /<tr class="([a-z0-9-]+)">\s*<td>(\d{1,2})\.(\d{1,2})\.(\d{4})<\/td>\s*<td>(\d{1,2}):(\d{2})<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
const TITLE_LINK_RE = /<a\b[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i;
const BYLINE_RE = /<p>([\s\S]*?)<\/p>/i;

export async function scrapeEnglishTheatreFrankfurt(): Promise<VenueScrapeResult> {
  const res = await fetch(BUY_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "en-GB,en;q=0.9,de;q=0.8" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`english-theatre-frankfurt fetch failed: ${res.status}`);
  return parse(await res.text());
}

function parse(html: string): VenueScrapeResult {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ROW_RE)) {
    const [, slug, dd, mm, yyyy, hh, mi, payload] = m;
    const date = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    if (date < today) continue;

    const time = nullIfMidnight(`${hh.padStart(2, "0")}:${mi}`);

    const link = payload.match(TITLE_LINK_RE);
    if (!link) continue;
    const ticketUrl = decodeEntities(link[1]);
    const title = formatTitle(stripHtml(link[2]));
    const byline = payload.match(BYLINE_RE);
    const subtitle = byline ? stripHtml(byline[1]) : null;

    const eventimEventId = ticketUrl.match(/[?&](?:amp;)?event=(\d+)/)?.[1] ?? null;
    const sourceEventId = eventimEventId ?? `${slug}|${date}|${time ?? ""}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle,
      description: subtitle,
      date,
      time,
      detail_url: normalizeUrl(`/${slug}/`, BASE),
      ticket_url: ticketUrl,
      image_url: null,
      language: "en",
      price_min: ETF_PRICE_MIN,
      price_max: ETF_PRICE_MAX,
      venue_room: null,
      labels: resolveStageLabels({ title, subtitle, confidence: 0.85 }),
    });
  }

  return { source_slug: "english-theatre-frankfurt", events };
}

/**
 * The buy-online table renders titles in screaming uppercase
 * ("CHURCHILL IN MOSCOW"). Title-case it for editorial display, but keep
 * a few words uppercase ("NT Live", roman numerals).
 */
function formatTitle(t: string): string {
  if (!t) return t;
  if (t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(" ")
    .map((w) => {
      if (/^(?:in|on|of|the|and|or|to|a|an|for|with|by|at|from|de|von)$/i.test(w)) return w;
      if (/^[ivxlcdm]+$/i.test(w)) return w.toUpperCase();
      if (/^#?\d+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}
