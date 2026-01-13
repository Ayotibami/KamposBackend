"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsert = upsert;
exports.listByEntity = listByEntity;
exports.listByUser = listByUser;
exports.removeById = removeById;
exports.removeByComposite = removeByComposite;
const db_1 = require("../../config/db");
async function upsert(params) {
    const { rows } = await db_1.pool.query(`INSERT INTO reactions (avitag, entity_type, entity_id, type)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (entity_type, entity_id, avitag)
     DO UPDATE SET type = EXCLUDED.type
     RETURNING *`, [params.avitag, params.entity_type, params.entity_id, params.type]);
    return rows[0];
}
async function listByEntity(entity_type, entity_id) {
    const { rows } = await db_1.pool.query(`SELECT * FROM reactions WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`, [entity_type, entity_id]);
    return rows;
}
async function listByUser(avitag) {
    const { rows } = await db_1.pool.query(`SELECT * FROM reactions WHERE avitag = $1 ORDER BY created_at DESC`, [avitag]);
    return rows;
}
async function removeById(reaction_id) {
    const { rowCount } = await db_1.pool.query(`DELETE FROM reactions WHERE reaction_id = $1`, [reaction_id]);
    return (rowCount || 0) > 0;
}
async function removeByComposite(entity_type, entity_id, avitag) {
    const { rowCount } = await db_1.pool.query(`DELETE FROM reactions WHERE entity_type = $1 AND entity_id = $2 AND avitag = $3`, [entity_type, entity_id, avitag]);
    return (rowCount || 0) > 0;
}
