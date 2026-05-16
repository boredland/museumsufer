#!/usr/bin/env bun
/**
 * Inspect the hub's canonical events from the command line. Used during
 * Phase 1 validation to compare label-filtered slices against each app's
 * existing scrape-data.ts before cutover.
 *
 * Usage:
 *   bun --cwd packages/event-hub query --labels talk:lesung,talk:vortrag
 *   bun --cwd packages/event-hub query --source mousonturm
 *   bun --cwd packages/event-hub query --labels music: --from 2026-05-15
 */
import { EVENTS } from "../data/events";
import type { CanonicalEvent } from "../src/types";

interface Args {
  labels?: string[];
  excludeLabels?: string[];
  source?: string;
  from?: string;
  to?: string;
  limit: number;
}

const args = parseArgs(process.argv.slice(2));
const filtered = filter(EVENTS, args);

if (filtered.length === 0) {
  process.stderr.write("[query] no events match\n");
  process.exit(0);
}

const rows = filtered.slice(0, args.limit).map(formatRow);
process.stdout.write(`${rows.join("\n")}\n`);
process.stderr.write(`[query] ${filtered.length} events (showing ${rows.length})\n`);

function filter(events: CanonicalEvent[], a: Args): CanonicalEvent[] {
  return events.filter((ev) => {
    if (a.source && ev.source_slug !== a.source) return false;
    if (a.from && ev.date < a.from) return false;
    if (a.to && ev.date > a.to) return false;
    if (a.labels?.length) {
      const has = a.labels.some((needle) =>
        ev.labels.some((l) => (needle.endsWith(":") ? l.label.startsWith(needle) : l.label === needle)),
      );
      if (!has) return false;
    }
    if (a.excludeLabels?.length) {
      const excluded = a.excludeLabels.some((needle) =>
        ev.labels.some((l) => (needle.endsWith(":") ? l.label.startsWith(needle) : l.label === needle)),
      );
      if (excluded) return false;
    }
    return true;
  });
}

function formatRow(ev: CanonicalEvent): string {
  const labels = ev.labels.map((l) => l.label).join(",");
  const time = ev.time ? ` ${ev.time}` : "";
  return `${ev.date}${time}  [${ev.source_slug}]  ${ev.title}  {${labels}}`;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { limit: 100 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case "--labels":
      case "-l":
        out.labels = (next ?? "").split(",").filter(Boolean);
        i++;
        break;
      case "--exclude":
      case "-x":
        out.excludeLabels = (next ?? "").split(",").filter(Boolean);
        i++;
        break;
      case "--source":
      case "-s":
        out.source = next;
        i++;
        break;
      case "--from":
        out.from = next;
        i++;
        break;
      case "--to":
        out.to = next;
        i++;
        break;
      case "--limit":
        out.limit = parseInt(next ?? "100", 10);
        i++;
        break;
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
    }
  }
  return out;
}

const USAGE = `Usage: bun --cwd packages/event-hub query [options]

  -l, --labels <a,b,...>   Match events with ANY of these labels.
                           Trailing ":" matches the whole namespace
                           (e.g. "music:" matches every music label).
  -x, --exclude <a,b,...>  Drop events with ANY of these labels.
  -s, --source <slug>      Only events from this source.
      --from <YYYY-MM-DD>  Lower date bound (inclusive).
      --to   <YYYY-MM-DD>  Upper date bound (inclusive).
      --limit <n>          Cap output rows (default 100).
`;
