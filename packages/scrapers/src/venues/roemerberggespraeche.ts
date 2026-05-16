import { detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://roemerberggespraeche-ffm.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const MONTHS_DE: Record<string, number> = {
  jan: 1,
  januar: 1,
  feb: 2,
  februar: 2,
  mrz: 3,
  mar: 3,
  märz: 3,
  maerz: 3,
  apr: 4,
  april: 4,
  mai: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dez: 12,
  dezember: 12,
};

const INSTALLMENT_HREF_RE = /https:\/\/roemerberggespraeche-ffm\.de\/(\d+)-roemerberggespraeche-[^"'\s)]+/g;

export async function scrapeRoemerberggespraeche(): Promise<VenueScrapeResult> {
  const homepage = await fetchHtml(BASE);
  const latest = pickLatestInstallment(homepage);
  if (!latest) return { source_slug: "roemerberggespraeche", events: [] };

  const page = await fetchHtml(latest.url);
  const date = extractDate(page);
  if (!date) return { source_slug: "roemerberggespraeche", events: [] };

  const today = todayIso();
  if (date < today) return { source_slug: "roemerberggespraeche", events: [] };

  const events: CanonicalScrapedEvent[] = parseProgramme(page).map(({ time, speakers, title }) => ({
    source_event_id: `rb-${latest.n}-${time.replace(":", "")}`,
    title,
    date,
    time,
    detail_url: latest.url,
    description: speakers || null,
    language: detectTalkLanguage(title, speakers),
    labels: [{ label: "talk:vortrag", confidence: 0.9, classifier: "scraper-hardcoded" }],
  }));

  return { source_slug: "roemerberggespraeche", events };
}

function pickLatestInstallment(html: string): { n: number; url: string } | null {
  let best: { n: number; url: string } | null = null;
  for (const m of html.matchAll(INSTALLMENT_HREF_RE)) {
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n)) continue;
    if (!best || n > best.n) best = { n, url: m[0] };
  }
  return best;
}

function extractDate(html: string): string | null {
  const re =
    /(?:Samstag|Sonntag|Freitag|Montag|Dienstag|Mittwoch|Donnerstag)?,?\s*(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\.?\s*(20\d{2})/g;
  for (const m of html.matchAll(re)) {
    const day = parseInt(m[1], 10);
    const monthKey = m[2].toLowerCase().replace(/[^a-zäöü]/g, "");
    const month = MONTHS_DE[monthKey];
    const year = parseInt(m[3], 10);
    if (!day || !month || !year) continue;
    const idx = m.index ?? 0;
    const after = html.slice(idx + m[0].length, idx + m[0].length + 160);
    if (!/\d{1,2}\s*Uhr/i.test(stripTags(after))) continue;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

interface ProgrammeEntry {
  time: string;
  speakers: string;
  title: string;
}

function parseProgramme(html: string): ProgrammeEntry[] {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const programIdx = stripped.search(/PROGRAMM\b/);
  if (programIdx < 0) return [];

  let block = stripped.slice(programIdx, programIdx + 20000);
  block = block.replace(/<(?:p|br|div|span|h[1-6]|li|ul|article|section)[^>]*>/gi, "\n");
  block = block.replace(/<\/(?:p|div|h[1-6]|li|ul|article|section)>/gi, "\n");
  block = block.replace(/<[^>]+>/g, "");
  block = decodeEntities(block);

  const lines = block
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  const entries: ProgrammeEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(.+)$/);
    if (!m) continue;
    const time = `${m[1].padStart(2, "0")}:${m[2]}`;
    const rest = m[3].trim();
    if (/^(mittagspause|kaffeepause|pause|ende\b|ausklang|schluss|fin\b)/i.test(rest)) continue;
    const next = lines[i + 1] ?? "";
    const looksLikeNextEntry = /^\d{1,2}:\d{2}\s*[–-]/.test(next);
    if (!next || looksLikeNextEntry) continue;
    entries.push({ time, speakers: rest, title: next });
    i++;
    if (entries.length >= 20) break;
  }
  return entries;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`roemerberggespraeche fetch failed: ${res.status} ${url}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&bdquo;/g, "„")
    .replace(/&ldquo;/g, "„")
    .replace(/&rdquo;/g, "“")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8222;/g, "„")
    .replace(/&#8220;/g, "„")
    .replace(/&#8221;/g, "“")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’");
}
