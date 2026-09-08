-- 0040_broadcast_recipient_claim.sql
-- Fixes a real race condition: the immediate-send-on-create trigger and the
-- once-a-minute recurring sender could both grab the same 'pending' rows at
-- once (nothing marked a row as "already being handled" the instant it was
-- picked up), sending duplicate emails to the same recipient. Adding a
-- 'sending' status + a claimed_at timestamp lets the sender atomically claim
-- rows (UPDATE ... FOR UPDATE SKIP LOCKED, see broadcast.repo.ts) so two
-- concurrent callers can never walk away with the same row. claimed_at also
-- lets a row that got claimed but never finished (a crash mid-send) become
-- reclaimable again after a timeout, instead of being stuck forever.

ALTER TABLE broadcast_recipients ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

ALTER TABLE broadcast_recipients DROP CONSTRAINT IF EXISTS broadcast_recipients_status_check;
ALTER TABLE broadcast_recipients ADD CONSTRAINT broadcast_recipients_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed'));
