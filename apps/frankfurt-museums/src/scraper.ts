/**
 * Pure-function scrape of museumsufer.de — the canonical source of the
 * museum directory and its currently-running exhibitions. No D1, no
 * env.DB; the script wires the result into the bundled SCRAPE_DATA.
 *
 * Each call returns a fresh dataset; previous-bundle merging happens at
 * the script level (e.g., to keep Wikipedia images sticky when a lookup
 * fails).
 */
import { getManualMuseums, WIKIPEDIA_IMAGE_URL_OVERRIDES, WIKIPEDIA_TITLE_OVERRIDES } from "./museum-config";
import { GERMAN_MONTHS, MUSEUMSUFER_DE } from "./shared";

const BASE_URL = MUSEUMSUFER_DE;
const EXHIBITIONS_URL = `${BASE_URL}/de/ausstellungen-und-veranstaltungen/aktuelle-ausstellungen/`;
const MUSEUMS_URL = `${BASE_URL}/de/museen/`;

const WIKIPEDIA_UA = "Museumsufer/1.0 (https://museumsufer.app; jonas@bgdlabs.com)";

export interface ParsedMuseum {
  name: string;
  slug: string;
  museumsufer_url: string;
  description: string | null;
  image_url: string | null;
  website_url?: string | null;
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

/** Top-level entry: scrapes the directory + Wikipedia + exhibition descriptions.
 *  `previous` lets us preserve sticky fields (website_url, image_url) when a
 *  lookup fails this run. */
export async function scrape(opts: { previous?: PreviousData } = {}): Promise<{
  museums: ParsedMuseum[];
  exhibitions: ParsedExhibition[];
}> {
  const previous = opts.previous;

  const directoryMuseums = await scrapeMuseums();
  const manualMuseums = manualMuseumsAsParsed();
  const museumsBySlug = new Map<string, ParsedMuseum>();
  for (const m of [...directoryMuseums, ...manualMuseums]) {
    museumsBySlug.set(m.slug, m);
  }

  await refreshWikipediaImages(museumsBySlug, previous?.museums ?? []);

  const directoryExhibitions = await scrapeExhibitions(museumsBySlug);
  await enrichExhibitionDescriptions(directoryExhibitions, previous?.exhibitions ?? []);

  return { museums: [...museumsBySlug.values()], exhibitions: directoryExhibitions };
}

// ─── museums ──────────────────────────────────────────────────────────

interface MuseumMapEntry {
  id: number;
  name: string;
  description: string;
  teaser_img: string;
  url: string;
  tags: string;
}

async function scrapeMuseums(): Promise<ParsedMuseum[]> {
  const res = await fetch(MUSEUMS_URL);
  if (!res.ok) throw new Error(`Failed to fetch museums: ${res.status}`);
  const html = await res.text();

  const startMarker = "museumMapConfig = ";
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) throw new Error("Could not find museumMapConfig");
  const jsonStart = startIdx + startMarker.length;
  const scriptEnd = html.indexOf("</script>", jsonStart);
  const jsonStr = html.slice(jsonStart, scriptEnd).replace(/;\s*$/, "").trim();
  if (!jsonStr.startsWith("{")) throw new Error("Could not find museumMapConfig JSON");

  const config = JSON.parse(jsonStr) as { museums: MuseumMapEntry[] };

  return config.museums.map((m): ParsedMuseum => {
    const slug = m.url.replace(/^\/de\/museen\//, "").replace(/\/$/, "");
    const name = m.name.replace(/\s+/g, " ").trim();
    return {
      slug,
      name,
      museumsufer_url: `${BASE_URL}${m.url}`,
      description: m.description?.replace(/\s+/g, " ").trim() || null,
      image_url: m.teaser_img ? `${BASE_URL}/media/sliderimages/${m.teaser_img}` : null,
    };
  });
}

function manualMuseumsAsParsed(): ParsedMuseum[] {
  return getManualMuseums().map((m) => ({
    slug: m.slug,
    name: m.name,
    museumsufer_url: "",
    description: m.description ?? null,
    image_url: m.image ?? null,
    website_url: m.website ?? null,
  }));
}

// ─── Wikipedia image enrichment ───────────────────────────────────────

async function lookupWikipediaImage(name: string): Promise<string | null> {
  const summary = async (title: string): Promise<string | null> => {
    const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { "User-Agent": WIKIPEDIA_UA },
    });
    if (!r.ok) {
      await r.body?.cancel();
      return null;
    }
    const d = (await r.json()) as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
    return d.originalimage?.source || d.thumbnail?.source || null;
  };

  // Many museum names carry a subtitle or alternative ("Caricatura Museum
  // Frankfurt – Museum für Komische Kunst", "Goethe-Haus / Freies Deutsches
  // Hochstift"). Strip after the first /, –, : or & — but NOT hyphens, since
  // German compounds use them ("Goethe-Haus", "Romantik-Museum").
  const cleaned = name.split(/\s*[/–:&]\s*/)[0].trim();
  for (const candidate of cleaned !== name ? [name, cleaned] : [name]) {
    const img = await summary(candidate);
    if (img) return img;
  }

  // Conservative opensearch: only accept a result whose title contains every
  // significant token (≥3 letters) of the cleaned source name.
  const tokens = (cleaned.toLowerCase().match(/\p{L}+/gu) || []).filter((t) => t.length >= 3);
  if (tokens.length === 0) return null;
  try {
    const r = await fetch(
      `https://de.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleaned)}&limit=3&format=json`,
      { headers: { "User-Agent": WIKIPEDIA_UA } },
    );
    if (!r.ok) {
      await r.body?.cancel();
      return null;
    }
    const data = (await r.json()) as [string, string[], string[], string[]];
    for (const candidate of data[1] || []) {
      const lower = candidate.toLowerCase();
      if (!tokens.every((t) => lower.includes(t))) continue;
      const img = await summary(candidate);
      if (img) return img;
    }
  } catch {}
  return null;
}

