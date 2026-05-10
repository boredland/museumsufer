/**
 * Scrape pfalz.de — Pfalz tourism portal (Drupal). The site has 3,000+
 * events region-wide, but only the Landau-area ones belong on
 * landau.today, so we lean on two cheap pre-filters before fetching:
 *
 *   1. The XML sitemap exposes every event URL up front. We slug-filter
 *      against a Landau-area keyword list (Landau itself + the
 *      Landauer-Land villages + a handful of close SÜW villages already
 *      in our taxonomy). That cuts 3,000+ → ~50 candidates.
 *   2. Each detail page carries `<time datetime="…">` per occurrence
 *      and an explicit `address__city` field. We re-verify the city
 *      against the same allowlist after fetching — slugs lie sometimes
 *      ("8-tagestour-pfalz"-style events that aren't actually local).
 *
 * Recurring events (Wochenmärkte etc.) emit one Event per occurrence in
 * the next OCCURRENCE_HORIZON_DAYS so the date strip lights up correctly;
 * occurrences beyond the horizon are dropped to keep the bundle small.
 */
import { decodeEntities, stripHtml, truncate } from "@museumsufer/core";
import { classifyEventByText } from "../categories";
import { todayIso } from "../date";
import type { Event, EventSource } from "../types";

const SOURCE: EventSource = "pfalz-de";
const SITEMAP_URL = "https://www.pfalz.de/sitemap.xml";
const OCCURRENCE_HORIZON_DAYS = 30;
const FETCH_CONCURRENCY = 6;

/** Slug-keyword filter — first cheap pass against the sitemap. We keep it
 *  inclusive (anything that *could* be Landau-area or Neustadt-area) and
 *  re-verify by city after fetching. Names normalised to ASCII so we
 *  hit umlaut variants too. */
