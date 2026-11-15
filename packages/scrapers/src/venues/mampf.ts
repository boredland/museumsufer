import { classifyMusic } from "@museumsufer/classify";
import { decodeEntities, slugify, todayIso, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.mampf-jazz.com";
const PROGRAMME_PAGE = `${BASE}/tickets`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

/**
 * Mampf (Wix) keeps its Wix Events app empty — `/event-list` says "Keine
 * bevorstehenden Veranstaltungen" and `/_api/wix-one-events-server/web/events`
 * answers 200 with `total: 0` — while the real programme is a monthly PDF
 * (`_files/ugd/<hash>.pdf`, new hash each month) linked from `/tickets`
 * ("Das aktuelle Programm finden sie HIER"). The PDF is a text layer, so it is
 * parsed directly rather than through the LLM cache the image-only programmes
 * need. It lists `Wochentag DD.MM. Titel` followed by a blurb; the month/year
 * appear once as a heading. The PDF gives no start time, so `time` stays null.
 */
const PDF_HREF_RE = /href="(https:\/\/www\.mampf-jazz\.com\/_files\/ugd\/[^"]+\.pdf)"/;
const DAY_LINE_RE = /^(?:Mo|Di|Mi|Do|Fr|Sa|So)\s+(\d{1,2})\.(\d{1,2})\.?\s*(.*)$/;
const MONTHS = [
  "januar",
  "februar",
  "märz",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "dezember",
];

interface Entry {
  month: number;
  day: number;
  title: string;
  blurb: string[];
}

export async function scrapeMampf(): Promise<VenueScrapeResult> {
  const page = await fetch(PROGRAMME_PAGE, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!page.ok) throw new Error(`mampf programme page fetch failed: ${PROGRAMME_PAGE} → ${page.status}`);
  const pdfUrl = (await page.text()).match(PDF_HREF_RE)?.[1];
  if (!pdfUrl) throw new Error("mampf: no programme PDF linked on /tickets");

  const pdf = await fetch(pdfUrl, { headers: { "User-Agent": UA } });
  if (!pdf.ok) throw new Error(`mampf programme PDF fetch failed: ${pdfUrl} → ${pdf.status}`);
  const lines = await pdfLines(new Uint8Array(await pdf.arrayBuffer()));

  // The heading is a standalone "November" line plus a standalone "2026" line.
  const headerMonth = lines.map((l) => MONTHS.indexOf(l.toLowerCase()) + 1).find((m) => m > 0);
  const headerYear = lines.map((l) => /^(20\d{2})$/.exec(l)?.[1]).find((y) => y);
  if (!headerMonth || !headerYear) throw new Error("mampf: month/year heading not found in programme PDF");

  const entries = parseEntries(lines);
  if (entries.length === 0) throw new Error("mampf: no dated entries parsed from programme PDF");

  const today = todayIso();
  const byId = new Map<string, CanonicalScrapedEvent>();
  for (const entry of entries) {
    // A programme that runs past New Year restarts the month numbers.
    const year = Number(headerYear) + (entry.month < headerMonth ? 1 : 0);
    const date = `${year}-${String(entry.month).padStart(2, "0")}-${String(entry.day).padStart(2, "0")}`;
    if (date < today) continue;

    const title = decodeEntities(entry.title);
    const description = truncate(entry.blurb.join(" "), 600);
    const id = `${date}|${slugify(title)}`;
    // The PDF repeats a trailing day line on the next page; the copy with a blurb is the real one.
    if (byId.has(id) && !description) continue;

    byId.set(id, {
      source_event_id: id,
      title,
      subtitle: null,
      description,
      date,
      time: null,
      detail_url: PROGRAMME_PAGE,
      ticket_url: PROGRAMME_PAGE,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: title,
      venue_room: null,
      raw_category: "music",
      labels: [
        { label: `music:${classifyMusic(title, null, description, "jazz")}`, confidence: 0.9, classifier: "scraper-hardcoded" },
      ],
    });
  }

  const events = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return { source_slug: "mampf", display_name: "Jazzlokal Mampf", events };
}

function parseEntries(lines: string[]): Entry[] {
  const entries: Entry[] = [];
  let current: Entry | null = null;
  let titlePending = false;

  for (const line of lines) {
    const day = DAY_LINE_RE.exec(line);
    if (day) {
      current = { day: Number(day[1]), month: Number(day[2]), title: day[3].trim(), blurb: [] };
      titlePending = current.title === "";
      entries.push(current);
      continue;
    }
    if (!current) continue;
    // The PDF's month/year heading is laid out mid-flow and must not leak into a blurb.
    if (MONTHS.includes(line.toLowerCase()) || /^20\d{2}$/.test(line)) continue;
    if (titlePending) {
      current.title = line;
      titlePending = false;
    } else {
      current.blurb.push(line);
    }
  }
  return entries.filter((e) => e.title);
}

/**
 * pdf.js marks line ends on text items; joining on those keeps one visual
 * line per array entry. unpdf is imported lazily because this package's index
 * is also pulled into the app Workers, which never scrape; a static import
 * would make every Worker initialise pdf.js at module load.
 */
async function pdfLines(data: Uint8Array): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(data);
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    let current = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      current += item.str;
      if (item.hasEOL) {
        lines.push(current);
        current = "";
      }
    }
    if (current) lines.push(current);
  }
  return lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}
