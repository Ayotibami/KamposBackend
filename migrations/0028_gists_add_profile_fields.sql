-- 0028_gists_add_profile_fields.sql
-- Add account_id, profile_id, profile_type, campus_tag, and major_tag to gists table

ALTER TABLE gists ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE gists ADD COLUMN IF NOT EXISTS profile_id TEXT;
ALTER TABLE gists ADD COLUMN IF NOT EXISTS profile_type TEXT;
ALTER TABLE gists ADD COLUMN IF NOT EXISTS campus_tag TEXT;
ALTER TABLE gists ADD COLUMN IF NOT EXISTS major_tag TEXT;
