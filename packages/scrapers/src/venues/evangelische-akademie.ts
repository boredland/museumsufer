import { classifyMusic, classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.evangelische-akademie.de";
const LISTING_URL = `${BASE}/kalender/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;

/**
 * Evangelische Akademie's REDAXO CMS tags every event with one or more
 * numeric tag IDs. We know the relevant ones:
 *   22 = Musik       → label "music:*"
 *   25 = Film        → skipped (not interesting for any consumer app)
 *   27 = Ausstellung → skipped
 *   anything else    → treated as a talk
 *
 * Previously two apps each fetched this listing with mutually exclusive
 * tag filters; here we emit both buckets and the apps decide.
 */

const SKIP_TAGS = new Set([25, 27]);
const MUSIC_TAG = 22;

const EN_MONTHS: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

const CARD_RE =
  /<div class="box grid-cell[^"]*"\s+data-tags="([^"]+)">\s*<a href="(\/kalender\/[^"]+)">([\s\S]*?)<\/a>\s*<\/div>/g;
const DAY_RE = /<div class="date-daydate">(\d+)<\/div>/;
const MONTH_RE = /<div class="date-month">([A-Za-z]+)<\/div>/;
const TITLE_RE = /<strong>([\s\S]*?)<\/strong>/;
const YEAR_RE = /<div class="date-year">(\d{4})<\/div>/;
const TIME_RANGE_RE = /(\d{1,2})\.(\d{2})\s*(?:&ndash;|–|-)\s*(\d{1,2})\.(\d{2})\s*Uhr/i;
const TIME_SINGLE_RE = /(\d{1,2})\.(\d{2})\s*Uhr/i;
const PRICE_RE = /(\d+(?:[.,]\d{1,2})?)\s*Euro/gi;
const TITLE_ADDITIONAL_RE = /<div class="title-additional">([\s\S]*?)<\/div>/;

export async function scrapeEvangelischeAkademie(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchText(LISTING_URL);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(CARD_RE)) {
    const tags = m[1]
      .split(",")
      .map((t) => parseInt(t.trim(), 10))
      .filter((n) => Number.isFinite(n));
    if (tags.some((t) => SKIP_TAGS.has(t))) continue;

    const detailPath = m[2];
    const detailUrl = `${BASE}${detailPath}`;
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const cardHtml = m[3];
    const dayMatch = DAY_RE.exec(cardHtml);
    const monthMatch = MONTH_RE.exec(cardHtml);
    if (!dayMatch || !monthMatch) continue;

    const mm = EN_MONTHS[monthMatch[1]];
    if (!mm) continue;
    const dd = dayMatch[1].padStart(2, "0");

    const titleMatch = TITLE_RE.exec(cardHtml);
    const title = titleMatch ? stripHtml(decodeEntities(titleMatch[1])).trim() : "";
    if (!title) continue;

    const subtitleMatch = /<strong>[\s\S]*?<\/strong><br>([\s\S]*?)\s*$/.exec(
      cardHtml.replace(/[\s\S]*<div class="box-bottom[^"]*">([\s\S]*)<\/a>$/, "$1"),
    );
    const subtitle = subtitleMatch ? stripHtml(decodeEntities(subtitleMatch[1])).trim() || null : null;

    await sleep(THROTTLE_MS);
    const detail = await fetchDetail(detailUrl);
    if (!detail.year) continue;

    const date = `${detail.year}-${mm}-${dd}`;
    if (date < today) continue;

    const slug = slugFromPath(detailPath) ?? slugify(`eaf-${date}-${title}`);
    const isMusic = tags.includes(MUSIC_TAG);
    const labels: ScrapedLabel[] = isMusic
      ? [
          {
            label: `music:${classifyMusic(title, subtitle, null, "chamber")}`,
            confidence: 1.0,
            classifier: "upstream-tag",
          },
        ]
      : [
          {
            label: `talk:${classifyTalk(title, subtitle).toLowerCase()}`,
            confidence: 0.95,
            classifier: "upstream-tag",
          },
        ];

    events.push({
      source_event_id: slug,
      title,
      subtitle,
      description: null,
      date,
      time: detail.time,
      end_time: detail.endTime,
      detail_url: detailUrl,
      ticket_url: detailUrl,
      image_url: null,
      language: detectTalkLanguage(title, subtitle),
      price_min: detail.priceMin,
      price_max: detail.priceMax,
      performers: subtitle,
      venue_room: null,
      raw_category: tags.join(","),
      labels,
    });
  }

  return { source_slug: "evangelische-akademie-frankfurt", events };
}

interface DetailFields {
  year: string | null;
  time: string | null;
  endTime: string | null;
  priceMin: number | null;
  priceMax: number | null;
}

async function fetchDetail(url: string): Promise<DetailFields> {
  let html: string;
  try {
    html = await fetchText(url);
  } catch {
    return { year: null, time: null, endTime: null, priceMin: null, priceMax: null };
  }

  const year = YEAR_RE.exec(html)?.[1] ?? null;

  const additionalRaw = TITLE_ADDITIONAL_RE.exec(html)?.[1] ?? "";
  const additional = decodeEntities(additionalRaw);

  const rangeMatch = TIME_RANGE_RE.exec(additional);
  let time: string | null = null;
  let endTime: string | null = null;
  if (rangeMatch) {
    time = `${rangeMatch[1].padStart(2, "0")}:${rangeMatch[2]}`;
    endTime = `${rangeMatch[3].padStart(2, "0")}:${rangeMatch[4]}`;
  } else {
    const singleMatch = TIME_SINGLE_RE.exec(additional);
    if (singleMatch) time = `${singleMatch[1].padStart(2, "0")}:${singleMatch[2]}`;
  }

  const prices: number[] = [];
  for (const pm of html.matchAll(PRICE_RE)) {
    const value = parseFloat(pm[1].replace(",", "."));
    if (Number.isFinite(value) && value > 0 && value < 500) prices.push(value);
  }

  return {
    year,
    time,
    endTime,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length > 1 ? Math.max(...prices) : null,
  };
}

function slugFromPath(path: string): string | null {
  const m = /\/kalender\/[^/]+\/(\d+)\//.exec(path);
  return m ? `eaf-${m[1]}` : null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`evangelische-akademie fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
