"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.listByEvent = listByEvent;
exports.listByStudent = listByStudent;
exports.unregister = unregister;
const db_1 = require("../../config/db");
async function register(event_id, student_avi_tag) {
    const { rows } = await db_1.pool.query(`INSERT INTO event_registrations (event_id, student_avi_tag) VALUES ($1,$2) RETURNING *`, [event_id, student_avi_tag]);
    return rows[0];
}
async function listByEvent(event_id) {
    const { rows } = await db_1.pool.query(`SELECT * FROM event_registrations WHERE event_id = $1 ORDER BY registered_at DESC`, [event_id]);
    return rows;
}
async function listByStudent(avi_tag) {
    const { rows } = await db_1.pool.query(`SELECT * FROM event_registrations WHERE student_avi_tag = $1 ORDER BY registered_at DESC`, [avi_tag]);
    return rows;
}
async function unregister(id) {
    const { rowCount } = await db_1.pool.query(`DELETE FROM event_registrations WHERE id = $1`, [id]);
    return (rowCount || 0) > 0;
}
