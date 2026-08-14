-- 0033_add_dimensions_to_gist_media.sql
-- Add width/height to gist_media — lets the frontend size a photo/video
-- tile correctly on first paint instead of guessing/measuring client-side
-- (which for video specifically doesn't resolve until playback starts on
-- many browsers, causing a visible resize the moment someone hits play).
-- Nullable: existing rows have no known dimensions and keep falling back
-- to the frontend's own client-side measurement.

ALTER TABLE gist_media
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer;
