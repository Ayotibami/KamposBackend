-- 0039_broadcast_emails.sql
-- King-only "email every account" feature. Per-recipient status (not just a
-- fire-and-forget loop) is what lets sending survive a server restart and
-- gracefully ride out a daily provider send-quota cap — see broadcastSender.ts.

CREATE TABLE IF NOT EXISTS broadcasts (
  broadcast_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_by_account_id UUID NOT NULL REFERENCES accounts(account_id),
  total_recipients INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  recipient_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  -- Snapshotted at creation time, not joined fresh at send time — so a
  -- later email change on the account doesn't retroactively change where
  -- an already-queued broadcast goes, and a deleted account's row here
  -- still shows what address it was actually sent to.
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status ON broadcast_recipients(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id);
