import { classifyLandauByText } from "@museumsufer/classify";
import { decodeEntities, stripHtml, todayIso, truncate } from "@museumsufer/core";
import PQueue from "p-queue";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Pfalz tourism portal (Drupal). The site has 3,000+ events region-wide,
 * but only the Landau-area ones belong here, so we lean on two cheap
 * pre-filters before fetching:
 *
 *   1. The XML sitemap exposes every event URL up front. We slug-filter
 *      against a Landau-area keyword list (Landau + Landauer-Land villages
 *      + close SÜW villages). That cuts 3,000+ → ~50 candidates.
 *   2. Each detail page carries `<time datetime="…">` per occurrence and
 *      an explicit `address__city` field. We re-verify the city against
 *      the same allowlist after fetching — slugs lie sometimes.
 *
 * Recurring events (Wochenmärkte etc.) emit one canonical event per
 * occurrence in the next OCCURRENCE_HORIZON_DAYS so the date strip lights
 * up correctly; occurrences beyond the horizon are dropped to keep the
 * bundle small.
 */

const SOURCE_SLUG = "pfalz-de";
const SITEMAP_URL = "https://www.pfalz.de/sitemap.xml";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const OCCURRENCE_HORIZON_DAYS = 30;
const FETCH_CONCURRENCY = 6;
const OVERALL_BUDGET_MS = 6 * 60 * 1000;
// pfalz.de's sitemap consistently takes 1–3 min cold; the previous 20s cap
// failed often enough that the scraper returned zero events on most runs.
const SITEMAP_TIMEOUT_MS = 4 * 60 * 1000;

/** Slug-keyword filter — first cheap pass against the sitemap. Names
 *  normalised to ASCII so we hit umlaut variants too. The corridor covers
 *  ~25 km of the Südliche Weinstraße north-south axis. */
const SLUG_KEYWORDS = [
  "landau",
  "moerzheim",
  "morzheim",
  "wollmesheim",
  "nussdorf",
  "godramstein",
  "dammheim",
  "queichheim",
  "arzheim",
  "birkweiler",
  "ranschbach",
  "frankweiler",
  "siebeldingen",
  "leinsweiler",
  "eschbach",
  "bornheim",
  "knoeringen",
  "knoringen",
  "roschbach",
  "hainfeld",
  "edesheim",
  "edenkoben",
  "rhodt",
  "rietburg",
  "weyher",
  "burrweiler",
  "gleisweiler",
  "kirrweiler",
  "maikammer",
  "sankt-martin",
  "st-martin",
  "neustadt",
  "hambach",
  "gimmeldingen",
  "mussbach",
  "haardt",
  "diedesfeld",
  "koenigsbach",
  "konigsbach",
  "geinsheim",
  "lachen-speyer",
];

const CITY_ALLOWLIST = new Set([
  "Landau in der Pfalz",
  "Landau",
  "Landau-Mörzheim",
  "Landau-Wollmesheim",
  "Landau-Nußdorf",
  "Landau-Godramstein",
  "Landau-Dammheim",
  "Landau-Queichheim",
  "Landau-Arzheim",
  "Birkweiler",
  "Ranschbach",
  "Frankweiler",
  "Siebeldingen",
  "Leinsweiler",
  "Eschbach",
  "Bornheim",
  "Knöringen",
  "Roschbach",
  "Hainfeld",
  "Edesheim",
  "Rhodt unter Rietburg",
  "Weyher",
  "Weyher in der Pfalz",
  "Burrweiler",
  "Gleisweiler",
  "Kirrweiler",
  "Maikammer",
  "St. Martin",
  "Sankt Martin",
  "Hambach an der Weinstraße",
  "Haardt",
  "Mußbach",
  "Diedesfeld",
  "Gimmeldingen",
  "Königsbach",
  "Lachen-Speyerdorf",
  "Geinsheim",
  "Duttweiler",
]);

const CITY_PREFIXES = ["Neustadt", "Edenkoben"];

function cityMatches(city: string | undefined): boolean {
  if (!city) return false;
  if (CITY_ALLOWLIST.has(city)) return true;
  return CITY_PREFIXES.some((p) => city.startsWith(p));
}

interface DetailPage {
  slug: string;
  url: string;
  title: string;
  datetimes: string[];
  venue?: string;
  city?: string;
  imageUrl?: string;
  description?: string;
}

export async function scrapePfalzDe(): Promise<VenueScrapeResult> {
  const budget = AbortSignal.timeout(OVERALL_BUDGET_MS);
  const events = await Promise.race([
    scrapeInner(budget),
    new Promise<CanonicalScrapedEvent[]>((resolve) => {
      budget.addEventListener("abort", () => {
        console.warn(`pfalz-de: overall budget of ${OVERALL_BUDGET_MS}ms exhausted, returning partial`);
        resolve([]);
      });
    }),
  ]);
  return { source_slug: SOURCE_SLUG, events };
}

async function scrapeInner(budget: AbortSignal): Promise<CanonicalScrapedEvent[]> {
  const candidates = await fetchSitemapUrls();
  if (candidates.length === 0 || budget.aborted) return [];

  const detailPages = await fetchAllDetailPages(candidates, budget);
  const today = todayIso();
  const horizon = addDaysIso(today, OCCURRENCE_HORIZON_DAYS);

  const events: CanonicalScrapedEvent[] = [];
  for (const page of detailPages) {
    if (!cityMatches(page.city)) continue;
    for (const ev of expandOccurrences(page, today, horizon)) {
      events.push(ev);
    }
  }
  return events;
}

