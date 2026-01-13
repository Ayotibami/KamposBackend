"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOTP = createOTP;
exports.findValidOTP = findValidOTP;
exports.deleteOTP = deleteOTP;
const db_1 = require("../../config/db");
async function createOTP(email, code, ttlSeconds = 600) {
    const { rows } = await db_1.pool.query(`INSERT INTO otp_codes (email, code, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)
     RETURNING *`, [email.toLowerCase(), code, String(ttlSeconds)]);
    return rows[0];
}
async function findValidOTP(email, code) {
    const { rows } = await db_1.pool.query(`SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`, [email.toLowerCase(), code]);
    return rows[0] ?? null;
}
async function deleteOTP(id) {
    await db_1.pool.query(`DELETE FROM otp_codes WHERE id = $1`, [id]);
}
