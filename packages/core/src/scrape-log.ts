/** stderr line logger for the scrape scripts. `process` doesn't exist
 *  in the Workers runtime, so the typeof guard makes this a no-op when
 *  imported transitively at request time. */
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
