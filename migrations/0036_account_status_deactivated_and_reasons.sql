-- Adds the DEACTIVATED account_status value (self-service "pause my whole
-- account" — see accounts.account_status doc trail) and a reason/changed_at
-- pair on accounts + every profile table, so an admin-triggered suspend/
-- ban/delete can carry a "why" that gets quoted back to the affected person.
--
-- The ADD VALUE statement is deliberately the only thing in this file that
-- touches the enum — nothing else in this same transaction reads or writes
-- 'DEACTIVATED' (Postgres forbids using a freshly-added enum value in the
-- same transaction that added it, and scripts/migrate.ts wraps every
-- migration file in one BEGIN...COMMIT).
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'DEACTIVATED';

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS account_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS account_status_changed_at TIMESTAMPTZ;

ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS profile_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS profile_status_changed_at TIMESTAMPTZ;

ALTER TABLE kreator_profiles
  ADD COLUMN IF NOT EXISTS profile_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS profile_status_changed_at TIMESTAMPTZ;

ALTER TABLE kompany_profiles
  ADD COLUMN IF NOT EXISTS profile_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS profile_status_changed_at TIMESTAMPTZ;

ALTER TABLE school_profiles
  ADD COLUMN IF NOT EXISTS profile_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS profile_status_changed_at TIMESTAMPTZ;

ALTER TABLE idiot_profiles
  ADD COLUMN IF NOT EXISTS profile_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS profile_status_changed_at TIMESTAMPTZ;
