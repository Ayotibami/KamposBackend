import { pool } from '../../config/db';

// `idiot_avitag` has no live FK constraint (the FK it was originally
// declared with pointed at a `profiles` table that migration
// 0012_drop_base_profiles.sql dropped, and nothing re-added it) — it's a
// bare TEXT column today, which is exactly why every safeAudit() call
// below already succeeds despite none of the acting avitags existing in
// that long-gone table.
export type AuditAction =
  | 'PROFILE_VERIFY'
  | 'PROFILE_REJECT'
  | 'PROFILE_BAN'
  | 'PROFILE_UNBAN'
  | 'PROFILE_DELETE'
  | 'PROFILE_CREATE'
  | 'GIST_APPROVE'
  | 'GIST_REJECT'
  | 'REPORT_ACCEPT'
  | 'REPORT_REJECT'
  | 'ADMIN_GRANT'
  | 'ADMIN_REVOKE'
  | 'GIST_DELETE'
  | 'COMMENT_DELETE'
  | 'USER_CREATE'
  | 'USER_EMAIL_EDIT'
  | 'ACCOUNT_SUSPEND'
  | 'ACCOUNT_UNSUSPEND'
  | 'ACCOUNT_DELETE'
  | 'ADMIN_EMAIL_SENT'
  | 'REFERENCE_CREATE'
  | 'REFERENCE_UPDATE'
  | 'REFERENCE_DELETE'
  | 'BROADCAST_CREATED';

export async function logAudit(params: {
  action: AuditAction;
  target_type: 'PROFILE' | 'GIST' | 'ACCOUNT' | 'COMMENT' | 'CAMPUS' | 'MAJOR' | 'BROADCAST';
  target_id: string; // avitag, gist_id, or a campus/major tag
  idiot_avitag: string;
  reason?: string | null;
}) {
  await pool.query(
    `INSERT INTO audit_logs (action, target_type, target_id, idiot_avitag, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.action, params.target_type, params.target_id, params.idiot_avitag, params.reason ?? null]
  );
}

export interface AuditLogRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  idiot_avitag: string;
  reason: string | null;
  created_at: string;
  /** Populated only when target_type = 'ACCOUNT' — target_id is that
   * account's own account_id, which on its own is just an opaque UUID. */
  target_email: string | null;
  /** Populated only when target_type = 'GIST' — first 140 chars of the
   * gist's own text, so a "Deleted a gist" row shows what was actually
   * removed instead of a bare gist_id. */
  target_gist_preview: string | null;
  /** Same idea, target_type = 'COMMENT'. */
  target_comment_preview: string | null;
  /** Populated only when target_type = 'PROFILE' — a real display name
   * alongside the avitag (target_id) already shown, resolved across
   * whichever of the 5 profile tables actually matches (same COALESCE
   * pattern gist.repo.ts's AUTHOR_COLUMNS uses for the same reason: a
   * kreator/kompany/school/idiot's real name lives in `display_name`, only
   * students have first_name/last_name instead). */
  target_profile_name: string | null;
  /** Populated only when target_type = 'CAMPUS' — target_id is the tag
   * itself (e.g. "unilag"), this is its full name ("University of
   * Lagos"). */
  target_campus_name: string | null;
  /** Same idea, target_type = 'MAJOR'. */
  target_major_name: string | null;
}

export interface AuditLogFilters {
  action?: AuditAction | null;
  /** Matches either the acting admin's avitag/account_id OR the target_id
   * — "who did this" and "what was this done to" are the two things
   * someone reading this log is actually searching for, so one search box
   * covers both rather than making the king pick which column to search. */
  search?: string | null;
  limit?: number;
  /** The last-seen row's own `id` — audit_logs.id is a BIGSERIAL, strictly
   * increasing by insertion order, which makes it a simpler, tie-free
   * cursor than created_at (two audit rows can share a timestamp at
   * millisecond resolution under a burst of admin actions; ids never
   * collide). Passed as a string since a BIGSERIAL can in principle exceed
   * JS's safe integer range, even though no real deployment is anywhere
   * close to that yet. */
  cursor?: string | null;
}

/**
 * King-only activity log (see idiot/audit.controller.ts's own role check —
 * this function itself has no permission logic, same split every other
 * repo function in this app follows). Every admin action taken this whole
 * build has already been writing rows here via safeAudit(); this is simply
 * the first time anything reads them back for a human to look at, rather
 * than a database console.
 */
export async function listAuditLogs(filters: AuditLogFilters): Promise<AuditLogRow[]> {
  const action = filters.action ?? null;
  const search = filters.search ? `%${filters.search}%` : null;
  const limit = filters.limit ?? 30;
  const cursor = filters.cursor ?? null;

  // target_id is TEXT holding three genuinely different kinds of value
  // depending on target_type (an avitag, or a gist/comment/account UUID
  // rendered as text) — every join below compares the OTHER side cast to
  // text (acc.account_id::text, g.gist_id::text, c.comment_id::text)
  // rather than casting target_id to uuid. Postgres does not guarantee
  // short-circuit evaluation of an AND'd type-guard before the other side
  // of a comparison runs, so `target_id::uuid = ...` would throw an
  // "invalid input syntax for type uuid" the moment a PROFILE row's plain
  // avitag reached that comparison — casting the known-uuid column to
  // text instead is a plain string compare for every row, which can never
  // throw regardless of what target_id actually holds.
  const { rows } = await pool.query<AuditLogRow>(
    `SELECT al.id::text, al.action, al.target_type, al.target_id, al.idiot_avitag, al.reason, al.created_at,
            acc.email AS target_email,
            LEFT(g.gist_text, 140) AS target_gist_preview,
            LEFT(c.text, 140) AS target_comment_preview,
            COALESCE(sp.first_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS target_profile_name,
            camp.campus_name AS target_campus_name,
            maj.major_name AS target_major_name
     FROM audit_logs al
     LEFT JOIN accounts acc ON al.target_type = 'ACCOUNT' AND acc.account_id::text = al.target_id
     LEFT JOIN gists g ON al.target_type = 'GIST' AND g.gist_id::text = al.target_id
     LEFT JOIN comments c ON al.target_type = 'COMMENT' AND c.comment_id::text = al.target_id
     LEFT JOIN student_profiles sp ON al.target_type = 'PROFILE' AND sp.avitag = al.target_id
     LEFT JOIN kreator_profiles kp ON al.target_type = 'PROFILE' AND kp.avitag = al.target_id
     LEFT JOIN kompany_profiles kmp ON al.target_type = 'PROFILE' AND kmp.avitag = al.target_id
     LEFT JOIN school_profiles scp ON al.target_type = 'PROFILE' AND scp.avitag = al.target_id
     LEFT JOIN idiot_profiles idp ON al.target_type = 'PROFILE' AND idp.avitag = al.target_id
     LEFT JOIN campus camp ON al.target_type = 'CAMPUS' AND camp.campus_tag = al.target_id
     LEFT JOIN major maj ON al.target_type = 'MAJOR' AND maj.major_tag = al.target_id
     WHERE ($1::text IS NULL OR al.action = $1::text)
       AND ($2::text IS NULL OR al.idiot_avitag ILIKE $2 OR al.target_id ILIKE $2)
       AND ($3::bigint IS NULL OR al.id < $3::bigint)
     ORDER BY al.id DESC
     LIMIT $4`,
    [action, search, cursor, limit]
  );
  return rows;
}
