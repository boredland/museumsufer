/** stderr line logger shared by the scrape pipeline. Format mirrors
 *  the theaters scrape output:
 *
 *    [scrape] events: senckenberg-naturmuseum  ok — 14 events
 *    [scrape] events: comedy-hall              FAIL — fetch failed: 503
 *
 *  The worker imports translate.ts (which imports this file) for the
 *  request-time `translateFields()` path, but `process` doesn't exist
 *  in the Workers runtime. The typeof guard below makes this a no-op
 *  there; only the Bun-driven scrape script actually emits lines.
 */
declare const process: { stderr: { write(s: string): void } } | undefined;

const PAD = 36;

function write(line: string): void {
  if (typeof process === "undefined") return;
  process.stderr.write(line);
}

export function logOk(group: string, slug: string, summary: string): void {
  write(`[scrape] ${group}: ${slug.padEnd(PAD, " ")} ok — ${summary}\n`);
}

export function logFail(group: string, slug: string, message: string): void {
  write(`[scrape] ${group}: ${slug.padEnd(PAD, " ")} FAIL — ${message}\n`);
}

export function logInfo(message: string): void {
  write(`[scrape] ${message}\n`);
}
