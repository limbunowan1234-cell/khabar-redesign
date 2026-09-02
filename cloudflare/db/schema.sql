-- Khabar Darjeeling — D1 schema (Phase 1)
-- Mirrors the 17 Appwrite collections currently in production. Field names
-- match the live Appwrite documents (verified against real data on
-- 2026-08-20), not the original camelCase — SQL convention (snake_case)
-- throughout; the Worker API layer is the translation point back to the
-- shapes the Next.js app already expects, so no frontend code needs to
-- change its data shapes, only its fetch URLs.
--
-- D1 has no native boolean — 0/1 INTEGER throughout, matching SQLite
-- convention. No native array type — repeatable sub-data (article
-- supporting images) becomes a child table instead of a JSON blob, so it
-- stays queryable and indexable.

PRAGMA foreign_keys = ON;

-- ─── Content ────────────────────────────────────────────────────────────

CREATE TABLE articles (
  id                TEXT PRIMARY KEY,
  slug              TEXT UNIQUE,
  title             TEXT NOT NULL,
  side_header       TEXT,
  content            TEXT,
  genre             TEXT,
  category          TEXT,
  status            TEXT NOT NULL DEFAULT 'published',
  location_district TEXT,
  location_area     TEXT,
  image_file_id     TEXT,
  image_caption     TEXT,
  youtube_id        TEXT,
  submitter_id      TEXT,
  submitter_name    TEXT,
  submitter_email   TEXT,
  submitter_avatar  TEXT,
  author_name       TEXT,
  author_email      TEXT,
  views             INTEGER NOT NULL DEFAULT 0,
  is_breaking       INTEGER NOT NULL DEFAULT 0,
  is_featured       INTEGER NOT NULL DEFAULT 0,
  is_contest_entry  INTEGER NOT NULL DEFAULT 0,
  is_weekly_pick    INTEGER NOT NULL DEFAULT 0,
  weekly_live       INTEGER NOT NULL DEFAULT 0,
  weekly_issue      TEXT,
  weekly_section    TEXT,
  weekly_order      INTEGER NOT NULL DEFAULT 0,
  is_weekly_lead    INTEGER NOT NULL DEFAULT 0,
  is_genre_featured INTEGER,
  is_genre_pinned   INTEGER,
  is_region_featured INTEGER,
  is_region_pinned  INTEGER,
  rejection_reason  TEXT,
  tracker_data      TEXT,
  -- Legacy field, superseded by location_area for every article that
  -- predates this migration (confirmed: every article with a non-null
  -- `location` already has location_area set, which always wins in the
  -- app's own `locationArea || location` fallback). Kept only because
  -- the admin photo-story creation flow still sets it unconditionally.
  location          TEXT,
  submitted_at      TEXT,
  published_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_articles_status_created ON articles(status, created_at DESC);
CREATE INDEX idx_articles_district ON articles(location_district);
CREATE INDEX idx_articles_genre ON articles(genre);
CREATE INDEX idx_articles_submitter ON articles(submitter_id);
CREATE INDEX idx_articles_slug ON articles(slug);

-- Appwrite stored supportingImages as an array of JSON strings
-- ({fileId, caption}) on the article document itself.
CREATE TABLE article_supporting_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  file_id     TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_supporting_images_article ON article_supporting_images(article_id);

-- Admin photo-story articles (category = 'Photo Story') attach extra
-- gallery images beyond the one cover image_file_id -- same child-table
-- shape as supporting images, just no caption.
CREATE TABLE article_gallery_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  file_id     TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_gallery_images_article ON article_gallery_images(article_id);

-- ─── Engagement ─────────────────────────────────────────────────────────

-- Article-likes and comment-likes share this table in Appwrite too
-- (distinguished by comment_id being NULL or not) — several profile-page
-- bugs this year came from call sites forgetting that split, so the
-- UNIQUE constraint below is new discipline D1 gets for free.
CREATE TABLE likes (
  id          TEXT PRIMARY KEY,
  article_id  TEXT NOT NULL,
  comment_id  TEXT,
  user_id     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(article_id, comment_id, user_id)  -- table-level only; see the
  -- partial indexes below for what actually enforces one-like-per-user.
  -- SQL treats every NULL comment_id as distinct from every other NULL,
  -- so this constraint alone does NOT stop a user racking up more than
  -- one article-level like on the same article. Found this while wiring
  -- up the first real write path (see cloudflare/src/routes/likes.ts) --
  -- worth calling out since it's exactly the class of gap that produced
  -- the ~18.5% duplicate rate the initial data export had to dedupe.
);
CREATE INDEX idx_likes_article ON likes(article_id) WHERE comment_id IS NULL;
CREATE INDEX idx_likes_comment ON likes(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX idx_likes_user ON likes(user_id);
CREATE UNIQUE INDEX idx_likes_article_unique ON likes(article_id, user_id) WHERE comment_id IS NULL;
CREATE UNIQUE INDEX idx_likes_comment_unique ON likes(comment_id, user_id) WHERE comment_id IS NOT NULL;

CREATE TABLE comments (
  id                TEXT PRIMARY KEY,
  article_id        TEXT NOT NULL,  -- also holds the fixed contest-discussion pseudo-id
  parent_comment_id TEXT,
  user_id           TEXT NOT NULL,
  author_name       TEXT,
  comment_text      TEXT NOT NULL,
  avatar_url        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_article ON comments(article_id, created_at DESC);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);

CREATE TABLE follows (
  id             TEXT PRIMARY KEY,
  follower_id    TEXT NOT NULL,
  follower_name  TEXT,
  following_id   TEXT NOT NULL,
  following_name TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(follower_id, following_id)
);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

CREATE TABLE bookmarks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  article_id  TEXT NOT NULL,
  saved_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, article_id)
);
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);

