import pool from "../../config/connectDB";
import type { IMedia } from "./media.interface";

const mapRow = (r: any): IMedia => ({
  mediaId: r.media_id,
  entityType: r.entity_type,
  entityId: r.entity_id,
  mediaType: r.media_type,
  mediaUrl: r.media_url,
  uploadedAt: r.uploaded_at,
  editedAt: r.edited_at,
  thumbnailUrl: r.thumbnail_url,
});

export const createMedia = async (media: Partial<IMedia>): Promise<IMedia> => {
  const { rows } = await pool.query(
    `INSERT INTO media (entity_type, entity_id, media_type, media_url, thumbnail_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      media.entityType,
      media.entityId,
      media.mediaType,
      media.mediaUrl,
      media.thumbnailUrl ?? null,
    ]
  );
  return mapRow(rows[0]);
};

export const findMediaById = async (
  mediaId: string
): Promise<IMedia | null> => {
  const { rows } = await pool.query(`SELECT * FROM media WHERE media_id = $1`, [
    mediaId,
  ]);
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findMediaByEntity = async (
  entityType: MediaEntityType,
  entityId: string
): Promise<IMedia[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM media WHERE entity_type = $1 AND entity_id = $2`,
    [entityType, entityId]
  );
  return rows.map(mapRow);
};

export const updateMediaById = async (
  mediaId: string,
  updates: Partial<IMedia>
): Promise<IMedia | null> => {
  const set: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  if (updates.mediaUrl) {
    set.push(`media_url = $${idx++}`);
    vals.push(updates.mediaUrl);
  }
  if (updates.thumbnailUrl !== undefined) {
    set.push(`thumbnail_url = $${idx++}`);
    vals.push(updates.thumbnailUrl);
  }
  if (set.length === 0) return findMediaById(mediaId);
  vals.push(mediaId);
  const { rows } = await pool.query(
    `UPDATE media SET ${set.join(
      ", "
    )}, edited_at = NOW() WHERE media_id = $${idx} RETURNING *`,
    vals
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const deleteMediaById = async (mediaId: string): Promise<void> => {
  await pool.query(`DELETE FROM media WHERE media_id = $1`, [mediaId]);
};
