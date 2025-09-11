-- 0006_profile_kompany.sql

CREATE TABLE IF NOT EXISTS kompany_profiles (
  avitag TEXT PRIMARY KEY REFERENCES profiles(avitag) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  logo TEXT NOT NULL,
  website TEXT NOT NULL,
  social_links JSONB NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kompany_display_name ON kompany_profiles(display_name);
