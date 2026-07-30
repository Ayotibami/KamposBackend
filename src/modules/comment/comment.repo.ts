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
  /** Commenter's profile info, joined in for display — null when the
   * avitag doesn't resolve to a student profile (only student_profiles has
   * campus/major; other profile types just show name-less/tag-less). Raw
   * tags (e.g. "unilag"), not resolved display names — matches how gists
   * themselves show campus_tag/major_tag directly, no campus/major join. */
  first_name: string | null;
  last_name: string | null;
  campus_tag: string | null;
  major_tag: string | null;
}

// Scalar subqueries (not a LATERAL join) since each only ever needs a single
// value back — simpler to read inline than standing up a join for it.
const REACTION_COLUMNS = (viewerParamIndex: number) => `
  (SELECT COUNT(*)::int FROM reactions r WHERE r.entity_type = 'COMMENT' AND r.entity_id = c.comment_id) AS reactions_count,
  (SELECT type FROM reactions r WHERE r.entity_type = 'COMMENT' AND r.entity_id = c.comment_id AND r.avitag = $${viewerParamIndex}::text LIMIT 1) AS my_reaction
`;

// Commenter display info — LEFT JOINed so a non-student (or since-deleted)
// avitag still returns a row, just with these columns null. Just
// student_profiles, no campus/major reference-table join — raw tags only.
const PROFILE_JOIN = `LEFT JOIN student_profiles sp ON sp.avitag = c.avitag`;
const PROFILE_COLUMNS = `sp.first_name, sp.last_name, sp.campus_tag, sp.major_tag`;

export async function create(params: { gist_id: string; avitag: string | null; text: string }): Promise<CommentRow> {
  const { rows } = await pool.query<CommentRow>(
    `INSERT INTO comments (gist_id, avitag, text) VALUES ($1, $2, $3) RETURNING *`,
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
       ORDER BY c.commented_at DESC LIMIT $3`,
      [gist_id, cursor, limit, viewerAvitag ?? null]
    );
    return rows;
  }
  const { rows } = await pool.query<CommentWithReactions>(
    `SELECT c.*, ${REACTION_COLUMNS(3)}, ${PROFILE_COLUMNS}
     FROM comments c
     ${PROFILE_JOIN}
     WHERE c.gist_id = $1 ORDER BY c.commented_at DESC LIMIT $2`,
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
     FROM unnest($1::text[]) AS g(gist_id)
     JOIN LATERAL (
       SELECT * FROM comments cm
       WHERE cm.gist_id = g.gist_id
       ORDER BY cm.commented_at DESC
       LIMIT $2
     ) c ON TRUE
     ${PROFILE_JOIN}
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
