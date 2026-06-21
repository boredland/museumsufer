import { extractText, getDocumentProxy } from "unpdf";

/**
 * Reusable "PDF programme → structured events" extraction, via the AI proxy
 * (Gemini, OpenAI-compatible). This is a HAND-RUN dev/enrichment helper — NOT
 * part of the deterministic scrape path. See AGENTS.md "LLM access": an LLM
 * call is non-deterministic + network-bound, so it must never run inside
 * `scrape()`. The flow is: run `scripts/refresh-pdf-cache.ts` by hand → it calls
 * this → the reviewed result is committed to `src/data/pdf-events-cache.ts` →
 * the venue scraper reads only that committed cache.
 *
 * Why LLM over a positional/regex parser: many venues publish their whole year
 * only as a PDF whose column layout is redrawn each edition. Extracting the
 * plain text and letting the model structure it survives those redesigns; a
 * hand-run + committed-output keeps the scrape itself deterministic and offline.
 */

export interface RawPdfEvent {
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
  /** "Referent" / leader. */
  performers?: string | null;
  /** Euro amount as an integer. */
  price_min?: number | null;
}

/** One committed cache entry per venue `tag`. `hash` lets the refresh script
 *  skip an unchanged PDF; `version` invalidates entries on a schema/prompt bump. */
export interface PdfEventsCacheEntry {
  hash: string;
  version: number;
  events: RawPdfEvent[];
}
export type PdfEventsCache = Record<string, PdfEventsCacheEntry>;

const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const SYSTEM_PROMPT = `Du extrahierst Veranstaltungen aus dem Klartext eines deutschen Kultur-Veranstaltungsprogramms (aus einem PDF).
Antworte AUSSCHLIESSLICH mit JSON in der Form { "events": [ ... ] }.
Jedes Event-Objekt hat exakt diese Felder:
{ "date": "YYYY-MM-DD", "end_date": null | "YYYY-MM-DD", "time": null | "HH:MM", "end_time": null | "HH:MM",
  "title": string, "description": null | string, "performers": null | string, "price_min": null | number }
Regeln:
- Datum im Text steht als TT.MM.JJJJ → wandle in ISO YYYY-MM-DD um.
- Zweitägige Angabe wie "14./ 15.01.2026": date = 2026-01-14, end_date = 2026-01-15.
- Zeit "HH:MM bis HH:MM Uhr": time = Beginn, end_time = Ende. Nur ein Beginn: time = Beginn, end_time = null.
- "Referent"/Leitung → performers. Preis "NN €" → price_min als ganze Zahl (nur der Euro-Betrag).
- title = die Veranstaltungsüberschrift, NICHT Datum/Ort/Gebühr/Referent.
- Erfinde nichts. Fehlt ein Feld, setze null. Keine Events ohne klares Datum.`;

/** SHA-256 hex of a string (Web Crypto; available globally in Bun/CI). */
export async function pdfTextHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface PdfToEventsOptions {
  /** URL of the AI proxy (OpenAI-compatible; token baked into the path). */
  aiProxyUrl: string;
  model?: string;
  /** Venue-specific extraction hints appended to the system prompt. */
  prompt?: string;
}

export interface PdfToEventsResult {
  hash: string;
  events: RawPdfEvent[];
}

/** Fetch a PDF and extract its plain text + a stable content hash. Cheap and
 *  deterministic — the refresh script uses the hash to skip an unchanged PDF
 *  before spending an LLM call. */
export async function fetchPdfText(pdfUrl: string): Promise<{ text: string; hash: string }> {
  const res = await fetch(pdfUrl, { headers: { "User-Agent": CHROME_UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`pdf fetch ${res.status} for ${pdfUrl}`);
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return { text, hash: await pdfTextHash(text) };
}

/** Structure already-extracted PDF text into validated events via the model. */
export async function eventsFromText(text: string, opts: PdfToEventsOptions): Promise<RawPdfEvent[]> {
  const events = validate(await callLlm(text, opts), text);
  if (events.length === 0) throw new Error("pdf-events: 0 valid events extracted");
  return events;
}

/** Convenience: fetch + extract + structure in one call. */
export async function pdfToEvents(pdfUrl: string, opts: PdfToEventsOptions): Promise<PdfToEventsResult> {
  const { text, hash } = await fetchPdfText(pdfUrl);
  return { hash, events: await eventsFromText(text, opts) };
}

async function callLlm(text: string, opts: PdfToEventsOptions): Promise<unknown> {
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
 *  (anti-hallucination). Dates live in the PDF as TT.MM.JJJJ, never ISO, so we
 *  reconstruct the source form to check presence. */
function validate(parsed: unknown, sourceText: string): RawPdfEvent[] {
  const list = (parsed as { events?: unknown })?.events;
  if (!Array.isArray(list)) return [];
  const out: RawPdfEvent[] = [];
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

/** True if the ISO date appears in the source as TT.MM.JJJJ (tolerant of the
 *  brochure's spacing and zero-padding). */
function dateInSource(iso: string, sourceText: string): boolean {
  const [y, m, d] = iso.split("-");
  const re = new RegExp(`\\b0?${Number(d)}\\.\\s*0?${Number(m)}\\.\\s*${y}\\b`);
  return re.test(sourceText);
}
