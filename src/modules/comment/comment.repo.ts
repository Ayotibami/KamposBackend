import { pool } from '../../config/db';

export interface CommentRow {
  comment_id: string;
  gist_id: string;
  avitag: string | null;
  text: string;
  commented_at: string;
  edited_at: string | null;
  edit_count: number;
}

export interface CommentWithReactions extends CommentRow {
  reactions_count: number;
  /** The viewer's own reaction on this comment, if any — same idea as
   * gists' my_reaction, just a plain total count instead of a per-type
   * breakdown (a comment reaction is a lighter single tap-to-like, not the
   * full 5-emoji picker gists get). */
  my_reaction: string | null;
  /** Commenter's display info — COALESCEd across all 5 profile tables (see
   * PROFILE_COLUMNS below), same "fix the student-only join" pattern
   * gist.repo.ts's AUTHOR_COLUMNS just got. Null only when the avitag
   * resolves to no profile at all (a data-integrity edge case, not the
   * common "non-student commenter" case anymore). */
  first_name: string | null;
  last_name: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  image_url: string | null;
}

// Scalar subqueries (not a LATERAL join) since each only ever needs a single
// value back — simpler to read inline than standing up a join for it.
const REACTION_COLUMNS = (viewerParamIndex: number) => `
  (SELECT COUNT(*)::int FROM reactions r WHERE r.entity_type = 'COMMENT' AND r.entity_id = c.comment_id) AS reactions_count,
  (SELECT type FROM reactions r WHERE r.entity_type = 'COMMENT' AND r.entity_id = c.comment_id AND r.avitag = $${viewerParamIndex}::text LIMIT 1) AS my_reaction
`;

// Commenter display info — LEFT JOINed across all 5 profile types (keyed by
// avitag, same as gist.repo.ts's AUTHOR_JOIN) so a KREATOR/KOMPANY/SCHOOL/
// IDIOT commenter gets real name/photo instead of silently falling back to
// their bare avitag the way a student-only join left them. `accounts` is
// joined off whichever profile table actually matched, for the AND-gate
// below (a comment's own row has no account_id column to join from
// directly, unlike gists).
const PROFILE_JOIN = `
  LEFT JOIN student_profiles sp ON sp.avitag = c.avitag
  LEFT JOIN kreator_profiles kp ON kp.avitag = c.avitag
  LEFT JOIN kompany_profiles kmp ON kmp.avitag = c.avitag
  LEFT JOIN school_profiles scp ON scp.avitag = c.avitag
  LEFT JOIN idiot_profiles idp ON idp.avitag = c.avitag
  LEFT JOIN accounts acc ON acc.account_id = COALESCE(sp.account_id, kp.account_id, kmp.account_id, scp.account_id, idp.account_id)
`;
// first_name/last_name stay real column names (not renamed) — CommentList.tsx
// already reads c.first_name with an avitag fallback, so COALESCING a
// non-student's display_name into first_name (and leaving last_name to
// student-only, same as campus/major/level) fixes the identity gap with no
// frontend change needed. image_url is COALESCEd across all 5 for the same
// reason gist.repo.ts's AUTHOR_COLUMNS is.
const PROFILE_COLUMNS = `
  COALESCE(sp.first_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS first_name,
  sp.last_name, sp.campus_tag, sp.major_tag, sp.level,
  COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url
`;

// Same AND-gate as gist.repo.ts's AUTHOR_LIVE_GATE — a banned/deactivated/
// deleted commenter's old comments shouldn't keep showing on other
// people's gists. Literal 'ACTIVE', not a bind parameter, so it never
// shifts any existing $N numbering below.
const PROFILE_LIVE_GATE = `(
  (COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) IS NULL
    OR COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) = 'ACTIVE')
  AND (acc.account_status IS NULL OR acc.account_status = 'ACTIVE')
)`;

