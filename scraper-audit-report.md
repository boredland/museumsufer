## Scraper health audit

⚠️ 12 scraper(s) appear to under-deliver. Each likely points at stale markup, a moved endpoint, or a filter dropping valid events — verify against the live source before assuming the venue is simply empty.

| Scraper | Kind | Finding |
| --- | --- | --- |
| `first-stage-theater` | venue | venue scraper → 0 entries in bundle |
| `hamburger-kammeroper` | venue | venue scraper → 0 entries in bundle |
| `hamburger-puppentheater` | venue | venue scraper → 0 entries in bundle |
| `hamburger-sprechwerk` | venue | venue scraper → 0 entries in bundle |
| `imperial-theater` | venue | venue scraper → 0 entries in bundle |
| `landau-de` | venue | venue scraper → 0 entries in bundle |
| `landinsicht-buchladen` | venue | venue scraper → 0 entries in bundle |
| `mut-theater` | venue | venue scraper → 0 entries in bundle |
| `deichtorhallen` | venue | venue scraper → 0 entries in bundle |
| `museums-hamburg` | venue | venue scraper → 0 entries in bundle |
| `theater-das-zimmer` | venue | venue scraper → 0 entries in bundle |
| `theater-fuer-kinder` | venue | venue scraper → 0 entries in bundle |

### What to do
For each scraper above: read its parser, fetch the live endpoint, and determine whether the source actually lists upcoming events (after today) that the scraper fails to extract. If broken, fix the parser and add a brief note; if the venue is genuinely/seasonally empty, add the slug to `packages/event-hub/scripts/audit-allowlist.json` with a one-line reason instead of changing code.

Scrapers live in `packages/scrapers/src/venues/<slug>.ts`; museum event APIs in `packages/scrapers/src/_museums/api.ts` (parser) and `config.ts` (endpoint). Verify a fix with a small bun script calling the scraper/parser against the live source.