-- 0021_update_gist_reports_status.sql
-- Add status and review fields to gist_reports and helpers to keep gists.is_reported accurate
ALTER TABLE gist_reports
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Ensure existing gists have is_reported reflecting pending reports
UPDATE gists g
SET is_reported = EXISTS (
  SELECT 1 FROM gist_reports r WHERE r.gist_id = g.gist_id AND r.status = 'PENDING'
);
