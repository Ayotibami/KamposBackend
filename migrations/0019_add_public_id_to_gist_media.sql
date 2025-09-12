-- 0019_add_public_id_to_gist_media.sql
-- Add Cloudinary public_id to gist_media for proper deletions

ALTER TABLE gist_media
  ADD COLUMN IF NOT EXISTS public_id text;

-- Optional helpful index if you frequently look up by public_id
CREATE INDEX IF NOT EXISTS idx_gist_media_public_id ON gist_media (public_id);
