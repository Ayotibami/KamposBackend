"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
exports.findByAvitag = findByAvitag;
exports.listVerifiedActive = listVerifiedActive;
exports.listActive = listActive;
exports.update = update;
exports.setVerified = setVerified;
exports.remove = remove;
const db_1 = require("../../../config/db");
async function create(p) {
    const { rows } = await db_1.pool.query(`INSERT INTO school_profiles (
       avitag, account_id, display_name, description, campus_tag, image_url, website
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`, [
        p.avitag,
        p.account_id,
        p.display_name,
        p.description ?? null,
        p.campus_tag ?? null,
        p.image_url ?? null,
        p.website ?? null,
    ]);
    return rows[0];
}
async function findByAvitag(avitag) {
    const { rows } = await db_1.pool.query(`SELECT * FROM school_profiles WHERE avitag = $1`, [avitag]);
    return rows[0] ?? null;
}
async function listVerifiedActive(limit = 20, offset = 0) {
    const { rows } = await db_1.pool.query(`SELECT * FROM school_profiles WHERE is_verified = TRUE AND profile_status = 'ACTIVE'
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    return rows;
}
async function listActive(limit = 20, offset = 0) {
    const { rows } = await db_1.pool.query(`SELECT * FROM school_profiles WHERE profile_status = 'ACTIVE'
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    return rows;
}
async function update(avitag, account_id, updates) {
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
    const { rows } = await db_1.pool.query(`UPDATE school_profiles SET ${fields.join(', ')} WHERE avitag = $${i++} AND account_id = $${i} RETURNING *`, vals);
    return rows[0] ?? null;
}
async function setVerified(avitag, verified) {
    const { rowCount } = await db_1.pool.query(`UPDATE school_profiles SET is_verified = $1, updated_at = NOW() WHERE avitag = $2`, [verified, avitag]);
    return (rowCount || 0) > 0;
}
async function remove(avitag) {
    const { rowCount } = await db_1.pool.query(`DELETE FROM school_profiles WHERE avitag = $1`, [avitag]);
    return (rowCount || 0) > 0;
}
