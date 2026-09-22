import { pool } from "../../config/db";

export interface SpotCommentRow {
  comment_id: string;
  spot_id: string;
  avitag: string;
  text: string;
  commented_at: string;
  edited_at: string | null;
  edit_count: number;
}

// Plain comments, no reaction join — comment-level likes were explicitly
// deferred for v1 (unlike comment.repo.ts's REACTION_COLUMNS for gist
// comments), so this is a straight profile-display join, nothing more.
export interface SpotCommentWithProfile extends SpotCommentRow {
  first_name: string | null;
  last_name: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  image_url: string | null;
}

const PROFILE_JOIN = `
  LEFT JOIN student_profiles sp ON sp.avitag = c.avitag
  LEFT JOIN kreator_profiles kp ON kp.avitag = c.avitag
  LEFT JOIN kompany_profiles kmp ON kmp.avitag = c.avitag
  LEFT JOIN school_profiles scp ON scp.avitag = c.avitag
  LEFT JOIN idiot_profiles idp ON idp.avitag = c.avitag
  LEFT JOIN accounts acc ON acc.account_id = COALESCE(sp.account_id, kp.account_id, kmp.account_id, scp.account_id, idp.account_id)
`;
const PROFILE_COLUMNS = `
  COALESCE(sp.first_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS first_name,
  sp.last_name, sp.campus_tag, sp.major_tag, sp.level,
  COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url
`;
const PROFILE_LIVE_GATE = `(
  (COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) IS NULL
    OR COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) = 'ACTIVE')
  AND (acc.account_status IS NULL OR acc.account_status = 'ACTIVE')
)`;

// Joined via a CTE so a freshly-posted comment already carries the
// poster's first_name/image_url on the very response that created it —
// same reasoning comment.repo.ts's own create() gives.
export async function create(params: {
  spot_id: string;
  avitag: string;
  text: string;
}): Promise<SpotCommentWithProfile> {
  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO spot_comments (spot_id, avitag, text) VALUES ($1, $2, $3) RETURNING *
     )
     SELECT inserted.*, ${PROFILE_COLUMNS}
     FROM inserted
     ${PROFILE_JOIN.replace(/c\.avitag/g, "inserted.avitag")}`,
    [params.spot_id, params.avitag, params.text]
  );
  return rows[0];
}

export async function get(comment_id: string): Promise<SpotCommentRow | null> {
  const { rows } = await pool.query<SpotCommentRow>(`SELECT * FROM spot_comments WHERE comment_id = $1`, [comment_id]);
  return rows[0] ?? null;
}

export async function listBySpot(
  spot_id: string,
  limit = 20,
  cursor?: string
): Promise<SpotCommentWithProfile[]> {
  if (cursor) {
    const { rows } = await pool.query<SpotCommentWithProfile>(
      `SELECT c.*, ${PROFILE_COLUMNS}
       FROM spot_comments c
       ${PROFILE_JOIN}
       WHERE c.spot_id = $1 AND c.commented_at < (SELECT commented_at FROM spot_comments WHERE comment_id = $2)
         AND ${PROFILE_LIVE_GATE}
       ORDER BY c.commented_at DESC LIMIT $3`,
      [spot_id, cursor, limit]
    );
    return rows;
  }
  const { rows } = await pool.query<SpotCommentWithProfile>(
    `SELECT c.*, ${PROFILE_COLUMNS}
     FROM spot_comments c
     ${PROFILE_JOIN}
     WHERE c.spot_id = $1 AND ${PROFILE_LIVE_GATE} ORDER BY c.commented_at DESC LIMIT $2`,
    [spot_id, limit]
  );
  return rows;
}

export async function remove(comment_id: string, avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM spot_comments WHERE comment_id = $1 AND avitag = $2`, [
    comment_id,
    avitag,
  ]);
  return (rowCount || 0) > 0;
}

export async function removeAsAdmin(comment_id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM spot_comments WHERE comment_id = $1`, [comment_id]);
  return (rowCount || 0) > 0;
}
