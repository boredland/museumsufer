/**
 * Museum directory builder. museumsufer.de used to be the canonical
 * source for the directory + currently-running exhibitions; both were
 * removed because the dual-source pattern produced duplicate entries
 * (same exhibition, different titles) and we now own a frozen snapshot
 * of all the museum metadata in `frozen-museum-meta.ts`.
 *
 * Exhibitions for individual museums now come from per-museum scrapers
 * in `@museumsufer/scrapers` via the event hub. This module just
 * assembles the directory entries.
 */

import { logInfo } from "@museumsufer/core";
import { FROZEN_MUSEUM_META } from "./frozen-museum-meta";
import { getManualMuseums } from "./museum-config";

export interface ParsedMuseum {
  name: string;
  slug: string;
  museumsufer_url: string;
  description: string | null;
  image_url: string | null;
  website_url?: string | null;
  /** City slug; absent ≡ "frankfurt". */
  city?: string;
}

export interface ParsedExhibition {
  museum_slug: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  image_url: string | null;
  detail_url: string;
}

export interface PreviousData {
  museums: ParsedMuseum[];
  exhibitions: ParsedExhibition[];
}

/** Returns the static museum directory. Exhibitions are handled
 *  elsewhere (hub-routed per-museum scrapers). `opts.previous` is
 *  accepted for source-compat but no longer used — the frozen meta
 *  is canonical. */
export async function scrape(_opts: { previous?: PreviousData } = {}): Promise<{
  museums: ParsedMuseum[];
  exhibitions: ParsedExhibition[];
}> {
  const manualMuseums = manualMuseumsAsParsed();
  const manualBySlug = new Map(manualMuseums.map((m) => [m.slug, m] as const));

  const museums: ParsedMuseum[] = [];
  for (const [slug, meta] of Object.entries(FROZEN_MUSEUM_META)) {
    const manual = manualBySlug.get(slug);
    museums.push({
      slug,
      name: manual?.name ?? meta.name,
      museumsufer_url: meta.museumsufer_url ?? "",
      description: manual?.description ?? meta.description ?? null,
      image_url: manual?.image_url ?? meta.image_url ?? null,
      website_url: manual?.website_url ?? null,
    });
    manualBySlug.delete(slug);
  }
  // Manual-only museums (not in frozen meta) — bring them in too.
  for (const manual of manualBySlug.values()) {
    museums.push(manual);
  }

  logInfo(`directory: ${museums.length} museums from frozen meta + manual config`);

  return { museums, exhibitions: [] };
}

function manualMuseumsAsParsed(): ParsedMuseum[] {
  return getManualMuseums().map((m) => ({
    slug: m.slug,
    name: m.name,
    museumsufer_url: "",
    description: m.description,
    image_url: m.image,
    website_url: m.website,
    ...(m.city ? { city: m.city } : {}),
  }));
}
