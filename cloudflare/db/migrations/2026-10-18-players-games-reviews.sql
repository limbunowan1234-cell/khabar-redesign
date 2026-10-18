-- Player accounts, the Simon Speed web competition, and app ratings/comments.
-- All new tables, nothing existing is altered, so the currently-deployed
-- Worker keeps working until the new one ships.

-- Lightweight accounts for the game and app reviews: an in-game name, a
-- phone number and a 4-digit PIN. Separate from `users` (the site's email
-- accounts) on purpose -- players never get reporter/admin powers, and their
-- tokens are signed with a different key so they can't pass verifyUser().
-- The phone number is private: it is only ever returned to the player
-- themselves (masked) and to a site admin.
CREATE TABLE players (
  id                TEXT PRIMARY KEY,
  game_name         TEXT NOT NULL,
  phone             TEXT NOT NULL,           -- normalised E.164, e.g. +919876543210
  pin_hash          TEXT NOT NULL,           -- lib/password.ts format
  failed_pin_count  INTEGER NOT NULL DEFAULT 0,
  locked_until      TEXT,                    -- set after repeated wrong PINs
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_players_phone ON players(phone);
CREATE UNIQUE INDEX idx_players_game_name ON players(game_name COLLATE NOCASE);

-- One row per game started. The Worker picks the seed, so the colour
-- sequence is fixed before the player sees it, and the finished game is
-- replayed server-side from the player's taps (see lib/simonSpeed.ts).
CREATE TABLE game_sessions (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game         TEXT NOT NULL,                -- 'simon-speed'
  mode         TEXT NOT NULL,                -- 'easy' | 'medium' | 'hard'
  seed         INTEGER NOT NULL,
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at  TEXT
);
CREATE INDEX idx_game_sessions_player ON game_sessions(player_id, started_at DESC);

-- Verified results. `period` is the competition month in India time
-- ('2026-10'); the Top 10 is each player's best score per game/mode/period.
CREATE TABLE game_scores (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game        TEXT NOT NULL,
  mode        TEXT NOT NULL,
  period      TEXT NOT NULL,
  score       INTEGER NOT NULL,
  level       INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_game_scores_board ON game_scores(game, mode, period, score DESC);
CREATE INDEX idx_game_scores_player ON game_scores(player_id, game, mode, period);

-- One rating (1-5) and optional comment per player per app; posting again
-- updates it.
CREATE TABLE app_reviews (
  id          TEXT PRIMARY KEY,
  app_id      TEXT NOT NULL REFERENCES downloads(id) ON DELETE CASCADE,
  player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_app_reviews_one_per_player ON app_reviews(app_id, player_id);
CREATE INDEX idx_app_reviews_app ON app_reviews(app_id, updated_at DESC);
