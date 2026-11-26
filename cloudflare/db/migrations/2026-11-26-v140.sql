-- Khabar Darjeeling app 1.4.0 (and the website): Flash News, comment
-- editing, @handles, email verification before publishing, moderation log.
-- Additive only: every existing query keeps working unchanged.

-- Flash News is a kind of article, so it reuses likes, comments, reports,
-- breaking push, feeds and the admin page. GET /articles returns only
-- 'story' rows unless the caller asks for kind=flash or kind=all.
ALTER TABLE articles ADD COLUMN kind TEXT NOT NULL DEFAULT 'story';   -- 'story' | 'flash'
ALTER TABLE articles ADD COLUMN related_article_id TEXT;              -- Flash News -> full story
ALTER TABLE articles ADD COLUMN tags TEXT;                            -- JSON array of strings
CREATE INDEX idx_articles_kind_status_created ON articles(kind, status, created_at DESC);

-- Comment editing ("edited" label in the app).
ALTER TABLE comments ADD COLUMN updated_at TEXT;

-- A unique @handle. profiles.user_name already holds display-style names
-- (with spaces and duplicates), so the handle is a new column rather than
-- a constraint on existing data.
ALTER TABLE profiles ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX idx_profiles_handle ON profiles(handle COLLATE NOCASE) WHERE handle IS NOT NULL;

-- Email verification is required before publishing (not for reading,
-- liking or commenting). Every account that exists today is treated as
-- verified; only new signups have to confirm their address.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
UPDATE users SET email_verified = 1;

CREATE TABLE email_verification_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_email_verification_user ON email_verification_tokens(user_id, created_at DESC);

-- Every admin moderation action: who did what to which item.
CREATE TABLE moderation_log (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL,
  admin_name  TEXT,
  action      TEXT NOT NULL,   -- delete | unpublish | republish | suspend | unsuspend | dismiss_report | delete_comment
  target_type TEXT NOT NULL,   -- article | comment | user | report
  target_id   TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_moderation_log_created ON moderation_log(created_at DESC);
