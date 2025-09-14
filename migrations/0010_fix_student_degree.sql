-- 0010_fix_student_degree.sql

-- Drop legacy CHECK constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_profiles_degree_check'
  ) THEN
    ALTER TABLE student_profiles DROP CONSTRAINT student_profiles_degree_check;
  END IF;
END$$;

-- Ensure enum type exists (from 0003). Create defensively if missing
DO $$ BEGIN
  CREATE TYPE degree_level AS ENUM ('BACHELORS','MASTERS','PHD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Convert the degree column to enum degree_level, keeping NULLs when not matching
ALTER TABLE student_profiles
  ALTER COLUMN degree TYPE degree_level
  USING (CASE WHEN degree::text IN ('BACHELORS','MASTERS','PHD') THEN degree::degree_level ELSE NULL END);
