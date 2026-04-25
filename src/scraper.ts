import { Env } from "./types";
import { MUSEUMSUFER_DE, GERMAN_MONTHS } from "./shared";

const BASE_URL = MUSEUMSUFER_DE;
const EXHIBITIONS_URL = `${BASE_URL}/de/ausstellungen-und-veranstaltungen/aktuelle-ausstellungen/`;
const MUSEUMS_URL = `${BASE_URL}/de/museen/`;

export async function scrape(env: Env): Promise<{ exhibitions: number; museums: number }> {
  const museumsCount = await scrapeMuseums(env);
  const exhibitionsCount = await scrapeExhibitions(env);
  return { exhibitions: exhibitionsCount, museums: museumsCount };
}

interface MuseumMapEntry {
  id: number;
  name: string;
  description: string;
  url: string;
  tags: string;
}

async function scrapeMuseums(env: Env): Promise<number> {
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
  const museums = config.museums;

  const stmt = env.DB.prepare(
    `INSERT INTO museums (name, slug, museumsufer_url) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name, updated_at = datetime('now')`
  );

  const ops = museums.map((m) => {
    const slug = m.url.replace(/^\/de\/museen\//, "").replace(/\/$/, "");
    return stmt.bind(m.name.trim(), slug, `${BASE_URL}${m.url}`);
  });

  await env.DB.batch(ops);
  return museums.length;
}

interface ParsedExhibition {
  title: string;
  museum_name: string;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
  detail_url: string;
}

async function scrapeExhibitions(env: Env): Promise<number> {
  const res = await fetch(EXHIBITIONS_URL);
  if (!res.ok) throw new Error(`Failed to fetch exhibitions: ${res.status}`);
  const html = await res.text();

  const exhibitions = parseExhibitions(html);
  if (exhibitions.length === 0) return 0;

  for (const ex of exhibitions) {
    const museumId = await resolveMuseumId(env, ex.museum_name);

    await env.DB.prepare(
      `INSERT INTO exhibitions (museum_id, title, start_date, end_date, image_url, detail_url)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(museum_id, title) DO UPDATE SET
         start_date = excluded.start_date,
         end_date = excluded.end_date,
         image_url = excluded.image_url,
         detail_url = excluded.detail_url,
         updated_at = datetime('now')`
    )
      .bind(
        museumId,
        ex.title,
        ex.start_date,
        ex.end_date,
        ex.image_url,
        ex.detail_url
      )
      .run();
  }

  return exhibitions.length;
}

async function resolveMuseumId(env: Env, museumName: string): Promise<number> {
  const slug = slugify(museumName);
  const nameNorm = museumName.toLowerCase().trim();

  const bySlug = await env.DB.prepare("SELECT id FROM museums WHERE slug = ?")
    .bind(slug)
    .first<{ id: number }>();
  if (bySlug) return bySlug.id;

  const { results: allMuseums } = await env.DB.prepare(
    "SELECT id, name, slug FROM museums"
  ).all<{ id: number; name: string; slug: string }>();

  let bestMatch: { id: number; score: number } | null = null;
  const slugParts = slug.split("-");

  for (const m of allMuseums) {
    const mSlugParts = m.slug.split("-");
    const mNameNorm = m.name.toLowerCase().trim();

    if (mNameNorm === nameNorm) return m.id;

    if (mNameNorm.includes(nameNorm) || nameNorm.includes(mNameNorm)) {
      const score = Math.min(nameNorm.length, mNameNorm.length);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { id: m.id, score };
      }
      continue;
    }

    let matching = 0;
    for (let i = 0; i < Math.min(slugParts.length, mSlugParts.length); i++) {
      if (slugParts[i] === mSlugParts[i] || normalizeStem(slugParts[i]) === normalizeStem(mSlugParts[i])) matching++;
      else break;
    }
    if (matching >= 2 && (!bestMatch || matching > bestMatch.score)) {
      bestMatch = { id: m.id, score: matching };
    }
  }

  if (bestMatch) return bestMatch.id;

  const inserted = await env.DB.prepare(
    `INSERT INTO museums (name, slug, museumsufer_url) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET updated_at = datetime('now')
     RETURNING id`
  )
    .bind(museumName, slug, `${BASE_URL}/de/museen/${slug}/`)
    .first<{ id: number }>();
  return inserted!.id;
}

function parseExhibitions(html: string): ParsedExhibition[] {
  const results: ParsedExhibition[] = [];

  const blockRe = /<a\s+href="(\/de\/ausstellungen-und-veranstaltungen\/ausstellungen\/[^"]+)">\s*<div class="teaserBox">([\s\S]*?)<\/div>\s*<\/a>/g;
  let blockMatch;
  while ((blockMatch = blockRe.exec(html)) !== null) {
    const detailUrl = blockMatch[1];
    const inner = blockMatch[2];

    const imgMatch = inner.match(/<img\s+src="([^"]+)"/);
    const titleMatch = inner.match(/<h2[^>]*class="[^"]*teaserHeadline[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
    const textMatch = inner.match(/<p[^>]*class="[^"]*teaserText[^"]*"[^>]*>([\s\S]*?)<\/p>/);

    if (!titleMatch || !textMatch) continue;

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

  return results;
}

function parseGermanDateRange(text: string): { start: string | null; end: string | null } {
  const cleaned = text.replace(/&ndash;/g, "–").replace(/\s+/g, " ").trim();

  // "DD. Month YYYY" (single date)
  // "DD. Month - DD. Month YYYY"
  // "DD. Month YYYY - DD. Month YYYY"
  const rangeMatch = cleaned.match(
    /(\d{1,2})\.\s*(\w+)\s*(?:(\d{4}))?\s*[-–]\s*(\d{1,2})\.\s*(\w+)\s*(\d{4})/
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

  // Single date: "DD. Month YYYY"
  const singleMatch = cleaned.match(/(\d{1,2})\.\s*(\w+)\s*(\d{4})/);
  if (singleMatch) {
    const [, day, monthName, year] = singleMatch;
    const month = GERMAN_MONTHS[monthName.toLowerCase()];
    if (!month) return { start: null, end: null };
    const date = `${year}-${month}-${day.padStart(2, "0")}`;
    return { start: date, end: date };
  }

  return { start: null, end: null };
}

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
  return word
    .replace(/en$/, "")
    .replace(/es$/, "")
    .replace(/er$/, "")
    .replace(/em$/, "");
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
