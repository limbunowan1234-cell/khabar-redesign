-- Family Reunion case management (KD-FR-xxx cases). Rollback:
-- db/migrations/2026-11-28-reunion-cases.rollback.sql.
--
-- Who can see what is enforced in the Worker (src/routes/reunion.ts), the
-- same way every other table here is protected: D1 is never reachable from
-- a browser, only through the Worker. Staff = admins plus users with the
-- "reunion" label; a "restricted" case is visible only to admins and the
-- people assigned to or who created it. The public page reads one endpoint
-- that returns only fields an admin marked public.
--
-- No personal data is seeded here: this repository is public. Cases are
-- created through the admin screens.

CREATE TABLE reunion_cases (
  id                    TEXT PRIMARY KEY,
  case_code             TEXT NOT NULL UNIQUE,              -- 'KD-FR-001'
  title                 TEXT NOT NULL,
  subject_name          TEXT,
  category              TEXT NOT NULL DEFAULT 'family_reconnection',
  status                TEXT NOT NULL DEFAULT 'new_case',  -- see STATUSES in src/routes/reunion.ts
  confidentiality       TEXT NOT NULL DEFAULT 'standard',  -- 'standard' | 'restricted'
  original_location     TEXT,
  current_location      TEXT,
  description           TEXT,                              -- internal, never public
  assigned_to           TEXT REFERENCES users (id) ON DELETE SET NULL,
  -- Public appeal page (/family-reunion/<case_code>). Nothing shows until
  -- public_enabled = 1, and then only these fields plus facts marked public.
  public_enabled        INTEGER NOT NULL DEFAULT 0,
  public_headline       TEXT,
  public_story          TEXT,
  public_photo_media_id TEXT,
  created_by            TEXT REFERENCES users (id) ON DELETE SET NULL,
  updated_by            TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at            TEXT
);
CREATE INDEX reunion_cases_status ON reunion_cases (status, updated_at);
CREATE INDEX reunion_cases_assigned ON reunion_cases (assigned_to);

-- Names, family details and clues, one per row, each with where it came
-- from. Values are stored exactly as given: spellings are never corrected
-- automatically.
CREATE TABLE reunion_case_facts (
  id          TEXT PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES reunion_cases (id) ON DELETE CASCADE,
  section     TEXT NOT NULL DEFAULT 'clue',                -- subject | family | background | clue | other
  label       TEXT NOT NULL,                               -- "Father's name"
  value       TEXT NOT NULL,
  provenance  TEXT NOT NULL DEFAULT 'source_provided',     -- source_provided | verified | unverified | disputed
  is_public   INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  notes       TEXT,
  created_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  updated_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);
CREATE INDEX reunion_facts_case ON reunion_case_facts (case_id, section, sort_order);

-- Information received, from staff entry or the public form. Informant
-- contact details (provider_contact) are never returned publicly.
CREATE TABLE reunion_case_leads (
  id                 TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES reunion_cases (id) ON DELETE CASCADE,
  source_type        TEXT NOT NULL DEFAULT 'other',        -- public_form | phone | whatsapp | email | in_person | social_media | other
  provider_name      TEXT,
  provider_contact   TEXT,
  provider_email     TEXT,
  received_at        TEXT NOT NULL DEFAULT (datetime('now')),
  original_message   TEXT,
  translated_message TEXT,
  summary            TEXT,
  recognition        TEXT,                                 -- public form: how they recognise the case
  status             TEXT NOT NULL DEFAULT 'new',          -- new | under_review | verification_required | verified | unverified | incorrect | duplicate | closed
  assigned_to        TEXT REFERENCES users (id) ON DELETE SET NULL,
  follow_up          TEXT,
  internal_remarks   TEXT,
  consent_given      INTEGER NOT NULL DEFAULT 0,
  created_by         TEXT REFERENCES users (id) ON DELETE SET NULL,  -- NULL for public submissions
  updated_by         TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at         TEXT
);
CREATE INDEX reunion_leads_case ON reunion_case_leads (case_id, status, received_at);
CREATE INDEX reunion_leads_status ON reunion_case_leads (status, received_at);

