import { pool } from '../../config/db';

export interface BroadcastRow {
  broadcast_id: string;
  subject: string;
  message: string;
  sent_by_account_id: string;
  total_recipients: number;
  created_at: string;
}

export interface BroadcastWithCounts extends BroadcastRow {
  sent_count: number;
  failed_count: number;
  pending_count: number;
}

export interface BroadcastRecipientRow {
  recipient_id: string;
  broadcast_id: string;
  account_id: string;
  email: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  claimed_at: string | null;
}

/** Every account this broadcast should go to — ACTIVE only. Deliberately
 * excludes DEACTIVATED (self-paused, may come back but chose to step away),
 * SUSPENDED (can't even log in right now), and DELETED (gone for good) —
 * none of those should get re-contacted by a mass announcement. */
export async function listActiveAccountEmails(): Promise<{ account_id: string; email: string }[]> {
  const { rows } = await pool.query<{ account_id: string; email: string }>(
    `SELECT account_id, email FROM accounts WHERE account_status = 'ACTIVE'`
  );
  return rows;
}

export async function createBroadcast(
  subject: string,
  message: string,
  sent_by_account_id: string,
  recipients: { account_id: string; email: string }[]
): Promise<BroadcastRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<BroadcastRow>(
      `INSERT INTO broadcasts (subject, message, sent_by_account_id, total_recipients)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [subject, message, sent_by_account_id, recipients.length]
    );
    const broadcast = rows[0];
    // Batched multi-row insert rather than one INSERT per recipient — at
    // today's account count this doesn't matter, but there's no reason to
    // make it N round trips when it can be one.
    if (recipients.length > 0) {
      const values: string[] = [];
      const params: any[] = [];
      recipients.forEach((r, i) => {
        const base = i * 3;
        values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        params.push(broadcast.broadcast_id, r.account_id, r.email);
      });
      await client.query(
        `INSERT INTO broadcast_recipients (broadcast_id, account_id, email) VALUES ${values.join(', ')}`,
        params
      );
    }
    await client.query('COMMIT');
    return broadcast;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

export async function listBroadcasts(limit = 20, offset = 0): Promise<BroadcastWithCounts[]> {
  const { rows } = await pool.query<BroadcastWithCounts>(
    `SELECT b.*,
            COALESCE(c.sent_count, 0)::int AS sent_count,
            COALESCE(c.failed_count, 0)::int AS failed_count,
            COALESCE(c.pending_count, 0)::int AS pending_count
     FROM broadcasts b
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
         COUNT(*) FILTER (WHERE status IN ('pending', 'sending')) AS pending_count
       FROM broadcast_recipients WHERE broadcast_id = b.broadcast_id
     ) c ON TRUE
     ORDER BY b.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function getBroadcast(broadcast_id: string): Promise<BroadcastWithCounts | null> {
  const { rows } = await pool.query<BroadcastWithCounts>(
    `SELECT b.*,
            COALESCE(c.sent_count, 0)::int AS sent_count,
            COALESCE(c.failed_count, 0)::int AS failed_count,
            COALESCE(c.pending_count, 0)::int AS pending_count
     FROM broadcasts b
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
         COUNT(*) FILTER (WHERE status IN ('pending', 'sending')) AS pending_count
       FROM broadcast_recipients WHERE broadcast_id = b.broadcast_id
     ) c ON TRUE
     WHERE b.broadcast_id = $1`,
    [broadcast_id]
  );
  return rows[0] ?? null;
}

/** A batch of not-yet-sent recipients across ALL broadcasts, oldest queued
 * first — a backlog from an earlier broadcast that got throttled always
 * finishes before a newer one starts, rather than newer broadcasts
 * starving older ones.
 *
 * This is a genuine atomic CLAIM, not a plain read — confirmed live that
 * without this, the immediate send-on-create trigger and the once-a-minute
 * recurring sender could both SELECT the same 'pending' rows at once (a
 * real race: firing a broadcast could send each recipient's email 2-3
 * times before either caller got around to marking anything 'sent').
 * `FOR UPDATE SKIP LOCKED` inside the subquery is what makes two
 * concurrent callers physically unable to walk away with the same row —
 * one gets it, the other's lock check simply excludes it, no blocking,
 * no double-claim, no manual coordination between the two callers needed.
 * The outer UPDATE flips status to 'sending' as part of that same atomic
 * step, and a row that gets claimed but never finishes (a crash mid-send)
 * becomes claimable again after 5 minutes via the claimed_at check, rather
 * than sitting stuck forever. */
export async function claimPendingRecipients(limit: number): Promise<BroadcastRecipientRow[]> {
  const { rows } = await pool.query<BroadcastRecipientRow>(
    `UPDATE broadcast_recipients
     SET status = 'sending', claimed_at = NOW()
     WHERE recipient_id IN (
       SELECT recipient_id FROM broadcast_recipients
       WHERE status = 'pending' OR (status = 'sending' AND claimed_at < NOW() - INTERVAL '5 minutes')
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [limit]
  );
  return rows;
}

export async function markRecipientSent(recipient_id: string): Promise<void> {
  await pool.query(
    `UPDATE broadcast_recipients SET status = 'sent', sent_at = NOW(), last_error = NULL WHERE recipient_id = $1`,
    [recipient_id]
  );
}

/** `permanent` decides whether this counts against the retry cap or gives
 * up immediately — see broadcastSender.ts for how that's decided from the
 * actual SMTP error. */
export async function markRecipientFailedOrRetry(
  recipient_id: string,
  errorMessage: string,
  permanent: boolean,
  maxAttempts: number
): Promise<void> {
  if (permanent) {
    await pool.query(
      `UPDATE broadcast_recipients SET status = 'failed', attempts = attempts + 1, last_error = $2 WHERE recipient_id = $1`,
      [recipient_id, errorMessage]
    );
    return;
  }
  await pool.query(
    `UPDATE broadcast_recipients
     SET attempts = attempts + 1,
         last_error = $2,
         status = CASE WHEN attempts + 1 >= $3 THEN 'failed' ELSE 'pending' END
     WHERE recipient_id = $1`,
    [recipient_id, errorMessage, maxAttempts]
  );
}
