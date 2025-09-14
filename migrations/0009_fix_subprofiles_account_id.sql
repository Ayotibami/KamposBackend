-- 0009_fix_subprofiles_account_id.sql

-- Add account_id to student_profiles
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS account_id UUID;
UPDATE student_profiles sp
SET account_id = p.account_id
FROM profiles p
WHERE p.avitag = sp.avitag AND sp.account_id IS NULL;
ALTER TABLE student_profiles ALTER COLUMN account_id SET NOT NULL;
-- Remove orphaned rows that would violate FK (accounts deleted previously)
DELETE FROM student_profiles sp WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.account_id = sp.account_id);
DO $$ BEGIN
  ALTER TABLE student_profiles ADD CONSTRAINT fk_student_profiles_account FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add account_id to kreator_profiles
ALTER TABLE kreator_profiles ADD COLUMN IF NOT EXISTS account_id UUID;
UPDATE kreator_profiles kp
SET account_id = p.account_id
FROM profiles p
WHERE p.avitag = kp.avitag AND kp.account_id IS NULL;
ALTER TABLE kreator_profiles ALTER COLUMN account_id SET NOT NULL;
DELETE FROM kreator_profiles kp WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.account_id = kp.account_id);
DO $$ BEGIN
  ALTER TABLE kreator_profiles ADD CONSTRAINT fk_kreator_profiles_account FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add account_id to kompany_profiles
ALTER TABLE kompany_profiles ADD COLUMN IF NOT EXISTS account_id UUID;
UPDATE kompany_profiles kp
SET account_id = p.account_id
FROM profiles p
WHERE p.avitag = kp.avitag AND kp.account_id IS NULL;
ALTER TABLE kompany_profiles ALTER COLUMN account_id SET NOT NULL;
DELETE FROM kompany_profiles kp WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.account_id = kp.account_id);
DO $$ BEGIN
  ALTER TABLE kompany_profiles ADD CONSTRAINT fk_kompany_profiles_account FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add account_id to school_profiles
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS account_id UUID;
UPDATE school_profiles sp
SET account_id = p.account_id
FROM profiles p
WHERE p.avitag = sp.avitag AND sp.account_id IS NULL;
ALTER TABLE school_profiles ALTER COLUMN account_id SET NOT NULL;
DELETE FROM school_profiles sp WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.account_id = sp.account_id);
DO $$ BEGIN
  ALTER TABLE school_profiles ADD CONSTRAINT fk_school_profiles_account FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