-- ─── People ─────────────────────────────────────────────────────────────

-- user_id is the Appwrite account id (auth stays on Appwrite — see plan).
CREATE TABLE profiles (
  user_id       TEXT PRIMARY KEY,
  display_name  TEXT,
  user_name     TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  cover_url     TEXT,
  banner_theme  TEXT,
  home_district TEXT,
  joined_at     TEXT
);

-- ─── Contest ────────────────────────────────────────────────────────────

-- Single-row table — replaces Appwrite's "one document named main" pattern
-- also used by news_digest below.
CREATE TABLE contest_settings (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  certificates_live  INTEGER NOT NULL DEFAULT 0,
  pinned_comment_id  TEXT
);
INSERT INTO contest_settings (id, certificates_live) VALUES (1, 0);

CREATE TABLE certificate_state (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE,
  download_count INTEGER NOT NULL DEFAULT 0,
  rank           TEXT
);

CREATE TABLE bhasa_diwas_submissions (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  category       TEXT,               -- 'poetry' | 'essay' | 'photo'
  description    TEXT,               -- the actual submitted text
  image_file_id  TEXT,
  submitter_id   TEXT,
  submitter_name TEXT,
  votes          INTEGER NOT NULL DEFAULT 0,  -- denormalized counter, see bhasa_diwas_votes
  is_featured    INTEGER NOT NULL DEFAULT 0,  -- added Week 38, via ALTER TABLE on the live DB
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  -- Below: added Week 44, via ALTER TABLE on the live DB. winner_rank is
  -- 1/2/3 within the submission's own category (NULL = not a winner), set
  -- by POST /bhasa-diwas/finalize-winners. The winner_* address fields are
  -- filled in later, directly by the winner themselves, for memento
  -- delivery -- never exposed on the public submissions/winners read, only
  -- via the admin-only GET /bhasa-diwas/winners/full.
  winner_rank         INTEGER,
  winner_full_name    TEXT,
  winner_address      TEXT,
  winner_phone        TEXT,
  address_submitted_at TEXT
);
CREATE INDEX idx_bhasa_submitter ON bhasa_diwas_submissions(submitter_id);

-- One row per vote cast, so a voter can't vote the same submission twice
-- (Appwrite enforced this with a listDocuments-then-check, not a real
-- constraint -- see the export script for what that let through).
CREATE TABLE bhasa_diwas_votes (
  id             TEXT PRIMARY KEY,
  submission_id  TEXT NOT NULL,
  voter_id       TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(submission_id, voter_id)
);
CREATE INDEX idx_bhasa_votes_voter ON bhasa_diwas_votes(voter_id);

