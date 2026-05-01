CREATE UNIQUE INDEX IF NOT EXISTS idx_events_unique ON events(museum_id, title, date);
