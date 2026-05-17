import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.neues-theater.de";
const SPIELPLAN_URL = `${BASE}/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Neues Theater Höchst is a TYPO3 site whose homepage is the spielplan —
 * each `<div class="nth-boxshadow">…</div>` is one performance, wrapped in
 * an anchor pointing at `/tickets/alle-veranstaltungen/<slug>-<id>`.
 *
 * No public sold-out / cancellation marker, no inline prices.
 */

const BOX_RE = /<div\s+class="nth-boxshadow">([\s\S]*?)(?=<div\s+class="nth-boxshadow">|<\/main\b|<footer\b)/g;
const ANCHOR_RE = /<a\s+href="([^"]+)"/i;
const DATE_RE = /<span\s+class="nth-list-date[^"]*">\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*<\/span>/i;
const TIME_RE = /<span\s+class="nth-list-time[^"]*">\s*(\d{1,2}):(\d{2})/i;
const TITLE_RE = /<h1[^>]*class="text-secondary[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h1>/i;
const SUBTITLE_RE = /<h2[^>]*class="text-secondary[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h2>/i;
const IMG_RE = /<img[^>]+\bdata-src="([^"]+)"/i;
const TEASER_RE = /<div\s+class="nth-teaser-content[^"]*">([\s\S]*?)<\/div>/i;

export async function scrapeNeuesTheaterHoechst(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`neues-theater-hoechst fetch failed: ${res.status}`);
  return parse(await res.text());
}

function parse(html: string): VenueScrapeResult {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(BOX_RE)) {
    const block = m[1];
    const dateMatch = block.match(DATE_RE);
    if (!dateMatch) continue;
    const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
    if (date < today) continue;
    const timeMatch = block.match(TIME_RE);
    const time = timeMatch ? nullIfMidnight(`${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`) : null;

    const titleRaw = block.match(TITLE_RE)?.[1];
    if (!titleRaw) continue;
    const title = stripHtml(titleRaw);
    if (!title) continue;

    const subtitleRaw = block.match(SUBTITLE_RE)?.[1];
    const subtitle = subtitleRaw ? stripHtml(subtitleRaw).replace(/^[„"„""]+|[""""„"]+$/g, "") || null : null;

    const href = block.match(ANCHOR_RE)?.[1];
    const ticketUrl = href ? decodeEntities(href) : null;

    const slug = deriveSlug(ticketUrl, title);
    const sourceEventId = `${slug}|${date}|${time ?? ""}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const imgSrc = block.match(IMG_RE)?.[1];
    const imageUrl = imgSrc ? normalizeUrl(imgSrc, BASE) : null;

    const teaserHtml = block.match(TEASER_RE)?.[1];
    const description = teaserHtml ? truncateTeaser(teaserHtml) : null;

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle,
      description: description ?? subtitle,
      date,
      time,
      detail_url: ticketUrl,
      ticket_url: ticketUrl,
      image_url: imageUrl,
      venue_room: null,
      labels: resolveStageLabels({ title, subtitle, confidence: 0.85 }),
    });
  }

  return { source_slug: "neues-theater-hoechst", display_name: "Neues Theater Höchst", events };
}

function deriveSlug(href: string | null | undefined, title: string): string {
  const m = href?.match(/\/alle-veranstaltungen\/([a-z0-9-]+?)(?:-\d+)?\/?$/i);
  return m ? m[1] : slugify(title);
}

function truncateTeaser(html: string): string | null {
  const text = stripHtml(html).replace(/^[\s…]+|[\s…]+$/g, "");
  if (!text) return null;
  if (text.length <= 800) return text;
  const cut = text.slice(0, 800);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 0 ? space : 800)}…`;
}
