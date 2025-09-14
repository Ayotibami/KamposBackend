-- 0015_drop_gists_and_engagement.sql
-- Drop all existing tables related to gists, reactions, comments, views (and related media/shares if present)

-- Drop FKs referencing these tables dynamically
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.confrelid IN (
      SELECT oid FROM pg_class WHERE relname IN ('gists','gist_media','comments','reactions','views','shares')
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
