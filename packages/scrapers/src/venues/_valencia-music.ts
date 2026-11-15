import { decodeEntities, stripHtml } from "@museumsufer/core";
import type { ScrapedLabel } from "../types";

export const VLC_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function fetchVlc(url: string, accept = "text/html"): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": VLC_UA, "Accept-Language": "es", Accept: accept } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

export function cleanText(html: string): string {
  return decodeEntities(stripHtml(html)).replace(/\s+/g, " ").trim();
}

/** The six konzert-haus genres; Valencia rock/pop clubs are out of scope. */
export type VlcGenre = "classical" | "jazz" | "sacred" | "world" | "experimental" | "chamber";

// konzert-haus keeps only events with a `music:*` label, and the German keyword
// rules in @museumsufer/classify do not fire on Spanish, so genre words are
// mapped here. Order matters: first matching bucket wins.
const BUCKETS: ReadonlyArray<{ genre: VlcGenre; re: RegExp }> = [
  { genre: "sacred", re: /\b(sacr[oa]s?|misa|requiem|gospel|villancicos?|stabat|te deum|oratorio|espiritual)\b/ },
  { genre: "jazz", re: /\b(jazz|swing|big ?band|bebop|manouche|jam session)\b/ },
  { genre: "experimental", re: /\b(electronic[oa]s?|techno|ambient|experimental|noise|dj set|house|synth)\b/ },
  {
    genre: "world",
    re: /\b(flamenc[oa]s?|salsa|reggae|reggaeton|latin[oa]?s?|cumbia|afrobeat|folk|fado|tango|rumba|bossa|musica tradicional|tradicional|world|valencianes|balls)\b/,
  },
  { genre: "chamber", re: /\b(camara|cambra|cuarteto|quinteto|sexteto|duo|recital|lied|lieder|solistas?)\b/ },
  {
    genre: "classical",
    re: /\b(orquest[ar]a|sinfon\w*|simfon\w*|opera|filarmon\w*|sonata|concierto para|concert per a|barroc[oa]?|banda sinfonica|bandas?|coro|cor|cantata|ensemble|philharmonic|symphony|orchestra|vivaldi|bach|beethoven|mozart|chopin|brahms|schubert|haydn|handel|haendel|rakhmaninov|rajmaninov|cuatro estaciones|musica antigua|renacimiento)\b/,
  },
];

/** `fallback: null` lets callers drop events no genre word can justify. */
export function genreFromText<F extends VlcGenre | null>(text: string, fallback: F): VlcGenre | F {
  const hay = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const { genre, re } of BUCKETS) if (re.test(hay)) return genre;
  return fallback;
}

export function musicLabel(genre: VlcGenre, confidence = 0.85): ScrapedLabel[] {
  return [{ label: `music:${genre}`, confidence, classifier: "scraper-hardcoded" }];
}

/** Euro amounts in free text ("Anticipada: 25€ / Taquilla: 29€"). */
export function pricesFrom(text: string): { min: number | null; max: number | null } {
  const nums = [...text.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*€/g)]
    .map((m) => Number.parseFloat(m[1].replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return { min: null, max: null };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Bounded fan-out so a venue with hundreds of detail pages stays polite. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
