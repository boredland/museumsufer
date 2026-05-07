import { todayIso } from "../date";
import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.internationales-theater.de";
const PROGRAMM_URL = `${BASE}/programm-ticketkauf`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Internationales Theater Frankfurt runs Joomla + VikEvents.
 * `/programm-ticketkauf` lists all upcoming performances as
 * `<div class="event_item ... event_id_<id> <month>-<year>"
 *  data-month="<de-short>" data-year="<YYYY>">`.
 *
 * Inside each item:
 *   - <a href="/programm-ticketkauf/<slug>" style="background-image: url('<image>')">
 *   - <div class="promotion_text">category (Konzert, Lesung, Cabaret, …)</div>
 *   - <h3><a class="event-title" href="/programm-ticketkauf/<slug>">TITLE</a></h3>
 *   - <h4 class="tagline">subtitle</h4>
 *   - <div class="event_date">
 *       <span class="event_date_tag">Wd, DD.</span>
 *       <span class="event_date_monat">Mai. 2026</span>
 *       <span class="event_date_jahr">/ HH:MM Uhr</span>
 *     </div>
 *   - <span class='hinweis_message'>Abgesagt</span> when cancelled
 */

const GERMAN_SHORT_MONTHS: Record<string, number> = {
  jan: 1,
  januar: 1,
  feb: 2,
  februar: 2,
  mar: 3,
  mär: 3,
  märz: 3,
  maerz: 3,
  apr: 4,
  april: 4,
  mai: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dez: 12,
  dezember: 12,
};

const ITEM_RE =
  /<div\s+class="event_item[^"]*event_id_(\d+)[^"]*"[^>]*\bdata-month="([^"]+)"\s+data-year="(\d{4})"[^>]*>([\s\S]*?)(?=<div\s+class="event_item|<\/main\b|<footer\b)/g;

export async function scrapeInternationalesTheater(): Promise<ScrapeResult> {
  const res = await fetch(PROGRAMM_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Internationales Theater fetch failed: ${res.status}`);
  return parseItfHtml(await res.text());
}

export function parseItfHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const m of html.matchAll(ITEM_RE)) {
    const eventId = m[1];
    const monthDe = m[2].toLowerCase().normalize("NFKD").replace(/̈/g, "");
    const month = GERMAN_SHORT_MONTHS[monthDe];
    const year = parseInt(m[3], 10);
    const block = m[4];
    if (!month) continue;

    // Day number — first 1-2 digit numeric token in event_date_tag
    const dayMatch = block.match(/<span\s+class="event_date_tag">[\s\S]*?(\d{1,2})\.\s*</);
    if (!dayMatch) continue;
    const day = parseInt(dayMatch[1], 10);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date < today) continue;

    const timeMatch = block.match(/<span\s+class="event_date_jahr">[\s\S]*?(\d{1,2}):(\d{2})/);
    const time = timeMatch ? nullIfMidnight(`${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`) : null;

    const titleAnchor = block.match(/<a\s+class="event-title"\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    if (!titleAnchor) continue;
    const detailHref = decodeEntities(titleAnchor[1]);
    const titleRaw = stripHtml(titleAnchor[2]);
    if (!titleRaw) continue;
    const title = formatTitle(titleRaw);

    const subtitle = stripHtml(block.match(/<h4\s+class="tagline">\s*([\s\S]*?)\s*<\/h4>/i)?.[1] ?? "") || null;
    const category =
      stripHtml(block.match(/<div\s+class="promotion_text">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "") || null;

    const thumbBg = block.match(
      /<div\s+class="thumb">[\s\S]*?<a[^>]+style="background-image:\s*url\(['"]([^'"]+)['"]\)/i,
    )?.[1];
    const image = thumbBg ? decodeEntities(thumbBg) : null;

    const isCancelled =
      /class=['"]hinweis_message['"][^>]*>\s*(?:Abgesagt|Entf[äa]llt)/i.test(block) || /event_stroke_class/.test(block);
    const status = isCancelled ? "cancelled" : "available";

    const slug = deriveSlug(detailHref) || slugify(title);
    const dedup = `${slug}|${date}|${time ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(slug)) {
      showsBySlug.set(slug, {
        slug,
        title,
        subtitle,
        description: subtitle ?? category,
        detail_url: normalizeUrl(detailHref, BASE),
        image_url: image ? normalizeUrl(image, BASE) : null,
      });
    }

    performances.push({
      show_slug: slug,
      date,
      time,
      end_time: null,
      venue_room: category,
      provider_event_id: eventId,
      ticket_url: normalizeUrl(detailHref, BASE),
      status,
    });
  }

  return {
    theater_slug: "internationales-theater",
    shows: [...showsBySlug.values()],
    performances,
  };
}

function deriveSlug(href: string): string | null {
  const m = href.match(/\/programm-ticketkauf\/([^/?#]+)/i);
  if (!m) return null;
  // Some have a leading id "1416-la-lune-cabaret"; strip the leading "<id>-" so two
  // entries for the same production share a slug.
  return m[1].replace(/^\d+-/, "");
}

/** ITF writes titles in screaming uppercase. Title-case them like the ETF parser. */
function formatTitle(t: string): string {
  if (!t || t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(" ")
    .map((w) => {
      if (/^(?:in|on|of|the|and|or|to|a|an|for|with|by|at|from|de|von|und|oder|aus|der|die|das)$/i.test(w)) return w;
      if (/^[ivxlcdm]+$/i.test(w)) return w.toUpperCase();
      if (/^#?\d+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}
