import { pool } from '../../config/db';

export interface PushSubscriptionRow {
  subscription_id: string;
  account_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function upsertSubscription(
  account_id: string,
  endpoint: string,
  p256dh: string,
  auth: string
): Promise<void> {
  // ON CONFLICT (endpoint) — the same browser/device re-subscribing (e.g.
  // after clearing permission and re-granting it) gets the same endpoint
  // back from the push service; this keeps exactly one row per real
  // subscription rather than accumulating dead duplicates, and re-points
  // it at whichever account asked most recently if it ever changed hands.
  await pool.query(
    `INSERT INTO admin_push_subscriptions (account_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET account_id = $1, p256dh = $3, auth = $4`,
    [account_id, endpoint, p256dh, auth]
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await pool.query(`DELETE FROM admin_push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

/** Every admin's subscriptions (idiot + king) — for reports and the digest. */
export async function listAdminSubscriptions(): Promise<PushSubscriptionRow[]> {
  const { rows } = await pool.query<PushSubscriptionRow>(
    `SELECT s.* FROM admin_push_subscriptions s
     JOIN accounts a ON a.account_id = s.account_id
     WHERE a.role IN ('idiot', 'king')`
  );
  return rows;
}

/** King-only subscriptions — for the security-event pushes (admin role
 * changes, blocked attempts to touch a king account/profile). */
export async function listKingSubscriptions(): Promise<PushSubscriptionRow[]> {
  const { rows } = await pool.query<PushSubscriptionRow>(
    `SELECT s.* FROM admin_push_subscriptions s
     JOIN accounts a ON a.account_id = s.account_id
     WHERE a.role = 'king'`
  );
  return rows;
}

export async function removeSubscriptionsByEndpoints(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  await pool.query(`DELETE FROM admin_push_subscriptions WHERE endpoint = ANY($1::text[])`, [endpoints]);
}

/** Durable "since when" clock for the digest job — a DB row, not an
 * in-memory variable, so a redeploy/restart doesn't fuzz the window (the
 * process could restart mid-interval on Render at any time). Defaults to
 * "30 minutes ago" the very first time it's read (no row yet), so the very
 * first digest after this feature ships covers a sane window instead of
 * either the dawn of time or nothing at all. */
export async function getLastDigestAt(): Promise<Date> {
  const { rows } = await pool.query<{ value: Date }>(
    `SELECT value FROM admin_notification_state WHERE key = 'digest_last_run'`
  );
  return rows[0]?.value ?? new Date(Date.now() - 30 * 60 * 1000);
}

export async function setLastDigestAt(when: Date): Promise<void> {
  await pool.query(
    `INSERT INTO admin_notification_state (key, value) VALUES ('digest_last_run', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [when]
  );
}
