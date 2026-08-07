-- 0030_unique_gist_report_per_reporter.sql
-- One report per (gist, reporter) — was previously unenforced, letting the
-- same person inflate reports_count by reporting the same gist repeatedly.
-- Existing duplicate rows (if any) are collapsed to the earliest report
-- before the constraint is added, since a unique index can't be created
-- over data that already violates it.

DELETE FROM gist_reports a
USING gist_reports b
WHERE a.gist_id = b.gist_id
  AND a.reporter_avitag = b.reporter_avitag
  AND a.created_at > b.created_at;

ALTER TABLE gist_reports
  ADD CONSTRAINT gist_reports_gist_reporter_unique UNIQUE (gist_id, reporter_avitag);
