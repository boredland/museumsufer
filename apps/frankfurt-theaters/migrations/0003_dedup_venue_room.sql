-- SQLite treats NULL != NULL in UNIQUE constraints, so the existing
-- (show_id, date, time, venue_room) unique key didn't catch duplicates whose
-- venue_room was unknown. Now that the scraper runs hourly, those slipped
-- through on every run.
--
-- Dedup existing rows (keep the lowest id per logical key), then normalise
-- NULL venue_room → empty string so the unique constraint actually fires.

DELETE FROM performances
WHERE id NOT IN (
  SELECT MIN(id) FROM performances
  GROUP BY show_id, date, time, COALESCE(venue_room, '')
);

UPDATE performances SET venue_room = '' WHERE venue_room IS NULL;
