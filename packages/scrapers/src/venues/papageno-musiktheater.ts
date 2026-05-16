import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.papageno-theater.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Papageno's homepage IS the spielplan: per-day `<li>` blocks each
 * containing a screen-reader date heading (`<h3 class="sr-only">DD.MM.YYYY</h3>`)
 * and one or more `<article class="eventItem">` performances:
 *
 *   <h3 class="sr-only">08.05.2026</h3>
 *   <article class="eventItem">
 *     <p class="topline">19:30 Uhr</p>
 *     <p class="topline">abendprogramm · musikalische-komoedie</p>  <-- categories
 *     <h4><a href="https://papageno-theater.de/produktionen/<slug>">Title</a></h4>
 *   </article>
 */

const DAY_RE =
  /<h3\s+class="sr-only">(\d{1,2})\.(\d{1,2})\.(\d{4})<\/h3>([\s\S]*?)(?=<h3\s+class="sr-only">\d|<\/main\b|<footer\b)/g;
const ARTICLE_RE = /<article\s+class="[^"]*\beventItem\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g;

export async function scrapePapagenoMusiktheater(): Promise<VenueScrapeResult> {
  const res = await fetch(`${BASE}/`, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`papageno-musiktheater fetch failed: ${res.status}`);
  return parse(await res.text());
}

function parse(html: string): VenueScrapeResult {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const day of html.matchAll(DAY_RE)) {
    const date = `${day[3]}-${day[2].padStart(2, "0")}-${day[1].padStart(2, "0")}`;
    if (date < today) continue;
    const dayBlock = day[4];

    for (const a of dayBlock.matchAll(ARTICLE_RE)) {
      const block = a[1];
      const titleMatch = block.match(/<h4[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
      if (!titleMatch) continue;
      const detailUrl = decodeEntities(titleMatch[1]);
      const title = stripHtml(titleMatch[2]);
      if (!title) continue;

      const toplineMatches = [...block.matchAll(/<p\s+class="[^"]*\btopline\b[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/gi)]
        .map((m) => stripHtml(m[1]))
        .filter(Boolean);
      const timeRaw = toplineMatches.find((t) => /\d{1,2}[.:]\d{2}/.test(t));
      const timeMatch = timeRaw?.match(/(\d{1,2})[.:](\d{2})/);
      const time = timeMatch ? nullIfMidnight(`${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`) : null;
      const categoryLine = toplineMatches.find((t) => !/\d{1,2}[.:]\d{2}/.test(t)) ?? null;
      const subtitle = prettifyCategory(categoryLine);

      const slug = deriveSlug(detailUrl) || slugify(title);
      const dedup = `${slug}|${date}|${time ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      events.push({
        source_event_id: slug,
        title,
        subtitle,
        description: subtitle,
        date,
        time,
        detail_url: normalizeUrl(detailUrl, BASE),
        ticket_url: normalizeUrl(detailUrl, BASE),
        image_url: null,
        venue_room: null,
        raw_category: categoryLine,
        labels: resolveStageLabels({ title, subtitle, hint: categoryLine, confidence: 0.85 }),
      });
    }
  }

  return { source_slug: "papageno-musiktheater", events };
}

function deriveSlug(url: string): string | null {
  return url.match(/\/produktionen\/([a-z0-9-]+)/i)?.[1] ?? null;
}

/** "abendprogramm · musikalische-komoedie" → "Abendprogramm · Musikalische Komödie" */
function prettifyCategory(text: string | null): string | null {
  if (!text) return null;
  return text
    .split(/\s*·\s*/)
    .map((part) =>
      part
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/komoedie/i, "komödie"),
    )
    .join(" · ");
}
