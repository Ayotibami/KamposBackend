-- 0003_profile_students.sql

DO $$ BEGIN
  CREATE TYPE degree_level AS ENUM ('BACHELORS','MASTERS','PHD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS student_profiles (
  avitag TEXT PRIMARY KEY REFERENCES profiles(avitag) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  bio TEXT NULL,
  hobbies TEXT[] NULL,
  degree degree_level NULL,
  profile_picture_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
