import { classifyTalk } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const LISTING_URL = "https://www.fes.de/landesbuero-hessen/veranstaltungen";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const ITEM_RE = /<div class="row row--no-margin digbib-event-item[^"]*"[^>]*>([\s\S]+?)<hr\s*\/?>/g;
const SUBHEADER_RE = /<div class="subheader">\s*([\s\S]*?)\s*<\/div>/;
const TITLE_RE = /<h3[^>]*>\s*([\s\S]*?)\s*<\/h3>/;
const DESC_RE = /<p[^>]*>\s*([\s\S]*?)\s*<\/p>/;
const DETAIL_RE = /<a[^>]+href="(https?:\/\/www\.fes\.de\/veranstaltungen\/veranstaltungsdetail\/\d+)"[^>]*>\s*Details/;
const DATE_RE = /(\d{2})\.(\d{2})\.(\d{2})/;

export async function scrapeFesHessen(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(LISTING_URL);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ITEM_RE)) {
    const card = m[1];

    const subheader = cleanText(card.match(SUBHEADER_RE)?.[1] ?? "");
    const dateMatch = subheader.match(DATE_RE);
    if (!dateMatch) continue;
    const [, dd, mm, yy] = dateMatch;
    const date = `20${yy}-${mm}-${dd}`;
    if (date < today) continue;

    const locMatch = subheader.match(/–\s*(.+)$/);
    const location = locMatch ? locMatch[1].trim() : "";
    if (/^online$/i.test(location)) continue;
    if (!/frankfurt/i.test(location)) continue;

    const detail = card.match(DETAIL_RE);
    if (!detail) continue;
    const detailUrl = detail[1];
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const title = cleanText(card.match(TITLE_RE)?.[1] ?? "");
    if (!title) continue;
    if (/KommunalAkademie\s+digital\s+Kurs/i.test(title)) continue;

    const description =
      cleanText(card.match(DESC_RE)?.[1] ?? "")
        .replace(/[…...]+\s*$/, "")
        .slice(0, 500) || null;

    const sourceEventId = detailUrl.replace(/\/+$/, "").split("/").pop() ?? detailUrl;

    events.push({
      source_event_id: sourceEventId,
      title,
      date,
      detail_url: detailUrl,
      description: location ? (description ? `${location} — ${description}` : location) : description,
      city: "Frankfurt",
      labels: [
        {
          label: `talk:${classifyTalk(title, description).toLowerCase()}`,
          confidence: 0.85,
          classifier: "keyword:talk",
        },
      ],
    });
  }

  return { source_slug: "fes-hessen", events };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`fes-hessen fetch failed: ${res.status}`);
  return res.text();
}

function cleanText(s: string): string {
  return stripHtml(s).replace(/\s+/g, " ").trim();
}
