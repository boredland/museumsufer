-- Same SQLite NULL != NULL bug as 0003, but for the `time` column. Untimed
-- rows (e.g. day-spanning conferences whose scraper couldn't extract a clock
-- time) all bypassed the (show_id, date, time, venue_room) unique constraint
-- because every NULL was distinct.
--
-- Dedup: keep the lowest id per logical key (treating NULL as equal via
-- COALESCE). Then normalise NULL → '' so future inserts collide correctly.

DELETE FROM performances
WHERE id NOT IN (
  SELECT MIN(id) FROM performances
  GROUP BY show_id, date, COALESCE(time, ''), COALESCE(venue_room, '')
);

UPDATE performances SET time = '' WHERE time IS NULL;
