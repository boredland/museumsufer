import { decodeEntities, stripHtml } from "@museumsufer/core";
import { type ProxyConfig, proxyFetch } from "../proxy";
import type { ScrapedLabel } from "../types";

/**
 * Shared bits for the Valencia museum scrapers. Their sites are written in
 * Spanish or Valencian (Catalan), and `@museumsufer/classify` only knows German
 * keywords, so every item carries its own `museum:*` labels from the rules here.
 */

export const VALENCIA = { city: "valencia", language: "es" } as const;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/** Month words in Spanish and Valencian, keyed by their first three letters
 *  ("març" → "mar", "maig" → "mai", "setembre" → "set"). */
const MONTH_BY_PREFIX: Record<string, string> = {
  ene: "01",
  gen: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  set: "09",
  oct: "10",
  nov: "11",
  dic: "12",
  des: "12",
};

export function monthNumber(word: string): string | null {
  return MONTH_BY_PREFIX[word.toLowerCase().slice(0, 3)] ?? null;
}

export function iso(year: number | string, month: string, day: number | string): string {
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}

export function clean(html: string): string {
  return decodeEntities(stripHtml(html)).replace(/\s+/g, " ").trim();
}

/** `proxy` is for hosts whose TLS chain fails from CI (cac.es); everything else fetches directly. */
export async function fetchText(url: string, proxy: ProxyConfig | null = null): Promise<string> {
  const res = await proxyFetch(url, proxy, {
    headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

/** A listing that parses to zero items means the markup changed or the upstream is down;
 *  throwing keeps that from looking like an empty venue. */
export function expectFound<T>(items: T[], what: string): T[] {
  if (items.length === 0) throw new Error(`${what}: no items found, markup changed or upstream down`);
  return items;
}

export function absolute(base: string, href: string): string {
  return new URL(decodeEntities(href), base).toString();
}

export const EXHIBITION_LABEL: ScrapedLabel = {
  label: "museum:ausstellung",
  confidence: 0.95,
  classifier: "scraper-hardcoded",
};

/** Spanish/Valencian counterpart of the German event keyword classifier. Order
 *  matters: a "taller infantil" is a workshop, a "concierto familiar" a concert. */
const EVENT_RULES: Array<[RegExp, string]> = [
  [/inaugurac|inauguraci/i, "museum:vernissage"],
  [/visita|recorregut|recorrido|itinerari|\bruta\b|portes obertes|puertas abiertas/i, "museum:fuehrung"],
  [/taller|workshop|obrador/i, "museum:workshop"],
  [/concierto|concert|m[uú]sica|m[uú]sic|jazz|recital|\bcor\b|coral/i, "museum:konzert"],
  [/\bcine(?:ma|s)?\b|pel[·.]?l[ií]cula|proyecci|projecci|documental|filmoteca/i, "museum:film"],
  [/conferencia|confer[eè]ncia|charla|xerrada|conversa|\bpresentaci|\bcurso|\bcurs\b|jornada|seminario|mesa redonda|di[aà]leg|divulgativ/i, "museum:vortrag"],
  [/infantil|familiar|famil[ií]a|cuentacuentos|contacontes|ni[ñn]os|xiquets|escolar|beb[eé]s/i, "museum:familie"],
];

export function eventLabels(...texts: Array<string | null | undefined>): ScrapedLabel[] {
  const haystack = texts.filter(Boolean).join(" ");
  const hit = EVENT_RULES.find(([re]) => re.test(haystack));
  return [
    {
      label: hit ? hit[1] : "museum:event",
      confidence: hit ? 0.85 : 0.5,
      classifier: "scraper-hardcoded",
    },
  ];
}

export interface DateSpan {
  start: string;
  end: string | null;
}

const DAY_TOKEN_RE = /\b(\d{1,2})\b\s*(?:de\s+)?([A-Za-zÀ-ÿ·]{3,})?\.?\s*(?:de\s+)?(\d{4})?/g;

/** Reads "21 OCTUBRE - 22 NOVEMBRE 2026", "15 de septiembre al 31 de octubre",
 *  "20 - 29 noviembre 2026" or a single "22 NOVEMBRE 2026". A missing month or
 *  year is borrowed from the next token; a span with no year at all is placed
 *  in the coming 200 days. Returns null when no day+month can be read (a
 *  month-only span like "JULIOL 2026 - DESEMBRE 2027" has no usable start). */
export function parseDateSpan(text: string, today: string): DateSpan | null {
  const span = parseSpan(text, today);
  // "10 I 17 DESEMBRE" lists two separate days, not a stay between them.
  return span && /\b\d{1,2}\s+(?:i|y)\s+\d{1,2}\b/i.test(text) ? { start: span.start, end: null } : span;
}

function parseSpan(text: string, today: string): DateSpan | null {
  const tokens = [...text.matchAll(DAY_TOKEN_RE)].map((m) => ({
    day: Number(m[1]),
    month: m[2] ? monthNumber(m[2]) : null,
    year: m[3] ? Number(m[3]) : null,
  }));
  const valid = tokens.filter((t) => t.day >= 1 && t.day <= 31 && (t.month !== null || t.year === null));
  for (let i = valid.length - 2; i >= 0; i--) {
    valid[i].month ??= valid[i + 1].month;
    if (valid[i].year === null && valid[i].month === valid[i + 1].month) valid[i].year = valid[i + 1].year;
  }
  const dated = valid.filter((t) => t.month);
  if (dated.length === 0) return null;
  const first = dated[0];
  const last = dated.length > 1 ? dated[dated.length - 1] : null;
  const todayYear = Number(today.slice(0, 4));

  let startYear = first.year ?? last?.year ?? todayYear;
  if (first.year === null && last?.year == null) {
    // A yearless span: take the occurrence that is not long past.
    const cutoff = new Date(`${today}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 200);
    if (iso(startYear, first.month!, first.day) < cutoff.toISOString().slice(0, 10)) startYear += 1;
  } else if (first.year === null && last?.year != null && Number(last.month) < Number(first.month)) {
    startYear = last.year - 1;
  }
  const start = iso(startYear, first.month!, first.day);
  if (!last) return { start, end: null };
  let endYear = last.year ?? startYear;
  if (iso(endYear, last.month!, last.day) < start) endYear += 1;
  const end = iso(endYear, last.month!, last.day);
  return { start, end: end === start ? null : end };
}

/** dd.mm.yyyy or dd/mm/yyyy occurrences, in document order. */
export function numericDates(text: string): string[] {
  return [...text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)].map(([, d, m, y]) => iso(y, m.padStart(2, "0"), d));
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Exhibitions the site announces without a closing date ("Desde el 7 de octubre")
 *  are listed for this long after opening, derived from the start so scrape output
 *  stays byte-stable between runs. */
export const OPEN_ENDED_DAYS = 180;
