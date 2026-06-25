import type { VenueScrapeResult } from "../types";

/**
 * Theater im Pariser Hof — cabaret, comedy, live music, puppet-comedy.
 * Publishes a public iCal feed at `/?ical=1` listing all upcoming performances.
 * Coordinates come from GEO field in the iCal feed.
 */
export async function scrapePariserHof(): Promise<VenueScrapeResult> {
  const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";
  const r = await fetch("https://www.theaterimpariserhof.de/?ical=1", { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`pariser-hof ical fetch failed: ${r.status}`);

  const text = await r.text();
  const parts = text.split("BEGIN:VEVENT").slice(1);

  const events: VenueScrapeResult["events"] = [];
  for (const part of parts) {
    const endIdx = part.indexOf("END:VEVENT");
    const block = endIdx > 0 ? part.slice(0, endIdx) : part;

    const uid = block.match(/UID:(.+)\r?\n/)?.[1]?.trim();
    const summary = block.match(/SUMMARY:(.+)/)?.[1]?.trim();
    const start = block.match(/DTSTART[^:]*:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    const end = block.match(/DTEND[^:]*:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    const url = block.match(/URL:(.+)/)?.[1]?.trim();
    const location = block.match(/LOCATION:(.+)/)?.[1]?.trim();
    const geo = block.match(/GEO:(-?[\d.]+);(-?[\d.]+)/);

    if (!summary || !start) continue;

    const date = `${start[1]}-${start[2]}-${start[3]}`;
    const time = `${start[4]}:${start[5]}`;
    const endTime = end ? `${end[4]}:${end[5]}` : null;

    events.push({
      source_event_id: uid ?? `pariser-${date}-${time}`,
      title: summary.replace(/ \//g, " — ").replace(/\/\//g, "—"),
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: url,
      venue_room: "Theater im Pariser Hof",
      labels: [{ label: "stage:theater", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "theater-im-pariser-hof", display_name: "Theater im Pariser Hof", events };
}
