import { pool } from '../../config/db';
export async function register(event_id, student_avi_tag) {
    const { rows } = await pool.query(`INSERT INTO event_registrations (event_id, student_avi_tag) VALUES ($1,$2) RETURNING *`, [event_id, student_avi_tag]);
    return rows[0];
}
export async function listByEvent(event_id) {
    const { rows } = await pool.query(`SELECT * FROM event_registrations WHERE event_id = $1 ORDER BY registered_at DESC`, [event_id]);
    return rows;
}
export async function listByStudent(avi_tag) {
    const { rows } = await pool.query(`SELECT * FROM event_registrations WHERE student_avi_tag = $1 ORDER BY registered_at DESC`, [avi_tag]);
    return rows;
}
export async function unregister(id) {
    const { rowCount } = await pool.query(`DELETE FROM event_registrations WHERE id = $1`, [id]);
    return (rowCount || 0) > 0;
}
