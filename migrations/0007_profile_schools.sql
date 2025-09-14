-- 0007_profile_schools.sql

CREATE TABLE IF NOT EXISTS school_profiles (
  avitag TEXT PRIMARY KEY REFERENCES profiles(avitag) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  description TEXT NULL,
  campus_tag TEXT NOT NULL,
  logo_url TEXT NULL,
  website TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_display_name ON school_profiles(display_name);
