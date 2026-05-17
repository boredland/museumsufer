import { classifyLandauByText, isLandauCategory, LANDAU_DE_KATID_MAP } from "@museumsufer/classify";
import { decodeEntities, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.landau.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

/**
 * Stadt Landau's Advantic CMS exposes an ICS feed with full DTSTART/DTEND/
 * LOCATION/DESCRIPTION for every event. The HTML listing pages carry the
 * bits the ICS lacks: stable FID (used as source_event_id), hero image,
 * deep-link URL, and a KatID hint in some templates. The site is ISO-8859-1
 * so we transcode at fetch time before any parsing.
 *
 * Join logic: lowercase-title match between ICS and HTML; ICS wins for
 * time/desc/location, HTML wins for image/detail URL/FID; events that
 * exist on only one side are synthesised from whichever has them.
 */

const ICS_URL = `${BASE}/output/options.php?ModID=11&call=ical&ext=ics&La=1`;
const LIST_URL = (offset: number) =>
  `${BASE}/Tourismus-Kultur/Veranstaltungen/index.php?ofs_1=${offset}&La=1&NavID=2644.11&bn=1&kuo=1&ModID=11&object=tx%7C2644.4.1`;

interface HtmlCard {
  title: string;
  fid: string;
  detailUrl: string;
  imageUrl?: string;
  dateText?: string;
  katid?: string;
}

interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: string;
  dtend?: string;
}

export async function scrapeLandauDe(): Promise<VenueScrapeResult> {
  const [icsEvents, htmlCards] = await Promise.all([fetchIcs(), fetchListing(5)]);

  const cardByTitle = new Map<string, HtmlCard>(htmlCards.map((c) => [normalizeTitle(c.title), c]));
  const usedTitles = new Set<string>();
  const events: CanonicalScrapedEvent[] = [];

  for (const ics of icsEvents) {
    const key = normalizeTitle(ics.summary);
    const card = cardByTitle.get(key);
    if (card) usedTitles.add(key);
    events.push(toCanonical(ics, card));
  }
  for (const card of htmlCards) {
    const key = normalizeTitle(card.title);
    if (usedTitles.has(key)) continue;
    const synthesised = htmlOnlyEvent(card);
    if (synthesised) events.push(synthesised);
  }

  return { source_slug: "landau-de", display_name: "Stadt Landau in der Pfalz", events };
}

async function fetchIcs(): Promise<IcsEvent[]> {
  const res = await fetch(ICS_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.warn(`landau-de ics: HTTP ${res.status}`);
    return [];
  }
  return parseIcs(await res.text());
}

function parseIcs(ics: string): IcsEvent[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  const out: IcsEvent[] = [];
  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0];
    const ev = parseVevent(body);
    if (ev) out.push(ev);
  }
  return out;
}

function parseVevent(body: string): IcsEvent | null {
  const fields = new Map<string, string>();
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const left = line.slice(0, colon);
    const value = unescapeIcsText(line.slice(colon + 1));
    const semi = left.indexOf(";");
    const name = (semi === -1 ? left : left.slice(0, semi)).toUpperCase();
    fields.set(name, value);
  }
  const uid = fields.get("UID");
  const summary = fields.get("SUMMARY");
  const dtstart = fields.get("DTSTART");
  if (!uid || !summary || !dtstart) return null;
  return {
    uid,
    summary,
    description: fields.get("DESCRIPTION") ?? undefined,
    location: fields.get("LOCATION") ?? undefined,
    dtstart,
    dtend: fields.get("DTEND") ?? undefined,
  };
}

function unescapeIcsText(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseIcsDateTime(raw: string): { date: string; time?: string } {
  const cleaned = raw.replace(/Z$/, "");
  const m = cleaned.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return { date: "" };
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] === undefined) return { date };
  if (m[4] === "00" && m[5] === "00") return { date };
  return { date, time: `${m[4]}:${m[5]}` };
}

async function fetchListing(maxPages: number): Promise<HtmlCard[]> {
  const cards: HtmlCard[] = [];
  for (let i = 0; i < maxPages; i++) {
    const offset = i * 25;
    const html = await fetchUtf8(LIST_URL(offset));
    if (!html) break;
    const page = parseListing(html);
    if (page.length === 0) break;
    cards.push(...page);
  }
  return cards;
}

async function fetchUtf8(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return new TextDecoder("iso-8859-1").decode(buf);
  } catch (err) {
    console.warn(`landau-de fetch: ${(err as Error).message}`);
    return null;
  }
}

