-- 0026_idiot_profiles_account_unique.sql
-- Add unique constraint to account_id in idiot_profiles (one idiot profile per account)

DO $$ BEGIN
  ALTER TABLE idiot_profiles ADD CONSTRAINT idiot_profiles_account_id_unique UNIQUE(account_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
