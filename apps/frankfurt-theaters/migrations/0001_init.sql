CREATE TABLE IF NOT EXISTS theaters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  lat REAL,
  lon REAL,
  website_url TEXT,
  ticketing_provider TEXT,
  description TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theater_id INTEGER NOT NULL REFERENCES theaters(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  language TEXT,
  age_recommendation TEXT,
  image_url TEXT,
  detail_url TEXT,
  season TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(theater_id, slug)
);

CREATE TABLE IF NOT EXISTS performances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id),
  date TEXT NOT NULL,
  time TEXT,
  end_time TEXT,
  end_date TEXT,
  venue_room TEXT,
  provider_event_id TEXT,
  ticket_url TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  available_seats INTEGER,
  total_seats INTEGER,
  price_min INTEGER,
  price_max INTEGER,
  currency TEXT DEFAULT 'EUR',
  availability_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(show_id, date, time, venue_room)
);

CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_hash TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_hash, target_lang)
);

CREATE INDEX idx_shows_theater ON shows(theater_id);
CREATE INDEX idx_performances_show ON performances(show_id);
CREATE INDEX idx_performances_date ON performances(date);
CREATE INDEX idx_performances_status ON performances(status);
CREATE INDEX idx_translations_lookup ON translations(source_hash, target_lang);
