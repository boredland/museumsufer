import { classifyEvent } from "@museumsufer/classify";
import { dateOffset, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { labelsForEvent } from "./_gomus-generic";

/**
 * Deutsches Röntgen-Museum, Remscheid-Lennep. The WordPress site runs the
 * My Calendar plugin, whose REST route `/wp-json/my-calendar/v1/events`
 * returns every occurrence in a date window, keyed by day. Each occurrence
 * links its event post (`event_post`); `/?p=<id>` redirects to the post's
 * permalink, so it is a stable detail link without a second request.
 *
 * The events are tours, children's workshops and the monthly open day of
 * Röntgen's birth house (Gänsemarkt 1), which the museum also runs.
 */
const BASE = "https://roentgenmuseum.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HORIZON_DAYS = 180;

interface MyCalendarOccurrence {
  occur_id: string;
  occur_begin: string;
  occur_end: string | null;
  event_title: string;
  event_desc: string | null;
  event_post: string | null;
}

export async function scrapeRoentgenMuseum(): Promise<VenueScrapeResult> {
  const from = todayIso();
  const url = `${BASE}/wp-json/my-calendar/v1/events?from=${from}&to=${dateOffset(HORIZON_DAYS)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`roentgen-museum fetch failed: ${res.status}`);
  // An empty window comes back as `[]`, a filled one as `{ "YYYY-MM-DD": [...] }`.
  const byDay = (await res.json()) as Record<string, MyCalendarOccurrence[]> | [];

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  for (const occ of Object.values(byDay).flat()) {
    // A multi-day occurrence (holiday courses) is listed under each day it spans.
    if (seen.has(occ.occur_id)) continue;
    seen.add(occ.occur_id);
    const [date, begin] = occ.occur_begin.split(" ");
    if (!date || date < from) continue;
    const title = occ.event_title.trim();
    const description = occ.event_desc ? stripHtml(occ.event_desc).trim().slice(0, 2000) || null : null;
    const [endDate, end] = occ.occur_end?.split(" ") ?? [];
    events.push({
      source_event_id: occ.occur_id,
      title,
      description,
      date,
      end_date: endDate && endDate !== date ? endDate : null,
      time: begin?.slice(0, 5) ?? null,
      end_time: end && end !== begin ? end.slice(0, 5) : null,
      detail_url: occ.event_post ? `${BASE}/?p=${occ.event_post}` : `${BASE}/kalender/`,
      labels: labelsForEvent(classifyEvent(title, description), title, description),
    });
  }
  return { source_slug: "roentgen-museum", display_name: "Deutsches Röntgen-Museum", events };
}
