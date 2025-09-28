-- 0025_profile_idiots.sql
-- Create IDIOT profiles table similar to others, requiring verification

-- Ensure profile_status enum exists
DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('ACTIVE','DEACTIVATED','DELETED','BANNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS idiot_profiles (
  avitag TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile_status profile_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_idiot_profiles_account ON idiot_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_idiot_profiles_verified ON idiot_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_idiot_profiles_status ON idiot_profiles(profile_status);
