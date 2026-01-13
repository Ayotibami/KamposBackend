import { pool } from '../../config/db';
export async function create(ev) {
    const { rows } = await pool.query(`INSERT INTO events (title, host_avi_tags, location, description, event_date, thumbnail_url, campus_tag, major_tag)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [ev.title, ev.host_avi_tags, ev.location, ev.description, ev.event_date, ev.thumbnail_url ?? null, ev.campus_tag ?? null, ev.major_tag ?? null]);
    return rows[0];
}
export async function update(event_id, patch) {
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k} = $${idx++}`);
        values.push(v);
    }
    if (!fields.length)
        return findById(event_id);
    values.push(event_id);
    const { rows } = await pool.query(`UPDATE events SET ${fields.join(', ')}, updated_at = NOW() WHERE event_id = $${idx} RETURNING *`, values);
    return rows[0] ?? null;
}
export async function remove(event_id) {
    const { rowCount } = await pool.query(`DELETE FROM events WHERE event_id = $1`, [event_id]);
    return (rowCount || 0) > 0;
}
export async function list(limit = 20, before) {
    if (before) {
        const { rows } = await pool.query(`SELECT * FROM events WHERE event_date < (SELECT event_date FROM events WHERE event_id = $1)
       ORDER BY event_date DESC LIMIT $2`, [before, limit]);
        return rows;
    }
    const { rows } = await pool.query(`SELECT * FROM events ORDER BY event_date DESC LIMIT $1`, [limit]);
    return rows;
}
export async function findById(event_id) {
    const { rows } = await pool.query(`SELECT * FROM events WHERE event_id = $1`, [event_id]);
    return rows[0] ?? null;
}
export async function incrementView(event_id, avitag) {
    await pool.query(`INSERT INTO event_views (event_id, avitag) VALUES ($1,$2)`, [event_id, avitag]);
}
