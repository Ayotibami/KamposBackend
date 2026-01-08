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

export interface CommentWithProfile extends CommentRow {
  display_name: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  image_url: string | null;
}

export async function create(params: { gist_id: string; avitag: string | null; text: string }): Promise<CommentRow> {
  const { rows } = await pool.query<CommentRow>(
    `INSERT INTO comments (gist_id, avitag, text) VALUES ($1, $2, $3) RETURNING *`,
    [params.gist_id, params.avitag, params.text]
  );
  return rows[0];
}

export async function get(comment_id: string): Promise<CommentWithProfile | null> {
  const { rows } = await pool.query<CommentWithProfile>(
    `SELECT c.*, sp.display_name, sp.campus_tag, sp.major_tag, sp.image_url
     FROM comments c
     LEFT JOIN student_profiles sp ON sp.avitag = c.avitag
     WHERE c.comment_id = $1`,
    [comment_id]
  );
  return rows[0] ?? null;
}

export async function listByGist(gist_id: string, limit = 20, cursor?: string): Promise<CommentWithProfile[]> {
  if (cursor) {
    const { rows } = await pool.query<CommentWithProfile>(
      `SELECT c.*, sp.display_name, sp.campus_tag, sp.major_tag, sp.image_url
       FROM comments c
       LEFT JOIN student_profiles sp ON sp.avitag = c.avitag
       WHERE c.gist_id = $1 AND c.commented_at < (SELECT commented_at FROM comments WHERE comment_id = $2)
       ORDER BY c.commented_at DESC LIMIT $3`,
      [gist_id, cursor, limit]
    );
    return rows;
  }
  const { rows } = await pool.query<CommentWithProfile>(
    `SELECT c.*, sp.display_name, sp.campus_tag, sp.major_tag, sp.image_url
     FROM comments c
     LEFT JOIN student_profiles sp ON sp.avitag = c.avitag
     WHERE c.gist_id = $1 ORDER BY c.commented_at DESC LIMIT $2`,
    [gist_id, limit]
  );
  return rows;
}

export async function listByUser(avitag: string, limit = 20, cursor?: string): Promise<CommentWithProfile[]> {
  if (cursor) {
    const { rows } = await pool.query<CommentWithProfile>(
      `SELECT c.*, sp.display_name, sp.campus_tag, sp.major_tag, sp.image_url
       FROM comments c
       LEFT JOIN student_profiles sp ON sp.avitag = c.avitag
       WHERE c.avitag = $1 AND c.commented_at < (SELECT commented_at FROM comments WHERE comment_id = $2)
       ORDER BY c.commented_at DESC LIMIT $3`,
      [avitag, cursor, limit]
    );
    return rows;
  }
  const { rows } = await pool.query<CommentWithProfile>(
    `SELECT c.*, sp.display_name, sp.campus_tag, sp.major_tag, sp.image_url
     FROM comments c
     LEFT JOIN student_profiles sp ON sp.avitag = c.avitag
     WHERE c.avitag = $1 ORDER BY c.commented_at DESC LIMIT $2`,
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
