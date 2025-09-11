-- 0004_profiles_status.sql

DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('ACTIVE','DEACTIVATED','DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_status profile_status NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(profile_status);
