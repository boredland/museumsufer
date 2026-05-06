import { todayIso } from "../date";
import { decodeEntities, normalizeUrl, nullIfMidnight, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

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
 *       <a href="https://english-theatre.eventim-inhouse.de/.../?event=<id>">TITLE</a>
 *       <p>A short byline.</p>
 *     </td>
 *   </tr>
 *
 * That's the whole programme. No sold-out indicator, no per-room data
 * (single house), no per-show prices on this page — every row gets a flat
 * play-tier range (31–43 € adult plays) since musical productions aren't
 * scheduled in the current season.
 */

const ETF_PRICE_MIN = 31;
const ETF_PRICE_MAX = 43;

export async function scrapeEnglishTheatre(): Promise<ScrapeResult> {
  const res = await fetch(BUY_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "en-GB,en;q=0.9,de;q=0.8" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`English Theatre buy-online fetch failed: ${res.status}`);
  const html = await res.text();
  return parseEnglishTheatreHtml(html);
}

const ROW_RE =
  /<tr class="([a-z0-9-]+)">\s*<td>(\d{1,2})\.(\d{1,2})\.(\d{4})<\/td>\s*<td>(\d{1,2}):(\d{2})<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
const TITLE_LINK_RE = /<a\b[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i;
const BYLINE_RE = /<p>([\s\S]*?)<\/p>/i;

export function parseEnglishTheatreHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

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
    const detailUrl = normalizeUrl(`/${slug}/`, BASE);

    const dedup = `${slug}|${date}|${time}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(slug)) {
      showsBySlug.set(slug, {
        slug,
        title,
        subtitle,
        description: subtitle,
        detail_url: detailUrl,
        image_url: null,
        language: "en",
      });
    }

    performances.push({
      show_slug: slug,
      date,
      time,
      end_time: null,
      venue_room: null,
      provider_event_id: eventimEventId,
      ticket_url: ticketUrl,
      status: "available",
      price_min: ETF_PRICE_MIN,
      price_max: ETF_PRICE_MAX,
    });
  }

  return {
    theater_slug: "english-theatre-frankfurt",
    shows: [...showsBySlug.values()],
    performances,
  };
}

/**
 * The buy-online table renders titles in screaming uppercase
 * ("CHURCHILL IN MOSCOW"). Title-case it for editorial display, but keep
 * a few words uppercase as written ("NT Live", roman numerals).
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
