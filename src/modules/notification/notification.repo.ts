import { pool } from '../../config/db';

export type TriggerType =
  | 'COMMENT' | 'REPOST' | 'HOT_EXPIRING'
  | 'COURSEMATE_GIST' | 'REACTION_MILESTONE' | 'TRENDING_GIST' | 'TRENDING_AMEBO' | 'SPOT_LIKES';

export type DeliveryMode = 'INSTANT' | 'DIGEST';
export type NotificationCategory = 'COMMENT' | 'REPOST' | 'HOT_EXPIRING' | 'DIGEST' | 'INACTIVITY_NUDGE' | 'ACTIVATION_NUDGE';
export type TargetType = 'GIST' | 'SPOT' | 'HOT_POST';
export type ImageKind = 'KAPPY' | 'PROFILE_PICTURE' | 'MEDIA';

export interface NotificationEventRow {
  event_id: string;
  recipient_avitag: string;
  actor_avitag: string | null;
  trigger_type: TriggerType;
  target_type: TargetType;
  target_id: string;
  delivery_mode: DeliveryMode;
  data: Record<string, unknown> | null;
  created_at: string;
  processed_at: string | null;
}

export interface NotificationRow {
  notification_id: string;
  recipient_avitag: string;
  category: NotificationCategory;
  kappy_line: string;
  image_kind: ImageKind;
  image_url: string | null;
  // Who triggered this, when there's a single real person behind it
  // (COMMENT, REPOST) — null for anything milestone/content-driven or
  // system-voiced. See migration 0050's own doc comment.
  actor_avitag: string | null;
  // That person's own photo, kept separate from image_kind/image_url
  // (always "the content's media" now) so a notification can show BOTH
  // at once — see migration 0051's own doc comment.
  actor_image_url: string | null;
  target_type: TargetType | 'PROFILE' | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export async function insertEvent(params: {
  recipient_avitag: string;
  actor_avitag: string | null;
  trigger_type: TriggerType;
  target_type: TargetType;
  target_id: string;
  delivery_mode: DeliveryMode;
  data?: Record<string, unknown> | null;
}): Promise<NotificationEventRow> {
  const { rows } = await pool.query<NotificationEventRow>(
    `INSERT INTO notification_events (recipient_avitag, actor_avitag, trigger_type, target_type, target_id, delivery_mode, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [params.recipient_avitag, params.actor_avitag, params.trigger_type, params.target_type, params.target_id, params.delivery_mode, params.data ?? null]
  );
  return rows[0];
}

export async function markEventsProcessed(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  await pool.query(`UPDATE notification_events SET processed_at = NOW() WHERE event_id = ANY($1::uuid[])`, [eventIds]);
}

/** Every DIGEST event still pending (processed_at IS NULL), grouped by
 * nothing yet — the service layer groups by recipient itself, since a
 * single batch run needs to iterate recipients anyway. */
export async function findPendingDigestEvents(): Promise<NotificationEventRow[]> {
  const { rows } = await pool.query<NotificationEventRow>(
    `SELECT * FROM notification_events WHERE delivery_mode = 'DIGEST' AND processed_at IS NULL ORDER BY recipient_avitag, created_at ASC`
  );
  return rows;
}

export async function insertNotification(params: {
  recipient_avitag: string;
  category: NotificationCategory;
  kappy_line: string;
  image_kind: ImageKind;
  image_url?: string | null;
  actor_avitag?: string | null;
  actor_image_url?: string | null;
  target_type?: TargetType | 'PROFILE' | null;
  target_id?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<NotificationRow> {
  const { rows } = await pool.query<NotificationRow>(
    `INSERT INTO notifications (recipient_avitag, category, kappy_line, image_kind, image_url, actor_avitag, actor_image_url, target_type, target_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.recipient_avitag,
      params.category,
      params.kappy_line,
      params.image_kind,
      params.image_url ?? null,
      params.actor_avitag ?? null,
      params.actor_image_url ?? null,
      params.target_type ?? null,
      params.target_id ?? null,
      params.payload ?? null,
    ]
  );
  return rows[0];
}

export async function listForUser(avitag: string, limit: number, cursor?: string): Promise<NotificationRow[]> {
  const { rows } = await pool.query<NotificationRow>(
    cursor
      ? `SELECT * FROM notifications WHERE recipient_avitag = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT $3`
      : `SELECT * FROM notifications WHERE recipient_avitag = $1 ORDER BY created_at DESC LIMIT $2`,
    cursor ? [avitag, cursor, limit] : [avitag, limit]
  );
  return rows;
}

export async function unreadCount(avitag: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM notifications WHERE recipient_avitag = $1 AND read_at IS NULL`,
    [avitag]
  );
  return Number(rows[0].count);
}

export async function markRead(notificationId: string, avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE notifications SET read_at = NOW() WHERE notification_id = $1 AND recipient_avitag = $2 AND read_at IS NULL`,
    [notificationId, avitag]
  );
  return (rowCount ?? 0) > 0;
}

