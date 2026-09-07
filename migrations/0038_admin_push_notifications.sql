-- 0038_admin_push_notifications.sql
-- Storage for Web Push subscriptions (an admin can have several — one per
-- device/browser) and a tiny durable clock for the periodic digest job, so
-- a server restart/redeploy doesn't fuzz its "since when" window.

CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_account ON admin_push_subscriptions(account_id);

CREATE TABLE IF NOT EXISTS admin_notification_state (
  key TEXT PRIMARY KEY,
  value TIMESTAMPTZ NOT NULL
);
