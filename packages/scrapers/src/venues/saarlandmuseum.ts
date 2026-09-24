import { classifyEvent } from "@museumsufer/classify";
import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { labelsForEvent } from "./_gomus-generic";

/**
 * Stiftung Saarländischer Kulturbesitz (kulturbesitz.de) — the Saarlandmuseum
 * (Moderne Galerie, Alte Sammlung, Museum für Vor- und Frühgeschichte) plus
 * the Zeitungsmuseum and Römische Villa Nennig. Two TYPO3 `mm_exhibition`
 * lists, `/de/ausstellungen` and `/de/programm/veranstaltungen`, render
 * `<div class="item">` cards server-side, ten per page. Further pages come
 * from POSTing the list's own filter form back with `pager_id=<n>`; the
 * form's hidden fields carry TYPO3's signed request state, so they are
 * replayed verbatim.
 *
 * Exhibitions name their house ("Moderne Galerie, Bismarckstraße 11-15,
 * 66111 Saarbrücken"); those outside Saarbrücken (Wadgassen, Nennig) are
 * dropped. Events carry no place; the off-site ones name their house in
 * the title ("Führung Römische Villa Nennig") and are dropped by that.
 */
const BASE = "https://www.kulturbesitz.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
/** The events list runs ~6 months ahead in ~8 pages; this bounds a pager
 *  that stops advancing. */
const MAX_PAGES = 20;

const MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

const ITEM_SPLIT_RE = /<div class="item" /;
const DATE_RE = /(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/g;
const TIME_RE = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;
/** Foundation houses outside Saarbrücken (Perl-Nennig, Wadgassen). */
const OFF_SITE_RE = /Nennig|Zeitungsmuseum|Wadgassen/i;

export async function scrapeSaarlandmuseum(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const [exhibitions, events] = await Promise.all([
    fetchAllPages(`${BASE}/de/ausstellungen`),
    fetchAllPages(`${BASE}/de/programm/veranstaltungen`),
  ]);
  return {
    source_slug: "saarlandmuseum",
    display_name: "Saarlandmuseum",
    events: [
      ...exhibitions.flatMap((item) => parseExhibition(item, today) ?? []),
      ...events.flatMap((item) => parseEvent(item, today) ?? []),
    ],
  };
}

async function fetchAllPages(url: string): Promise<string[]> {
  const first = await fetchText(url);
  const items = splitItems(first);
  const form = first.match(/<form data-mm_exhibition_function="filter-form" action="([^"]+)"[\s\S]*?<\/form>/);
  const pages = new Set([...first.matchAll(/data-pager-page-id="(\d+)"/g)].map((m) => Number(m[1])));
  if (!form) return items;

  const action = `${BASE}${decodeEntities(form[1])}`;
  const fields = [...form[0].matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/g)].map(
    (m) => [decodeEntities(m[1]), decodeEntities(m[2])] as [string, string],
  );
  // Page 1 is the GET above.
  for (const page of [...pages].filter((p) => p > 1 && p <= MAX_PAGES).sort((a, b) => a - b)) {
    const body = new URLSearchParams([...fields, ["pager_id", String(page)]]);
    items.push(...splitItems(await fetchText(action, body)));
  }
  return items;
}

async function fetchText(url: string, body?: URLSearchParams): Promise<string> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
    body,
  });
  if (!res.ok) throw new Error(`saarlandmuseum ${url}: ${res.status}`);
  return res.text();
}

function splitItems(html: string): string[] {
  return html.split(ITEM_SPLIT_RE).slice(1);
}

function parseExhibition(item: string, today: string): CanonicalScrapedEvent | null {
  const place = clean(item.match(/<div class="item__place">[\s\S]*?<span>([\s\S]*?)<\/span>/)?.[1] ?? "");
  if (!/Saarbrücken/.test(place)) return null;
  const [start, end] = dates(item.match(/<div class="item__date ?">([\s\S]*?)<\/div>/)?.[1] ?? "");
  if (!start || (end ?? start) < today) return null;
  const titleHtml = item.match(/<div class="item__title">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const [title, subtitle] = titleHtml.split(/<br\s*\/?>/i).map(clean);
  const id = item.match(/data-mm_exhibition-id="(\d+)"/)?.[1];
  const detail = item.match(/<div class="item__detail-link"><a[^>]+href="([^"]+)"/)?.[1];
  if (!title || !id) return null;
  return {
    source_event_id: `exhibition|${id}`,
    title,
    subtitle: subtitle || null,
    date: start,
    end_date: end && end !== start ? end : null,
    detail_url: detail ? `${BASE}${decodeEntities(detail)}` : `${BASE}/de/ausstellungen`,
    image_url: imageOf(item),
    // The house name leads the address ("Moderne Galerie, Bismarckstraße …").
    venue_room: place.split(",")[0] || null,
    labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
  };
}

function parseEvent(item: string, today: string): CanonicalScrapedEvent | null {
  const dateHtml = item.match(/<div class="item__date">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const [date] = dates(dateHtml);
  if (!date || date < today) return null;
  const title = clean(item.match(/<div class="item__title">([\s\S]*?)<\/div>/)?.[1] ?? "");
  const id = item.match(/data-mm_exhibition-id="(\d+)"/)?.[1];
  if (!title || !id || OFF_SITE_RE.test(title)) return null;
  const time = clean(dateHtml).match(TIME_RE);
  const text = item.match(/<div class="item__text-wrap"[^>]*>([\s\S]*?)<div class="item__links"/)?.[1];
  const description = text ? clean(text).slice(0, 2000) || null : null;
  // "Führung | "Andy Warhol - Ikonen"": the upstream tag is folded into the
  // title, so it also feeds the classifier.
  const category = [...item.matchAll(/<li>\[([^\]]+)\]<\/li>/g)].map((m) => m[1]).join(" ");
  return {
    source_event_id: id,
    title,
    description,
    date,
    time: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
    end_time: time ? `${time[3].padStart(2, "0")}:${time[4]}` : null,
    detail_url: `${BASE}/de/programm/veranstaltungen`,
    raw_category: category || null,
    labels: labelsForEvent(classifyEvent(`${category} ${title}`, description), title, description),
  };
}

function dates(html: string): string[] {
  return [...clean(html).matchAll(DATE_RE)].flatMap(([, d, m, y]) => {
    const month = MONTHS[m.toLowerCase()];
    return month ? [`${y}-${month}-${d.padStart(2, "0")}`] : [];
  });
}

function imageOf(item: string): string | null {
  const src = item.match(/<div class="item__picture"><img src="([^"]+)"/)?.[1];
  return src ? `${BASE}${src}` : null;
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
