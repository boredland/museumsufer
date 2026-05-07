import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.gallustheater.de";
const PROGRAMM_URL = `${BASE}/prog/prog.php`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Gallus Theater is a hand-rolled PHP site whose `/prog/prog.php` lists
 * every upcoming performance as a single anchor:
 *
 *   <a class="Prog" href="/2026/05/<slug>.php">
 *     <span>Fr. 08.05.26 - 14:30</span>
 *     &nbsp;<b>Artist or Group</b>
 *     &nbsp;&raquo;Title&laquo;
 *     <i>optional extra label, e.g. "Premiere"</i>
 *   </a>
 *   <a class="Kart" href="/prog/vob.php?i=N">Karten</a>
 *
 * Date format is `Wd. DD.MM.YY - HH:MM`. Year is two-digit; we expand to
 * 2000s since the site only lists upcoming events.
 */

const ROW_RE =
  /<a\s+class="Prog"\s+href="([^"]+)"\s*>\s*<span>\s*\w+\.\s*(\d{1,2})\.(\d{1,2})\.(\d{2})\s*-\s*(\d{1,2})[:.](\d{2})\s*<\/span>\s*&nbsp;\s*<b>([\s\S]*?)<\/b>\s*&nbsp;\s*&raquo;([\s\S]*?)&laquo;\s*(?:<i>([\s\S]*?)<\/i>)?\s*<\/a>(?:\s*<a\s+class="Kart"\s+href="([^"]+)"[^>]*>[^<]*<\/a>)?/g;

export async function scrapeGallusTheater(): Promise<ScrapeResult> {
  const res = await fetch(PROGRAMM_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Gallus Theater fetch failed: ${res.status}`);
  return parseGallusHtml(await res.text());
}

export function parseGallusHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const m of html.matchAll(ROW_RE)) {
    const detailHref = decodeEntities(m[1]);
    const day = m[2];
    const month = m[3];
    const yy = m[4];
    const year = `20${yy}`;
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (date < today) continue;

    const time = nullIfMidnight(`${m[5].padStart(2, "0")}:${m[6]}`);
    const artist = stripHtml(m[7]);
    const titleRaw = stripHtml(m[8]);
    const title = titleRaw || artist;
    if (!title) continue;
    const subtitle = artist && artist !== title ? artist : null;
    const extraLabel = m[9] ? stripHtml(m[9]) : null;
    const ticketHref = m[10] ? decodeEntities(m[10]) : null;

    const slug = `${slugify(artist || title)}-${slugify(title)}`.replace(/^-+|-+$/g, "");
    const dedup = `${slug}|${date}|${time ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(slug)) {
      showsBySlug.set(slug, {
        slug,
        title,
        subtitle,
        description: subtitle,
        detail_url: normalizeUrl(detailHref, BASE),
        image_url: null,
      });
    }

    performances.push({
      show_slug: slug,
      date,
      time,
      end_time: null,
      venue_room: extraLabel === "Festival" ? extraLabel : "Gallus Theater",
      provider_event_id: ticketHref ? (ticketHref.match(/i=(\d+)/)?.[1] ?? null) : null,
      ticket_url: ticketHref ? normalizeUrl(ticketHref, BASE) : normalizeUrl(detailHref, BASE),
      status: "available",
    });
  }

  return {
    theater_slug: "gallus-theater",
    shows: [...showsBySlug.values()],
    performances,
  };
}
