-- Rollback for 2026-11-28-reunion-cases.sql. DESTROYS all Family Reunion
-- case data. Export it first:
--   npx wrangler d1 export khabar-d1 --remote --output=reunion-backup.sql
-- Private files in the khabar-reunion-private R2 bucket are not touched by
-- this; delete them separately once you're sure.
--
-- Articles are kept. Case-linked articles lose their link and SEO fields;
-- any left at status 'approved' are moved back to 'pending_review' first so
-- they stay hidden and reviewable.

UPDATE articles SET status = 'pending_review' WHERE status = 'approved';

DROP INDEX IF EXISTS articles_reunion_case;
ALTER TABLE articles DROP COLUMN reunion_case_id;
ALTER TABLE articles DROP COLUMN seo_title;
ALTER TABLE articles DROP COLUMN meta_description;
ALTER TABLE articles DROP COLUMN keywords;
ALTER TABLE articles DROP COLUMN social_description;

DROP TABLE IF EXISTS reunion_submission_limits;
DROP TRIGGER IF EXISTS reunion_events_append_only;
DROP TABLE IF EXISTS reunion_case_events;
DROP TABLE IF EXISTS reunion_case_media;
DROP TABLE IF EXISTS reunion_case_consents;
DROP TABLE IF EXISTS reunion_case_contacts;
DROP TABLE IF EXISTS reunion_case_leads;
DROP TABLE IF EXISTS reunion_case_facts;
DROP TABLE IF EXISTS reunion_cases;
