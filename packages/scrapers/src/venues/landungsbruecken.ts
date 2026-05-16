import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Landungsbrücken Frankfurt is a small free-theatre house at Gutleutstraße 294
 * with a hand-rolled PHP CMS. The spielplan page renders two month groups —
 * "Diesen Monat" and "Nächsten Monat" — each as a `<ul class="layout
 * termin-box">` of `<li class="record">` cards. Day-of-month + section month
 * gives the full date; the year only ever wraps when "Nächsten Monat"
 * crosses December.
 */

const BASE = "https://landungsbruecken.org";
const SPIELPLAN_URL = `${BASE}/de/spielplan.php`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeLandungsbruecken(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(SPIELPLAN_URL);
  const today = todayIso();
  const now = new Date(`${today}T00:00:00Z`);
  const sections = splitSections(html, now);

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const section of sections) {
    for (const record of extractRecords(section.html)) {
      const parsed = parseRecord(record, section.year, section.month);
      if (!parsed) continue;
      if (parsed.date < today) continue;
      if (seen.has(parsed.source_event_id)) continue;
      seen.add(parsed.source_event_id);
      events.push(parsed);
    }
  }

  return { source_slug: "landungsbruecken", events };
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
  month: number;
  html: string;
}

const SECTION_RE =
  /<h2[^>]*class="col-head"[^>]*>([^<]+)<\/h2>\s*<ul[^>]*class="layout termin-box"[^>]*>([\s\S]*?)<\/ul>/g;

function splitSections(html: string, now: Date): Section[] {
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
  return null;
}

const RECORD_RE = /<li[^>]+class="record"[^>]*>([\s\S]*?)<\/li>/g;

function extractRecords(sectionHtml: string): string[] {
  return Array.from(sectionHtml.matchAll(RECORD_RE), (m) => m[1]);
}

function parseRecord(
  recordHtml: string,
  year: number,
  month: number,
): (CanonicalScrapedEvent & { date: string }) | null {
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

  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Tickets/detail URLs from the page contain literal spaces and unescaped
  // ampersands. Re-encode the query string so consumers can build canonical
  // links without breaking.
  const detailUrl = detailHref ? `${BASE}/de/${reencodeQuery(decodeEntities(detailHref))}` : null;
  const ticketUrl = ticketHref ? `${BASE}/de/${reencodeQuery(decodeEntities(ticketHref))}` : null;

  const slug = slugify(title);
  const description = refClean ? `Mit ${refClean}` : subtitle;

  return {
    date,
    source_event_id: `${slug}|${date}|${time ?? ""}`,
    title,
    subtitle: subtitle || null,
    description,
    time,
    detail_url: detailUrl,
    ticket_url: ticketUrl ?? detailUrl,
    image_url: imageUrl,
    price_min: price,
    price_max: price,
    venue_room: null,
    labels: resolveStageLabels({ title, subtitle, hint: refClean || null, confidence: 0.85 }),
  };
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
