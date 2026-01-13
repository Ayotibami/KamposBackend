"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
exports.findByAvitag = findByAvitag;
exports.listActive = listActive;
exports.update = update;
exports.setVerified = setVerified;
exports.remove = remove;
const db_1 = require("../../../config/db");
async function create(p) {
    const { rows } = await db_1.pool.query(`INSERT INTO student_profiles (
       avitag, account_id, first_name, last_name, display_name, campus_tag, major_tag, level,
       bio, hobbies, degree, image_url
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`, [
        p.avitag,
        p.account_id,
        p.first_name,
        p.last_name,
        p.display_name ?? null,
        p.campus_tag ?? null,
        p.major_tag ?? null,
        p.level ?? null,
        p.bio ?? null,
        p.hobbies ?? null,
        p.degree ?? null,
        p.image_url ?? null,
    ]);
    return rows[0];
}
async function findByAvitag(avitag) {
    const { rows } = await db_1.pool.query(`SELECT * FROM student_profiles WHERE avitag = $1`, [avitag]);
    return rows[0] ?? null;
}
async function listActive(limit = 20, offset = 0) {
    const { rows } = await db_1.pool.query(`SELECT * FROM student_profiles
     WHERE profile_status = 'ACTIVE'
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`, [limit, offset]);
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
    const { rows } = await db_1.pool.query(`UPDATE student_profiles SET ${fields.join(', ')} WHERE avitag = $${i++} AND account_id = $${i} RETURNING *`, vals);
    return rows[0] ?? null;
}
async function setVerified(avitag, verified) {
    const { rowCount } = await db_1.pool.query(`UPDATE student_profiles SET is_verified = $1, updated_at = NOW() WHERE avitag = $2`, [verified, avitag]);
    return (rowCount || 0) > 0;
}
async function remove(avitag) {
    const { rowCount } = await db_1.pool.query(`DELETE FROM student_profiles WHERE avitag = $1`, [avitag]);
    return (rowCount || 0) > 0;
}
