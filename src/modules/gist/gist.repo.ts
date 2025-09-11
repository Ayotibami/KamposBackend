import { pool } from "../../config/db";

export interface GistRow {
  gist_id: string;
  avitag: string;
  gist_text: string;
  created_at: string;
  edited_at: string | null;
  edit_count: number;
  is_reported: boolean;
  gist_status?: "SUBMITTED" | "APPROVED" | "REJECTED";
}

export async function findWithCountsAnyStatus(
  gist_id: string
): Promise<GistWithCounts | null> {
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     WHERE g.gist_id = $1`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export interface GistWithCounts extends GistRow {
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
  media: Array<{
    media_id: string;
    media_type: "IMAGE" | "VIDEO";
    media_url: string;
    thumbnail_url: string | null;
    order_index: number;
    uploaded_at: string;
    edited_at: string | null;
  }>;
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
    `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     WHERE g.gist_id = $1 AND g.gist_status = 'APPROVED'`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function listRecent(
  limit = 20,
  cursor?: string,
  viewerAvitag?: string
): Promise<GistWithCounts[]> {
  if (cursor) {
    const { rows } = await pool.query<GistWithCounts>(
      `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
              COALESCE(m.media, '[]'::json) AS media
       FROM gists g
       LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'media_id', gm.media_id,
           'media_type', gm.media_type,
           'media_url', gm.media_url,
           'thumbnail_url', gm.thumbnail_url,
           'order_index', gm.order_index,
           'uploaded_at', gm.uploaded_at,
           'edited_at', gm.edited_at
         ) ORDER BY gm.order_index ASC) AS media
         FROM gist_media gm WHERE gm.gist_id = g.gist_id
       ) m ON TRUE
       WHERE g.created_at < (SELECT created_at FROM gists WHERE gist_id = $1)
         AND (g.gist_status = 'APPROVED' OR ($3::text IS NOT NULL AND g.avitag = $3::text))
       ORDER BY g.created_at DESC
       LIMIT $2`,
      [cursor, limit, viewerAvitag ?? null]
    );
    return rows;
  }
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     WHERE (g.gist_status = 'APPROVED' OR ($1::text IS NOT NULL AND g.avitag = $1::text))
     ORDER BY g.created_at DESC LIMIT $2`,
    [viewerAvitag ?? null, limit]
  );
  return rows;
}

export async function listByUser(
  avitag: string,
  limit = 20,
  cursor?: string,
  viewerAvitag?: string
): Promise<GistWithCounts[]> {
  if (cursor) {
    const { rows } = await pool.query<GistWithCounts>(
      `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
              COALESCE(m.media, '[]'::json) AS media
       FROM gists g
       LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'media_id', gm.media_id,
           'media_type', gm.media_type,
           'media_url', gm.media_url,
           'thumbnail_url', gm.thumbnail_url,
           'order_index', gm.order_index,
           'uploaded_at', gm.uploaded_at,
           'edited_at', gm.edited_at
         ) ORDER BY gm.order_index ASC) AS media
         FROM gist_media gm WHERE gm.gist_id = g.gist_id
       ) m ON TRUE
       WHERE g.avitag = $1 AND g.created_at < (SELECT created_at FROM gists WHERE gist_id = $2)
         AND (g.gist_status = 'APPROVED' OR ($4::text IS NOT NULL AND g.avitag = $4::text))
       ORDER BY g.created_at DESC LIMIT $3`,
      [avitag, cursor, limit, viewerAvitag ?? null]
    );
    return rows;
  }
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     WHERE g.avitag = $1 AND (g.gist_status = 'APPROVED' OR ($3::text IS NOT NULL AND g.avitag = $3::text))
     ORDER BY g.created_at DESC LIMIT $2`,
    [avitag, limit, viewerAvitag ?? null]
  );
  return rows;
}

export async function trending(limit = 20, viewerAvitag?: string): Promise<
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
            t.score, t.reactions_3d, t.comments_3d,
            COALESCE(m.media, '[]'::json) AS media
     FROM v_gist_trending_3d t
     JOIN gists g ON g.gist_id = t.gist_id
     LEFT JOIN v_gist_counts counts ON counts.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     WHERE (g.gist_status = 'APPROVED' OR ($1::text IS NOT NULL AND g.avitag = $1::text))
     ORDER BY t.score DESC
     LIMIT $2`,
    [viewerAvitag ?? null, limit]
  );
  return rows;
}

export async function search(
  term: string,
  limit = 20,
  offset = 0,
  viewerAvitag?: string
): Promise<GistWithCounts[]> {
  const q = `%${term}%`;
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     WHERE (g.gist_status = 'APPROVED' OR ($4 IS NOT NULL AND g.avitag = $4)) AND g.gist_text ILIKE $1
     ORDER BY g.created_at DESC
     LIMIT $2 OFFSET $3`,
    [q, limit, offset, viewerAvitag ?? null]
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

// Moderation helpers (used by idiot routes)
export async function approveGist(gist_id: string): Promise<GistRow | null> {
  const { rows } = await pool.query<GistRow>(
    `UPDATE gists SET gist_status = 'APPROVED', edited_at = NOW() WHERE gist_id = $1 RETURNING *`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function rejectGist(gist_id: string): Promise<GistRow | null> {
  const { rows } = await pool.query<GistRow>(
    `UPDATE gists SET gist_status = 'REJECTED', edited_at = NOW() WHERE gist_id = $1 RETURNING *`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function listPendingGists(
  limit = 20,
  offset = 0
): Promise<GistRow[]> {
  const { rows } = await pool.query<GistRow>(
    `SELECT * FROM gists WHERE gist_status = 'SUBMITTED' ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}
