import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

/**
 * Landungsbrücken Frankfurt is a small free-theatre house at Gutleutstraße 294
 * with a hand-rolled PHP CMS. The spielplan page renders two month groups —
 * "Diesen Monat" and "Nächsten Monat" — each as a `<ul class="layout
 * termin-box">` of `<li class="record">` cards.
 *
 * We parse:
 *   - the section header to derive the month/year (current calendar month for
 *     "Diesen", current+1 for "Nächsten"; the page never shows further out).
 *   - each record's `.dayofmonth strong` for the day, `.timestamp` for the
 *     start time and free-form price tail, `.copy strong` for the title,
 *     `.copy p:nth-child(2)` for an optional subtitle line, and `.detail-link`
 *     anchors for detail/ticket URLs.
 *
 * Day-of-month + section month gives us the full date — the year only ever
 * needs to wrap when "Nächsten Monat" crosses December.
 */

const BASE = "https://landungsbruecken.org";
const SPIELPLAN_URL = `${BASE}/de/spielplan.php`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeLandungsbruecken(): Promise<ScrapeResult> {
  const html = await fetchHtml(SPIELPLAN_URL);
  const today = todayIso();
  const now = new Date(`${today}T00:00:00Z`);
  const sections = splitSections(html, now);

  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];

  for (const section of sections) {
    for (const record of extractRecords(section.html)) {
      const parsed = parseRecord(record, section.year, section.month);
      if (!parsed) continue;
      if (parsed.date < today) continue;

      if (!showsBySlug.has(parsed.show.slug)) {
        showsBySlug.set(parsed.show.slug, parsed.show);
      }
      performances.push(parsed.perf);
    }
  }

  return {
    theater_slug: "landungsbruecken",
    shows: [...showsBySlug.values()],
    performances,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

interface Section {
  year: number;
  /** 1-based month */
  month: number;
  html: string;
}

const SECTION_RE =
  /<h2[^>]*class="col-head"[^>]*>([^<]+)<\/h2>\s*<ul[^>]*class="layout termin-box"[^>]*>([\s\S]*?)<\/ul>/g;

export function splitSections(html: string, now: Date): Section[] {
  const out: Section[] = [];
  for (const m of html.matchAll(SECTION_RE)) {
    const headline = decodeEntities(m[1]).trim();
    const offset = monthOffsetFromHeadline(headline);
    if (offset == null) continue;
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    out.push({ year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, html: m[2] });
  }
  return out;
}

function monthOffsetFromHeadline(headline: string): number | null {
  const lc = headline.toLowerCase();
  if (lc.includes("diesen monat")) return 0;
  if (lc.includes("nächsten monat") || lc.includes("naechsten monat")) return 1;
  // Any explicit "in X Monaten" / specific month names could be added later;
  // the live page only ships the two known headlines.
  return null;
}

const RECORD_RE = /<li[^>]+class="record"[^>]*>([\s\S]*?)<\/li>/g;

export function extractRecords(sectionHtml: string): string[] {
  return Array.from(sectionHtml.matchAll(RECORD_RE), (m) => m[1]);
}

interface ParsedRecord {
  show: ScrapedShow;
  perf: ScrapedPerformance;
  date: string;
}

export function parseRecord(recordHtml: string, year: number, month: number): ParsedRecord | null {
  const day = matchInt(recordHtml, /<p[^>]*class="dayofmonth"[^>]*>\s*<strong>\s*(\d{1,2})/);
  if (day == null) return null;

  const titleRaw = matchOne(recordHtml, /<p>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/);
  if (!titleRaw) return null;
  const title = collapseWs(decodeEntities(stripHtml(titleRaw)));
  if (!title) return null;

  const timestamp = matchOne(recordHtml, /<p[^>]*class="timestamp"[^>]*>([\s\S]*?)<\/p>/);
  const time = timestamp ? parseStartTime(timestamp) : null;
  const price = timestamp ? parsePrice(timestamp) : null;

  const subtitleRaw = matchOne(recordHtml, /<\/strong>\s*<\/p>\s*<p>([\s\S]*?)<\/p>/);
  const subtitle = subtitleRaw ? collapseWs(decodeEntities(stripHtml(subtitleRaw))) || null : null;

  const ref = matchOne(recordHtml, /<p[^>]*class="ref"[^>]*>([\s\S]*?)<\/p>/);
  const refClean = ref ? collapseWs(decodeEntities(stripHtml(ref))) : "";

  const detailHref = matchOne(recordHtml, /<a[^>]+href="(programm_aktuell\.php\?[^"]+)"[^>]*>\s*Details/i);
  const ticketHref = matchOne(recordHtml, /<a[^>]+href="(tickets\.php\?[^"]+)"[^>]*>\s*Tickets/i);

  const imgSrc = matchOne(recordHtml, /<img[^>]+src="([^"]+)"/);
  const imageUrl = imgSrc ? normalizeUrl(imgSrc.replace(/^\.\.\//, "/"), BASE) : null;

  const date = formatDate(year, month, day);
  // Tickets/detail URLs from the page contain literal spaces and unescaped
  // ampersands inside `prg=` and `dt=` values. The browser handles these,
  // but the URL constructor (used by buildUtm + new URL elsewhere) parses
  // the rogue `&` as another param boundary and breaks the link. Re-encode
  // the query string before passing through normalizeUrl.
  const detailUrl = detailHref ? `${BASE}/de/${reencodeQuery(decodeEntities(detailHref))}` : null;
  const ticketUrl = ticketHref ? `${BASE}/de/${reencodeQuery(decodeEntities(ticketHref))}` : null;

  const slug = slugify(title);
  const show: ScrapedShow = {
    slug,
    title,
    subtitle: subtitle || null,
    description: refClean ? `Mit ${refClean}` : null,
    image_url: imageUrl,
    detail_url: detailUrl,
  };

  const perf: ScrapedPerformance = {
    show_slug: slug,
    date,
    time,
    venue_room: null,
    provider_event_id: null,
    ticket_url: ticketUrl ?? detailUrl,
    status: "available",
    price_min: price,
    price_max: price,
  };

  return { show, perf, date };
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const TIME_RE = /Beginn\s+(\d{1,2})[:.](\d{2})/;

function parseStartTime(timestamp: string): string | null {
  const m = decodeEntities(timestamp).match(TIME_RE);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

const PRICE_RE = /(?:Eintritt|VVK|AK|EUR|€)\s*[^\d]{0,12}(\d{1,3}(?:[.,]\d{1,2})?)/i;

function parsePrice(timestamp: string): number | null {
  const text = decodeEntities(stripHtml(timestamp));
  const m = text.match(PRICE_RE);
  if (!m) return null;
  const num = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

function matchOne(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

function matchInt(html: string, re: RegExp): number | null {
  const v = matchOne(html, re);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function reencodeQuery(href: string): string {
  const qIdx = href.indexOf("?");
  if (qIdx < 0) return href;
  const path = href.slice(0, qIdx);
  const query = href.slice(qIdx + 1);
  // Split on the first `=` of each k=v pair. Each pair is delimited by `&`,
  // but values themselves may contain raw `&`s — we accept the first parser
  // pass since the source format only emits `prg=…&dt=…` and `dt=` is always
  // the last param. So: split on the boundary `&dt=` if present, else `&t=`.
  const params = splitTopLevel(query);
  const encoded = params
    .map((kv) => {
      const eq = kv.indexOf("=");
      if (eq < 0) return encodeURIComponent(kv);
      const k = kv.slice(0, eq);
      const v = kv.slice(eq + 1);
      return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
    })
    .join("&");
  return `${path}?${encoded}`;
}

function splitTopLevel(query: string): string[] {
  // Landungsbrücken always emits prg=<title>&dt=<date>. Split before each
  // `&` followed by `<known-key>=`, so embedded ampersands inside the title
  // stay attached to the prg= value.
  const KNOWN_KEYS = ["prg", "dt", "t524", "g524", "f524"];
  const out: string[] = [];
  let last = 0;
  for (let i = 0; i < query.length; i++) {
    if (query[i] !== "&") continue;
    const tail = query.slice(i + 1);
    if (KNOWN_KEYS.some((k) => tail.startsWith(`${k}=`))) {
      out.push(query.slice(last, i));
      last = i + 1;
    }
  }
  out.push(query.slice(last));
  return out;
}