export async function markAllRead(avitag: string): Promise<void> {
  await pool.query(`UPDATE notifications SET read_at = NOW() WHERE recipient_avitag = $1 AND read_at IS NULL`, [avitag]);
}

/** How many INSTANT-category notifications + digest batches this person
 * has already received today — the daily cap (12 instant + 8 digest,
 * counted separately) reads off this directly rather than a separate
 * counter table, since `notifications` already has everything needed. */
export async function countTodayByCategory(avitag: string): Promise<{ instant: number; digest: number }> {
  const { rows } = await pool.query<{ instant: string; digest: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE category IN ('COMMENT','REPOST','HOT_EXPIRING')) AS instant,
       COUNT(*) FILTER (WHERE category = 'DIGEST') AS digest
     FROM notifications
     WHERE recipient_avitag = $1 AND created_at > date_trunc('day', NOW())`,
    [avitag]
  );
  return { instant: Number(rows[0].instant), digest: Number(rows[0].digest) };
}

export async function getPreferences(avitag: string): Promise<string[]> {
  const { rows } = await pool.query<{ muted_categories: string[] }>(
    `SELECT muted_categories FROM notification_preferences WHERE avitag = $1`,
    [avitag]
  );
  return rows[0]?.muted_categories ?? [];
}

/** Has this person already gotten a notification of this category since
 * the given cutoff? Used by the two periodic nudges to dedupe — the
 * inactivity nudge shouldn't re-fire every time its own cron tick runs
 * within the same 3-day window, and the activation nudge shouldn't fire
 * more than once per day even though its cron may run several times
 * during the 12pm-4pm window it's scoped to. */
export async function hasNotificationSince(avitag: string, category: NotificationCategory, since: Date): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM notifications WHERE recipient_avitag = $1 AND category = $2 AND created_at > $3 LIMIT 1`,
    [avitag, category, since]
  );
  return rows.length > 0;
}

export async function setMutedCategories(avitag: string, categories: string[]): Promise<void> {
  await pool.query(
    `INSERT INTO notification_preferences (avitag, muted_categories, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (avitag) DO UPDATE SET muted_categories = $2, updated_at = NOW()`,
    [avitag, categories]
  );
}

/** Has this exact (target, milestone) already fired? Used by both the
 * reaction-milestone and trending-threshold checks so each one only ever
 * notifies once, not on every subsequent reaction/comment/like past the
 * line it already crossed. */
export async function milestoneAlreadyNotified(targetType: TargetType, targetId: string, milestone: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM notification_milestones WHERE target_type = $1 AND target_id = $2 AND milestone = $3`,
    [targetType, targetId, milestone]
  );
  return rows.length > 0;
}

export async function recordMilestone(targetType: TargetType, targetId: string, milestone: string): Promise<void> {
  await pool.query(
    `INSERT INTO notification_milestones (target_type, target_id, milestone) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [targetType, targetId, milestone]
  );
}

export async function deleteOlderThan(days: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM notifications WHERE created_at < NOW() - ($1 || ' days')::interval`, [String(days)]);
  return rowCount ?? 0;
}
