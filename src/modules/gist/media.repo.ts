import { pool } from '../../config/db';

export type MediaType = 'IMAGE' | 'VIDEO';

export interface GistMediaRow {
  media_id: string;
  gist_id: string;
  order_index: number;
  media_type: MediaType;
  media_url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  public_id: string | null;
  uploaded_at: string;
  edited_at: string | null;
}

export async function addMedia(params: {
  gist_id: string;
  media_type: MediaType;
  media_url: string;
  thumbnail_url?: string | null;
  /** Cloudinary reports these on every successful upload (both images and
   * videos) — passed straight through so the frontend can size a tile
   * correctly on first paint instead of guessing/measuring client-side.
   * Null for media that never went through Cloudinary (e.g. a GIF/sticker
   * attached by URL) — the frontend falls back to its own measurement. */
  width?: number | null;
  height?: number | null;
  order_index?: number;
  public_id?: string | null;
}): Promise<GistMediaRow> {
  const { rows } = await pool.query<GistMediaRow>(
    `INSERT INTO gist_media (gist_id, media_type, media_url, thumbnail_url, width, height, order_index, public_id)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, (
       SELECT COALESCE(MAX(order_index)+1, 0) FROM gist_media WHERE gist_id = $1
     )), $8)
     RETURNING *`,
    [
      params.gist_id,
      params.media_type,
      params.media_url,
      params.thumbnail_url ?? null,
      params.width ?? null,
      params.height ?? null,
      params.order_index ?? null,
      params.public_id ?? null,
    ]
  );
  return rows[0];
}

export async function listByGist(gist_id: string): Promise<GistMediaRow[]> {
  const { rows } = await pool.query<GistMediaRow>(
    `SELECT * FROM gist_media WHERE gist_id = $1 ORDER BY order_index ASC`,
    [gist_id]
  );
  return rows;
}

export async function updateMedia(media_id: string, updates: Partial<Pick<GistMediaRow, 'order_index'|'thumbnail_url'|'media_url'>>): Promise<GistMediaRow | null> {
  const fields: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      fields.push(`${k} = $${i++}`);
      vals.push(v);
    }
  }
  if (!fields.length) return get(media_id);
  fields.push('edited_at = NOW()');
  vals.push(media_id);
  const { rows } = await pool.query<GistMediaRow>(
    `UPDATE gist_media SET ${fields.join(', ')} WHERE media_id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function remove(media_id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM gist_media WHERE media_id = $1`, [media_id]);
  return (rowCount || 0) > 0;
}

export async function get(media_id: string): Promise<GistMediaRow | null> {
  const { rows } = await pool.query<GistMediaRow>(`SELECT * FROM gist_media WHERE media_id = $1`, [media_id]);
  return rows[0] ?? null;
}

export async function reorderMedia(gist_id: string, media_ids: string[]): Promise<GistMediaRow[]> {
  // Update order_index for the provided media_ids sequence, ensuring they belong to the gist
  // Use a transaction for atomicity
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let idx = 0;
    for (const id of media_ids) {
      await client.query(
        `UPDATE gist_media SET order_index = $1, edited_at = NOW() WHERE media_id = $2 AND gist_id = $3`,
        [idx++, id, gist_id]
      );
    }
    const { rows } = await client.query<GistMediaRow>(
      `SELECT * FROM gist_media WHERE gist_id = $1 ORDER BY order_index ASC`,
      [gist_id]
    );
    await client.query('COMMIT');
    return rows;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
