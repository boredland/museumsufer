-- Composite indexes for the per-museum detail page (`/museum/:slug`).
--
-- Both queries below filter by museum_id then by a date column. The single
-- (museum_id) index forces SQLite to fetch every row for that museum and
-- post-filter by date; a composite cuts straight to the relevant slice.
--
--   events:       WHERE museum_id IN (...) AND date >= ? AND date <= ?
--   exhibitions:  WHERE museum_id IN (...) AND (end_date IS NULL OR end_date >= ?)

CREATE INDEX IF NOT EXISTS idx_events_museum_date ON events(museum_id, date);
CREATE INDEX IF NOT EXISTS idx_exhibitions_museum_end ON exhibitions(museum_id, end_date);
