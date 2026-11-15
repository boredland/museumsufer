import { classifyDance, classifyMusic, isWorkshopTitle, looksLikeNonProgramme } from "@museumsufer/classify";
import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.staatstheater-darmstadt.de";
const SPIELPLAN_URL = `${BASE}/spielplan/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * The spielplan's own genre filter (`/spielplan/filter/<id>/<from>/<to>/`)
 * answers with the JSON list of termin ids in that category, so the venue's
 * category decides the label namespace. Description text must not: a musical's
 * blurb announcing a "Publikumsgespräch" is still a musical. Filter ids are
 * resolved from the `<option>` labels rather than hardcoded, and a missing
 * label throws so a renamed filter cannot silently drop every label.
 */
const CATEGORY_OPTIONS = {
  musical: ["Musiktheater: Musical"],
  oper: ["Musiktheater: Oper"],
  schauspiel: ["Schauspiel: Alle"],
  ballett: ["Ballett: Alle"],
  konzert: ["Konzerte: Alle"],
  kammer: ["Konzerte: Kammerkonzert", "Konzerte: Soli fan tutti"],
  familie: [
    "Musiktheater: Familienoper",
    "Schauspiel: Familienschauspiel",
    "Konzerte: Familienkonzerte",
    "Konzerte: Minikonzerte",
    "Konzerte: Teddybärenkonzerte",
  ],
} as const;

type CategoryKey = keyof typeof CATEGORY_OPTIONS;
type Categories = Record<CategoryKey, Set<string>>;

/** Announcements of a talk that accompanies a performance; they must not turn the performance into a talk. */
const ACCOMPANYING_TALK_RE = /(?:Publikums|Nach|Künstler)gespräch[^/]*|Einführung[^/]*/gi;

const LAT = 49.8632;
const LON = 8.647;

/**
 * Staatstheater Darmstadt — multi-section city theatre (opera, musical,
 * drama, ballet, concerts, young audiences). Its public spielplan page is
 * server-rendered with one `<article class="termin js-termin" data-termin-id>`
 * per dated performance. The unique `data-termin-id` is the stable upstream
 * id. Tickets are sold through the Bilettix-based webshop.
 */
export async function scrapeStaatstheaterDarmstadt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(SPIELPLAN_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Staatstheater Darmstadt fetch failed: ${res.status}`);
  const html = await res.text();

  const categories = await fetchCategories(html);
  const events = parseTermine(html, today, categories);
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return {
    source_slug: "staatstheater-darmstadt",
    display_name: "Staatstheater Darmstadt",
    events,
  };
}

/** Fails loudly when the filter markup or API changes: unlabelled-by-category events would silently regress to guesses. */
async function fetchCategories(html: string): Promise<Categories> {
  const apiUrl = html.match(/data-filter-api-url="([^"]+)"/i)?.[1];
  if (!apiUrl?.includes("/filter/0/")) throw new Error("Staatstheater Darmstadt: spielplan filter api url not found");

  const optionIds = new Map<string, string>();
  for (const m of html.matchAll(/<option[^>]*data-filter-id="(\d+)"[^>]*>\s*([^<]+?)\s*<\/option>/gi)) {
    optionIds.set(decodeEntities(m[2] ?? ""), m[1] ?? "");
  }

  const fetchIds = async (optionLabel: string): Promise<string[]> => {
    const id = optionIds.get(optionLabel);
    if (!id) throw new Error(`Staatstheater Darmstadt: filter option "${optionLabel}" not found`);
    const res = await fetch(absoluteUrl(apiUrl.replace("/filter/0/", `/filter/${id}/`)), {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) throw new Error(`Staatstheater Darmstadt filter "${optionLabel}" failed: ${res.status}`);
    const ids = (await res.json()) as unknown;
    if (!Array.isArray(ids)) throw new Error(`Staatstheater Darmstadt filter "${optionLabel}" returned no id list`);
    return ids.map(String);
  };

  const keys = Object.keys(CATEGORY_OPTIONS) as CategoryKey[];
  const sets = await Promise.all(keys.map(async (k) => new Set((await Promise.all(CATEGORY_OPTIONS[k].map(fetchIds))).flat())));
  return Object.fromEntries(keys.map((k, i) => [k, sets[i]])) as Categories;
}

