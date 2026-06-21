CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  schedule TEXT NOT NULL CHECK (schedule IN ('morning', 'afternoon', 'weekly')),
  tz TEXT NOT NULL DEFAULT 'Europe/Berlin',
  filters_json TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_sent_at TEXT,
  failed_at TEXT,
  UNIQUE (endpoint, schedule)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_schedule
  ON push_subscriptions (schedule)
  WHERE failed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON push_subscriptions (endpoint);
