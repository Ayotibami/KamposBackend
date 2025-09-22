import { pool } from '../../config/db';

export type ReactionEntity = 'GIST' | 'COMMENT' | 'EVENT';
export type ReactionType = 'LIKE' | 'LOVE' | 'FIRE' | 'SAD' | 'WOW';

export interface ReactionRow {
  reaction_id: string;
  avitag: string;
  entity_type: ReactionEntity;
  entity_id: string;
  type: ReactionType;
  created_at: string;
}

export async function upsert(params: {
  avitag: string;
  entity_type: ReactionEntity;
  entity_id: string;
  type: ReactionType;
}): Promise<ReactionRow> {
  const { rows } = await pool.query<ReactionRow>(
    `INSERT INTO reactions (avitag, entity_type, entity_id, type)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (entity_type, entity_id, avitag)
     DO UPDATE SET type = EXCLUDED.type
     RETURNING *`,
    [params.avitag, params.entity_type, params.entity_id, params.type]
  );
  return rows[0];
}

export async function listByEntity(entity_type: ReactionEntity, entity_id: string): Promise<ReactionRow[]> {
  const { rows } = await pool.query<ReactionRow>(
    `SELECT * FROM reactions WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
    [entity_type, entity_id]
  );
  return rows;
}

export async function listByUser(avitag: string): Promise<ReactionRow[]> {
  const { rows } = await pool.query<ReactionRow>(
    `SELECT * FROM reactions WHERE avitag = $1 ORDER BY created_at DESC`,
    [avitag]
  );
  return rows;
}

export async function removeById(reaction_id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM reactions WHERE reaction_id = $1`, [reaction_id]);
  return (rowCount || 0) > 0;
}

export async function removeByComposite(entity_type: ReactionEntity, entity_id: string, avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM reactions WHERE entity_type = $1 AND entity_id = $2 AND avitag = $3`,
    [entity_type, entity_id, avitag]
  );
  return (rowCount || 0) > 0;
}
