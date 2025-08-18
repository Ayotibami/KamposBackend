import pool from "../../config/connectDB";
import type { IComment } from "./comment.interface";

const mapRow = (r: any): IComment => ({
  commentId: r.comment_id,
  gistId: r.gist_id,
  avitag: r.avitag,
  text: r.text,
  commentedAt: r.commented_at,
});

export const createComment = async (
  comment: Partial<IComment>
): Promise<IComment> => {
  const { rows } = await pool.query(
    `INSERT INTO comments (gist_id, avitag, text) VALUES ($1, $2, $3) RETURNING *`,
    [comment.gistId, comment.avitag, comment.text]
  );
  return mapRow(rows[0]);
};

export const findCommentById = async (
  commentId: string
): Promise<IComment | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM comments WHERE comment_id = $1`,
    [commentId]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findCommentsByGistId = async (
  gistId: string
): Promise<IComment[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM comments WHERE gist_id = $1 ORDER BY commented_at DESC`,
    [gistId]
  );
  return rows.map(mapRow);
};

export const deleteCommentById = async (commentId: string): Promise<void> => {
  await pool.query(`DELETE FROM comments WHERE comment_id = $1`, [commentId]);
};
