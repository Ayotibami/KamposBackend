-- 0042_gist_is_anonymous.sql
-- Anonymous gists: the real avitag/account_id stay on the row exactly as
-- they always do (this is pseudonymous, not truly anonymous — moderation
-- and the poster themselves can always see who really posted it; see
-- gist.repo.ts's redactIfAnonymous for the read-time enforcement of that).
-- Create-only, same as color_key/polls: no update path ever sets this.
ALTER TABLE gists ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;
