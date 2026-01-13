import { pool } from '../../config/db';
export async function create(params) {
    const { rows } = await pool.query(`INSERT INTO comments (gist_id, avitag, text) VALUES ($1, $2, $3) RETURNING *`, [params.gist_id, params.avitag, params.text]);
    return rows[0];
}
export async function get(comment_id) {
    const { rows } = await pool.query(`SELECT * FROM comments WHERE comment_id = $1`, [comment_id]);
    return rows[0] ?? null;
}
export async function listByGist(gist_id, limit = 20, cursor) {
    if (cursor) {
        const { rows } = await pool.query(`SELECT * FROM comments WHERE gist_id = $1 AND commented_at < (SELECT commented_at FROM comments WHERE comment_id = $2)
       ORDER BY commented_at DESC LIMIT $3`, [gist_id, cursor, limit]);
        return rows;
    }
    const { rows } = await pool.query(`SELECT * FROM comments WHERE gist_id = $1 ORDER BY commented_at DESC LIMIT $2`, [gist_id, limit]);
    return rows;
}
export async function listByUser(avitag, limit = 20, cursor) {
    if (cursor) {
        const { rows } = await pool.query(`SELECT * FROM comments WHERE avitag = $1 AND commented_at < (SELECT commented_at FROM comments WHERE comment_id = $2)
       ORDER BY commented_at DESC LIMIT $3`, [avitag, cursor, limit]);
        return rows;
    }
    const { rows } = await pool.query(`SELECT * FROM comments WHERE avitag = $1 ORDER BY commented_at DESC LIMIT $2`, [avitag, limit]);
    return rows;
}
export async function update(comment_id, avitag, text) {
    const { rows } = await pool.query(`UPDATE comments SET text = $1, edited_at = NOW(), edit_count = edit_count + 1
     WHERE comment_id = $2 AND avitag = $3 RETURNING *`, [text, comment_id, avitag]);
    return rows[0] ?? null;
}
export async function remove(comment_id, avitag) {
    const { rowCount } = await pool.query(`DELETE FROM comments WHERE comment_id = $1 AND avitag = $2`, [comment_id, avitag]);
    return (rowCount || 0) > 0;
}
export async function removeAsAdmin(comment_id) {
    const { rowCount } = await pool.query(`DELETE FROM comments WHERE comment_id = $1`, [comment_id]);
    return (rowCount || 0) > 0;
}
