"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrUpdateSession = createOrUpdateSession;
exports.getSessionsByAccount = getSessionsByAccount;
const db_1 = require("../../config/db");
async function createOrUpdateSession(params) {
    const { rows } = await db_1.pool.query(`INSERT INTO oauth_sessions (account_id, auth_provider, encrypted_refresh_token, token_expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id, auth_provider)
     DO UPDATE SET encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
                   token_expires_at = EXCLUDED.token_expires_at,
                   updated_at = NOW()
     RETURNING *`, [
        params.account_id,
        params.auth_provider,
        params.encrypted_refresh_token ?? null,
        params.token_expires_at ?? null,
    ]);
    return rows[0];
}
async function getSessionsByAccount(account_id) {
    const { rows } = await db_1.pool.query(`SELECT * FROM oauth_sessions WHERE account_id = $1 ORDER BY updated_at DESC`, [account_id]);
    return rows;
}
