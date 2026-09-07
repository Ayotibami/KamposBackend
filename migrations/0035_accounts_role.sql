-- 0035_accounts_role.sql
-- Replace the untracked `who` column and the ADMIN_ACCOUNT_IDS env var with
-- a single real `role` column on accounts — one source of truth for
-- permissions instead of two disconnected mechanisms.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','idiot','king'));

-- Backfill role from the old `who` column, but only if that column actually
-- exists — it was never tracked by a migration (added out-of-band on the
-- live DB), so a fresh/test database won't have it at all, and an
-- unconditional UPDATE referencing it would fail there.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'who'
  ) THEN
    EXECUTE 'UPDATE accounts SET role = ''king'' WHERE who = ''king''';
  END IF;
END $$;

ALTER TABLE accounts DROP COLUMN IF EXISTS who;
