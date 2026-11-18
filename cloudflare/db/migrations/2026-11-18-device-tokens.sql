-- Breaking-news push for the Android app (Khabar Darjeeling 1.2.0+).
-- device_tokens: one row per installed app. Every reader registers at
-- startup, logged in or not, and is subscribed to the FCM topic "breaking".
-- breaking_pushes: one row per article already announced, so toggling
-- the breaking flag off and on again never pushes the same story twice.
-- New tables only, so the currently-deployed Worker keeps working until
-- the new one ships.
CREATE TABLE device_tokens (
  token        TEXT PRIMARY KEY,               -- native FCM registration token
  platform     TEXT NOT NULL DEFAULT 'android',
  app_version  TEXT,
  topic_ok     INTEGER NOT NULL DEFAULT 0,     -- 1 once subscribed to /topics/breaking
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE breaking_pushes (
  article_id   TEXT PRIMARY KEY,
  sent_at      TEXT NOT NULL DEFAULT (datetime('now')),
  message_id   TEXT
);