function parseListing(html: string): HtmlCard[] {
  const blocks = html.split(/<div\s+class="trenner"/i);
  const cards: HtmlCard[] = [];
  for (const block of blocks) {
    const fid = match(block, /FID=(2644\.\d+\.\d+)/);
    if (!fid) continue;
    const titleAndUrl = block.match(/<div\s+class="liste_titel">\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleAndUrl) continue;
    const detailUrl = decodeEntities(titleAndUrl[1]);
    const title = stripHtml(decodeEntities(titleAndUrl[2])).replace(/»/g, "").trim();
    const imageUrl = match(block, /<div\s+class="liste_bild">[\s\S]*?<img\s+src="([^"]+)"/i);
    const dateText = match(block, /<div\s+class="date">\s*([\s\S]*?)\s*<\/div>/i);
    const katid = match(block, /KatID=(\d+\.\d+)/);
    cards.push({
      title,
      fid,
      detailUrl: detailUrl.startsWith("http") ? detailUrl : `${BASE}${detailUrl}`,
      imageUrl: imageUrl ? (imageUrl.startsWith("http") ? imageUrl : `${BASE}${imageUrl}`) : undefined,
      dateText: dateText ? stripHtml(dateText).trim() : undefined,
      katid,
    });
  }
  return cards;
}

function toCanonical(ics: IcsEvent, card?: HtmlCard): CanonicalScrapedEvent {
  const start = parseIcsDateTime(ics.dtstart);
  const end = ics.dtend ? parseIcsDateTime(ics.dtend) : undefined;
  const description = ics.description?.replace(/\s+/g, " ").trim().slice(0, 500) ?? null;
  const { venue, city } = parseIcsLocation(ics.location);
  const detailUrl = card?.detailUrl ?? `${BASE}/Tourismus-Kultur/Veranstaltungen/`;
  const labels = buildLabels(ics.summary, description, card?.katid);

  return {
    source_event_id: card?.fid ?? ics.uid,
    title: ics.summary.trim(),
    description,
    date: start.date,
    time: start.time ?? null,
    end_date: end?.date && end.date !== start.date ? end.date : null,
    end_time: end?.time ?? null,
    detail_url: detailUrl,
    ticket_url: null,
    image_url: card?.imageUrl ?? null,
    price_min: null,
    price_max: null,
    performers: null,
    venue_room: venue ?? null,
    city: city ?? null,
    raw_category: card?.katid ?? null,
    labels,
  };
}

function htmlOnlyEvent(card: HtmlCard): CanonicalScrapedEvent | null {
  const dt = parseGermanDateRange(card.dateText);
  if (!dt) return null;
  const labels = buildLabels(card.title, null, card.katid);
  return {
    source_event_id: card.fid,
    title: card.title,
    description: null,
    date: dt.start,
    time: null,
    end_date: dt.end && dt.end !== dt.start ? dt.end : null,
    end_time: null,
    detail_url: card.detailUrl,
    ticket_url: null,
    image_url: card.imageUrl ?? null,
    price_min: null,
    price_max: null,
    performers: null,
    venue_room: null,
    city: "Landau in der Pfalz",
    raw_category: card.katid ?? null,
    labels,
  };
}

function buildLabels(title: string, description: string | null, katid?: string): ScrapedLabel[] {
  if (katid) {
    const mapped = LANDAU_DE_KATID_MAP[katid];
    if (mapped) {
      return [{ label: `region:landau:${mapped}`, confidence: 0.95, classifier: "upstream-category" }];
    }
  }
  const slug = classifyLandauByText(title, description);
  return [
    {
      label: `region:landau:${isLandauCategory(slug) ? slug : "sonstiges"}`,
      confidence: 0.7,
      classifier: "keyword:landau",
    },
  ];
}

function parseGermanDateRange(text?: string): { start: string; end?: string } | null {
  if (!text) return null;
  const dates = text.match(/\d{2}\.\d{2}\.\d{4}/g);
  if (!dates || dates.length === 0) return null;
  const toIso = (de: string) => `${de.slice(6, 10)}-${de.slice(3, 5)}-${de.slice(0, 2)}`;
  const start = toIso(dates[0]);
  const end = dates[1] ? toIso(dates[1]) : undefined;
  return { start, end };
}

function parseIcsLocation(loc?: string): { venue?: string; city?: string } {
  if (!loc) return {};
  const parts = loc
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { venue: parts[0] };
  if (/^Landau/i.test(parts[0])) {
    return { city: parts[0], venue: parts.slice(1).join(", ") };
  }
  return { venue: loc.trim() };
}

function match(haystack: string, re: RegExp): string | undefined {
  return haystack.match(re)?.[1];
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/["»«]/g, "")
    .replace(/[^a-z0-9äöüß\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
