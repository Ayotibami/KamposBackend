import { pool } from '../../config/db';
export async function createResetToken(account_id, ttlSeconds = 3600) {
    const { rows } = await pool.query(`INSERT INTO password_reset_tokens (account_id, expires_at)
     VALUES ($1, NOW() + ($2 || ' seconds')::interval)
     RETURNING *`, [account_id, String(ttlSeconds)]);
    return rows[0];
}
export async function findValidToken(token) {
    const { rows } = await pool.query(`SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()`, [token]);
    return rows[0] ?? null;
}
export async function consumeToken(token) {
    await pool.query(`DELETE FROM password_reset_tokens WHERE token = $1`, [token]);
}
