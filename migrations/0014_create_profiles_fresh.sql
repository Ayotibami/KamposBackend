-- 0014_create_profiles_fresh.sql
-- Fresh, fully separated profile tables with a unified image_url field

-- Enums
DO $$ BEGIN
  CREATE TYPE degree_level AS ENUM ('BACHELORS','MASTERS','PHD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('ACTIVE','DEACTIVATED','DELETED','BANNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- STUDENT PROFILES
CREATE TABLE IF NOT EXISTS student_profiles (
  avitag TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT,
  campus_tag TEXT REFERENCES campus(campus_tag),
  major_tag TEXT REFERENCES major(major_tag),
  level INT,
  bio TEXT,
  hobbies TEXT[],
  degree degree_level,
  image_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile_status profile_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_level_allowed CHECK (level IS NULL OR level IN (100,200,300,400,500,600))
);
CREATE INDEX IF NOT EXISTS idx_student_profiles_account ON student_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_verified ON student_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_student_profiles_status ON student_profiles(profile_status);

-- KREATOR PROFILES
CREATE TABLE IF NOT EXISTS kreator_profiles (
  avitag TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL UNIQUE,
  campustag TEXT,
  description TEXT,
  image_url TEXT,
  engagement_score DOUBLE PRECISION,
  earnings_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  monetization_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  top_gist_id UUID NULL REFERENCES gists(gist_id) ON DELETE SET NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile_status profile_status NOT NULL DEFAULT 'ACTIVE',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kreator_profiles_account ON kreator_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_kreator_profiles_verified ON kreator_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_kreator_profiles_status ON kreator_profiles(profile_status);

-- KOMPANY PROFILES
CREATE TABLE IF NOT EXISTS kompany_profiles (
  avitag TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  image_url TEXT NOT NULL,
  website TEXT NOT NULL,
  social_links JSONB,
  description TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile_status profile_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kompany_profiles_account ON kompany_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_kompany_profiles_verified ON kompany_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_kompany_profiles_status ON kompany_profiles(profile_status);

-- SCHOOL PROFILES
CREATE TABLE IF NOT EXISTS school_profiles (
  avitag TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  description TEXT,
  campus_tag TEXT REFERENCES campus(campus_tag),
  image_url TEXT,
  website TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile_status profile_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_profiles_account ON school_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_school_profiles_verified ON school_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_school_profiles_status ON school_profiles(profile_status);
