import { pool } from "../../config/db";

export interface GistRow {
  gist_id: string;
  avitag: string;
  gist_text: string;
  created_at: string;
  edited_at: string | null;
  edit_count: number;
  is_reported: boolean;
}

export interface GistWithCounts extends GistRow {
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
}

export async function create(
  avitag: string,
  gist_text: string
): Promise<GistRow> {
  const { rows } = await pool.query<GistRow>(
    `INSERT INTO gists (avitag, gist_text) VALUES ($1, $2) RETURNING *`,
    [avitag, gist_text]
  );
  return rows[0];
}

export async function updateText(
  gist_id: string,
  avitag: string,
  gist_text: string
): Promise<GistRow | null> {
  const { rows } = await pool.query<GistRow>(
    `UPDATE gists SET gist_text = $1, edited_at = NOW(), edit_count = edit_count + 1
     WHERE gist_id = $2 AND avitag = $3 RETURNING *`,
    [gist_text, gist_id, avitag]
  );
  return rows[0] ?? null;
}

export async function remove(
  gist_id: string,
  avitag: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM gists WHERE gist_id = $1 AND avitag = $2`,
    [gist_id, avitag]
  );
  return (rowCount || 0) > 0;
}

export async function removeAsIdiot(gist_id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM gists WHERE gist_id = $1`,
    [gist_id]
  );
  return (rowCount || 0) > 0;
}

export async function findById(gist_id: string): Promise<GistRow | null> {
  const { rows } = await pool.query<GistRow>(
    `SELECT * FROM gists WHERE gist_id = $1`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function findWithCounts(
  gist_id: string
): Promise<GistWithCounts | null> {
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count
     FROM gists g LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     WHERE g.gist_id = $1`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function listRecent(
  limit = 20,
  cursor?: string
): Promise<GistWithCounts[]> {
  if (cursor) {
    const { rows } = await pool.query<GistWithCounts>(
      `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count
       FROM gists g LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
       WHERE g.created_at < (SELECT created_at FROM gists WHERE gist_id = $1)
       ORDER BY g.created_at DESC
       LIMIT $2`,
      [cursor, limit]
    );
    return rows;
  }
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count
     FROM gists g LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     ORDER BY g.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function listByUser(
  avitag: string,
  limit = 20,
  cursor?: string
): Promise<GistWithCounts[]> {
  if (cursor) {
    const { rows } = await pool.query<GistWithCounts>(
      `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count
       FROM gists g LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
       WHERE g.avitag = $1 AND g.created_at < (SELECT created_at FROM gists WHERE gist_id = $2)
       ORDER BY g.created_at DESC LIMIT $3`,
      [avitag, cursor, limit]
    );
    return rows;
  }
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count
     FROM gists g LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     WHERE g.avitag = $1 ORDER BY g.created_at DESC LIMIT $2`,
    [avitag, limit]
  );
  return rows;
}

export async function trending(
  limit = 20
): Promise<
  Array<
    GistWithCounts & {
      score: number;
      reactions_3d: number;
      comments_3d: number;
    }
  >
> {
  const { rows } = await pool.query<any>(
    `SELECT g.*, counts.reactions_count, counts.comments_count, counts.views_count, counts.reports_count,
            t.score, t.reactions_3d, t.comments_3d
     FROM v_gist_trending_3d t
     JOIN gists g ON g.gist_id = t.gist_id
     LEFT JOIN v_gist_counts counts ON counts.gist_id = g.gist_id
     ORDER BY t.score DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function search(
  term: string,
  limit = 20,
  offset = 0
): Promise<GistWithCounts[]> {
  const q = `%${term}%`;
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count
     FROM gists g LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     WHERE g.gist_text ILIKE $1
     ORDER BY g.created_at DESC
     LIMIT $2 OFFSET $3`,
    [q, limit, offset]
  );
  return rows;
}

export async function report(
  gist_id: string,
  reporter_avitag: string,
  reason: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO gist_reports (gist_id, reporter_avitag, reason) VALUES ($1, $2, $3)`,
    [gist_id, reporter_avitag, reason]
  );
  await pool.query(`UPDATE gists SET is_reported = TRUE WHERE gist_id = $1`, [
    gist_id,
  ]);
}

export async function incrementView(
  gist_id: string,
  avitag: string | null
): Promise<void> {
  await pool.query(`INSERT INTO gist_views (gist_id, avitag) VALUES ($1, $2)`, [
    gist_id,
    avitag,
  ]);
}
