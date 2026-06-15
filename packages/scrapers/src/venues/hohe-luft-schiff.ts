import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://hoheluftschiff.de";
const SPIELPLAN_URL = `${BASE}/spielplan`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * HoheLuftschiff — Hamburg's floating children's theater on the Isebek canal.
 *
 * The spielplan page embeds one `<script type="application/ld+json">` block per
 * dated performance, each containing a full Schema.org `Event` object with:
 *   - `name`            show title
 *   - `description`     full show description
 *   - `startDate`       ISO-8601 datetime "YYYY-MM-DDTHH:MM"
 *   - `image`           high-res OG-sized image URL
 *   - `eventStatus`     EventScheduled / EventCancelled
 *
 * Performance detail URLs come from the `<a>` links wrapping each card
 * (pattern: `/stueck/<slug>/<YYYYMMDD>-<HHMM>`). We also detect sold-out
 * status from the "Ausverkauft!" text in the surrounding card.
 *
 * The page optionally accepts `?tag=<category>` and `?minage=<n>` filters,
 * but we fetch without filters to get everything.
 */
export async function scrapeHoheLuftschiff(): Promise<VenueScrapeResult> {
  const html = await fetchPage();
  const events = parseEvents(html);
  return { source_slug: "hohe-luft-schiff", display_name: "HoheLuftschiff", events };
}

async function fetchPage(): Promise<string> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      "Accept-Language": "de-DE,de;q=0.9",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    },
  });
  if (!res.ok) throw new Error(`HoheLuftschiff fetch failed: ${res.status}`);
  return res.text();
}

interface EventCard {
  href: string;
  jsonLd: SchemaEvent;
  soldOut: boolean;
}

interface SchemaEvent {
  "@type"?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: string;
  eventStatus?: string;
}

// Match every <a href="…/stueck/…">…</a> block (these are the event cards)
const _CARD_RE =
  /<a\s+class="block group[^"]*"\s+href="(https:\/\/hoheluftschiff\.de\/stueck\/[^"]+)">([\s\S]*?)<\/a>\s*(?:<script type="application\/ld\+json">([\s\S]*?)<\/script>)?/gi;

function parseEvents(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Extract all (href, block, jsonLd) tuples
  const cards = extractCards(html);

  for (const card of cards) {
    const schema = card.jsonLd;
    const rawStart = schema.startDate ?? "";
    if (!rawStart) continue;

    const date = rawStart.slice(0, 10);
    if (date < today) continue;

    const time = rawStart.length > 10 ? rawStart.slice(11, 16) : null;
    const title = (schema.name ?? "").trim();
    if (!title) continue;

    const cancelled = (schema.eventStatus ?? "").includes("EventCancelled");
    if (cancelled) continue;

    const sourceEventId = card.href.replace(BASE, "");
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const description = (schema.description ?? "").trim() || null;

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle: null,
      description: description ? description.slice(0, 500) : null,
      date,
      time,
      detail_url: card.href,
      ticket_url: card.href, // detail page has "Jetzt buchen" button
      image_url: schema.image ?? null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: "HoheLuftschiff",
      raw_category: card.soldOut ? "sold_out" : null,
      labels: resolveStageLabels({
        title,
        subtitle: description,
        defaultLabel: "stage:theater",
        confidence: 0.85,
      }),
    });
  }

  return events;
}

function extractCards(html: string): EventCard[] {
  const cards: EventCard[] = [];

  // We need to find pairs of card+jsonLd together. Walk through the HTML
  // looking for ld+json blocks; each is preceded by a card <a> tag.
  const JSON_LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  const A_TAG_RE = /<a\s+class="block group[^"]*"\s+href="(https:\/\/hoheluftschiff\.de\/stueck\/[^"]+)"/gi;

  // Find all JSON-LD positions and their content
  const jsonLdBlocks: Array<{ pos: number; schema: SchemaEvent }> = [];
  let m: RegExpExecArray | null;
  while ((m = JSON_LD_RE.exec(html)) !== null) {
    try {
      const schema = JSON.parse(m[1]) as SchemaEvent;
      if (schema["@type"] === "Event" || schema.startDate) {
        jsonLdBlocks.push({ pos: m.index, schema });
      }
    } catch {
      // ignore malformed JSON
    }
  }

  // Find all card <a> positions and hrefs
  const cardTags: Array<{ pos: number; href: string; endPos: number }> = [];
  while ((m = A_TAG_RE.exec(html)) !== null) {
    cardTags.push({ pos: m.index, href: m[1], endPos: m.index + m[0].length });
  }

  // For each JSON-LD block, find the most recently preceding card tag
  for (const jld of jsonLdBlocks) {
    // Find the latest card tag whose position is before this JSON-LD block
    let bestCard: (typeof cardTags)[0] | null = null;
    for (const ct of cardTags) {
      if (ct.pos < jld.pos) {
        if (!bestCard || ct.pos > bestCard.pos) {
          bestCard = ct;
        }
      }
    }
    if (!bestCard) continue;

    // Check for "Ausverkauft" text between card start and JSON-LD
    const between = html.slice(bestCard.pos, jld.pos);
    const soldOut = /Ausverkauft/i.test(between);

    cards.push({ href: bestCard.href, jsonLd: jld.schema, soldOut });
  }

  return cards;
}
