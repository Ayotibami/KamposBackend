"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResetToken = createResetToken;
exports.findValidToken = findValidToken;
exports.consumeToken = consumeToken;
const db_1 = require("../../config/db");
async function createResetToken(account_id, ttlSeconds = 3600) {
    const { rows } = await db_1.pool.query(`INSERT INTO password_reset_tokens (account_id, expires_at)
     VALUES ($1, NOW() + ($2 || ' seconds')::interval)
     RETURNING *`, [account_id, String(ttlSeconds)]);
    return rows[0];
}
async function findValidToken(token) {
    const { rows } = await db_1.pool.query(`SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()`, [token]);
    return rows[0] ?? null;
}
async function consumeToken(token) {
    await db_1.pool.query(`DELETE FROM password_reset_tokens WHERE token = $1`, [token]);
}