-- ─── Media ──────────────────────────────────────────────────────────────

CREATE TABLE photography (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  caption        TEXT,
  location       TEXT,
  image_file_id  TEXT,
  submitter_id   TEXT,
  submitter_name TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- General photo/ad-creative bucket (distinct from the Hills in Frame
-- gallery above) — confirmed fields: imageFileId, type, title, slug.
CREATE TABLE photos (
  id             TEXT PRIMARY KEY,
  image_file_id  TEXT,
  type           TEXT,      -- e.g. 'ad', 'story'
  title          TEXT,
  slug           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_photos_type ON photos(type);

-- ─── Notifications & push ───────────────────────────────────────────────

CREATE TABLE notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'general',
  message       TEXT NOT NULL,
  article_id    TEXT,
  article_slug  TEXT,
  from_user_name TEXT,
  read          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE push_subscriptions (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL,
  endpoint  TEXT NOT NULL,
  p256dh    TEXT NOT NULL,
  auth      TEXT NOT NULL
);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);

CREATE TABLE fcm_tokens (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL,
  token    TEXT NOT NULL
);
CREATE INDEX idx_fcm_tokens_user ON fcm_tokens(user_id);

-- Added [weather-alerts feature]. One row per (city, forecast date,
-- severity) that has already triggered a push, so the cron in
-- src/index.ts scheduled() can re-check every few hours without
-- re-notifying everyone each time -- the UNIQUE constraint is what
-- makes "have we sent this one yet" an atomic INSERT ... ON CONFLICT
-- DO NOTHING instead of a check-then-write race.
CREATE TABLE weather_alert_log (
  id           TEXT PRIMARY KEY,
  city         TEXT NOT NULL,
  alert_date   TEXT NOT NULL,
  severity     TEXT NOT NULL,
  sent_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(city, alert_date, severity)
);

-- ─── Advertising ────────────────────────────────────────────────────────

-- One row per advertiser campaign. `active` is the master kill switch --
-- AdSlot.tsx (see lib/adConfig.ts) refuses to render anything for a
-- campaign unless both this row AND the campaign's own config entry say
-- active. Defaults to 0 deliberately: a campaign exists in the system
-- (trackable, billable) without being live on the site until someone
-- explicitly flips it on.
CREATE TABLE ad_campaigns (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  advertiser  TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 0,
  start_date  TEXT,
  end_date    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Impression/click events, one row each -- deliberately not deduplicated
-- or aggregated at write time (matches analytics_events' own pattern);
-- GET /ads/analytics aggregates on read.
CREATE TABLE ad_events (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL,
  placement_id  TEXT NOT NULL,
  event_type    TEXT NOT NULL,  -- 'impression' | 'click'
  device_type   TEXT,
  visitor_id    TEXT,
  page_url      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ad_events_campaign ON ad_events(campaign_id, event_type, created_at);
CREATE INDEX idx_ad_events_placement ON ad_events(placement_id, event_type, created_at);

-- ─── Analytics & admin utilities ────────────────────────────────────────

CREATE TABLE analytics_events (
  id           TEXT PRIMARY KEY,
  visitor_id   TEXT NOT NULL,
  user_id      TEXT,
  event_type   TEXT NOT NULL,   -- 'view' | 'comment' | 'like'
  article_id   TEXT,
  user_country TEXT,
  timestamp    TEXT NOT NULL
);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_article ON analytics_events(article_id);
-- Retention: delete WHERE timestamp < 30 days ago — port the existing
-- cron logic from lib/analyticsEvents.ts's deleteEventsOlderThan().

CREATE TABLE app_counters (
  key    TEXT PRIMARY KEY,
  value  INTEGER NOT NULL DEFAULT 0
);
INSERT INTO app_counters (key, value) VALUES ('apk_downloads', 0);

-- News Digest admin cache — same single-row pattern as contest_settings.
CREATE TABLE news_digest (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  sections_json TEXT NOT NULL DEFAULT '[]',
  last_verified TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO news_digest (id) VALUES (1);
