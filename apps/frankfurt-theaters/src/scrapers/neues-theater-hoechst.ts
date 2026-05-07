import { todayIso } from "../date";
import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.neues-theater.de";
const SPIELPLAN_URL = `${BASE}/`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Neues Theater Höchst is a TYPO3 site whose homepage is the spielplan —
 * each `<div class="nth-boxshadow">…</div>` is one performance, wrapped in
 * an anchor that points at `/tickets/alle-veranstaltungen/<slug>-<id>`.
 *
 *   - `<span class="nth-list-day">Do</span>`            weekday (German short)
 *   - `<span class="nth-list-date">07.05.2026</span>`   DD.MM.YYYY
 *   - `<span class="nth-list-time">20:00&nbsp;Uhr</span>`
 *   - `<h1>TITLE</h1>`                                  shouty production title
 *   - `<h2>subtitle</h2>`                               quoted byline
 *   - `<img data-src="/fileadmin/.../csm_*.jpg">`       lazy-loaded image
 *   - `<p class="mb-1">…</p>`                           teaser blurb
 *
 * No public sold-out / cancellation marker and no inline prices, so every
 * row ships as `available` with null price.
 */

export async function scrapeNeuesTheaterHoechst(): Promise<ScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Neues Theater Höchst spielplan fetch failed: ${res.status}`);
  const html = await res.text();
  return parseNeuesTheaterHoechstHtml(html);
}

const BOX_RE = /<div\s+class="nth-boxshadow">([\s\S]*?)(?=<div\s+class="nth-boxshadow">|<\/main\b|<footer\b)/g;
const ANCHOR_RE = /<a\s+href="([^"]+)"/i;
const DATE_RE = /<span\s+class="nth-list-date[^"]*">\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*<\/span>/i;
const TIME_RE = /<span\s+class="nth-list-time[^"]*">\s*(\d{1,2}):(\d{2})/i;
const TITLE_RE = /<h1[^>]*class="text-secondary[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h1>/i;
const SUBTITLE_RE = /<h2[^>]*class="text-secondary[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h2>/i;
const IMG_RE = /<img[^>]+\bdata-src="([^"]+)"/i;
const TEASER_RE = /<div\s+class="nth-teaser-content[^"]*">([\s\S]*?)<\/div>/i;

export function parseNeuesTheaterHoechstHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const m of html.matchAll(BOX_RE)) {
    const block = m[1];
    const date = parseDate(block);
    const time = parseTime(block);
    if (!date || date < today) continue;

    const titleRaw = block.match(TITLE_RE)?.[1];
    if (!titleRaw) continue;
    const title = stripHtml(titleRaw);
    if (!title) continue;

    const subtitleRaw = block.match(SUBTITLE_RE)?.[1];
    const subtitle = subtitleRaw ? stripHtml(subtitleRaw).replace(/^[„"„""]+|[""""„"]+$/g, "") || null : null;

    const href = block.match(ANCHOR_RE)?.[1];
    const ticketUrl = href ? decodeEntities(href) : null;
    const detailUrl = ticketUrl;

    const slug = deriveSlug(ticketUrl, title);
    const dedup = `${slug}|${date}|${time ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const imgSrc = block.match(IMG_RE)?.[1];
    const imageUrl = imgSrc ? normalizeUrl(imgSrc, BASE) : null;

    const teaserHtml = block.match(TEASER_RE)?.[1];
    const description = teaserHtml ? truncateTeaser(teaserHtml) : null;

    if (!showsBySlug.has(slug)) {
      showsBySlug.set(slug, {
        slug,
        title,
        subtitle,
        description: description ?? subtitle,
        detail_url: detailUrl,
        image_url: imageUrl,
      });
    }

    performances.push({
      show_slug: slug,
      date,
      time,
      end_time: null,
      venue_room: null,
      provider_event_id: extractProviderEventId(ticketUrl),
      ticket_url: ticketUrl,
      status: ticketUrl ? "available" : "unknown",
    });
  }

  return {
    theater_slug: "neues-theater-hoechst",
    shows: [...showsBySlug.values()],
    performances,
  };
}

function parseDate(block: string): string | null {
  const m = block.match(DATE_RE);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parseTime(block: string): string | null {
  const m = block.match(TIME_RE);
  if (!m) return null;
  return nullIfMidnight(`${m[1].padStart(2, "0")}:${m[2]}`);
}

function deriveSlug(href: string | null | undefined, title: string): string {
  // /tickets/alle-veranstaltungen/<slug>-<id>
  const m = href?.match(/\/alle-veranstaltungen\/([a-z0-9-]+?)(?:-\d+)?\/?$/i);
  return m ? m[1] : slugify(title);
}

function extractProviderEventId(href: string | null | undefined): string | null {
  return href?.match(/-(\d+)\/?$/)?.[1] ?? null;
}

function truncateTeaser(html: string): string | null {
  const text = stripHtml(html).replace(/^[\s…]+|[\s…]+$/g, "");
  if (!text) return null;
  if (text.length <= 800) return text;
  const cut = text.slice(0, 800);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 0 ? space : 800)}…`;
}
