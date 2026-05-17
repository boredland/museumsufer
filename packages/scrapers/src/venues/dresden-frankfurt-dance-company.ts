import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.dfdc.de";
const SPIELPLAN_URL = `${BASE}/de/spielplan`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Dresden Frankfurt Dance Company runs a Next.js + Sanity site. Their
 * `/de/spielplan` page hydrates from `_next/data/<buildId>/de/spielplan.json`,
 * which exposes the entire schedule as structured JSON. DFDC tours, so we
 * filter variants to `venueFrankfurt` and drop Bruges/Hellerau/etc.
 *
 * All performances are dance — the label is hardcoded to `stage:dance`
 * (scraper-hardcoded) instead of going through the keyword resolver.
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

export async function scrapeDresdenFrankfurtDanceCompany(): Promise<VenueScrapeResult> {
  const buildId = await fetchBuildId();
  const data = await fetchSpielplan(buildId);
  return parse(data);
}

async function fetchBuildId(): Promise<string> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`dfdc spielplan fetch failed: ${res.status}`);
  const html = await res.text();
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error("dfdc: buildId not found in spielplan HTML");
  return m[1];
}

async function fetchSpielplan(buildId: string): Promise<DfdcSpielplan> {
  const url = `${BASE}/_next/data/${buildId}/de/spielplan.json`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`dfdc spielplan.json failed: ${res.status}`);
  return (await res.json()) as DfdcSpielplan;
}

function parse(data: DfdcSpielplan): VenueScrapeResult {
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const evening of data.pageProps.evenings) {
    const eveningSlug = evening.slug ?? slugOfEvening(evening);
    const ticketUrl = evening.ticketInfo?.shopLink ?? null;
    const description = collectProductionsBlurb(evening.productions);
    const subtitle = subtitleFromProductions(evening.productions);

    for (const variant of evening.variants) {
      if (variant.venue?._type !== "venueFrankfurt") continue;

      for (const isoTs of variant.performances) {
        const dt = new Date(isoTs);
        const date = berlinDate(dt);
        if (date < today) continue;
        const time = berlinTime(dt);

        const sourceEventId = `${variant._key}|${date}|${time}`;
        if (seen.has(sourceEventId)) continue;
        seen.add(sourceEventId);

        events.push({
          source_event_id: sourceEventId,
          title: evening.title,
          subtitle,
          description,
          date,
          time,
          detail_url: `${BASE}/de/spielplan/${eveningSlug}`,
          ticket_url: ticketUrl,
          image_url: null,
          language: "de",
          venue_room: variant.venue.name,
          labels: [{ label: "stage:dance", confidence: 0.95, classifier: "scraper-hardcoded" }],
        });
      }
    }
  }

  return { source_slug: "dresden-frankfurt-dance-company", display_name: "Dresden Frankfurt Dance Company", events };
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
