import { todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Music Star Norderstedt — rock/blues/folk club run by Music-Werkstatt e.V.
 * Old-school HTML table site at harksheide.de. Events are in
 * `<address class="TXTSubHead">` blocks with the pattern:
 *   ARTIST (Country) - Norderstedt, Music Star - D.M.YYYY Einlass: 19°° UHR Beginn: 20 Uhr
 * Some events span multiple dates ("12. und 13.7.2026").
 */
const BASE = "https://www.harksheide.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeMusicstarNorderstedt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(BASE, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`harksheide fetch failed: ${res.status}`);
  const raw = await res.text();
  const html = raw.includes("\xc3\xaf") || raw.includes("charset=iso-8859")
    ? new TextDecoder("latin1").decode(new TextEncoder().encode(raw))
    : raw;

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Match event blocks in <address class="TXTSubHead"> tags
  const blockRe = /<address[^>]*class="TXTSubHead"[^>]*>([\s\S]*?)<\/address>/gi;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(html)) !== null) {
    const block = blockMatch[1].replace(/<[^>]+>/g, "").trim();
    if (!block || block === "&nbsp;") continue;

    // Pattern: ARTIST - Norderstedt, Music Star - DATE(S) ...
    const parts = block.split(/\s*-\s*Norderstedt,\s*Music\s*Star\s*-\s*/i);
    if (parts.length < 2) continue;

    const rawTitle = decodeEntities(parts[0].trim());
    const datePart = parts[1];
    const time = parseStart(datePart);

    // Expand "12. und 13.7.2026" → ["12.7.2026", "13.7.2026"]
    // and "8.7.2026" → ["8.7.2026"]
    const expandedDates = expandDateStr(datePart);

    for (const ds of expandedDates) {
      const dm = ds.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (!dm) continue;
      const date = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      if (date < today) continue;

      const dedupKey = `${rawTitle}|${date}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      events.push({
        source_event_id: dedupKey,
        title: rawTitle,
        description: null,
        date,
        time,
        detail_url: BASE,
        labels: [{ label: "music:rock", confidence: 0.8, classifier: "scraper-hardcoded" }],
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { source_slug: "musicstar-norderstedt", display_name: "Music Star Norderstedt", events };
}

/** Start time from "Einlass: 19°° UHR Beginn: 20 Uhr"; the doors time is the fallback. Defaults to 20:00, the club's standing start. */
function parseStart(raw: string): string {
  const m = raw.match(/Beginn:?\s*(\d{1,2})(?:[.:°]+(\d{2}))?/i) ?? raw.match(/Einlass:?\s*(\d{1,2})(?:[.:°]+(\d{2}))?/i);
  if (!m) return "20:00";
  return `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
}

/** Expand "12. und 13.7.2026" / "18 & 19.11.2026" → one "D.M.YYYY" per day,
 *  "8.7.2026 Einlass: ..." → ["8.7.2026"]. */
function expandDateStr(raw: string): string[] {
  const cleaned = raw
    .replace(/Einlass.*$/i, "")
    .replace(/Beginn.*$/i, "")
    .replace(/&nbsp;|&amp;/g, (e) => (e === "&amp;" ? "&" : " "))
    .trim();
  const multi = cleaned.match(/^(\d{1,2})\.?\s*(?:und|&|\+|\/)\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/i);
  if (multi) return [`${multi[1]}.${multi[3]}.${multi[4]}`, `${multi[2]}.${multi[3]}.${multi[4]}`];
  const single = cleaned.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (single) return [`${single[1]}.${single[2]}.${single[3]}`];
  return [];
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}
