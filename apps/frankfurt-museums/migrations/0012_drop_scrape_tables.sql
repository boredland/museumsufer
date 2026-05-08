-- Scraped data moved out of D1 and into a bundled module
-- (src/scrape-data.ts), regenerated daily by .github/workflows/scrape.yml
-- (museums job). The worker no longer reads `museums`, `events`,
-- `exhibitions`, or `translations` — drop them. Only `likes` stays
-- (user-submitted writes during normal traffic).

DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS exhibitions;
DROP TABLE IF EXISTS translations;
DROP TABLE IF EXISTS museums;
