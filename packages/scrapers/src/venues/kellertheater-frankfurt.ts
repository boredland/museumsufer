import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.kellertheater-frankfurt.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Kellertheater Frankfurt is a hand-rolled classic-HTML site. The homepage
 * carries the upcoming-shows list inline; every performance generates a
 * `<a href="reservierungVorstellung.php?vorstellung=DD.MM.YYYY HH:MM Title&…">`
 * anchor for the in-house reservation form, plus an external
 * `tickets.php?ticketURL=…` redirect to frankfurtticket.de. Date+time come
 * from the reservation query string (with the full title verbatim); the
 * production page link (`/produktionen/<slug>/index.html`) and image sit
 * nearby in the markup.
 */

const TRENNER_RE = /<div\s+class="trenner"[^>]*><\/div>/gi;
const RESERV_RE =
  /reservierungVorstellung\.php\?vorstellung=(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})\s+([^&"'<]+?)(?:&|")/i;
const PRODUKTION_RE = /href="(?:https?:\/\/[^"']+)?\/?(produktionen\/[a-z0-9-]+\/(?:index\.html?)?)"/i;
const TITLE_RE = /<b><big>([\s\S]*?)<\/big><\/b>/i;
const AUTHOR_RE = /<div[^>]*style='[^']*'[^>]*>\s*([\s\S]*?)<p\s*>\s*<b><big>/i;
const IMG_RE = /<img\s+[^>]*src='([^']+\/produktionen\/[^']+)'/i;
const FRANKFURTTICKET_RE = /tickets\.php\?ticketURL=([^"']+)/i;

export async function scrapeKellertheaterFrankfurt(): Promise<VenueScrapeResult> {
  const res = await fetch(`${BASE}/`, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`kellertheater-frankfurt fetch failed: ${res.status}`);
  return parse(await res.text());
}

function parse(html: string): VenueScrapeResult {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
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

    events.push({
      source_event_id: slug,
      title,
      subtitle: author,
      description: author,
      date,
      time,
      detail_url: detailUrl,
      ticket_url: ticketUrl,
      image_url: image,
      venue_room: "Kellertheater",
      labels: resolveStageLabels({ title, subtitle: author, confidence: 0.85 }),
    });
  }

  return { source_slug: "kellertheater-frankfurt", events };
}
