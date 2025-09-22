-- 0024_add_campus_major_to_gists_events.sql
-- Add campus_tag and major_tag to gists and events

ALTER TABLE IF EXISTS gists
  ADD COLUMN IF NOT EXISTS campus_tag TEXT,
  ADD COLUMN IF NOT EXISTS major_tag TEXT;

ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS campus_tag TEXT,
  ADD COLUMN IF NOT EXISTS major_tag TEXT;
