-- 0012_drop_base_profiles.sql
-- Phase B: drop all foreign keys referencing base profiles table, then drop the table

-- 1) Drop all FKs that reference profiles(avitag)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE confrelid = 'profiles'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- 2) Drop indexes on profiles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_account') THEN
    DROP INDEX idx_profiles_account;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_type') THEN
    DROP INDEX idx_profiles_type;
  END IF;
END $$;

-- 3) Finally drop the profiles table
DROP TABLE IF EXISTS profiles CASCADE;

-- Note:
-- Tables previously referencing profiles(avitag) should enforce author existence via application logic or
-- future triggers calling a profile_exists(avitag) function that checks subtype tables. We'll add that separately if desired.
