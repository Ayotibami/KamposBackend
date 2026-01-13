import { pool } from '../../config/db';
export async function createOTP(email, code, ttlSeconds = 600) {
    const { rows } = await pool.query(`INSERT INTO otp_codes (email, code, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)
     RETURNING *`, [email.toLowerCase(), code, String(ttlSeconds)]);
    return rows[0];
}
export async function findValidOTP(email, code) {
    const { rows } = await pool.query(`SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`, [email.toLowerCase(), code]);
    return rows[0] ?? null;
}
export async function deleteOTP(id) {
    await pool.query(`DELETE FROM otp_codes WHERE id = $1`, [id]);
}
