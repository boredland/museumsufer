import { classifyMusic, looksLikeMusic } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * FABRIK in Hamburg-Altona — a long-running culture & communication centre
 * known above all for live music (world, jazz, folk, global pop). Its
 * /programm page embeds one schema.org `Event` JSON-LD block per show, which
 * is the cleanest source: name, startDate (ISO + TZ), endDate, image,
 * description. Per-event detail URLs aren't in the JSON-LD, so we zip the
 * in-document-order `/veranstaltungsdetail/<slug>-<id>` links to the blocks.
 *
 * The hall occasionally hosts non-music events (conventions, markets); those
 * carry no musical signal and are dropped — only concerts feed konzert.haus.
 */
const PROGRAMM_URL = "https://fabrik.de/programm";
const BASE = "https://fabrik.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

interface LdEvent {
  name?: string;
  startDate?: string;
  endDate?: string;
  image?: string;
  description?: string;
}

export async function scrapeFabrik(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAMM_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fabrik fetch failed: ${res.status}`);
  const html = await res.text();

  const ldBlocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => safeParse(m[1]))
    .filter((o): o is LdEvent => !!o && (o as { "@type"?: string })["@type"] === "Event");

  // Unique detail links in document order, to pair with the blocks.
  const detailLinks: string[] = [];
  const seenLink = new Set<string>();
  for (const m of html.matchAll(/\/veranstaltungsdetail\/[a-z0-9-]+/gi)) {
    if (!seenLink.has(m[0])) {
      seenLink.add(m[0]);
      detailLinks.push(m[0]);
    }
  }

  const events: CanonicalScrapedEvent[] = [];
  ldBlocks.forEach((ld, i) => {
    if (!ld.name || !ld.startDate) return;
    const title = stripHtml(decodeEntities(ld.name)).trim();
    const date = ld.startDate.slice(0, 10);
    if (date < today) return;
    const time = ld.startDate.length >= 16 ? ld.startDate.slice(11, 16) : null;
    const endTime = ld.endDate && ld.endDate.length >= 16 ? ld.endDate.slice(11, 16) : null;

    const description = ld.description ? stripHtml(decodeEntities(ld.description)).replace(/\s+/g, " ").trim() : null;
    const labels = classify(title, description);
    if (!labels) return; // non-music (convention, market): no vertical

    // Pair with the detail link at the same document position.
    const link = detailLinks[i];
    const detailUrl = link ? `${BASE}${link}` : PROGRAMM_URL;

    events.push({
      source_event_id: link ? link.split("/").pop()! : `${slugify(title)}|${date}`,
      title,
      description,
      date,
      time,
      end_time: endTime,
      detail_url: detailUrl,
      ticket_url: detailUrl,
      image_url: ld.image ?? null,
      labels,
    });
  });

  return { source_slug: "fabrik", display_name: "Fabrik", events };
}

function classify(title: string, description: string | null): ScrapedLabel[] | null {
  if (looksLikeMusic(title, description) || /\bkonzert|musik|live|tour|band|festival\b/i.test(title)) {
    const genre = classifyMusic(title, null, description, "world");
    return [{ label: `music:${genre}`, confidence: 0.8, classifier: "keyword:music" }];
  }
  return null;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s.trim());
  } catch {
    return null;
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
