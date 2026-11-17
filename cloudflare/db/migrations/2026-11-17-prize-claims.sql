-- Prize claims for the Simon Speed competition. The #1 player in each mode
-- of a finished round uploads the QR code of their UPI account (and can add
-- their UPI ID), and an admin marks the prize paid. New table only, so the
-- currently-deployed Worker keeps working until the new one ships.
CREATE TABLE prize_claims (
  id          TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game        TEXT NOT NULL,                  -- 'simon-speed'
  mode        TEXT NOT NULL,                  -- 'easy' | 'medium' | 'hard'
  period      TEXT NOT NULL,                  -- the round, e.g. '2026-11'
  amount      INTEGER NOT NULL,               -- rupees, fixed when claimed
  qr_key      TEXT NOT NULL,                  -- private R2 key under prize-qr/, never public
  qr_type     TEXT NOT NULL,
  upi_id      TEXT,
  status      TEXT NOT NULL DEFAULT 'submitted', -- 'submitted' | 'paid'
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at     TEXT
);
CREATE UNIQUE INDEX idx_prize_claims_round ON prize_claims(game, mode, period);
CREATE INDEX idx_prize_claims_player ON prize_claims(player_id);