// Profile fields joined in via a CTE (not a separate follow-up query) so a
// freshly-posted comment already carries the poster's first_name/level/
// image_url etc. on the very response that created it — without this, the
// UI only had avitag to show until the next full list refetch happened to
// bring the joined data along.
export async function create(
  params: { gist_id: string; avitag: string; text: string }
): Promise<CommentRow & { first_name: string | null; last_name: string | null; campus_tag: string | null; major_tag: string | null; level: number | null; image_url: string | null }> {
  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO comments (gist_id, avitag, text) VALUES ($1, $2, $3) RETURNING *
     )
     SELECT inserted.*, ${PROFILE_COLUMNS}
     FROM inserted
     ${PROFILE_JOIN.replace(/c\.avitag/g, 'inserted.avitag')}`,
    [params.gist_id, params.avitag, params.text]
  );
  return rows[0];
}

export async function get(comment_id: string): Promise<CommentRow | null> {
  const { rows } = await pool.query<CommentRow>(`SELECT * FROM comments WHERE comment_id = $1`, [comment_id]);
  return rows[0] ?? null;
}

export async function listByGist(
  gist_id: string,
  limit = 20,
  cursor?: string,
  viewerAvitag?: string
): Promise<CommentWithReactions[]> {
  if (cursor) {
    const { rows } = await pool.query<CommentWithReactions>(
      `SELECT c.*, ${REACTION_COLUMNS(4)}, ${PROFILE_COLUMNS}
       FROM comments c
       ${PROFILE_JOIN}
       WHERE c.gist_id = $1 AND c.commented_at < (SELECT commented_at FROM comments WHERE comment_id = $2)
         AND ${PROFILE_LIVE_GATE}
       ORDER BY c.commented_at DESC LIMIT $3`,
      [gist_id, cursor, limit, viewerAvitag ?? null]
    );
    return rows;
  }
  const { rows } = await pool.query<CommentWithReactions>(
    `SELECT c.*, ${REACTION_COLUMNS(3)}, ${PROFILE_COLUMNS}
     FROM comments c
     ${PROFILE_JOIN}
     WHERE c.gist_id = $1 AND ${PROFILE_LIVE_GATE} ORDER BY c.commented_at DESC LIMIT $2`,
    [gist_id, limit, viewerAvitag ?? null]
  );
  return rows;
}

/**
 * Top-N-per-group fetch: the first `limitPerGist` comments for each of
 * `gist_ids`, in one round trip instead of one request per gist. Used to
 * prefetch comments for a whole page of gists alongside the gist list
 * itself, so switching to a gist you haven't even viewed yet often already
 * has its comments in hand.
 */
export async function listBatchByGistIds(
  gist_ids: string[],
  limitPerGist = 20,
  viewerAvitag?: string
): Promise<Record<string, CommentWithReactions[]>> {
  if (gist_ids.length === 0) return {};
  const { rows } = await pool.query<CommentWithReactions>(
    `SELECT c.*, ${REACTION_COLUMNS(3)}, ${PROFILE_COLUMNS}
     FROM unnest($1::uuid[]) AS g(gist_id)
     JOIN LATERAL (
       SELECT * FROM comments cm
       WHERE cm.gist_id = g.gist_id
       ORDER BY cm.commented_at DESC
       LIMIT $2
     ) c ON TRUE
     ${PROFILE_JOIN}
     WHERE ${PROFILE_LIVE_GATE}
     ORDER BY c.gist_id, c.commented_at DESC`,
    [gist_ids, limitPerGist, viewerAvitag ?? null]
  );
  const byGist: Record<string, CommentWithReactions[]> = {};
  for (const id of gist_ids) byGist[id] = [];
  for (const row of rows) {
    (byGist[row.gist_id] ??= []).push(row);
  }
  return byGist;
}

export async function listByUser(avitag: string, limit = 20, cursor?: string): Promise<CommentRow[]> {
  if (cursor) {
    const { rows } = await pool.query<CommentRow>(
      `SELECT * FROM comments WHERE avitag = $1 AND commented_at < (SELECT commented_at FROM comments WHERE comment_id = $2)
       ORDER BY commented_at DESC LIMIT $3`,
      [avitag, cursor, limit]
    );
    return rows;
  }
  const { rows } = await pool.query<CommentRow>(
    `SELECT * FROM comments WHERE avitag = $1 ORDER BY commented_at DESC LIMIT $2`,
    [avitag, limit]
  );
  return rows;
}

export async function update(comment_id: string, avitag: string, text: string): Promise<CommentRow | null> {
  const { rows } = await pool.query<CommentRow>(
    `UPDATE comments SET text = $1, edited_at = NOW(), edit_count = edit_count + 1
     WHERE comment_id = $2 AND avitag = $3 RETURNING *`,
    [text, comment_id, avitag]
  );
  return rows[0] ?? null;
}

export async function remove(comment_id: string, avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM comments WHERE comment_id = $1 AND avitag = $2`, [comment_id, avitag]);
  return (rowCount || 0) > 0;
}

export async function removeAsAdmin(comment_id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM comments WHERE comment_id = $1`, [comment_id]);
  return (rowCount || 0) > 0;
}
