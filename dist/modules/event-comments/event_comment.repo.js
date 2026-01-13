"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
exports.get = get;
exports.listByEvent = listByEvent;
exports.update = update;
exports.remove = remove;
exports.removeAsAdmin = removeAsAdmin;
const db_1 = require("../../config/db");
async function create(params) {
    const { rows } = await db_1.pool.query(`INSERT INTO event_comments (event_id, avitag, text) VALUES ($1, $2, $3) RETURNING *`, [params.event_id, params.avitag, params.text]);
    return rows[0];
}
async function get(comment_id) {
    const { rows } = await db_1.pool.query(`SELECT * FROM event_comments WHERE comment_id = $1`, [comment_id]);
    return rows[0] ?? null;
}
async function listByEvent(event_id, limit = 20, cursor) {
    if (cursor) {
        const { rows } = await db_1.pool.query(`SELECT * FROM event_comments WHERE event_id = $1 AND commented_at < (SELECT commented_at FROM event_comments WHERE comment_id = $2)
       ORDER BY commented_at DESC LIMIT $3`, [event_id, cursor, limit]);
        return rows;
    }
    const { rows } = await db_1.pool.query(`SELECT * FROM event_comments WHERE event_id = $1 ORDER BY commented_at DESC LIMIT $2`, [event_id, limit]);
    return rows;
}
async function update(comment_id, avitag, text) {
    const { rows } = await db_1.pool.query(`UPDATE event_comments SET text = $1, edited_at = NOW(), edit_count = edit_count + 1
     WHERE comment_id = $2 AND avitag = $3 RETURNING *`, [text, comment_id, avitag]);
    return rows[0] ?? null;
}
async function remove(comment_id, avitag) {
    const { rowCount } = await db_1.pool.query(`DELETE FROM event_comments WHERE comment_id = $1 AND avitag = $2`, [comment_id, avitag]);
    return (rowCount || 0) > 0;
}
async function removeAsAdmin(comment_id) {
    const { rowCount } = await db_1.pool.query(`DELETE FROM event_comments WHERE comment_id = $1`, [comment_id]);
    return (rowCount || 0) > 0;
}
