CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_hash TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_hash, target_lang)
);

CREATE INDEX idx_translations_lookup ON translations(source_hash, target_lang);
