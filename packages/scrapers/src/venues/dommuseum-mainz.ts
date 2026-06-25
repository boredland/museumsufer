import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const KALENDER_URL = "https://www.dommuseum-mainz.de/programm/kalender/aktuelle-termine-kalender/";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

/**
 * Dom- und Diözesanmuseum Mainz — WordPress site with a custom "Termin"
 * calendar page. Each event is an `<li class="termin-item …">` block
 * carrying inline date (`<span class="tag">DD.MM.</span>`), time range,
 * title (`<h1>` + `<h2>`), description (`<div class="da">`), and
 * price/location hints (`<p class="red italic">`). The date has no year;
 * we infer it with a Dec→Jan rollover check. No detail pages — all data
 * is on the single ~680 KB calendar page.
 */
export async function scrapeDommuseumMainz(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(KALENDER_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`dommuseum-mainz fetch failed: ${res.status}`);
  const html = await res.text();

  const currentYear = new Date().getFullYear();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const liRe = /<li class="termin-item[^"]*">([\s\S]*?)<\/li>/g;
  let match: RegExpExecArray | null;

  while ((match = liRe.exec(html)) !== null) {
    const block = match[1];

    // Date: <span class="tag">27.06. </span>
    const dateMatch = block.match(/<span class="tag">(\d{1,2})\.(\d{1,2})\.\s*<\/span>/);
    if (!dateMatch) continue;
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    if (!day || !month || month > 12) continue;

    // Year inference (same pattern as MRE scraper)
    const parsed = inferDate(day, month, currentYear);
    if (!parsed) continue;
    const { date } = parsed;
    if (date < today) continue;

    // Time: <div class="termindatumright...">11:30 Uhr - 13:30 Uhr</div>
    // Extract the full time block text to check for "p.m." suffix
    const timeBlockText = block.match(/termindatumright[^>]*>([^<]+)<\/div>/)?.[1] ?? "";
    const isPM = /p\.m\./i.test(timeBlockText);

    // Start time: first HH:MM in the block
    const timeMatch = timeBlockText.match(/(\d{1,2}):(\d{2})/);
    let time: string | null = null;
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      if (isPM && hour < 12) hour += 12;
      time = `${String(hour).padStart(2, "0")}:${timeMatch[2]}`;
    }

    // End time: HH:MM after the dash
    const endMatch = timeBlockText.match(/(\d{1,2}):(\d{2})\s*(?:Uhr)?\s*-\s*(\d{1,2}):(\d{2})/);
    let endTime: string | null = null;
    if (endMatch) {
      let endHour = parseInt(endMatch[3], 10);
      if (isPM && endHour < 12) endHour += 12;
      endTime = `${String(endHour).padStart(2, "0")}:${endMatch[4]}`;
    }

    // Title: <h1 class="bold">KiD</h1><h2>Kinder im Dommuseum</h2>
    const h1Match = block.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const h2Match = block.match(/<h2[^>]*>([^<]+)<\/h2>/);
    const titleParts: string[] = [];
    if (h1Match) titleParts.push(h1Match[1].trim());
    if (h2Match) titleParts.push(h2Match[1].trim());
    if (titleParts.length === 0) continue;
    const title = titleParts.join(" — ");

    // Description: <div class="da"><p>...</p></div>
    const descMatch = block.match(/<div class="da">([\s\S]*?)<\/div>/);
    const description = descMatch ? stripHtml(descMatch[1]).replace(/\s+/g, " ").trim().slice(0, 2000) || null : null;

    // Price/location hints: <p class="red italic">KOSTEN: ... TREFFPUNKT: ...</p>
    const extraMatch = block.match(/<p class="red italic">([\s\S]*?)<\/p>/);
    let priceMin: number | null = null;
    if (extraMatch) {
      const extra = extraMatch[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
      const priceHint = extra.match(/KOSTEN?\s*:\s*(\d+)\s*[€&]?/i);
      if (priceHint) priceMin = parseInt(priceHint[1], 10);
    }

    // Category from class: workshop-kinder, fuehrung-dom, etc.
    const catMatch = block.match(
      /termin-item[^"]*?\b(fuehrung-[a-z-]+|workshop-[a-z-]+|familienfuehrungen|kunst-und-kreppel)\b/,
    );
    const category = catMatch?.[1] ?? null;

    // Deduplicate by title + date (same event on same date)
    const dedupKey = `${title}|${date}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    events.push({
      source_event_id: dedupKey,
      title,
      description,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: KALENDER_URL,
      price_min: priceMin,
      labels: buildLabels(title, category),
    });
  }

  return { source_slug: "dommuseum-mainz", display_name: "Dom- und Diözesanmuseum Mainz", events };
}

// ─── helpers ────────────────────────────────────────────────────────────

function inferDate(day: number, month: number, currentYear: number): { date: string } | null {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  // If the event month is earlier than the current month and it's in the
  // first half of the year, it's next year (December→January rollover).
  const year = month < currentMonth && month <= 6 ? currentYear + 1 : currentYear;
  const d = String(day).padStart(2, "0");
  const mo = String(month).padStart(2, "0");
  return { date: `${year}-${mo}-${d}` };
}

function buildLabels(
  title: string,
  category: string | null,
): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [
    { label: "museum:event", confidence: 0.95, classifier: "scraper-hardcoded" },
  ];
  const t = title.toLowerCase();
  if (t.includes("führung") || t.includes("rundgang") || (category && category.includes("fuehrung"))) {
    labels.push({ label: "museum:fuehrung", confidence: 0.8, classifier: "scraper-hardcoded" });
  }
  if (t.includes("vortrag") || t.includes("gespräch") || t.includes("diskussion")) {
    labels.push({ label: "talk:lecture", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (
    t.includes("workshop") ||
    t.includes("kid") ||
    t.includes("kinder") ||
    (category && category.includes("workshop"))
  ) {
    labels.push({ label: "museum:workshop", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  return labels;
}
