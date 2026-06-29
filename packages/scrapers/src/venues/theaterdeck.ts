import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Theaterdeck Hamburg (Theater Jugend Hamburg e.V.) — youth theatre school
 * with its own productions. The Nuxt frontend ships a prerendered
 * `_payload.json` in devalue format: a flat pool where object fields hold
 * *indices* into the same array. We scan for the performance objects (those
 * carrying `date_from` + `event_slug`) and dereference their fields.
 */
const BASE = "https://theaterdeck.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeTheaterdeck(): Promise<VenueScrapeResult> {
  const res = await fetch(`${BASE}/stuecke/_payload.json`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`theaterdeck fetch failed: ${res.status}`);
  const pool = (await res.json()) as unknown[];
  const today = todayIso();

  // Devalue: a field value that is a number indexes back into `pool`.
  const str = (ref: unknown): string | null => (typeof ref === "number" ? ((pool[ref] as string) ?? null) : null);

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const node of pool) {
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    const rec = node as Record<string, number | undefined>;
    if (rec.date_from === undefined || rec.event_slug === undefined) continue;

    const iso = str(rec.date_from);
    const slug = str(rec.event_slug);
    const title = str(rec.name);
    if (!iso || !slug || !title) continue;

    const date = iso.slice(0, 10);
    if (date < today) continue;

    const subId = rec.subeventId !== undefined ? pool[rec.subeventId] : undefined;
    const sourceEventId =
      typeof subId === "number" || typeof subId === "string" ? `${slug}|${subId}` : `${slug}|${iso}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const autor = str(rec.autor);
    const soldOut = rec.soldOut !== undefined ? pool[rec.soldOut] === true : false;

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle: autor,
      description: null,
      date,
      time: iso.slice(11, 16),
      detail_url: `${BASE}/stuecke/${slug}`,
      ticket_url: `${BASE}/stuecke/${slug}`,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: null,
      raw_category: soldOut ? "sold_out" : null,
      availability: soldOut ? "sold_out" : null,
      labels: resolveStageLabels({
        title,
        hint: autor,
        defaultLabel: "stage:theater",
        confidence: 0.85,
        classifier: "scraper-hardcoded",
      }),
    });
  }

  return { source_slug: "theaterdeck", display_name: "Theaterdeck Hamburg", events };
}
