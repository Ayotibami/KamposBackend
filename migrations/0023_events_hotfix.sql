-- 0023_events_hotfix.sql
-- Ensure events.thumbnail_url column exists for existing installations
ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