async function fetchSitemapUrls(): Promise<string[]> {
  try {
    const xml = await fetchTextWithTimeout(SITEMAP_URL, SITEMAP_TIMEOUT_MS);
    if (xml == null) return [];
    const seen = new Set<string>();
    for (const m of xml.matchAll(/<loc>(https:\/\/www\.pfalz\.de\/de\/veranstaltung\/[^<"]+)<\/loc>/g)) {
      const url = m[1].trim();
      const slug = url.replace(/^.*\/veranstaltung\//, "");
      if (matchesSlugKeyword(slug)) seen.add(url);
    }
    return [...seen];
  } catch (err) {
    console.warn(`pfalz-de sitemap: ${(err as Error).message}`);
    return [];
  }
}

function matchesSlugKeyword(slug: string): boolean {
  const lower = slug.toLowerCase();
  return SLUG_KEYWORDS.some((kw) => lower.includes(kw));
}

async function fetchAllDetailPages(urls: string[], budget: AbortSignal): Promise<DetailPage[]> {
  const queue = new PQueue({ concurrency: FETCH_CONCURRENCY });
  const out: DetailPage[] = [];
  for (const url of urls) {
    queue.add(async () => {
      if (budget.aborted) return;
      try {
        const html = await fetchTextWithTimeout(url, 8_000);
        if (html == null) return;
        const page = parseDetail(url, html);
        if (page) out.push(page);
      } catch (err) {
        console.warn(`pfalz-de fetch ${url}: ${(err as Error).message}`);
      }
    });
  }
  await queue.onIdle();
  return out;
}

function parseDetail(url: string, html: string): DetailPage | null {
  const title = decode(
    match(html, /<meta\s+property="og:title"\s+content="([^"]+)"/i) ?? match(html, /<title>([^<|]+)/i),
  );
  if (!title) return null;
  const datetimes = [...html.matchAll(/<time[^>]+datetime="([^"]+)"/gi)].map((m) => m[1]);
  const venue = decode(match(html, /class="address__organisation"[^>]*>([^<]+)<\/[^>]+>/i));
  const city = decode(match(html, /class="address__city"[^>]*>([^<]+)<\/[^>]+>/i));
  const imageUrl = pickFirstImage(html);
  const descriptionRaw = decode(
    match(html, /<meta\s+property="og:description"\s+content="([^"]+)"/i) ??
      match(html, /<meta\s+name="description"\s+content="([^"]+)"/i),
  );
  return {
    slug: url.replace(/^.*\/veranstaltung\//, ""),
    url,
    title: stripHtml(title)
      .replace(/\s*\|\s*Pfalz\.de\s*$/, "")
      .trim(),
    datetimes,
    venue,
    city,
    imageUrl,
    description: descriptionRaw ? (truncate(descriptionRaw, 500) ?? undefined) : undefined,
  };
}

function pickFirstImage(html: string): string | undefined {
  const og = match(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (og) return og.startsWith("http") ? og : `https://www.pfalz.de${og}`;
  const inline = match(html, /<img[^>]*src="(\/sites\/default\/files\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
  if (!inline) return undefined;
  return `https://www.pfalz.de${inline}`;
}

function expandOccurrences(page: DetailPage, today: string, horizon: string): CanonicalScrapedEvent[] {
  const out: CanonicalScrapedEvent[] = [];
  const seenDates = new Set<string>();
  const category = classifyLandauByText(page.title, page.description);
  for (const raw of page.datetimes) {
    const occ = parseDateTimeUtc(raw);
    if (!occ) continue;
    if (occ.date < today || occ.date > horizon) continue;
    if (seenDates.has(occ.date)) continue;
    seenDates.add(occ.date);
    out.push({
      // Append date so each occurrence has a unique stable id even though
      // the upstream slug is shared across the whole recurrence.
      source_event_id: `${page.slug}#${occ.date}`,
      title: page.title,
      description: page.description ?? null,
      date: occ.date,
      time: occ.time ?? null,
      detail_url: page.url,
      ticket_url: null,
      image_url: page.imageUrl ?? null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: page.venue ?? page.city ?? "Landau",
      city: page.city ?? null,
      labels: [{ label: `region:landau:${category}`, confidence: 0.7, classifier: "keyword:landau" }],
    });
  }
  return out;
}

/** Convert a UTC datetime (the format pfalz.de uses) to Berlin local
 *  date + time. Manual rather than dayjs to keep the bundle dep-free. */
function parseDateTimeUtc(s: string): { date: string; time?: string } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const offsetHours = isCestUtc(m[1], m[2], m[3]) ? 2 : 1;
  const local = new Date(utcMs + offsetHours * 3600_000);
  const date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const hh = pad(local.getUTCHours());
  const mm = pad(local.getUTCMinutes());
  if (hh === "00" && mm === "00") return { date };
  return { date, time: `${hh}:${mm}` };
}

function isCestUtc(yyyy: string, mm: string, dd: string): boolean {
  const m = Number(mm);
  if (m < 3 || m > 10) return false;
  if (m > 3 && m < 10) return true;
  const year = Number(yyyy);
  const month = m - 1;
  const day = Number(dd);
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const lastSunday = lastDay.getUTCDate() - lastDay.getUTCDay();
  return m === 3 ? day >= lastSunday : day < lastSunday;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function match(haystack: string, re: RegExp): string | undefined {
  return haystack.match(re)?.[1];
}

function decode(s: string | undefined): string | undefined {
  return s ? decodeEntities(s).trim() : undefined;
}

/** Fetch + read body under a single AbortController so a hung pfalz.de
 *  socket can't stall the whole pipeline. Bun's default fetch has no
 *  per-request timeout, and clearing the timer before awaiting
 *  `res.text()` would re-expose the body stream to indefinite hangs. */
async function fetchTextWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
