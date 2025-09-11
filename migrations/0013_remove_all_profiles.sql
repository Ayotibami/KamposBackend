-- 0013_remove_all_profiles.sql
-- Remove base profiles artifacts and all sub profile tables cleanly.

-- 1) Drop any foreign keys that reference the sub-profile tables dynamically
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE confrelid IN (
      'student_profiles'::regclass,
      'kreator_profiles'::regclass,
      'kompany_profiles'::regclass,
      'school_profiles'::regclass
    )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- 2) Drop compatibility view if it exists
DROP VIEW IF EXISTS profiles_view;

-- 3) Drop sub-profile tables (idempotent)
DROP TABLE IF EXISTS student_profiles CASCADE;
DROP TABLE IF EXISTS kreator_profiles CASCADE;
DROP TABLE IF EXISTS kompany_profiles CASCADE;
DROP TABLE IF EXISTS school_profiles CASCADE;

-- 4) Drop base profiles table if it still exists (from earlier migrations)
DROP TABLE IF EXISTS profiles CASCADE;

-- Note:
-- We intentionally do NOT drop campus/major reference tables or enums here.
-- This keeps other features (e.g., gists with campus/major tags) intact.
