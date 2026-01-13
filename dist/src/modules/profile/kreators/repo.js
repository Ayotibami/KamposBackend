import { pool } from '../../../config/db';
export async function create(p) {
    const { rows } = await pool.query(`INSERT INTO kreator_profiles (
       avitag, account_id, display_name, campustag, description, image_url
     ) VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`, [
        p.avitag,
        p.account_id,
        p.display_name,
        p.campustag ?? null,
        p.description ?? null,
        p.image_url ?? null,
    ]);
    return rows[0];
}
export async function findByAvitag(avitag) {
    const { rows } = await pool.query(`SELECT * FROM kreator_profiles WHERE avitag = $1`, [avitag]);
    return rows[0] ?? null;
}
export async function listVerifiedActive(limit = 20, offset = 0) {
    const { rows } = await pool.query(`SELECT * FROM kreator_profiles WHERE is_verified = TRUE AND profile_status = 'ACTIVE'
     ORDER BY joined_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    return rows;
}
export async function listActive(limit = 20, offset = 0) {
    const { rows } = await pool.query(`SELECT * FROM kreator_profiles WHERE profile_status = 'ACTIVE'
     ORDER BY joined_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    return rows;
}
export async function update(avitag, account_id, updates) {
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
        return findByAvitag(avitag);
    fields.push('updated_at = NOW()');
    vals.push(avitag, account_id);
    const { rows } = await pool.query(`UPDATE kreator_profiles SET ${fields.join(', ')} WHERE avitag = $${i++} AND account_id = $${i} RETURNING *`, vals);
    return rows[0] ?? null;
}
export async function setVerified(avitag, verified) {
    const { rowCount } = await pool.query(`UPDATE kreator_profiles SET is_verified = $1, updated_at = NOW() WHERE avitag = $2`, [verified, avitag]);
    return (rowCount || 0) > 0;
}
export async function remove(avitag) {
    const { rowCount } = await pool.query(`DELETE FROM kreator_profiles WHERE avitag = $1`, [avitag]);
    return (rowCount || 0) > 0;
}
