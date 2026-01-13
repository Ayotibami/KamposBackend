import { pool } from '../../config/db';
export async function addMedia(params) {
    const { rows } = await pool.query(`INSERT INTO gist_media (gist_id, media_type, media_url, thumbnail_url, order_index, public_id)
     VALUES ($1,$2,$3,$4, COALESCE($5, (
       SELECT COALESCE(MAX(order_index)+1, 0) FROM gist_media WHERE gist_id = $1
     )), $6)
     RETURNING *`, [params.gist_id, params.media_type, params.media_url, params.thumbnail_url ?? null, params.order_index ?? null, params.public_id ?? null]);
    return rows[0];
}
export async function listByGist(gist_id) {
    const { rows } = await pool.query(`SELECT * FROM gist_media WHERE gist_id = $1 ORDER BY order_index ASC`, [gist_id]);
    return rows;
}
export async function updateMedia(media_id, updates) {
    const fields = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) {
            fields.push(`${k} = $${i++}`);
            vals.push(v);
        }
    }
    if (!fields.length)
        return get(media_id);
    fields.push('edited_at = NOW()');
    vals.push(media_id);
    const { rows } = await pool.query(`UPDATE gist_media SET ${fields.join(', ')} WHERE media_id = $${i} RETURNING *`, vals);
    return rows[0] ?? null;
}
export async function remove(media_id) {
    const { rowCount } = await pool.query(`DELETE FROM gist_media WHERE media_id = $1`, [media_id]);
    return (rowCount || 0) > 0;
}
export async function get(media_id) {
    const { rows } = await pool.query(`SELECT * FROM gist_media WHERE media_id = $1`, [media_id]);
    return rows[0] ?? null;
}
export async function reorderMedia(gist_id, media_ids) {
    // Update order_index for the provided media_ids sequence, ensuring they belong to the gist
    // Use a transaction for atomicity
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let idx = 0;
        for (const id of media_ids) {
            await client.query(`UPDATE gist_media SET order_index = $1, edited_at = NOW() WHERE media_id = $2 AND gist_id = $3`, [idx++, id, gist_id]);
        }
        const { rows } = await client.query(`SELECT * FROM gist_media WHERE gist_id = $1 ORDER BY order_index ASC`, [gist_id]);
        await client.query('COMMIT');
        return rows;
    }
    catch (e) {
        try {
            await client.query('ROLLBACK');
        }
        catch { }
        throw e;
    }
    finally {
        client.release();
    }
}
