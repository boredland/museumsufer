/**
 * Source health check. For each upstream we perform the minimum probe
 * that would catch the kinds of regression that have actually broken
 * production scrapes elsewhere in this repo:
 *
 *   - Kulturnetz: the 15 category listing pages must each return 200
 *     and contain at least one schema.org Event itemscope.
 *   - Stadt Landau: the public ICS feed must return non-empty text
 *     containing BEGIN:VEVENT.
 *   - Hambacher Schloss: the MEC RSS must contain at least one
 *     <mec:startDate>.
 *   - RPTU: the newsroom RSS must contain at least one <item>.
 *   - SÜW: the listing must contain at least one event slug.
 *   - Pfalz.de: the sitemap must contain a /de/veranstaltung/ URL.
 *
 * Two-state output: ok / failed. The GitHub Action (see
 * .github/workflows/health-check.yml) opens an issue when any check
 * fails so the breakage is surfaced before the next daily scrape pushes
 * a thinned-out bundle.
 */

import { KULTURNETZ_CATEGORY_MAP } from "./categories";

export interface HealthCheckResult {
  source: string;
  url: string;
  ok: boolean;
  detail: string;
}

export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  const results = await Promise.all([
    ...Object.keys(KULTURNETZ_CATEGORY_MAP).map((cat) =>
      probe(`kulturnetz/${cat}`, `https://kulturnetz-landau.de/veranstaltungen/${cat}/`, (body) =>
        /itemtype="https?:\/\/schema\.org\/Event"/i.test(body),
      ),
    ),
    probe("landau-de/ics", "https://www.landau.de/output/options.php?ModID=11&call=ical&ext=ics&La=1", (body) =>
      body.includes("BEGIN:VEVENT"),
    ),
    probe("hambacher-schloss/feed", "https://hambacher-schloss.de/events/feed/", (body) =>
      body.includes("<mec:startDate>"),
    ),
    probe("rptu/rss", "https://rptu.de/newsroom/veranstaltungen/rss.xml", (body) => /<item>/i.test(body)),
    probe(
      "suew/listing",
      "https://www.suedlicheweinstrasse.de/veranstaltungen/uebersicht?tx_sfcontenthub_contenthub%5BcurrentPage%5D=1",
      (body) => /\/veranstaltungen\/uebersicht\/[a-z0-9-]+-\d{4}-\d{2}-\d{2}/i.test(body),
    ),
    probe(
      "pfalz-de/sitemap",
      "https://www.pfalz.de/sitemap.xml",
      (body) => body.includes("/de/veranstaltung/"),
      30_000,
    ),
  ]);
  return results;
}

async function probe(
  source: string,
  url: string,
  predicate: (body: string) => boolean,
  timeoutMs = 15_000,
): Promise<HealthCheckResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "landau-today-healthcheck/1.0" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return { source, url, ok: false, detail: `HTTP ${res.status}` };
    }
    // Some sources (landau.de) are ISO-8859-1; we need the body as text.
    // arrayBuffer + TextDecoder is more permissive than .text() + the
    // wrong implicit encoding.
    const buf = new Uint8Array(await res.arrayBuffer());
    const utf8 = new TextDecoder("utf-8", { fatal: false, ignoreBOM: false }).decode(buf);
    const latin1 = utf8.includes("�") ? new TextDecoder("iso-8859-1").decode(buf) : utf8;
    if (!predicate(latin1)) {
      return { source, url, ok: false, detail: "predicate failed (markup changed?)" };
    }
    return { source, url, ok: true, detail: `${latin1.length} bytes` };
  } catch (err) {
    return { source, url, ok: false, detail: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

export function formatResults(results: HealthCheckResult[]): string {
  const lines = results.map((r) => `${r.ok ? "✓" : "✗"} ${r.source.padEnd(30)} ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  lines.push("");
  lines.push(`${results.length - failed}/${results.length} checks passed.`);
  return lines.join("\n");
}
