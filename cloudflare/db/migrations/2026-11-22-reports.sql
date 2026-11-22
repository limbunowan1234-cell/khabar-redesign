-- Report button for user content (Khabar Darjeeling Android app 1.3.0+,
-- needed for Google Play's user-generated-content policy; the website can
-- use it too). One row per report. A reader can report a comment, an
-- article or a user; admins review them at GET /reports and mark them
-- actioned or dismissed. A comment with 3+ open reports from different
-- people is hidden from GET /comments until an admin dismisses them.
-- Blocking is done on the phone only (the app keeps its own list), so
-- there is no blocks table.
CREATE TABLE reports (
  id           TEXT PRIMARY KEY,
  target_type  TEXT NOT NULL,                  -- 'comment' | 'article' | 'user'
  target_id    TEXT NOT NULL,
  reason       TEXT NOT NULL,                  -- spam | abuse | hate | sexual | violence | false | other
  details      TEXT,
  reporter_id  TEXT,                           -- user id if logged in, else NULL
  reporter_key TEXT NOT NULL,                  -- user id, or a random per-install id from the app
  status       TEXT NOT NULL DEFAULT 'open',   -- open | actioned | dismissed
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at  TEXT
);
CREATE UNIQUE INDEX reports_once ON reports (target_type, target_id, reporter_key);
CREATE INDEX reports_status ON reports (status, created_at);
