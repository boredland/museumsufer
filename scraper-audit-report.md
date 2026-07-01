## Scraper health audit

⚠️ 6 scraper(s) appear to under-deliver. Each likely points at stale markup, a moved endpoint, or a filter dropping valid events — verify against the live source before assuming the venue is simply empty.

| Scraper | Kind | Finding |
| --- | --- | --- |
| `b-movie` | venue | venue scraper → 0 entries in bundle |
| `hohe-luft-schiff` | venue | venue scraper → 0 entries in bundle |
| `koerber-stiftung` | venue | venue scraper → 0 entries in bundle |
| `kino-koeppern` | venue | venue scraper → 0 entries in bundle |
| `rls-hessen` | venue | venue scraper → 0 entries in bundle |
| `schauspiel-frankfurt` | venue | venue scraper → 0 entries in bundle |

### What to do
For each scraper above: read its parser, fetch the live endpoint, and determine whether the source actually lists upcoming events (after today) that the scraper fails to extract. If broken, fix the parser and add a brief note; if the venue is genuinely/seasonally empty, add the slug to `packages/event-hub/scripts/audit-allowlist.json` with a one-line reason instead of changing code.

Scrapers live in `packages/scrapers/src/venues/<slug>.ts`; museum event APIs in `packages/scrapers/src/_museums/api.ts` (parser) and `config.ts` (endpoint). Verify a fix with a small bun script calling the scraper/parser against the live source.