const SLUG_KEYWORDS = [
  // Landau + Stadtdörfer
  "landau",
  "moerzheim",
  "morzheim",
  "wollmesheim",
  "nussdorf",
  "godramstein",
  "dammheim",
  "queichheim",
  "arzheim",
  // Tight ring around Landau (already in our SÜW ingestion)
  "birkweiler",
  "ranschbach",
  // Neustadt an der Weinstraße + Stadtteile — pairs with our Hambacher
  // Schloss source which already lives in this orbit. ~20 km from Landau
  // but tightly linked culturally (Hambacher Fest, Musikfest, Pfälzer
  // Weinkönigin etc.).
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

/** City allowlist for the post-fetch verification step. Exact matches go
 *  in here; broader prefix-based matches (e.g., any city starting with
 *  "Neustadt") are handled by `cityMatches()` below so we don't have to
 *  enumerate every transliteration. */
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

const CITY_PREFIXES = ["Neustadt"]; // catches "Neustadt an der Weinstraße", "Neustadt a.d. W.", etc.

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

export interface PfalzDeOptions {
  fetchImpl?: typeof fetch;
  /** Drop occurrences that start after `today + horizonDays`. */
  horizonDays?: number;
  /** Cap parallel detail-page fetches; keeps the upstream server happy. */
  concurrency?: number;
}

export async function scrapePfalzDe(opts: PfalzDeOptions = {}): Promise<Omit<Event, "id">[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const horizonDays = opts.horizonDays ?? OCCURRENCE_HORIZON_DAYS;
  const concurrency = opts.concurrency ?? FETCH_CONCURRENCY;

  const candidates = await fetchSitemapUrls(fetchImpl);
  if (candidates.length === 0) return [];

  const detailPages = await fetchAllDetailPages(fetchImpl, candidates, concurrency);
  const today = todayIso();
  const horizon = addDaysIso(today, horizonDays);

  const events: Omit<Event, "id">[] = [];
  for (const page of detailPages) {
    if (!cityMatches(page.city)) continue;
    for (const ev of expandOccurrences(page, today, horizon)) {
      events.push(ev);
    }
  }
  return events;
}

async function fetchSitemapUrls(fetchImpl: typeof fetch): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(fetchImpl, SITEMAP_URL, 20_000);
    if (!res.ok) {
      console.warn(`pfalz-de sitemap: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
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

async function fetchAllDetailPages(
  fetchImpl: typeof fetch,
  urls: string[],
  concurrency: number,
): Promise<DetailPage[]> {
  // Tiny worker-pool to keep concurrent fetches bounded — we don't want to
  // hammer the upstream Drupal cluster on a daily cron.
  const out: DetailPage[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const i = cursor++;
      const url = urls[i];
      try {
        const res = await fetchWithTimeout(fetchImpl, url, 12_000);
        if (!res.ok) continue;
        const html = await res.text();
        const page = parseDetail(url, html);
        if (page) out.push(page);
      } catch (err) {
        console.warn(`pfalz-de fetch ${url}: ${(err as Error).message}`);
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

function parseDetail(url: string, html: string): DetailPage | null {
  const title = decode(
    match(html, /<meta\s+property="og:title"\s+content="([^"]+)"/i) || match(html, /<title>([^<|]+)/i),
  );
  if (!title) return null;
  const datetimes = [...html.matchAll(/<time[^>]+datetime="([^"]+)"/gi)].map((m) => m[1]);
  const venue = decode(match(html, /class="address__organisation"[^>]*>([^<]+)<\/[^>]+>/i));
  const city = decode(match(html, /class="address__city"[^>]*>([^<]+)<\/[^>]+>/i));
  const imageUrl = pickFirstImage(html);
  const description = decode(
    match(html, /<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
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
    description: description ? truncate(description, 500) || undefined : undefined,
  };
}

function pickFirstImage(html: string): string | undefined {
  const og = match(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (og) return og.startsWith("http") ? og : `https://www.pfalz.de${og}`;
  // Drupal puts gallery images under /sites/default/files/styles/.../public/...
  const inline = match(html, /<img[^>]*src="(\/sites\/default\/files\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
  if (!inline) return undefined;
  return `https://www.pfalz.de${inline}`;
}

function expandOccurrences(page: DetailPage, today: string, horizon: string): Omit<Event, "id">[] {
  const out: Omit<Event, "id">[] = [];
  const seenDates = new Set<string>();
  for (const raw of page.datetimes) {
    const occ = parseDateTimeUtc(raw);
    if (!occ) continue;
    if (occ.date < today || occ.date > horizon) continue;
    if (seenDates.has(occ.date)) continue;
    seenDates.add(occ.date);
    out.push({
      source: SOURCE,
      // Append date so each occurrence has a unique stable id even though
      // the upstream slug is shared across the whole recurrence.
      source_uid: `${page.slug}#${occ.date}`,
      title: page.title,
      date: occ.date,
      ...(occ.time ? { time: occ.time } : {}),
      category: classifyEventByText(page.title, page.description),
      venue: page.venue || page.city || "Landau",
      ...(page.city ? { city: page.city } : {}),
      ...(page.description ? { description: page.description } : {}),
      detail_url: page.url,
      ...(page.imageUrl ? { image_url: page.imageUrl } : {}),
    });
  }
  return out;
}

/** Convert a UTC datetime (the format pfalz.de uses) to Berlin local
 *  date + time. We do this manually rather than reaching for dayjs to
 *  keep the scraper bundle-free of timezone-data deps. */
function parseDateTimeUtc(s: string): { date: string; time?: string } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Cheap CET/CEST detection: between last-Sunday-of-March and last-Sunday-of-October
  // it's CEST (UTC+2), otherwise CET (UTC+1). pfalz.de is regional, so this is fine.
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
  // Last Sunday of the month boundary.
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

/** Wrap fetch with an AbortController so a hung pfalz.de socket can't
 *  stall the whole scrape pipeline. The default fetch in Bun has no
 *  per-request timeout. */
async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      headers: { "User-Agent": "landau-today/1.0" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
