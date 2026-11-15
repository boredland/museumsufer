import { decodeEntities, normalizeUrl, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

// The institute moved from mathildenhoehe.eu (now an empty SilverStripe shell
// that always claims "no exhibitions") to this site.
const BASE = "https://www.mathildenhoehe.de";
const EXHIBITIONS_URL = `${BASE}/ausstellungen/aktuell`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.8773;
const LON = 8.666;
const CITY = "darmstadt";

const CARD_RE =
  /<div class="col-12 exhibitionLoopContainer">\s*<a href="([^"]+)"[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)<\/div>\s*<\/div>/g;
const H3_RE = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
const LAUFZEIT_RE = /Laufzeit:\s*([^<]+)/i;

const MONTHS_DE: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`mathildenhoehe fetch failed: ${url} → ${res.status}`);
  return res.text();
}

export async function scrapeMathildenhoehe(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(EXHIBITIONS_URL);

  const cards = [...html.matchAll(CARD_RE)];
  // /aktuell always carries the permanent Dauerausstellung, so zero cards means
  // the markup changed, not that the institute has nothing on.
  if (cards.length === 0) throw new Error("mathildenhoehe: no exhibitionLoopContainer cards on /ausstellungen/aktuell");

  const seen = new Set<string>();
  const events = await Promise.all(
    cards.map(async ([, href, img, rawTitle, tail]) => {
      const title = stripHtml(rawTitle);
      const detailUrl = normalizeUrl(decodeEntities(href), BASE);
      const kind = [...tail.matchAll(H3_RE)].map((h) => stripHtml(h[1]));
      const permanent = kind.some((k) => /dauerausstellung/i.test(k));
      const slug = new URL(detailUrl ?? BASE).pathname.split("/").filter(Boolean).pop();
      if (!slug || !title) throw new Error(`mathildenhoehe: exhibition card without slug/title: ${rawTitle}`);
      const id = `mathildenhoehe|exhibition|${slug}`;
      if (seen.has(id)) return null;
      seen.add(id);

      let start: string | null = null;
      let end: string | null = null;
      if (!permanent) {
        const detail = await fetchHtml(detailUrl as string);
        const range = parseLaufzeit(LAUFZEIT_RE.exec(stripHtml(detail.replace(/<br\s*\/?>/gi, "\n")))?.[1] ?? null);
        if (!range) throw new Error(`mathildenhoehe: no parseable "Laufzeit:" on ${detailUrl}`);
        ({ start, end } = range);
      }

      const event: CanonicalScrapedEvent = {
        source_event_id: id,
        title,
        subtitle: kind.filter((k) => !/dauerausstellung/i.test(k)).join(" · ") || null,
        description: null,
        // Permanent exhibitions pin to the epoch, as _museums-frankfurt does, so
        // they stay "running" without polluting upcoming-window queries.
        date: start ?? "1970-01-01",
        time: null,
        end_date: end,
        end_time: null,
        detail_url: detailUrl,
        ticket_url: null,
        image_url: normalizeUrl(decodeEntities(img), BASE),
        city: CITY,
        lat: LAT,
        lon: LON,
        labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
      };
      return event;
    }),
  );

  return {
    source_slug: "mathildenhoehe",
    display_name: "Institut Mathildenhöhe",
    events: events.filter((e): e is CanonicalScrapedEvent => e !== null).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** "6. Juni 2026 – 31. Januar 2027" (start month/year may be omitted: "6.–31. Juli 2026"). */
function parseLaufzeit(text: string | null): { start: string; end: string } | null {
  if (!text) return null;
  const m = text
    .toLowerCase()
    .match(
      /(\d{1,2})\.\s*(?:([a-zä]+)\s*)?(?:(\d{4})\s*)?[-–]\s*(\d{1,2})\.\s*([a-zä]+)\s*(\d{4})/,
    );
  if (!m) return null;
  const endMonth = MONTHS_DE[m[5]];
  const startMonth = m[2] ? MONTHS_DE[m[2]] : endMonth;
  if (!endMonth || !startMonth) return null;
  const endYear = m[6];
  const startYear = m[3] ?? endYear;
  const iso = (y: string, mo: number, d: string) => `${y}-${String(mo).padStart(2, "0")}-${d.padStart(2, "0")}`;
  return { start: iso(startYear, startMonth, m[1]), end: iso(endYear, endMonth, m[4]) };
}
