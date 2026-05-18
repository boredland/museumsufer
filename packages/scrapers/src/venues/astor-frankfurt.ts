import { todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_URL = "https://backend.premiumkino.de/v1/de/frankfurt/program";
const SITE_BASE = "https://frankfurt.premiumkino.de";

interface AstorMovie {
  id: string;
  name: string;
  slug: string;
  poster?: { src?: string | null } | null;
  minutes?: number | null;
  year?: number | null;
  country?: string | null;
  performanceIds: string[];
}

interface AstorPerformance {
  id: string;
  movieId: string;
  begin: string;
  end?: string | null;
  slug: string;
  bookable?: boolean | null;
  reservable?: boolean | null;
  filterIds?: string[] | null;
  language?: string | null;
}

interface AstorFilterItem {
  label: string;
  value: string;
}

interface AstorFilterGroup {
  label: string;
  items?: AstorFilterItem[] | null;
}

interface AstorProgram {
  movies?: AstorMovie[] | null;
  performances?: AstorPerformance[] | null;
  movieFilterGroups?: AstorFilterGroup[] | null;
}

/**
 * ASTOR Film Lounge MyZeil is an Angular SPA that pulls its programme
 * from a public JSON backend (the same one filme-hannover uses for its
 * Hannover instance). One performance = one screening.
 */
export async function scrapeAstorFrankfurt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`astor frankfurt fetch failed: ${res.status}`);
  const data = (await res.json()) as AstorProgram;

  const movieById = new Map((data.movies ?? []).map((m) => [m.id, m]));
  const dubByFilterId = buildDubMap(data.movieFilterGroups ?? []);

  const events: CanonicalScrapedEvent[] = [];
  for (const perf of data.performances ?? []) {
    if (!perf.bookable && !perf.reservable) continue;
    const movie = movieById.get(perf.movieId);
    if (!movie || !perf.begin) continue;

    const [date, timeFull] = perf.begin.split("T");
    if (!date || date < today) continue;
    const time = timeFull ? timeFull.slice(0, 5) : null;
    const endTime = perf.end?.includes("T") ? perf.end.split("T")[1].slice(0, 5) : null;

    const dub = perf.filterIds?.map((id) => dubByFilterId.get(id)).find(Boolean) ?? null;
    const subtitleParts: string[] = [];
    if (dub) subtitleParts.push(dub);
    if (movie.year) subtitleParts.push(String(movie.year));
    if (movie.minutes) subtitleParts.push(`${movie.minutes} min`);
    const subtitle = subtitleParts.length ? subtitleParts.join(" · ") : null;

    events.push({
      source_event_id: perf.id,
      title: movie.name,
      subtitle,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: `${SITE_BASE}/vorstellung/${perf.slug}/0/0/${perf.id}`,
      ticket_url: `${SITE_BASE}/vorstellung/${perf.slug}/0/0/${perf.id}`,
      // Astor's poster.src paths (e.g. /movie/5915/<hash>) resolve to HTML
      // detail pages on every premiumkino host we've probed (frontend,
      // backend, cdn). The actual image origin is constructed by the
      // Angular SPA at runtime — we don't know the recipe yet. Until we
      // do, omit the field so the lichtspiel-haus Caligari intertitle
      // fallback renders instead of a broken velvet rectangle.
      image_url: null,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "astor-frankfurt", display_name: "ASTOR Film Lounge MyZeil", events };
}

function buildDubMap(groups: AstorFilterGroup[]): Map<string, "OV" | "OmU"> {
  const map = new Map<string, "OV" | "OmU">();
  const versionGroup = groups.find((g) => g.label?.toLowerCase() === "filterversiongroup");
  for (const item of versionGroup?.items ?? []) {
    const label = item.label ?? "";
    if (/Untertitel|OmU|mU/i.test(label)) map.set(item.value, "OmU");
    else if (/Originalversion|OV/i.test(label)) map.set(item.value, "OV");
  }
  return map;
}
