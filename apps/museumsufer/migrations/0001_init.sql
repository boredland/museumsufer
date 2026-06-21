CREATE TABLE IF NOT EXISTS museums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  museumsufer_url TEXT NOT NULL,
  website_url TEXT,
  opening_hours TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exhibitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  museum_id INTEGER NOT NULL REFERENCES museums(id),
  title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  image_url TEXT,
  detail_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(museum_id, title)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  museum_id INTEGER NOT NULL REFERENCES museums(id),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  description TEXT,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_exhibitions_dates ON exhibitions(start_date, end_date);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_exhibitions_museum ON exhibitions(museum_id);
CREATE INDEX idx_events_museum ON events(museum_id);
