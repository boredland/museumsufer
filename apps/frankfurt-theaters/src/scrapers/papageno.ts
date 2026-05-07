import { todayIso } from "../date";
import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

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

export async function scrapePapageno(): Promise<ScrapeResult> {
  const res = await fetch(`${BASE}/`, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Papageno fetch failed: ${res.status}`);
  return parsePapagenoHtml(await res.text());
}

const DAY_RE =
  /<h3\s+class="sr-only">(\d{1,2})\.(\d{1,2})\.(\d{4})<\/h3>([\s\S]*?)(?=<h3\s+class="sr-only">\d|<\/main\b|<footer\b)/g;

const ARTICLE_RE = /<article\s+class="[^"]*\beventItem\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g;

export function parsePapagenoHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

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

      const slug = deriveSlug(detailUrl) || slugify(title);
      const dedup = `${slug}|${date}|${time ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      if (!showsBySlug.has(slug)) {
        showsBySlug.set(slug, {
          slug,
          title,
          subtitle: prettifyCategory(categoryLine),
          description: prettifyCategory(categoryLine),
          detail_url: normalizeUrl(detailUrl, BASE),
          image_url: null,
        });
      }

      performances.push({
        show_slug: slug,
        date,
        time,
        end_time: null,
        venue_room: null,
        provider_event_id: null,
        ticket_url: normalizeUrl(detailUrl, BASE),
        status: "available",
      });
    }
  }

  return {
    theater_slug: "papageno-musiktheater",
    shows: [...showsBySlug.values()],
    performances,
  };
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
