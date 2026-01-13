import { pool } from '../../../config/db';
export async function create(p) {
    const { rows } = await pool.query(`INSERT INTO kompany_profiles (
       avitag, account_id, display_name, email, phone_number, image_url, website, social_links, description
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`, [
        p.avitag,
        p.account_id,
        p.display_name,
        p.email,
        p.phone_number,
        p.image_url,
        p.website,
        p.social_links ?? null,
        p.description ?? null,
    ]);
    return rows[0];
}
export async function findByAvitag(avitag) {
    const { rows } = await pool.query(`SELECT * FROM kompany_profiles WHERE avitag = $1`, [avitag]);
    return rows[0] ?? null;
}
export async function listVerifiedActive(limit = 20, offset = 0) {
    const { rows } = await pool.query(`SELECT * FROM kompany_profiles WHERE is_verified = TRUE AND profile_status = 'ACTIVE'
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    return rows;
}
export async function listActive(limit = 20, offset = 0) {
    const { rows } = await pool.query(`SELECT * FROM kompany_profiles WHERE profile_status = 'ACTIVE'
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
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
    const { rows } = await pool.query(`UPDATE kompany_profiles SET ${fields.join(', ')} WHERE avitag = $${i++} AND account_id = $${i} RETURNING *`, vals);
    return rows[0] ?? null;
}
export async function setVerified(avitag, verified) {
    const { rowCount } = await pool.query(`UPDATE kompany_profiles SET is_verified = $1, updated_at = NOW() WHERE avitag = $2`, [verified, avitag]);
    return (rowCount || 0) > 0;
}
export async function remove(avitag) {
    const { rowCount } = await pool.query(`DELETE FROM kompany_profiles WHERE avitag = $1`, [avitag]);
    return (rowCount || 0) > 0;
}
