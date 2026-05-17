import { classifyEvent, classifyTalk, eventTypeToLabel } from "@museumsufer/classify";
import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Heinrich-Böll-Stiftung Hessen — civic-educational programme covering
 * Vorträge, Stadtteilrundgänge, Bachwanderungen, panel discussions.
 * Events listed on the WordPress homepage with date + city in a meta
 * span; full time/venue on each detail page (not fetched here to keep
 * the scrape cheap).
 *
 * Programme spans Hessen — Fulda, Gießen, Darmstadt events filter out
 * via the city allowlist (they're outside FRANKFURT_BBOX anyway).
 */
const BASE = "https://www.boell-hessen.de";
const LIST_URL = `${BASE}/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const BLOCK_RE =
  /<a\s+href=(https?:\/\/www\.boell-hessen\.de\/[^"\s>]+)\s+class="block__inner[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
const TITLE_RE = /<h2[^>]*>\s*([\s\S]*?)\s*<\/h2>/;
const SUB_RE = /<h3\s+class="sub[^"]*">\s*([\s\S]*?)\s*<\/h3>/;
const META_RE = /<span\s+class=meta>\s*<span>\s*(\d{2})\.(\d{2})\.(\d{4}),\s*([^<]+?)\s*<\/span>/;

const FRANKFURT_AREA_CITIES = new Set(["frankfurt", "offenbach", "bad homburg", "bad homburg vor der höhe", "hanau"]);

export async function scrapeBoellHessen(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`boell-hessen fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(BLOCK_RE)) {
    const detailUrl = m[1];
    const block = m[2];

    const meta = block.match(META_RE);
    if (!meta) continue;
    const date = `${meta[3]}-${meta[2]}-${meta[1]}`;
    if (date < today) continue;
    const city = meta[4].toLowerCase().trim();
    if (!FRANKFURT_AREA_CITIES.has(city)) continue;

    const title = stripHtml(decodeEntities(block.match(TITLE_RE)?.[1] ?? "")).trim();
    if (!title) continue;

    const slug = detailUrl.replace(/\/$/, "").split("/").pop();
    const sourceEventId = slug ? `${slug}|${date}` : `${title}|${date}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const subtitle = stripHtml(decodeEntities(block.match(SUB_RE)?.[1] ?? "")).trim() || null;

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle,
      description: subtitle,
      date,
      time: null,
      end_date: null,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: null,
      city: meta[4].trim(),
      raw_category: null,
      labels: [labelFor(title, subtitle)],
    });
  }

  return { source_slug: "boell-hessen", display_name: "Heinrich-Böll-Stiftung Hessen", events };
}

function labelFor(title: string, subtitle: string | null): ScrapedLabel {
  const type = classifyEvent(title, subtitle);
  if (type === "Vortrag") {
    const sub = classifyTalk(title, subtitle).toLowerCase();
    return { label: `talk:${sub}`, confidence: 0.85, classifier: "keyword:event" };
  }
  const mapped = eventTypeToLabel(type);
  if (mapped) return { label: mapped, confidence: 0.85, classifier: "keyword:event" };
  // The Stiftung's programme is civic-educational by default — talks and
  // panels even when the title doesn't carry a classifier keyword.
  return { label: "talk:vortrag", confidence: 0.6, classifier: "scraper-hardcoded" };
}
