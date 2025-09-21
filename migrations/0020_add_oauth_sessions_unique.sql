-- 0020_add_oauth_sessions_unique.sql
-- Ensure there is a unique constraint for (account_id, auth_provider)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'oauth_sessions' AND c.conname = 'oauth_sessions_account_provider_key'
  ) THEN
    ALTER TABLE oauth_sessions
      ADD CONSTRAINT oauth_sessions_account_provider_key UNIQUE (account_id, auth_provider);
  END IF;
END $$;
