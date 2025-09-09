import { pool } from '../../config/db';
import type { QueryResult } from 'pg';

export interface Gist {
  gist_id: string;
  gist_text: string;
  avitag: string;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  gist_status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  created_at: string;
  edited_at: string | null;
}

export async function createGist(input: {
  gist_text: string;
  avitag: string;
  campus_tag?: string | null;
  major_tag?: string | null;
  level?: number | null;
}): Promise<Gist> {
  const { rows } = await pool.query<Gist>(
    `INSERT INTO gists (gist_text, avitag, campus_tag, major_tag, level)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.gist_text, input.avitag, input.campus_tag ?? null, input.major_tag ?? null, input.level ?? null]
  );
  return rows[0];
}

export async function findGistById(gist_id: string): Promise<Gist | null> {
  const { rows } = await pool.query<Gist>(`SELECT * FROM gists WHERE gist_id = $1`, [gist_id]);
  return rows[0] ?? null;
}

export async function approveGist(gist_id: string): Promise<Gist | null> {
  const { rows } = await pool.query<Gist>(
    `UPDATE gists SET gist_status = 'APPROVED', edited_at = NOW() WHERE gist_id = $1 RETURNING *`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function rejectGist(gist_id: string): Promise<Gist | null> {
  const { rows } = await pool.query<Gist>(
    `UPDATE gists SET gist_status = 'REJECTED', edited_at = NOW() WHERE gist_id = $1 RETURNING *`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function listPendingGists(limit = 20, offset = 0): Promise<Gist[]> {
  const { rows } = await pool.query<Gist>(
    `SELECT * FROM gists WHERE gist_status = 'SUBMITTED' ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}
