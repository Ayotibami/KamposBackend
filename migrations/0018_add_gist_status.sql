-- 0018_add_gist_status.sql
-- Reintroduce moderation status for gists

DO $$ BEGIN
  CREATE TYPE gist_status AS ENUM ('SUBMITTED','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE gists
  ADD COLUMN IF NOT EXISTS gist_status gist_status NOT NULL DEFAULT 'SUBMITTED';

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_gists_status_created ON gists (gist_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gists_status_avitag_created ON gists (gist_status, avitag, created_at DESC);
