import { decodeEntities, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { cleanText, fetchVlc, genreFromText, mapPool, musicLabel, type VlcGenre } from "./_valencia-music";

const LIST_URL = "https://www.uv.es/uvweb/cultura/ca/activitats-convocatories/arees-programacio/musica/programacio/actual-1285872403494.html";
const ORIGIN = "https://www.uv.es";

interface Hall {
  slug: string;
  name: string;
  /** Matches the "Sales" line of the detail page. */
  match: RegExp;
  lat: number;
  lon: number;
  fallback: VlcGenre;
}

/**
 * Halls of the Universitat de València inside the city. Concerts at the Palau
 * de la Música (own scraper) and on the Burjassot campus (outside the city) are
 * deliberately not listed and get dropped. Coordinates looked up once by hand.
 */
const HALLS: Hall[] = [
  { slug: "capella-de-la-sapiencia-valencia", name: "Capella de la Sapiència (La Nau)", match: /Capella de la Sapi[eè]ncia/i, lat: 39.4746, lon: -0.3763, fallback: "classical" },
  { slug: "col-legi-major-rector-peset", name: "Col·legi Major Rector Peset", match: /Rector Peset|C\.M\.R\. Peset/i, lat: 39.4755, lon: -0.3796, fallback: "chamber" },
  { slug: "jardi-botanic-auditori-valencia", name: "Auditori del Jardí Botànic", match: /Bot[aà]nic\. Auditori|Jard[ií] Bot[aà]nic/i, lat: 39.4769, lon: -0.3867, fallback: "classical" },
];

/** "Músiques Urbanes" is the university's pop/singer-songwriter strand. */
const SKIP_TITLE = /m[uú]siques urbanes/i;

const MONTHS: Record<string, string> = {
  gener: "01", febrer: "02", "març": "03", abril: "04", maig: "05", juny: "06",
  juliol: "07", agost: "08", setembre: "09", octubre: "10", novembre: "11", desembre: "12",
};

/**
 * Universitat de València, Aula de Música: the "Concerts de Tardor" cycle in
 * La Nau, the Rector Peset hall and the Botanical Garden. The area listing
 * ("Música / Actual") is server-rendered; each card links to a detail page with
 * date, time range and hall. Free entry with reservation.
 */
export async function scrapeUniversitatValenciaConcerts(): Promise<VenueScrapeResult[]> {
  const today = todayIso();
  const html = await fetchVlc(LIST_URL);
  const cards = html.match(/<article class="activitat-box">[\s\S]*?<\/article>/g) ?? [];
  if (cards.length === 0) throw new Error("universitat-valencia: no activity cards in listing");

  const singles = cards.flatMap((c) => {
    const area = c.match(/class="areaAct[^>]*>([^<]*)</)?.[1]?.trim();
    const url = c.match(/href='(https:\/\/www\.uv\.es\/uvweb\/cultura\/ca\/llista-activitat\/[^']+)'/)?.[1];
    const title = cleanText(c.match(/class="header-3">([\s\S]*?)<\/span>/)?.[1] ?? "");
    const date = cleanText(c.match(/class="date">([\s\S]*?)<\/div>/)?.[1] ?? "");
    const img = c.match(/<img[^>]+src="([^"]+)"/)?.[1];
    // Ranges ("2 octubre al 22 desembre") are the umbrella entry of the cycle, not a concert.
    if (area !== "Música" || !url || !title || / al /.test(date) || SKIP_TITLE.test(title)) return [];
    return [{ url: decodeEntities(url), title, image: img ? `${ORIGIN}${img}` : null }];
  });

  const pages = await mapPool(singles, 4, async (s) => ({ s, html: await fetchVlc(s.url) }));
  const byHall = new Map<string, VenueScrapeResult>();
  const seen = new Set<string>();
  for (const { s, html: page } of pages) {
    const text = cleanText(page.replace(/<\/(?:p|div|li|h\d)>/gi, "\n"));
    const m = text.match(/Data\s*:\s*(\d{1,2}) de (\S+) de (\d{4})(?: de (\d{1,2}:\d{2}) a (\d{1,2}:\d{2}))?/);
    const month = m ? MONTHS[m[2].toLowerCase()] : undefined;
    if (!m || !month) throw new Error(`universitat-valencia: unparseable date on ${s.url}`);
    const date = `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
    if (date < today) continue;
    const place = text.match(/(?:Sales|Lloc de realitzaci[oó])\s*:\s*(.+?)\s+(?:Organitza|Col·labora)\s*:/)?.[1] ?? "";
    const hall = HALLS.find((h) => h.match.test(place));
    if (!hall) continue;
    const genre = genreFromText(s.title, hall.fallback);
    const id = `${s.url.match(/id=(\d+)/)?.[1] ?? s.title}-${date}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const time = m[4] && m[4] !== "00:00" ? m[4].padStart(5, "0") : null;
    const reserve = page.match(/href="(https:\/\/entrades\.fundacio\.es\/[^"]+)"/)?.[1];
    const ev: CanonicalScrapedEvent = {
      source_event_id: id,
      title: s.title,
      date,
      time,
      end_time: time && m[5] ? m[5].padStart(5, "0") : null,
      detail_url: s.url,
      ticket_url: reserve ? decodeEntities(reserve) : null,
      image_url: s.image,
      price_min: 0,
      price_max: 0,
      language: "ca",
      venue_room: hall.name,
      city: "valencia",
      lat: hall.lat,
      lon: hall.lon,
      raw_category: "Concerts de Tardor",
      labels: musicLabel(genre, 0.8),
    };
    const res = byHall.get(hall.slug) ?? { source_slug: hall.slug, display_name: hall.name, events: [] };
    res.events.push(ev);
    byHall.set(hall.slug, res);
  }
  const out = [...byHall.values()];
  for (const r of out) r.events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return out.sort((a, b) => a.source_slug.localeCompare(b.source_slug));
}
