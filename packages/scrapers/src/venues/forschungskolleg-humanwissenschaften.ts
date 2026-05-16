import { classifyTalk } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.forschungskolleg-humanwissenschaften.de";
const LISTING_URL = `${BASE}/index.php/archive/events`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const ROW_RE = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
const DATE_RE = /(\d{2})\.(\d{2})\.(\d{4})\s*<br[^>]*>\s*(\d{1,2}):(\d{2})\s*Uhr/;
const LINK_RE = /<a[^>]+href="(\/index\.php\/archive\/events\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/;
const ROW_DIVS_RE = /<div[^>]*>([\s\S]*?)<\/div>/g;
const ORG_RE = /<em[^>]*>([\s\S]*?)<\/em>/;

export async function scrapeForschungskollegHumanwissenschaften(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(LISTING_URL);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ROW_RE)) {
    const row = m[1];
    const dateMatch = row.match(DATE_RE);
    if (!dateMatch) continue;
    const [, dd, mm, yyyy, hh, mi] = dateMatch;
    const date = `${yyyy}-${mm}-${dd}`;
    if (date < today) continue;

    const linkMatch = row.match(LINK_RE);
    if (!linkMatch) continue;
    const detailUrl = `${BASE}${linkMatch[1]}`;
    const titleRaw = cleanText(linkMatch[2]);
    if (!titleRaw) continue;
    if (/^FÄLLT AUS!?/i.test(titleRaw)) continue;
    const title = stripQuotes(titleRaw);
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const titleStripped = stripQuotes(title);
    const divs = [...row.matchAll(ROW_DIVS_RE)].map((d) => cleanText(d[1])).filter(Boolean);
    const descParts = divs
      .filter((s) => !stripQuotes(s).includes(titleStripped))
      .filter((s) => !/^\d{1,2}\.\d{1,2}\.\d{4}\b/.test(s));
    const organizer = cleanText(row.match(ORG_RE)?.[1] ?? "");
    if (organizer && !descParts.some((p) => p.includes(organizer))) descParts.push(organizer);
    const description = descParts.join(" — ").slice(0, 600) || null;

    const idMatch = linkMatch[1].match(/\/events\/(\d+)/);
    const sourceEventId = idMatch ? `fkh-${idMatch[1]}` : detailUrl;

    events.push({
      source_event_id: sourceEventId,
      title,
      date,
      time: `${hh.padStart(2, "0")}:${mi}`,
      detail_url: detailUrl,
      description,
      language: detectEnglish(title) ? "en" : null,
      labels: [
        {
          label: `talk:${classifyTalk(title, description).toLowerCase()}`,
          confidence: 0.85,
          classifier: "keyword:talk",
        },
      ],
    });
  }

  return { source_slug: "forschungskolleg-humanwissenschaften", events };
}

function detectEnglish(title: string): boolean {
  const t = title.toLowerCase();
  if (/[äöüß]/.test(t)) return false;
  if (/\b(der|die|das|den|dem|eine?|und|oder|nicht|von|zu|im|am|ist|wie|als|für|bei|mit|aus|über|durch)\b/.test(t)) {
    return false;
  }
  return /\b(the|of|and|on|to|in|is|with|how|why)\b.+\b(the|of|and|on|to|in|is|with)\b/.test(t);
}

function stripQuotes(s: string): string {
  return s.replace(/^[»„"„“‚'](.*)[«"”“’']$/, "$1").trim();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`forschungskolleg-humanwissenschaften fetch failed: ${res.status}`);
  return res.text();
}

function cleanText(s: string): string {
  return stripHtml(s).replace(/\s+/g, " ").trim();
}
