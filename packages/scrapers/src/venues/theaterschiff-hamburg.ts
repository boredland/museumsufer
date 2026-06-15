import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const ICAL_URL = "https://www.theaterschiff.de/spielplan/?ical=1";
const SPIELPLAN_URL = "https://www.theaterschiff.de/spielplan/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Theaterschiff Hamburg — Europas einzige hochseetüchtige Bühne im Nikolaifleet.
 *
 * The WordPress-powered website exposes a standard iCalendar (RFC 5545) feed at
 * `/spielplan/?ical=1` which contains every upcoming dated performance with:
 *
 *   - `SUMMARY`     show title
 *   - `DTSTART`     local Berlin datetime (TZID=Europe/Berlin), format YYYYMMDDTHHMMSS
 *   - `DTEND`       end datetime
 *   - `URL`         detail/booking page URL
 *   - `DESCRIPTION` show description (optional)
 *   - `ATTACH`      show image URL (optional)
 *   - `CATEGORIES`  show category tag
 */
export async function scrapeTheaterschiffHamburg(): Promise<VenueScrapeResult> {
  let ical: string;
  try {
    const res = await fetch(ICAL_URL, {
      headers: {
        "User-Agent": UA,
        Accept: "text/calendar,text/plain,*/*",
        "Accept-Language": "de-DE,de;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
    ical = await res.text();
  } catch (err) {
    console.warn("Theaterschiff iCal fetch error:", err);
    return { source_slug: "theaterschiff-hamburg", display_name: "Theaterschiff Hamburg", events: [] };
  }

  const events = parseIcal(ical);
  return { source_slug: "theaterschiff-hamburg", display_name: "Theaterschiff Hamburg", events };
}

function parseIcal(ical: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Unfold lines (RFC 5545 §3.1: CRLF followed by a space/tab continues prev line)
  const unfolded = ical.replace(/\r?\n[ \t]/g, "");

  // Split into VEVENT blocks
  const VEVENT_RE = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let m: RegExpExecArray | null;

  while ((m = VEVENT_RE.exec(unfolded)) !== null) {
    const block = m[1];

    const get = (prop: string): string => {
      // Matches PROP:value or PROP;param=...:value
      const re = new RegExp(`^${prop}(?:;[^:]*)?:(.*)$`, "mi");
      return (block.match(re)?.[1] ?? "").trim();
    };

    const summary = decodeIcalText(get("SUMMARY"));
    if (!summary) continue;

    const dtstart = get("DTSTART");
    if (!dtstart) continue;

    // Parse DTSTART: YYYYMMDDTHHMMSS (local Berlin time) or YYYYMMDD (all-day)
    const parsed = parseDtstart(dtstart);
    if (!parsed) continue;
    const { date, time } = parsed;

    if (date < today) continue;

    const uid = get("UID") || `${slugify(summary)}|${date}|${time}`;
    if (seen.has(uid)) continue;
    seen.add(uid);

    const urlRaw = get("URL");
    const detailUrl = urlRaw || SPIELPLAN_URL;

    const descRaw = decodeIcalText(get("DESCRIPTION"));
    const description = descRaw || null;

    const attachRaw = get("ATTACH");
    const imageUrl = attachRaw && /^https?:\/\//.test(attachRaw) ? attachRaw : null;

    out.push({
      source_event_id: uid,
      title: summary,
      subtitle: null,
      description: description ? description.slice(0, 400) : null,
      date,
      time: time || null,
      detail_url: detailUrl,
      ticket_url: detailUrl,
      image_url: imageUrl,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: "Theaterschiff Hamburg",
      raw_category: null,
      labels: resolveStageLabels({
        title: summary,
        subtitle: description,
        defaultLabel: "stage:theater",
        confidence: 0.85,
      }),
    });
  }

  return out;
}

/**
 * Parse an iCal DTSTART value into { date: "YYYY-MM-DD", time: "HH:MM" }.
 * Supports: YYYYMMDDTHHMMSS (local), YYYYMMDDTHHMMSSZ (UTC), YYYYMMDD (all-day).
 */
function parseDtstart(raw: string): { date: string; time: string } | null {
  // Remove TZID param if present: DTSTART;TZID=Europe/Berlin:20260617T193000
  const val = raw.replace(/^[^:]*:/, "");
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(val);
  if (dateOnly) {
    return { date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, time: "" };
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(val);
  if (dateTime) {
    return {
      date: `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}`,
      time: `${dateTime[4]}:${dateTime[5]}`,
    };
  }
  return null;
}

function decodeIcalText(raw: string): string {
  // iCal text escaping: \n → newline, \\ → \, \, → ,, \; → ;
  return stripHtml(
    decodeEntities(raw).replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\"),
  )
    .replace(/\s+/g, " ")
    .trim();
}
