import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import { getDocumentProxy } from "unpdf";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * MainÄppelHaus Lohrberg — the Streuobst (orchard) centre on Frankfurt's
 * Lohrberg, with a mixed programme of concerts ("MUSIK AUF DEM LOHRBERG"),
 * children's courses, nature walks and orchard workshops.
 *
 * The full year (~70 dated items, with times) is published only as a yearly
 * PDF linked from the Veranstaltungskalender page
 * (`/images/dokumente/Kalender_<year>_*.pdf`). We parse it positionally: the
 * brochure is a fixed five-column table (Termine/Referenten · Veranstaltung ·
 * Ort · Gebühren · Bemerkung), and pdf.js text items carry x/y, so each event
 * row is a y-band anchored on its date (column 1), with the title as the top
 * line of column 2 and the description on the lines below. This separates
 * title/referent/description cleanly without guessing sentence boundaries.
 *
 * The HTML page itself only carries a short rolling "Die nächsten
 * Veranstaltungen" teaser; we keep a parser for it as a fallback if the PDF
 * can't be fetched/parsed (e.g. a future layout change). Labels come from the
 * title via the shared event classifier (the venue is genuinely mixed).
 *
 * NOTE: the positional parser depends on the brochure's column layout. If a
 * future edition is redesigned the PDF may yield nothing — the teaser fallback
 * then keeps the source alive (thin) until the parser is updated.
 */
const PROGRAM_URL = "https://www.mainaeppelhauslohrberg.de/index.php/lohrberg-erleben/veranstaltungskalender.html";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

