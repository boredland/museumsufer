import { stripHtml } from "@museumsufer/core/html";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * Reusable "programme text → structured events" extraction via the AI proxy
 * (Gemini, OpenAI-compatible). A HAND-RUN dev/enrichment helper — NOT part of
 * the deterministic scrape path. See AGENTS.md "LLM access": an LLM call is
 * non-deterministic + network-bound, so it must never run inside `scrape()`.
 * The flow is: run a refresh script by hand (`scripts/refresh-pdf-cache.ts` for
 * PDF programmes, `scripts/refresh-html-cache.ts` for HTML pages) → it calls
 * this → the reviewed result is committed to `src/data/*-events-cache.ts` → the
 * venue scraper reads only that committed cache.
 *
 * Why an LLM over a positional/regex parser: many venues publish their whole
 * programme only as a redrawn-each-edition PDF or as free prose on a page.
 * Extracting the plain text and letting the model structure it survives those
 * layouts; a hand-run + committed output keeps the scrape deterministic + offline.
 */

export interface RawProgrammeEvent {
  /** ISO YYYY-MM-DD. */
  date: string;
  /** ISO YYYY-MM-DD; present for multi-day items. */
  end_date?: string | null;
  /** HH:MM. */
  time?: string | null;
  /** HH:MM. */
  end_time?: string | null;
  title: string;
  description?: string | null;
  /** "Referent" / Leitung / namentlich auftretende Person. */
  performers?: string | null;
  /** Euro amount as an integer. */
  price_min?: number | null;
}

/** One committed cache entry per venue `tag`. `hash` lets the refresh script
 *  skip an unchanged source; `version` invalidates entries on a schema/prompt bump. */
export interface ProgrammeEventsCacheEntry {
  hash: string;
  version: number;
  events: RawProgrammeEvent[];
}
export type ProgrammeEventsCache = Record<string, ProgrammeEventsCacheEntry>;

const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const SYSTEM_PROMPT = `Du extrahierst Veranstaltungen aus dem Klartext eines deutschen Kultur-Veranstaltungsprogramms (aus einem PDF oder von einer Webseite).
Antworte AUSSCHLIESSLICH mit JSON in der Form { "events": [ ... ] }.
Jedes Event-Objekt hat exakt diese Felder:
{ "date": "YYYY-MM-DD", "end_date": null | "YYYY-MM-DD", "time": null | "HH:MM", "end_time": null | "HH:MM",
  "title": string, "description": null | string, "performers": null | string, "price_min": null | number }
Regeln:
- Datum im Text steht als TT.MM.JJJJ oder als "T. Monatsname JJJJ" → wandle in ISO YYYY-MM-DD um.
- Zweitägige Angabe wie "14./ 15.01.2026": date = 2026-01-14, end_date = 2026-01-15.
- Zeit "HH:MM bis HH:MM Uhr": time = Beginn, end_time = Ende. Nur ein Beginn: time = Beginn, end_time = null.
- performers: NUR ein im Text ausdrücklich genannter Referent / Leitung / Dozent bzw. die namentlich auftretende Person. Erfinde KEINEN Personennamen und leite keinen aus einem reinen Titel ab. Steht nur ein Veranstaltungs- oder Bandname ohne separat genannte Person, setze null. Im Zweifel null.
- Preis "NN €" → price_min als ganze Zahl (nur der Euro-Betrag).
- title = die Veranstaltungsüberschrift, NICHT Datum/Ort/Gebühr/Referent.
- Erfinde nichts. Fehlt ein Feld, setze null. Keine Events ohne klares Datum.`;

/** SHA-256 hex of a string (Web Crypto; available globally in Bun/CI). */
export async function sourceTextHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ProgrammeToEventsOptions {
  /** URL of the AI proxy (OpenAI-compatible; token baked into the path). */
  aiProxyUrl: string;
  model?: string;
  /** Venue-specific extraction hints appended to the system prompt. */
  prompt?: string;
}

export interface PdfToEventsResult {
  hash: string;
  events: RawProgrammeEvent[];
}

/** Fetch a PDF and extract its plain text + a stable content hash. Cheap and
 *  deterministic — the refresh script uses the hash to skip an unchanged PDF
 *  before spending an LLM call. */