async function refreshWikipediaImages(museums: Map<string, ParsedMuseum>, previous: ParsedMuseum[]): Promise<void> {
  const previousBySlug = new Map(previous.map((m) => [m.slug, m]));
  const lookups = await Promise.all(
    [...museums.values()].map(async (m) => {
      const direct = WIKIPEDIA_IMAGE_URL_OVERRIDES[m.slug];
      if (direct) return { slug: m.slug, image: direct };
      // Skip the lookup if we already have an image — Wikipedia rarely
      // changes museum article images, and we have a previous-bundle copy.
      if (m.image_url) return { slug: m.slug, image: m.image_url };
      if (previousBySlug.get(m.slug)?.image_url) {
        return { slug: m.slug, image: previousBySlug.get(m.slug)!.image_url };
      }
      const image = await lookupWikipediaImage(WIKIPEDIA_TITLE_OVERRIDES[m.slug] || m.name).catch(() => null);
      return { slug: m.slug, image };
    }),
  );
  for (const { slug, image } of lookups) {
    if (!image) continue;
    const m = museums.get(slug);
    if (m) m.image_url = image;
  }
}

// ─── exhibitions ──────────────────────────────────────────────────────

async function scrapeExhibitions(museums: Map<string, ParsedMuseum>): Promise<ParsedExhibition[]> {
  const res = await fetch(EXHIBITIONS_URL);
  if (!res.ok) throw new Error(`Failed to fetch exhibitions: ${res.status}`);
  const html = await res.text();

  const parsed = parseExhibitions(html);

  const out: ParsedExhibition[] = [];
  for (const teaser of parsed) {
    const museumSlug = resolveMuseumSlug(teaser.museum_name, museums) ?? synthesiseMuseum(teaser.museum_name, museums);
    out.push({
      museum_slug: museumSlug,
      title: teaser.title,
      start_date: teaser.start_date,
      end_date: teaser.end_date,
      description: null,
      image_url: teaser.image_url,
      detail_url: teaser.detail_url,
    });
  }
  return out;
}

function synthesiseMuseum(museumName: string, museums: Map<string, ParsedMuseum>): string {
  const slug = slugify(museumName);
  if (!museums.has(slug)) {
    museums.set(slug, {
      slug,
      name: museumName,
      museumsufer_url: `${BASE_URL}/de/museen/${slug}/`,
      description: null,
      image_url: null,
    });
  }
  return slug;
}

function resolveMuseumSlug(museumName: string, museums: Map<string, ParsedMuseum>): string | null {
  const slug = slugify(museumName);
  if (museums.has(slug)) return slug;

  const nameNorm = museumName.toLowerCase().trim();
  const slugParts = slug.split("-");

  let bestMatch: { slug: string; score: number } | null = null;
  for (const m of museums.values()) {
    const mNameNorm = m.name.toLowerCase().trim();
    if (mNameNorm === nameNorm) return m.slug;

    if (mNameNorm.includes(nameNorm) || nameNorm.includes(mNameNorm)) {
      const score = Math.min(nameNorm.length, mNameNorm.length);
      if (!bestMatch || score > bestMatch.score) bestMatch = { slug: m.slug, score };
      continue;
    }

    const mSlugParts = m.slug.split("-");
    let matching = 0;
    for (let i = 0; i < Math.min(slugParts.length, mSlugParts.length); i++) {
      if (slugParts[i] === mSlugParts[i] || normalizeStem(slugParts[i]) === normalizeStem(mSlugParts[i])) matching++;
      else break;
    }
    if (matching >= 2 && (!bestMatch || matching > bestMatch.score)) {
      bestMatch = { slug: m.slug, score: matching };
    }
  }

  return bestMatch?.slug ?? null;
}

interface ScrapedTeaser {
  title: string;
  museum_name: string;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
  detail_url: string;
}

