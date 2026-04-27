import { MUSEUM_APIS } from "./museum-apis";
import { MUSEUM_EXHIBITION_URLS } from "./museum-exhibitions";
import { MUSEUMSUFER_DE, USER_AGENT } from "./shared";

interface CheckResult {
  name: string;
  url: string;
  ok: boolean;
  error?: string;
}

const CHECKS: Array<{
  name: string;
  url: string;
  validate: (body: string, status: number) => string | null;
}> = [
  {
    name: "museumsufer.de — museums (museumMapConfig)",
    url: `${MUSEUMSUFER_DE}/de/museen/`,
    validate: (body) => (body.includes("museumMapConfig") ? null : "museumMapConfig not found in page"),
  },
  {
    name: "museumsufer.de — exhibitions (teaserBox)",
    url: `${MUSEUMSUFER_DE}/de/ausstellungen-und-veranstaltungen/aktuelle-ausstellungen/`,
    validate: (body) =>
      body.includes("teaserBox") && body.includes("teaserHeadline")
        ? null
        : "teaserBox/teaserHeadline elements not found",
  },
  ...Object.entries(MUSEUM_EXHIBITION_URLS)
    .filter(([, config]) => !config.js)
    .map(([slug, config]) => ({
      name: `Exhibition page: ${slug}`,
      url: config.url,
      validate: (_body: string, status: number): string | null => {
        if (status >= 400) return `HTTP ${status}`;
        return null;
      },
    })),
  ...MUSEUM_APIS.map((api) => ({
    name: `API: ${api.slug} (${api.type})`,
    url: api.endpoint.includes("?")
      ? api.endpoint
      : api.type === "tribe-events"
        ? `${api.endpoint}?per_page=1`
        : api.endpoint,
    validate: (body: string, status: number): string | null => {
      if (status >= 400) return `HTTP ${status}`;

      switch (api.type) {
        case "tribe-events":
          return body.includes('"events"') ? null : 'Missing "events" key';
        case "historisches":
          return body.includes('"title"') && body.includes('"dateStart"') ? null : 'Missing "title"/"dateStart" fields';
        case "juedisches":
          return body.includes('"items"') ? null : 'Missing "items" key';
        case "staedel":
          return body.includes('"events"') ? null : 'Missing "events" key';
        case "senckenberg":
          return body.includes('"event_start_time"') ? null : 'Missing "event_start_time" ACF field';
        case "my-calendar":
          return body.startsWith("{") || body.startsWith("[") ? null : "Response is not JSON";
        case "liebieghaus":
          return body.includes('itemtype="http://schema.org/Event"') ? null : "Missing schema.org Event markup";
        case "mak":
          return body.includes("mak-event-item") ? null : "Missing mak-event-item elements";
        case "stadtgeschichte-rss":
          return body.includes("<rss") && body.includes("<item>") ? null : "Not a valid RSS feed";
        case "dommuseum":
          return body.includes("event-date-day") ? null : "Missing event-date-day elements";
        case "junges-museum":
          return body.includes("view-calendar") && body.includes("<h2>")
            ? null
            : "Missing Drupal calendar view structure";
        case "ledermuseum":
          return body.includes("quarter") && body.includes('<div class="date">')
            ? null
            : "Missing li.quarter event items";
        case "bibelhaus":
          return body.includes("bmBase--eventsItem") ? null : "Missing bmBase--eventsItem elements";
        case "fkv":
          return body.includes("archive-title") && body.includes("subtitle")
            ? null
            : "Missing archive-title/subtitle elements";
        case "fdh":
          return body.includes("o-program-link") ? null : "Missing o-program-link elements";
        default:
          return null;
      }
    },
  })),
];

export async function runHealthChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const check of CHECKS) {
    try {
      const res = await fetch(check.url, {
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      });
      const body = await res.text();
      const error = check.validate(body, res.status);
      results.push({
        name: check.name,
        url: check.url,
        ok: error === null,
        error: error ?? undefined,
      });
    } catch (e) {
      results.push({
        name: check.name,
        url: check.url,
        ok: false,
        error: `Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return results;
}

export function formatResults(results: CheckResult[]): string {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  let out = `# Health Check Results\n\n`;
  out += `**${passed}/${results.length} passed**\n\n`;

  if (failed.length > 0) {
    out += `## Failures\n\n`;
    for (const r of failed) {
      out += `- **${r.name}**\n  URL: ${r.url}\n  Error: ${r.error}\n\n`;
    }
  }

  out += `## All checks\n\n`;
  for (const r of results) {
    out += `- ${r.ok ? "pass" : "FAIL"} ${r.name}\n`;
  }

  return out;
}
