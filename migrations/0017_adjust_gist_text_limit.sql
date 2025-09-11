-- 0017_adjust_gist_text_limit.sql
-- Remove hard length CHECK on gists.gist_text to allow app-level limits by verification status

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'gists'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%char_length%gist_text%'
  LOOP
    EXECUTE format('ALTER TABLE gists DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
