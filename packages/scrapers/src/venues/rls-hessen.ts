import { classifyTalk } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://hessen.rosalux.de";
const LISTING_URL = `${BASE}/aktuelle-veranstaltungen`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const SECTION_RE = /<section[^>]*data-section="event-[^"]+"[^>]*>([\s\S]+?)<\/section>/g;
const LINK_RE =
  /<a class="teaser__link"[^>]+href="([^"]+)"[^>]*>[\s\S]*?<span class="teaser__title-text">([\s\S]*?)<\/span>/;
const META_RE = /<span class="teaser__meta-event-text">\s*([\s\S]*?)\s*<\/span>/;
const DAY_RE = /<span class="teaser__date-day">\s*(\d{1,2})\s*<\/span>/;
const MONTH_RE = /<span class="teaser__date-month">\s*([A-Za-zäöü]+)\s*<\/span>/;
const YEAR_RE = /<span class="teaser__date-year">\s*(20\d{2})\s*<\/span>/;
const DATE_GROUP_RIGHT_RE =
  /<span class="teaser__date-group teaser__date-group--right"[^>]*>([\s\S]+?)<\/span>\s*<\/p>/;
const TEXT_RE = /<p class="teaser__text"[^>]*>\s*([\s\S]*?)\s*<\/p>/;

const MONTHS_DE: Record<string, number> = {
  jan: 1,
  januar: 1,
  feb: 2,
  februar: 2,
  mar: 3,
  märz: 3,
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
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dez: 12,
  dezember: 12,
};

export async function scrapeRlsHessen(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(LISTING_URL);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(SECTION_RE)) {
    const card = m[1];

    const dayMatch = card.match(DAY_RE);
    const monthMatch = card.match(MONTH_RE);
    const yearMatch = card.match(YEAR_RE);
    if (!dayMatch || !monthMatch || !yearMatch) continue;
    const month = MONTHS_DE[monthMatch[1].toLowerCase().replace(/[^a-zäöü]/g, "")];
    if (!month) continue;
    const date = `${yearMatch[1]}-${String(month).padStart(2, "0")}-${dayMatch[1].padStart(2, "0")}`;
    if (date < today) continue;

    const rightGroup = card.match(DATE_GROUP_RIGHT_RE);
    let city: string | null = null;
    let time: string | null = null;
    if (rightGroup) {
      const spans = [...rightGroup[1].matchAll(/<span[^>]*>\s*([\s\S]*?)\s*<\/span>/g)].map((s) => cleanText(s[1]));
      if (spans.length >= 2) {
        city = spans[0] || null;
        const timeText = spans[1] || "";
        const tm = timeText.match(/(\d{1,2})[:.](\d{2})/);
        if (tm) time = `${tm[1].padStart(2, "0")}:${tm[2]}`;
      }
    }
    if (!city || !/frankfurt/i.test(city)) continue;

    const link = card.match(LINK_RE);
    if (!link) continue;
    const detailUrl = link[1].startsWith("http") ? link[1] : `${BASE}${link[1]}`;
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const title = cleanText(link[2]);
    if (!title) continue;

    const formatLabel = cleanText(card.match(META_RE)?.[1] ?? "");
    const excerpt = cleanText(card.match(TEXT_RE)?.[1] ?? "");
    const description = excerpt || formatLabel || null;
    const sourceEventId = detailUrl.replace(/\/+$/, "").split("/").pop() ?? detailUrl;

    events.push({
      source_event_id: sourceEventId,
      title,
      date,
      time,
      detail_url: detailUrl,
      description,
      city,
      raw_category: formatLabel || null,
      labels: [
        {
          label: `talk:${labelFromFormat(formatLabel, title)}`,
          confidence: formatLabel ? 0.95 : 0.7,
          classifier: formatLabel ? "upstream-category" : "keyword:talk",
        },
      ],
    });
  }

  return { source_slug: "rls-hessen", display_name: "Rosa-Luxemburg-Stiftung Hessen", events };
}

function labelFromFormat(formatLabel: string, title: string): string {
  const h = `${formatLabel} ${title}`.toLowerCase();
  if (/lesung/.test(h) && !/diskussion|vortrag/.test(h.replace(/lesung/g, ""))) return "lesung";
  if (/buchpräsentation|buchvorstellung/.test(h)) return "lesung";
  if (/diskussion|podium|debatte|gespräch|dialog/.test(h)) return "diskussion";
  return classifyTalk(title).toLowerCase();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`rls-hessen fetch failed: ${res.status}`);
  return res.text();
}

function cleanText(s: string): string {
  return stripHtml(s).replace(/\s+/g, " ").trim();
}