export async function fetchPdfText(pdfUrl: string): Promise<{ text: string; hash: string }> {
  const res = await fetch(pdfUrl, { headers: { "User-Agent": CHROME_UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`pdf fetch ${res.status} for ${pdfUrl}`);
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return { text, hash: await sourceTextHash(text) };
}

/** Fetch an HTML page and reduce it to plain text + a stable content hash — the
 *  HTML analogue of `fetchPdfText`. Tags are stripped so both the model and the
 *  hash see only the human-readable copy. */
export async function fetchHtmlText(pageUrl: string): Promise<{ text: string; hash: string }> {
  const res = await fetch(pageUrl, { headers: { "User-Agent": CHROME_UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`html fetch ${res.status} for ${pageUrl}`);
  const text = stripHtml(await res.text());
  return { text, hash: await sourceTextHash(text) };
}

/** Structure already-extracted PDF text into validated events via the model. */
export async function eventsFromText(text: string, opts: ProgrammeToEventsOptions): Promise<RawProgrammeEvent[]> {
  const events = validate(await callLlm(text, opts), text);
  if (events.length === 0) throw new Error("programme-events: 0 valid events extracted");
  return events;
}

/** Convenience: fetch + extract + structure in one call. */
export async function pdfToEvents(pdfUrl: string, opts: ProgrammeToEventsOptions): Promise<PdfToEventsResult> {
  const { text, hash } = await fetchPdfText(pdfUrl);
  return { hash, events: await eventsFromText(text, opts) };
}

async function callLlm(text: string, opts: ProgrammeToEventsOptions): Promise<unknown> {
  const body = {
    model: opts.model ?? "gemini-2.5-flash",
    messages: [
      { role: "system", content: opts.prompt ? `${SYSTEM_PROMPT}\n${opts.prompt}` : SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
  };
  const res = await fetch(`${opts.aiProxyUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": CHROME_UA },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`ai-proxy ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("ai-proxy: empty completion");
  return JSON.parse(stripCodeFences(content));
}

/** Gemini's OpenAI shim sometimes wraps JSON in ```json fences despite
 *  response_format — strip them before parsing. */
function stripCodeFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Keep only well-formed events whose date actually appears in the source text
 *  (anti-hallucination). The source spells dates as TT.MM.JJJJ or "T. Monatsname
 *  JJJJ", never ISO, so `dateInSource` reconstructs those forms to check presence. */
function validate(parsed: unknown, sourceText: string): RawProgrammeEvent[] {
  const list = (parsed as { events?: unknown })?.events;
  if (!Array.isArray(list)) return [];
  const out: RawProgrammeEvent[] = [];
  for (const item of list) {
    const e = item as Record<string, unknown>;
    const date = typeof e.date === "string" ? e.date : "";
    const title = typeof e.title === "string" ? e.title.trim() : "";
    if (!ISO_DATE.test(date) || !title) continue;
    const endDate = typeof e.end_date === "string" && ISO_DATE.test(e.end_date) ? e.end_date : null;
    if (endDate && endDate < date) continue;
    // The end date is the one printed verbatim for two-day "14./ 15.01" items.
    if (!dateInSource(endDate ?? date, sourceText)) continue;
    out.push({
      date,
      end_date: endDate,
      time: isHm(e.time) ? (e.time as string) : null,
      end_time: isHm(e.end_time) ? (e.end_time as string) : null,
      title,
      description: typeof e.description === "string" && e.description.trim() ? e.description.trim() : null,
      performers: typeof e.performers === "string" && e.performers.trim() ? e.performers.trim() : null,
      price_min: typeof e.price_min === "number" && Number.isFinite(e.price_min) ? e.price_min : null,
    });
  }
  return out;
}

function isHm(v: unknown): boolean {
  return typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);
}

const MONTHS_DE = [
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
] as const;

/** True if the ISO date appears in the source either numerically (TT.MM.JJJJ,
 *  tolerant of spacing/zero-padding) or spelled out as "T. Monatsname JJJJ" —
 *  covers PDF programmes (numeric) and HTML pages that write the month name. */
function dateInSource(iso: string, sourceText: string): boolean {
  const [y, m, d] = iso.split("-");
  const day = Number(d);
  const numeric = new RegExp(`\\b0?${day}\\.\\s*0?${Number(m)}\\.\\s*${y}\\b`);
  if (numeric.test(sourceText)) return true;
  const month = MONTHS_DE[Number(m) - 1];
  if (!month) return false;
  return new RegExp(`\\b0?${day}\\.?\\s*${month}\\s+${y}\\b`, "i").test(sourceText);
}
