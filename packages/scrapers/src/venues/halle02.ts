import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import PQueue from "p-queue";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.halle02.de";
const REST_URL = `${BASE}/wp-json/wp/v2/programm`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.3998;
const LON = 8.686;
const CITY = "heidelberg";

interface WpProgram {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  content?: { rendered: string };
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
}

interface ParsedDetail {
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  endTime: string | null;
  priceMin: number | null;
  ticketUrl: string | null;
  venueRoom: string | null;
  categoryHint: string;
  imageUrl: string | null;
}

export async function scrapeHalle02(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const posts = await fetchProgramList();

  const toFetch: WpProgram[] = [];
  for (const post of posts) {
    const slugDate = parseSlugDate(post.slug);
    if (slugDate && slugDate.date < today) continue;
    toFetch.push(post);
  }

  const queue = new PQueue({ concurrency: 8 });
  const detailResults = await Promise.all(
    toFetch.map((post) =>
      queue.add(async () => {
        try {
          const r = await fetch(post.link, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(20000),
          });
          if (!r.ok) return null;
          const parsed = parseDetail(await r.text(), post);
          if (!parsed || parsed.date < today) return null;
          return { post, parsed };
        } catch {
          return null;
        }
      }),
    ),
  );

  const events: CanonicalScrapedEvent[] = [];
  for (const result of detailResults) {
    if (!result) continue;
    const { post, parsed } = result;
    const labels = resolveStageLabels({
      title: parsed.title,
      subtitle: parsed.description,
      hint: parsed.categoryHint,
      defaultLabel: "music:classical",
      classifier: "scraper-hardcoded",
      confidence: 0.8,
    });

    events.push({
      source_event_id: String(post.id),
      title: parsed.title,
      subtitle: parsed.description,
      description: parsed.description,
      date: parsed.date,
      time: parsed.time,
      end_time: parsed.endTime,
      detail_url: post.link,
      ticket_url: parsed.ticketUrl ?? post.link,
      image_url: parsed.imageUrl,
      price_min: parsed.priceMin,
      venue_room: parsed.venueRoom,
      city: CITY,
      lat: LAT,
      lon: LON,
      labels,
    });
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return { source_slug: "halle02", display_name: "halle02", events };
}

async function fetchProgramList(): Promise<WpProgram[]> {
  const posts: WpProgram[] = [];
  for (let page = 1; page <= 2; page++) {
    const url = `${REST_URL}?per_page=100&orderby=date&order=desc&_embed&page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) break;
    const body = (await res.json()) as WpProgram[];
    if (!Array.isArray(body) || body.length === 0) break;
    posts.push(...body);
    if (body.length < 100) break;
  }
  return posts;
}

function parseSlugDate(slug: string): { date: string } | null {
  const numeric6 = /-(\d{2})(\d{2})(\d{2})$/.exec(slug);
  if (numeric6) {
    const year = 2000 + parseInt(numeric6[1], 10);
    const month = parseInt(numeric6[2], 10);
    const day = parseInt(numeric6[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    }
  }
  return null;
}

function parseDetail(html: string, post: WpProgram): ParsedDetail | null {
  const relevant = html.split("Das könnte dir auch gefallen")[0] ?? html;

  const h1Marker = '<h1 class="elementor-heading-title elementor-size-default">';
  const h1Index = relevant.indexOf(h1Marker);
  if (h1Index < 0) return null;

  const title = cleanText(
    extractFirst(
      relevant.slice(h1Index),
      /<h1[^>]*class="[^"]*elementor-heading-title[^"]*elementor-size-default[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
    ),
  );
  if (!title) return null;

  const description = buildDescription(post);
  const date = parseLastDateBefore(relevant, h1Index);
  if (!date) return null;

  const afterH1 = relevant.slice(h1Index);
  const time =
    parseTime(afterH1, /Beginn:\s*(\d{1,2}):(\d{2})/i) ?? parseTime(afterH1, /Einlass:\s*(\d{1,2}):(\d{2})/i);
  const endTime = parseTime(afterH1, /Ende:\s*(\d{1,2}):(\d{2})/i);

  const priceMin = parsePrice(relevant);
  const ticketUrl = extractFirst(relevant, /https?:\/\/t\.rausgegangen\.de\/tickets\/[^"'\s]+/i) ?? null;

  const venueRoom = extractCategory(relevant, "location") ?? null;
  const categoryHint = [extractCategory(relevant, "genre"), extractCategory(relevant, "veranstaltungsart"), venueRoom]
    .filter(Boolean)
    .join(" ");

  const imageUrl =
    post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ??
    extractFirst(relevant, /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ??
    null;

  return {
    title,
    description,
    date,
    time,
    endTime,
    priceMin,
    ticketUrl,
    venueRoom,
    categoryHint,
    imageUrl,
  };
}

function buildDescription(post: WpProgram): string | null {
  const raw = post.excerpt?.rendered || post.content?.rendered || "";
  const text = stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 400 ? `${text.slice(0, 397)}...` : text;
}

function parseLastDateBefore(text: string, index: number): string | null {
  const before = text.slice(0, index);
  const re = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;
  let last: { day: number; month: number; year: number } | null = null;
  for (const m of before.matchAll(re)) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      last = { day, month, year };
    }
  }
  if (!last) return null;
  return `${last.year}-${String(last.month).padStart(2, "0")}-${String(last.day).padStart(2, "0")}`;
}

function parseTime(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  if (!m) return null;
  return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
}

function parsePrice(text: string): number | null {
  if (/eintritt\s*frei|kostenlos|gratis/i.test(text)) return null;
  const m = /ab\s+(\d+)(?:[,.](\d{2}))?\s*€/.exec(text);
  if (!m) return null;
  const euros = parseInt(m[1], 10);
  const cents = m[2] ? parseInt(m[2], 10) : 0;
  return euros + cents / 100;
}

function extractCategory(text: string, taxonomy: string): string | null {
  const re = new RegExp(`href="https://www\\.halle02\\.de/${taxonomy}/[^"]+/">([^<]+)</a>`, "gi");
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const t = cleanText(m[1]);
    if (t) out.push(t);
  }
  return out.length ? out.join(" ") : null;
}

function extractFirst(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  return m ? cleanText(m[1]) : null;
}

function cleanText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
  return text || null;
}
