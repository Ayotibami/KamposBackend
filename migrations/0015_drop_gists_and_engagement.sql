-- 0015_drop_gists_and_engagement.sql
-- Drop all existing tables related to gists, reactions, comments, views (and related media/shares if present)

-- Drop FKs referencing these tables dynamically
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE confrelid IN (
      'gists'::regclass,
      'gist_media'::regclass,
      'comments'::regclass,
      'reactions'::regclass,
      'views'::regclass,
      'shares'::regclass
    )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- Drop tables if they exist (idempotent)
DROP TABLE IF EXISTS reactions CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS views CASCADE;
DROP TABLE IF EXISTS shares CASCADE;
DROP TABLE IF EXISTS gist_media CASCADE;
DROP TABLE IF EXISTS gists CASCADE;
