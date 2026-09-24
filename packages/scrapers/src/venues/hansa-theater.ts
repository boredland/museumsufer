import { decodeEntities, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.hansa-theater.com";
const SPIELPLAN_URL = `${BASE}/spielplan/`;
const INIT_LOAD_URL = `${BASE}/?evo-ajax=eventon_init_load`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HORIZON_DAYS = 90;

interface EventOnOccurrence {
  ID: number | string;
  _ID: string;
  event_title: string;
  event_start_unix: string;
  event_pmv?: { evcal_subtitle?: string[] };
}

/**
 * Hansa-Theater Hamburg (Varieté, St. Georg). The spielplan is an EventOn 5
 * calendar that loads client-side: the page carries a per-page nonce, and
 * `?evo-ajax=eventon_init_load` returns every occurrence in a focus date
 * range as JSON. Only the nonce and the range are required; the calendar id
 * key is arbitrary.
 *
 * EventOn stores Berlin wall-clock time in `event_start_unix` as if it were
 * UTC, so the date and time are read in UTC.
 *
 * This replaces an Eventim search that 403s from every IP we have (direct
 * and through FETCH_PROXY), which made a busy season look like Sommerpause.
 */
export async function scrapeHansaTheater(): Promise<VenueScrapeResult> {
  const pageRes = await fetch(SPIELPLAN_URL, { headers: { "User-Agent": UA } });
  if (!pageRes.ok) throw new Error(`hansa-theater spielplan fetch failed: ${pageRes.status}`);
  const nonce = (await pageRes.text()).match(/"n":"([0-9a-f]+)"/)?.[1];
  if (!nonce) throw new Error("hansa-theater: EventOn nonce not found on spielplan page");

  const today = todayIso();
  const start = Math.floor(Date.parse(`${today}T00:00:00Z`) / 1000);
  const body = new URLSearchParams({
    nonce,
    "cals[c][sc][focus_start_date_range]": String(start),
    "cals[c][sc][focus_end_date_range]": String(start + HORIZON_DAYS * 86_400),
  });
  const res = await fetch(INIT_LOAD_URL, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`hansa-theater calendar fetch failed: ${res.status}`);
  const data = (await res.json()) as { status?: string; msg?: string; cals?: { c?: { json?: EventOnOccurrence[] } } };
  if (data.status === "bad") throw new Error(`hansa-theater calendar rejected: ${data.msg}`);

  const events: CanonicalScrapedEvent[] = [];
  for (const occ of data.cals?.c?.json ?? []) {
    const title = decodeEntities(occ.event_title ?? "").trim();
    const unix = Number(occ.event_start_unix);
    if (!title || !Number.isFinite(unix)) continue;
    const iso = new Date(unix * 1000).toISOString();
    const date = iso.slice(0, 10);
    if (date < today) continue;
    const subtitle = decodeEntities(occ.event_pmv?.evcal_subtitle?.[0] ?? "").trim() || null;

    events.push({
      source_event_id: occ._ID,
      title,
      subtitle,
      description: null,
      date,
      time: iso.slice(11, 16),
      detail_url: `${BASE}/?p=${occ.ID}`,
      ticket_url: null,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: "Hansa-Theater",
      raw_category: null,
      labels: resolveStageLabels({ title, subtitle, defaultLabel: "stage:theater", confidence: 0.85 }),
    });
  }

  return { source_slug: "hansa-theater", display_name: "Hansa-Theater", events };
}
