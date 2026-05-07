import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.theaterhaus-frankfurt.de";
const SPIELPLAN_URL = `${BASE}/spielplan/`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Theaterhaus Frankfurt (TYPO3 + calendarize) renders /spielplan/ as a
 * grid of `<div id="index-<id>">` blocks per performance.
 *
 *   - Date+time in `<div class="date_time">`: "Donnerstag, 7.5.2026, 11:00 Uhr"
 *   - Theatre group in `<h4 class="headline-theatergruppen">`
 *     (Theaterhaus hosts ensembles like TheaterGrueneSosse, Figurentheater
 *     Eigentlich, Theaterhaus Ensemble — kept in `subtitle`)
 *   - Title in `<h3 class="title">`
 *   - Image at /fileadmin/_processed_/.../csm_*.jpg
 *   - Age recommendation in `<a class="badge altersgruppen">ab 5</a>`
 *   - Venue room in `<a class="news-list-category">Löwenhof</a>`
 *   - Sold-out indicator in `<div class="status">Ausverkauft</div>`
 */

const ITEM_RE =
  /<div\s+id="index-\d+"\s+class="row[^"]*"[^>]*>([\s\S]*?)(?=<div\s+id="index-\d+"|<\/main\b|<footer\b)/g;

export async function scrapeTheaterhaus(): Promise<ScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Theaterhaus fetch failed: ${res.status}`);
  return parseTheaterhausHtml(await res.text());
}

export function parseTheaterhausHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const m of html.matchAll(ITEM_RE)) {
    const block = m[1];
    const datePlain = stripHtml(block.match(/<div\s+class="[^"]*\bdate_time\b[^"]*">([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const dateMatch = datePlain.match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),\s*(\d{1,2}):(\d{2})/);
    if (!dateMatch) continue;
    const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
    if (date < today) continue;
    const time = nullIfMidnight(`${dateMatch[4].padStart(2, "0")}:${dateMatch[5]}`);

    const titleAnchor = block.match(
      /<h3[^>]*class="title[^"]*"[^>]*>\s*<a\s+title="([^"]+)"\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i,
    );
    if (!titleAnchor) continue;
    const title = stripHtml(titleAnchor[3]) || decodeEntities(titleAnchor[1]);
    const detailHref = decodeEntities(titleAnchor[2]);
    if (!title) continue;

    const groupName =
      stripHtml(
        block.match(/<h4[^>]*class="headline-theatergruppen[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "",
      ) || null;

    const venueRoom =
      stripHtml(block.match(/<a\s+class="news-list-category[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "") || null;

    const ageBadge =
      stripHtml(block.match(/<a\s+class="badge[^"]*\baltersgruppen[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "") || null;

    const imgSrc = block.match(/<img[^>]+src="((?:https?:\/\/[^"]+)?\/fileadmin\/[^"]+)"/i)?.[1];

    const statusText = stripHtml(block.match(/<div\s+class="status">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "");
    const status = mapStatus(statusText);

    const slug = `${slugify(groupName ?? "")}-${slugify(title)}`.replace(/^-+|-+$/g, "") || slugify(title);
    const dedup = `${slug}|${date}|${time ?? ""}|${venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(slug)) {
      showsBySlug.set(slug, {
        slug,
        title,
        subtitle: groupName,
        description: groupName,
        detail_url: normalizeUrl(detailHref, BASE),
        image_url: imgSrc ? normalizeUrl(imgSrc, BASE) : null,
        age_recommendation: ageBadge,
      });
    }

    performances.push({
      show_slug: slug,
      date,
      time,
      end_time: null,
      venue_room: venueRoom,
      provider_event_id: null,
      ticket_url: normalizeUrl(detailHref, BASE),
      status,
    });
  }

  return {
    theater_slug: "theaterhaus-frankfurt",
    shows: [...showsBySlug.values()],
    performances,
  };
}

function mapStatus(text: string): ScrapedPerformance["status"] {
  const t = text.trim().toLowerCase();
  if (!t) return "available";
  if (t.includes("ausverkauft")) return "sold_out";
  if (t.includes("entfäll") || t.includes("abgesagt")) return "cancelled";
  if (t.includes("restkarten") || t.includes("wenige")) return "few_left";
  return "available";
}