function resolveLabels(id: string, title: string, description: string | null, cats: Categories): ScrapedLabel[] {
  const hint = description?.replace(ACCOMPANYING_TALK_RE, "") ?? null;
  const generic = resolveStageLabels({
    title,
    hint,
    defaultLabel: "stage:theater",
    classifier: "scraper-hardcoded",
    confidence: 0.85,
  });
  if (looksLikeNonProgramme(title) || isWorkshopTitle(title)) return generic;

  const own = (label: string): ScrapedLabel => ({ label, confidence: 0.95, classifier: "upstream-category" });
  let primary: ScrapedLabel | null = null;
  if (cats.ballett.has(id)) primary = own(`dance:${classifyDance(title, null, hint, "contemporary")}`);
  else if (cats.kammer.has(id)) primary = own("music:chamber");
  else if (cats.konzert.has(id)) primary = own(`music:${classifyMusic(title, null, hint, "classical")}`);
  else if (cats.musical.has(id)) primary = own("stage:musical");
  else if (cats.oper.has(id)) primary = own("stage:opera");
  else if (cats.schauspiel.has(id)) primary = own("stage:theater");
  if (!primary) return generic;

  const labels = [primary];
  if (cats.familie.has(id) || generic.some((l) => l.label === "museum:familie")) {
    labels.push({ label: "museum:familie", confidence: 0.8, classifier: "upstream-category" });
  }
  return labels;
}

function parseTermine(html: string, today: string, cats: Categories): CanonicalScrapedEvent[] {
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Split on the opening of each performance block; [0] is everything before
  // the first event.
  const parts = html.split(/<article\s+class="termin js-termin"\s+data-termin-id="(\d+)"/i);
  for (let i = 1; i < parts.length; i += 2) {
    const terminId = parts[i];
    const block = parts[i + 1];
    if (!terminId || !block) continue;
    if (seen.has(terminId)) continue;

    const datetime = extractFirst(block, /<time\s+datetime="([^"]+)"/i);
    if (!datetime) continue;
    const [date, time] = splitDateTime(datetime);
    if (!date || date < today) continue;

    const title = cleanText(extractFirst(block, /<h3\s+class="termin__title">([\s\S]*?)<\/h3>/i));
    if (!title) continue;

    const detailHref = extractFirst(block, /<a\s+class="termin__anchor"\s+href="([^"]+)"/i);
    const detailUrl = detailHref ? absoluteUrl(detailHref) : null;
    const ticketUrl = extractFirst(block, /href="(https:\/\/webshop\.staatstheater-darmstadt\.de\/[^"]+)"/i);

    const venueRoom = cleanText(extractFirst(block, /<\/time>\s*<span>([^<]+)<\/span>/i)) || null;
    const description = extractDetailsText(block);
    const priceMin = extractPriceMin(block);
    const availability = block.includes("Ausverkauft") ? "sold_out" : null;

    seen.add(terminId);
    out.push({
      source_event_id: terminId,
      title,
      subtitle: null,
      description,
      date,
      time,
      detail_url: detailUrl,
      ticket_url: ticketUrl,
      price_min: priceMin,
      price_max: null,
      performers: null,
      venue_room: venueRoom,
      availability,
      city: "darmstadt",
      lat: LAT,
      lon: LON,
      labels: resolveLabels(terminId, title, description, cats),
    });
  }

  return out;
}

function splitDateTime(iso: string): [string, string | null] {
  const [datePart, timePart] = iso.split("T");
  if (!datePart) return ["", null];
  const time = timePart ? timePart.slice(0, 5) : null;
  return [datePart, time];
}

function extractDetailsText(block: string): string | null {
  const start = block.indexOf('<div class="termin__details');
  const end = block.indexOf('<div class="termin__options');
  if (start === -1 || end === -1 || end <= start) return null;
  const inner = block.slice(start, end);
  const match = inner.match(/<div\s+class="termin__details[^"]*"[^>]*>([\s\S]*)$/i);
  if (!match) return null;
  const text = cleanText(match[1]);
  return text || null;
}

function extractPriceMin(block: string): number | null {
  // Look for a price like "15,00 €" or "15,00 € bis 80,00 €".
  const m = block.match(/(\d+),\s*(\d{2})\s*&euro;/);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const cents = parseInt(m[2], 10);
  return whole + cents / 100;
}

function extractFirst(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

function cleanText(raw: string | null): string {
  if (!raw) return "";
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${BASE}${path}`;
}
