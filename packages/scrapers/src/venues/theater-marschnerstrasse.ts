import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.theater-marschnerstrasse.de";
const DATA_URL = `${BASE}/spielplan.json`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface Ensemble {
  name: string;
  ticketUrl?: string;
}

interface Production {
  id: string;
  title: string;
  subtitle?: string;
  ensemble?: string;
  genre?: string;
  active?: boolean;
  showPage?: boolean;
  poster?: string;
  ticketUrl?: string;
  showings?: Array<{ date: string; time?: string }>;
}

interface SpielplanData {
  ensembles?: Ensemble[];
  productions?: Production[];
}

/**
 * Theater an der Marschnerstraße, Barmbek-Süd — a shared house for four
 * amateur ensembles (Ensemble an der Marschnerstrasse, VB Thalia, DSV
 * Hamburg, Hamburg Players). The site renders its spielplan client-side from
 * `/spielplan.json`, written by the house's own editor: productions with
 * `showings[{date, time}]`, the presenting ensemble, and an `active` flag
 * that is false once a run has ended. Ticket links fall back from the
 * production to its ensemble's Reservix shop.
 */
export async function scrapeTheaterMarschnerstrasse(): Promise<VenueScrapeResult> {
  const res = await fetch(DATA_URL, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`theater-marschnerstrasse fetch failed: ${res.status}`);
  const data = (await res.json()) as SpielplanData;
  const today = todayIso();

  const ticketByEnsemble = new Map((data.ensembles ?? []).map((e) => [e.name, e.ticketUrl]));
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const p of data.productions ?? []) {
    if (p.active === false || !p.title) continue;
    const detailUrl = p.showPage === false ? `${BASE}/` : `${BASE}/stueck.html?id=${encodeURIComponent(p.id)}`;
    const ticketUrl = p.ticketUrl || (p.ensemble ? ticketByEnsemble.get(p.ensemble) : undefined) || null;
    const subtitle = p.subtitle?.trim() || null;

    for (const s of p.showings ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || s.date < today) continue;
      const time = s.time && /^\d{2}:\d{2}$/.test(s.time) ? s.time : null;
      const sourceEventId = `${p.id}|${s.date}|${time ?? ""}`;
      if (seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);

      events.push({
        source_event_id: sourceEventId,
        title: p.title.trim(),
        subtitle,
        description: null,
        date: s.date,
        time,
        detail_url: detailUrl,
        ticket_url: ticketUrl,
        image_url: p.poster ? `${BASE}/${p.poster}` : null,
        price_min: null,
        price_max: null,
        performers: p.ensemble?.trim() || null,
        venue_room: null,
        raw_category: p.genre?.trim() || null,
        labels: resolveStageLabels({
          title: p.title,
          subtitle: [subtitle, p.genre].filter(Boolean).join(" "),
          defaultLabel: "stage:theater",
          confidence: 0.85,
        }),
      });
    }
  }

  return { source_slug: "theater-marschnerstrasse", display_name: "Theater an der Marschnerstraße", events };
}
