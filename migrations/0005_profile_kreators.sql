-- 0005_profile_kreators.sql

CREATE TABLE IF NOT EXISTS kreator_profiles (
  avitag TEXT PRIMARY KEY REFERENCES profiles(avitag) ON DELETE CASCADE,
  display_name TEXT NOT NULL UNIQUE,
  campustag TEXT NULL,
  description TEXT NULL,
  profile_image TEXT NULL,
  engagement_score DOUBLE PRECISION NULL,
  earnings_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  monetization_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
