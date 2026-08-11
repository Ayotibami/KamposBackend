-- 0032_add_gist_color_key.sql
-- Lets a poster pick their own short-gist hero color instead of always
-- getting one deterministically hashed from gist_id. NULL means "no pick
-- made" — the app falls back to the existing hash-based color in that case.

ALTER TABLE gists ADD COLUMN IF NOT EXISTS color_key TEXT;
