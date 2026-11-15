#!/usr/bin/env bun
/**
 * Hand-run: seed or force-rebuild the committed halle02 detail-page cache.
 *
 * Not needed for normal operation: event-hub's scrape.ts writes every live
 * detail fetch of `scrapeHalle02` back into `src/data/halle02-detail-cache.ts`
 * (the TMDb-cache pattern), so the cache keeps itself current, 40 posts per run.
 * This script only front-loads a large backlog (the first run, or `--force`
 * after a parser change) without waiting for several scheduled runs.
 *
 * Detail pages cost ~5 s each, which is why they are cached by post id plus WP
 * `modified` stamp: the scrape's output then depends on upstream data only, not
 * on how fast halle02.de answered (AGENTS.md determinism rule).
 *
 *   bun packages/scrapers/scripts/refresh-halle02-cache.ts            # add new/modified posts
 *   bun packages/scrapers/scripts/refresh-halle02-cache.ts --force    # re-parse everything
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PQueue from "p-queue";
import { HALLE02_DETAIL_CACHE, type Halle02CacheEntry } from "../src/data/halle02-detail-cache";
import {
  fetchDetail,
  fetchProgramList,
  isUpcomingCandidate,
  serializeHalle02Cache,
  type WpProgram,
} from "../src/venues/halle02";

const here = dirname(fileURLToPath(import.meta.url));
const force = process.argv.includes("--force");
const today = new Date().toISOString().slice(0, 10);

const posts = (await fetchProgramList()).filter((p) => isUpcomingCandidate(p.slug, today));
const cache: Record<number, Halle02CacheEntry> = {};
const todo: WpProgram[] = [];
for (const post of posts) {
  const hit = HALLE02_DETAIL_CACHE[post.id];
  if (!force && hit && hit.modified === post.modified) cache[post.id] = hit;
  else todo.push(post);
}
log(`${posts.length} candidate posts, ${posts.length - todo.length} cached, ${todo.length} to fetch`);

const queue = new PQueue({ concurrency: 6 });
let failed = 0;
await Promise.all(
  todo.map((post) =>
    queue.add(async () => {
      try {
        cache[post.id] = { modified: post.modified, detail: await fetchDetail(post) };
      } catch (e) {
        failed++;
        const stale = HALLE02_DETAIL_CACHE[post.id];
        if (stale) cache[post.id] = stale;
        log(`failed ${post.link}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  ),
);

// Only posts still listed stay in the cache, so it cannot grow without bound.
await writeFile(resolve(here, "../src/data/halle02-detail-cache.ts"), serializeHalle02Cache(cache), "utf8");
log(`wrote ${Object.keys(cache).length} entries (${failed} failed fetches)`);

function log(msg: string): void {
  process.stderr.write(`[halle02-cache] ${msg}\n`);
}
