import { todayIso } from "../date";
import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.kellertheater-frankfurt.de";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Kellertheater Frankfurt is a hand-rolled classic-HTML site.  The
 * homepage carries the upcoming-shows list inline; every performance
 * generates a `<a href="reservierungVorstellung.php?vorstellung=DD.MM.YYYY HH:MM Title&amp;…">`
 * anchor for the in-house reservation form, plus an external
 * `tickets.php?ticketURL=…` redirect to frankfurtticket.de.  We harvest
 * date+time directly from the reservation query string (it carries the
 * full show title verbatim), and pair it with the production page link
 * (`/produktionen/<slug>/index.html`) and image alongside it in the
 * markup.
 */

export async function scrapeKellertheater(): Promise<ScrapeResult> {
  const res = await fetch(`${BASE}/`, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Kellertheater fetch failed: ${res.status}`);
  return parseKellertheaterHtml(await res.text());
}

const TRENNER_RE = /<div\s+class="trenner"[^>]*><\/div>/gi;
const RESERV_RE =
  /reservierungVorstellung\.php\?vorstellung=(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})\s+([^&"'<]+?)(?:&|")/i;
const PRODUKTION_RE = /href="(?:https?:\/\/[^"']+)?\/?(produktionen\/[a-z0-9-]+\/(?:index\.html?)?)"/i;
const TITLE_RE = /<b><big>([\s\S]*?)<\/big><\/b>/i;
const AUTHOR_RE = /<div[^>]*style='[^']*'[^>]*>\s*([\s\S]*?)<p\s*>\s*<b><big>/i;
const IMG_RE = /<img\s+[^>]*src='([^']+\/produktionen\/[^']+)'/i;
const FRANKFURTTICKET_RE = /tickets\.php\?ticketURL=([^"']+)/i;

export function parseKellertheaterHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  // Each event block ends at a <div class="trenner"></div> separator.  Split
  // the page around these and treat each chunk as a candidate event block.
  const chunks = html.split(TRENNER_RE);

  for (const chunk of chunks) {
    const reserv = chunk.match(RESERV_RE);
    if (!reserv) continue;
    const date = `${reserv[3]}-${reserv[2].padStart(2, "0")}-${reserv[1].padStart(2, "0")}`;
    if (date < today) continue;
    const time = nullIfMidnight(`${reserv[4].padStart(2, "0")}:${reserv[5]}`);
    const titleFromQuery = decodeEntities(reserv[6].replace(/\+/g, " ")).trim();

    const titleMatch = chunk.match(TITLE_RE);
    const title = (titleMatch ? stripHtml(titleMatch[1]) : "") || titleFromQuery;
    if (!title) continue;

    const prodHref = chunk.match(PRODUKTION_RE)?.[1];
    const detailUrl = prodHref ? normalizeUrl(`/${prodHref}`, BASE) : null;
    const slug = prodHref?.match(/produktionen\/([a-z0-9-]+)/i)?.[1] ?? slugify(title);

    const author = stripHtml(chunk.match(AUTHOR_RE)?.[1] ?? "") || null;

    const imgSrc = chunk.match(IMG_RE)?.[1];
    const image = imgSrc ? normalizeUrl(imgSrc, BASE) : null;

    const externalTicket = chunk.match(FRANKFURTTICKET_RE)?.[1];
    const ticketUrl = externalTicket ? decodeEntities(externalTicket) : detailUrl;

    const dedup = `${slug}|${date}|${time ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(slug)) {
      showsBySlug.set(slug, {
        slug,
        title,
        subtitle: author,
        description: author,
        detail_url: detailUrl,
        image_url: image,
      });
    }

    performances.push({
      show_slug: slug,
      date,
      time,
      end_time: null,
      venue_room: "Kellertheater",
      provider_event_id: null,
      ticket_url: ticketUrl,
      status: "available",
    });
  }

  return {
    theater_slug: "kellertheater-frankfurt",
    shows: [...showsBySlug.values()],
    performances,
  };
}