CREATE TABLE reunion_case_contacts (
  id          TEXT PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES reunion_cases (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'other',               -- subject | family | informant | official | other
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  notes       TEXT,
  created_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  updated_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);
CREATE INDEX reunion_contacts_case ON reunion_case_contacts (case_id);

-- Consent for public stories and photos. Withdrawal is recorded, not deleted.
CREATE TABLE reunion_case_consents (
  id            TEXT PRIMARY KEY,
  case_id       TEXT NOT NULL REFERENCES reunion_cases (id) ON DELETE CASCADE,
  given_by      TEXT NOT NULL,
  relationship  TEXT,                                      -- self | family | guardian | other
  scope         TEXT NOT NULL,                             -- public_story | public_photo | both
  method        TEXT NOT NULL DEFAULT 'written',           -- written | verbal | whatsapp | email | other
  given_at      TEXT NOT NULL,
  withdrawn_at  TEXT,
  notes         TEXT,
  recorded_by   TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX reunion_consents_case ON reunion_case_consents (case_id);

-- Photos and documents. Stored in the private R2 bucket (never served from
-- the public /cdn routes); public_key is set only when an admin publishes a
-- photo with consent, and cleared if consent is withdrawn.
CREATE TABLE reunion_case_media (
  id            TEXT PRIMARY KEY,
  case_id       TEXT NOT NULL REFERENCES reunion_cases (id) ON DELETE CASCADE,
  lead_id       TEXT REFERENCES reunion_case_leads (id) ON DELETE SET NULL,
  kind          TEXT NOT NULL DEFAULT 'photo',             -- photo | document
  private_key   TEXT NOT NULL,
  filename      TEXT,
  content_type  TEXT,
  size_bytes    INTEGER,
  caption       TEXT,
  public_key    TEXT,
  consent_id    TEXT REFERENCES reunion_case_consents (id) ON DELETE SET NULL,
  uploaded_by   TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);
CREATE INDEX reunion_media_case ON reunion_case_media (case_id);

-- Append-only history: every change, status move, lead update, investigation
-- note and view of sensitive records. Powers the case timeline. The trigger
-- below makes rows impossible to edit; sensitive old values (phone numbers,
-- addresses) are recorded as "[changed]" rather than copied here.
CREATE TABLE reunion_case_events (
  id           TEXT PRIMARY KEY,
  case_id      TEXT NOT NULL REFERENCES reunion_cases (id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  field        TEXT,
  old_value    TEXT,
  new_value    TEXT,
  reason       TEXT,
  note         TEXT,
  actor_id     TEXT,
  actor_name   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX reunion_events_case ON reunion_case_events (case_id, created_at);
CREATE TRIGGER reunion_events_append_only BEFORE UPDATE ON reunion_case_events
BEGIN
  SELECT RAISE(ABORT, 'reunion_case_events is append-only');
END;

-- Public submission form rate limit: submissions per hashed IP per day.
CREATE TABLE reunion_submission_limits (
  ip_hash  TEXT NOT NULL,
  day      TEXT NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, day)
);

-- Articles written about a case, plus SEO fields every article can use.
-- reunion_case_id deliberately has no REFERENCES clause so the rollback can
-- drop it (SQLite can't drop a column used by a foreign key); the Worker
-- checks it. New status 'approved' needs no schema change: status is TEXT.
ALTER TABLE articles ADD COLUMN reunion_case_id TEXT;
ALTER TABLE articles ADD COLUMN seo_title TEXT;
ALTER TABLE articles ADD COLUMN meta_description TEXT;
ALTER TABLE articles ADD COLUMN keywords TEXT;
ALTER TABLE articles ADD COLUMN social_description TEXT;
CREATE INDEX articles_reunion_case ON articles (reunion_case_id);