// "24.01.2026" or a two-day "14./ 15.01.2026" (start-day prefix + main date).
const DATE_RE = /(?:(\d{1,2})\.\s*\/\s*)?(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const TIME_RE = /(\d{1,2}):(\d{2})(?:\s*bis\s*(\d{1,2}):(\d{2}))?/;
// A pure weekday cell ("Sa.", "Mi. und Do.") — used to tell it from a referent.
const WEEKDAY_RE = /^(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?(?:\s*(?:u\.|und|\/|-|–|bis)\s*(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?)*$/i;

// Column x-boundaries (pdf user-space units) for the brochure table.
const COL2_MIN = 110; // Veranstaltung column starts here; col 1 is to its left.
const COL2_MAX = 380; // …and ends before the Ort column.
const PRICE_MIN = 480;
const PRICE_MAX = 565;

interface PdfTextItem {
  str?: string;
  transform?: number[];
}
interface Cell {
  s: string;
  x: number;
  y: number;
}

export async function scrapeMainaeppelhausLohrberg(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAM_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`mainaeppelhaus-lohrberg fetch failed: ${res.status}`);
  const html = await res.text();

  let events: CanonicalScrapedEvent[] = [];

  // Primary: the yearly PDF (full programme with times).
  const pdfHref = html.match(/\/images\/dokumente\/[^"']*\.pdf/i)?.[0];
  if (pdfHref) {
    try {
      events = await parsePdf(new URL(pdfHref, PROGRAM_URL).href, today);
    } catch (err) {
      console.warn(`mainaeppelhaus-lohrberg PDF parse failed: ${(err as Error).message}`);
    }
  }

  // Fallback: the HTML "Die nächsten Veranstaltungen" teaser (thin).
  if (events.length === 0) events = parseTeaser(html, today);

  return { source_slug: "mainaeppelhaus-lohrberg", display_name: "MainÄppelHaus Lohrberg", events };
}

async function parsePdf(url: string, today: string): Promise<CanonicalScrapedEvent[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`pdf ${res.status}`);
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let pg = 1; pg <= pdf.numPages; pg++) {
    const page = await pdf.getPage(pg);
    const content = await page.getTextContent();
    const items: Cell[] = (content.items as PdfTextItem[])
      .filter((it): it is Required<PdfTextItem> => Array.isArray(it.transform) && typeof it.str === "string")
      .map((it) => ({
        s: it.str.replace(/\s+/g, " ").trim(),
        x: Math.round(it.transform[4]),
        y: Math.round(it.transform[5]),
      }))
      .filter((it) => it.s);

    // Each event row is anchored on its date in column 1, top to bottom.
    const anchors = items.filter((it) => it.x < COL2_MIN && DATE_RE.test(it.s)).sort((a, b) => b.y - a.y);

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const yHi = a.y + 14; // include the weekday/title line just above the date
      const yLo = i + 1 < anchors.length ? anchors[i + 1].y + 14 : Number.NEGATIVE_INFINITY;
      const band = items.filter((it) => it.y <= yHi && it.y > yLo);

      const col1 = band.filter((it) => it.x < COL2_MIN).sort((p, q) => q.y - p.y);
      const col2 = band.filter((it) => it.x >= COL2_MIN && it.x < COL2_MAX).sort((p, q) => q.y - p.y);
      const priceCell = band.filter((it) => it.x >= PRICE_MIN && it.x < PRICE_MAX);

      const dm = DATE_RE.exec(a.s);
      if (!dm) continue;
      const [, startDay, dd, mm, yyyy] = dm;
      const m = mm.padStart(2, "0");
      const main = `${yyyy}-${m}-${dd.padStart(2, "0")}`;
      // "14./ 15.01.2026": the prefix is the start day, the main date the end.
      const date = startDay ? `${yyyy}-${m}-${startDay.padStart(2, "0")}` : main;
      const endDate = startDay ? main : null;

      if ((endDate ?? date) < today) continue;

      const title = col2[0]?.s;
      if (!title) continue;
      const description =
        col2
          .slice(1)
          .map((it) => it.s)
          .join(" ")
          .trim() || null;

      const timeCell = col1.find((it) => /\d{1,2}:\d{2}/.test(it.s));
      let time: string | null = null;
      let endTime: string | null = null;
      if (timeCell) {
        const tm = TIME_RE.exec(timeCell.s);
        if (tm) {
          time = `${tm[1].padStart(2, "0")}:${tm[2]}`;
          if (tm[3]) endTime = `${tm[3].padStart(2, "0")}:${tm[4]}`;
        }
      }

      const performers = col1.find((it) => !/\d/.test(it.s) && !WEEKDAY_RE.test(it.s))?.s ?? null;
      const priceMin = priceCell
        .map((it) => it.s)
        .join(" ")
        .match(/(\d+)\s*€/)?.[1];

      const key = `${date}|${time ?? ""}|${title}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        source_event_id: key,
        title,
        description,
        date,
        time,
        end_date: endDate,
        end_time: endTime,
        detail_url: PROGRAM_URL,
        ticket_url: null,
        image_url: null,
        performers,
        price_min: priceMin ? Number(priceMin) : null,
        labels: labelsFor(title),
      });
    }
  }

  return events;
}

const MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};
const TEASER_DATE_RE = new RegExp(`(\\d{1,2})\\.\\s*(${Object.keys(MONTHS).join("|")})`, "i");

/** Fallback: the page's rolling "Die nächsten Veranstaltungen" teaser — a
 *  hand-edited module of "<weekday>, <DD>. <Monat>" + title(s), no times. */
function parseTeaser(html: string, today: string): CanonicalScrapedEvent[] {
  const start = Math.max(html.indexOf("mod-custom194"), html.search(/nächsten Veranstaltungen/i));
  const region = start >= 0 ? html.slice(start) : html;
  const endMarker = region.search(/komplettes\s+Kursangebot/i);
  const teaser = endMarker >= 0 ? region.slice(0, endMarker) : region;

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const p of teaser.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const chunk = p[1];
    const dm = TEASER_DATE_RE.exec(chunk);
    if (!dm) continue;
    const date = inferDate(dm[1], MONTHS[dm[2].toLowerCase()], today);
    if (date < today) continue;

    // Each <br/> line is a separate same-day item, except a trailing-colon line
    // is a prefix continuing onto the next ("MUSIK AUF DEM LOHRBERG:" + act).
    const after = chunk.slice((dm.index ?? 0) + dm[0].length);
    const brIdx = after.search(/<br\b[^>]*>/i);
    const segs = (brIdx >= 0 ? after.slice(brIdx) : after)
      .split(/<br\b[^>]*>/i)
      .map((s) => stripHtml(decodeEntities(s)).replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const titles: string[] = [];
    for (let i = 0; i < segs.length; i++) {
      let s = segs[i];
      while (s.endsWith(":") && i + 1 < segs.length) s = `${s} ${segs[++i]}`;
      s = s.replace(/^[\s:–-]+|[\s:–-]+$/g, "").trim();
      if (s) titles.push(s);
    }

    for (const title of titles) {
      const key = `${date}|${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        source_event_id: key,
        title,
        description: null,
        date,
        time: null,
        detail_url: PROGRAM_URL,
        ticket_url: null,
        image_url: null,
        labels: labelsFor(title),
      });
    }
  }

  return events;
}

function labelsFor(title: string): ScrapedLabel[] {
  const type = classifyEvent(title);
  const mapped = type ? eventTypeToLabel(type) : null;
  return mapped ? [{ label: mapped, confidence: 0.75, classifier: "keyword:event" }] : [];
}

/** "20", "06" (no year) → ISO date, inferring the year against `today`.
 *  A month more than 6 behind today's wraps to next year (Dec→Jan rollover). */
function inferDate(dRaw: string, mm: string, today: string): string {
  const dd = dRaw.padStart(2, "0");
  const curYear = parseInt(today.slice(0, 4), 10);
  const monthsBehind = Number(today.slice(5, 7)) - Number(mm);
  const year = monthsBehind > 6 ? curYear + 1 : curYear;
  return `${year}-${mm}-${dd}`;
}