function parseExhibitions(html: string): ScrapedTeaser[] {
  const results: ScrapedTeaser[] = [];

  const blockRe =
    /<a\s+href="(\/de\/ausstellungen-und-veranstaltungen\/ausstellungen\/[^"]+)">\s*<div class="teaserBox">([\s\S]*?)<\/div>\s*<\/a>/g;
  let blockMatch: RegExpExecArray | null = blockRe.exec(html);
  while (blockMatch !== null) {
    const detailUrl = blockMatch[1];
    const inner = blockMatch[2];

    const imgMatch = inner.match(/<img\s+src="([^"]+)"/);
    const titleMatch = inner.match(/<h2[^>]*class="[^"]*teaserHeadline[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
    const textMatch = inner.match(/<p[^>]*class="[^"]*teaserText[^"]*"[^>]*>([\s\S]*?)<\/p>/);

    if (titleMatch && textMatch) {
      const title = decodeHtmlEntities(titleMatch[1].trim());
      const textContent = textMatch[1].trim();
      const parts = textContent.split(/<br\s*\/?>/);

      const dateStr = parts[0]?.trim() || "";
      const museumName = decodeHtmlEntities(parts[1]?.trim() || "Unknown");

      const { start, end } = parseGermanDateRange(dateStr);

      results.push({
        title,
        museum_name: museumName,
        start_date: start,
        end_date: end,
        image_url: imgMatch ? `${BASE_URL}${imgMatch[1]}` : null,
        detail_url: `${BASE_URL}${detailUrl}`,
      });
    }
    blockMatch = blockRe.exec(html);
  }

  return results;
}

function parseGermanDateRange(text: string): { start: string | null; end: string | null } {
  const cleaned = text
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();

  const M = "[\\wäöüÄÖÜß]+";
  const rangeMatch = cleaned.match(
    new RegExp(`(\\d{1,2})\\.\\s*(${M})\\s*(?:(\\d{4}))?\\s*[-–]\\s*(\\d{1,2})\\.\\s*(${M})\\s*(\\d{4})`),
  );

  if (rangeMatch) {
    const [, startDay, startMonthName, startYearStr, endDay, endMonthName, endYear] = rangeMatch;
    const endMonth = GERMAN_MONTHS[endMonthName.toLowerCase()];
    const startMonth = GERMAN_MONTHS[startMonthName.toLowerCase()];
    if (!endMonth || !startMonth) return { start: null, end: null };

    const startYear = startYearStr || endYear;
    return {
      start: `${startYear}-${startMonth}-${startDay.padStart(2, "0")}`,
      end: `${endYear}-${endMonth}-${endDay.padStart(2, "0")}`,
    };
  }

  const openMatch = cleaned.match(new RegExp(`^[Aa]b\\s+(\\d{1,2})\\.\\s*(${M})\\s*(\\d{4})`));
  if (openMatch) {
    const [, day, monthName, year] = openMatch;
    const month = GERMAN_MONTHS[monthName.toLowerCase()];
    if (!month) return { start: null, end: null };
    return { start: `${year}-${month}-${day.padStart(2, "0")}`, end: null };
  }

  const singleMatch = cleaned.match(new RegExp(`(\\d{1,2})\\.\\s*(${M})\\s*(\\d{4})`));
  if (singleMatch) {
    const [, day, monthName, year] = singleMatch;
    const month = GERMAN_MONTHS[monthName.toLowerCase()];
    if (!month) return { start: null, end: null };
    const date = `${year}-${month}-${day.padStart(2, "0")}`;
    return { start: date, end: date };
  }

  return { start: null, end: null };
}

// ─── exhibition descriptions (museumsufer.de detail pages) ────────────

async function enrichExhibitionDescriptions(
  exhibitions: ParsedExhibition[],
  previous: ParsedExhibition[],
): Promise<void> {
  const previousByDetailUrl = new Map(previous.map((e) => [e.detail_url, e]));

  // Carry over previous-bundle descriptions; only fetch fresh for ones still
  // missing. Cap fresh fetches per run at 20 (matches the previous SQL LIMIT).
  for (const ex of exhibitions) {
    if (ex.description) continue;
    const prev = previousByDetailUrl.get(ex.detail_url);
    if (prev?.description) ex.description = prev.description;
  }

  const needsFetch = exhibitions
    .filter((ex) => !ex.description && ex.detail_url.includes("museumsufer.de"))
    .slice(0, 20);

  await Promise.all(
    needsFetch.map(async (ex) => {
      try {
        const res = await fetch(ex.detail_url);
        if (!res.ok) return;
        const html = await res.text();
        const containerMatch = html.match(
          /<div class="textContainer[^"]*">\s*<div class="textPanel">([\s\S]*?)<\/div>/,
        );
        if (!containerMatch) return;
        const description = decodeHtmlEntities(
          containerMatch[1]
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        );
        if (description.length < 20) return;
        ex.description = description;
      } catch {}
    }),
  );
}

// ─── small utils ──────────────────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/­/g, "");
}

function normalizeStem(word: string): string {
  return word.replace(/en$/, "").replace(/es$/, "").replace(/er$/, "").replace(/em$/, "");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
