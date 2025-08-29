import pool from "../../config/connectDB";
import type { IReaction, ReactionEntityType } from "./reaction.interface";

const mapRow = (r: any): IReaction => ({
  reactionId: r.reaction_id,
  avitag: r.avitag,
  entityType: r.entity_type,
  entityId: r.entity_id,
  type: r.type,
  createdAt: r.created_at,
});

export const createReaction = async (
  reaction: Partial<IReaction>
): Promise<IReaction> => {
  const { rows } = await pool.query(
    `INSERT INTO reactions (avitag, entity_type, entity_id, type)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [reaction.avitag, reaction.entityType, reaction.entityId, reaction.type]
  );
  return mapRow(rows[0]);
};

export const findReactionById = async (
  reactionId: string
): Promise<IReaction | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM reactions WHERE reaction_id = $1`,
    [reactionId]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findReactionsByEntity = async (
  entityType: ReactionEntityType,
  entityId: string
): Promise<IReaction[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM reactions WHERE entity_type = $1 AND entity_id = $2`,
    [entityType, entityId]
  );
  return rows.map(mapRow);
};

export const findReactionsByUser = async (
  avitag: string
): Promise<IReaction[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM reactions WHERE avitag = $1 ORDER BY created_at DESC`,
    [avitag]
  );
  return rows.map(mapRow);
};

export const deleteByEntityAndUser = async (
  entityType: ReactionEntityType,
  entityId: string,
  avitag: string
): Promise<number> => {
  const { rowCount } = await pool.query(
    `DELETE FROM reactions WHERE entity_type = $1 AND entity_id = $2 AND avitag = $3`,
    [entityType, entityId, avitag]
  );
  return rowCount || 0;
};

export const deleteReactionById = async (reactionId: string): Promise<void> => {
  await pool.query(`DELETE FROM reactions WHERE reaction_id = $1`, [
    reactionId,
  ]);
};
