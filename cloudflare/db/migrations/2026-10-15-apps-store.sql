-- /apps becomes an app store: richer listings (tagline, screenshots, links),
-- public submissions with admin approval, and a featured flag. All additive,
-- so the currently-deployed Worker keeps working until the new one ships.
-- Existing rows default to status 'approved' so nothing disappears.
ALTER TABLE downloads ADD COLUMN slug TEXT;
ALTER TABLE downloads ADD COLUMN tagline TEXT;
ALTER TABLE downloads ADD COLUMN screenshots TEXT NOT NULL DEFAULT '[]';
ALTER TABLE downloads ADD COLUMN developer_name TEXT;
ALTER TABLE downloads ADD COLUMN developer_email TEXT;
ALTER TABLE downloads ADD COLUMN website_url TEXT;
ALTER TABLE downloads ADD COLUMN play_store_url TEXT;
ALTER TABLE downloads ADD COLUMN app_store_url TEXT;
ALTER TABLE downloads ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE downloads ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE downloads ADD COLUMN rejection_reason TEXT;
ALTER TABLE downloads ADD COLUMN submitter_id TEXT;
CREATE UNIQUE INDEX idx_downloads_slug ON downloads(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_downloads_status ON downloads(status, active, featured, created_at DESC);
CREATE INDEX idx_downloads_submitter ON downloads(submitter_id);
