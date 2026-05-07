import { todayIso } from "../date";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.dfdc.de";
const SPIELPLAN_URL = `${BASE}/de/spielplan`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Dresden Frankfurt Dance Company runs a Next.js site backed by Sanity.
 * Their `/de/spielplan` page hydrates from `_next/data/<buildId>/de/spielplan.json`,
 * which exposes the entire schedule as structured JSON:
 *
 *   evenings[].variants[].performances[]  // ISO datetimes
 *   evenings[].variants[].venue           // { _type: "venueFrankfurt" | "venueOther", name, city }
 *   evenings[].productions[]              // shows in the evening (one or more)
 *   evenings[].ticketInfo.shopLink        // booking URL
 *
 * We only keep variants where venue._type === "venueFrankfurt" — DFDC
 * tours, but the Frankfurt-theater listing should not include Bruges,
 * Hellerau, etc.
 */

interface DfdcVenue {
  _id: string;
  _type: "venueFrankfurt" | "venueOther";
  name: string;
  city: string | null;
}

interface DfdcVariant {
  _key: string;
  performances: string[];
  venue: DfdcVenue;
}

interface DfdcProduction {
  _id: string;
  slug: string | null;
  title: string;
  description?: unknown;
}

interface DfdcEvening {
  _id: string;
  _type: string;
  title: string;
  slug?: string;
  productions: DfdcProduction[];
  variants: DfdcVariant[];
  ticketInfo?: { shopLink?: string };
}

interface DfdcSpielplan {
  pageProps: { evenings: DfdcEvening[] };
}

export async function scrapeDfdc(): Promise<ScrapeResult> {
  const buildId = await fetchBuildId();
  const data = await fetchSpielplan(buildId);
  return parseDfdc(data);
}

async function fetchBuildId(): Promise<string> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`DFDC spielplan fetch failed: ${res.status}`);
  const html = await res.text();
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error("DFDC: buildId not found in spielplan HTML");
  return m[1];
}

async function fetchSpielplan(buildId: string): Promise<DfdcSpielplan> {
  const url = `${BASE}/_next/data/${buildId}/de/spielplan.json`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`DFDC spielplan.json failed: ${res.status}`);
  return (await res.json()) as DfdcSpielplan;
}

export function parseDfdc(data: DfdcSpielplan): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const evening of data.pageProps.evenings) {
    const eveningSlug = evening.slug ?? slugOfEvening(evening);
    const ticketUrl = evening.ticketInfo?.shopLink ?? null;
    const description = collectProductionsBlurb(evening.productions);

    for (const variant of evening.variants) {
      if (variant.venue?._type !== "venueFrankfurt") continue;

      for (const isoTs of variant.performances) {
        const dt = new Date(isoTs);
        const date = berlinDate(dt);
        if (date < today) continue;
        const time = berlinTime(dt);

        const dedup = `${eveningSlug}|${date}|${time}|${variant.venue.name}`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);

        if (!showsBySlug.has(eveningSlug)) {
          showsBySlug.set(eveningSlug, {
            slug: eveningSlug,
            title: evening.title,
            subtitle: subtitleFromProductions(evening.productions),
            description,
            detail_url: `${BASE}/de/spielplan/${eveningSlug}`,
            image_url: null,
            language: "de",
          });
        }

        performances.push({
          show_slug: eveningSlug,
          date,
          time,
          end_time: null,
          venue_room: variant.venue.name,
          provider_event_id: variant._key,
          ticket_url: ticketUrl,
          status: ticketUrl ? "available" : "unknown",
        });
      }
    }
  }

  return {
    theater_slug: "dresden-frankfurt-dance-company",
    shows: [...showsBySlug.values()],
    performances,
  };
}

function slugOfEvening(evening: DfdcEvening): string {
  return (evening._id || evening.title).replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
}

function subtitleFromProductions(productions: DfdcProduction[]): string | null {
  if (!productions?.length) return null;
  return (
    productions
      .map((p) => p.title)
      .filter(Boolean)
      .join(" / ") || null
  );
}

function collectProductionsBlurb(productions: DfdcProduction[]): string | null {
  if (!productions?.length) return null;
  const parts: string[] = [];
  for (const p of productions) {
    const text = sanityBlocksToText(p.description);
    if (text) parts.push(text);
  }
  const joined = parts.join("\n\n");
  if (!joined) return null;
  return joined.length > 800 ? `${joined.slice(0, 800).trimEnd()}…` : joined;
}

interface SanitySpan {
  _type: string;
  text?: string;
}
interface SanityBlock {
  _type: string;
  children?: SanitySpan[];
}

function sanityBlocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  for (const block of blocks as SanityBlock[]) {
    if (block?._type !== "block") continue;
    const text = (block.children ?? [])
      .filter((c) => c._type === "span")
      .map((c) => c.text ?? "")
      .join("");
    if (text) out.push(text);
  }
  return out.join("\n").trim();
}

function berlinDate(d: Date): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(d);
}

function berlinTime(d: Date): string {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return f.format(d);
}
