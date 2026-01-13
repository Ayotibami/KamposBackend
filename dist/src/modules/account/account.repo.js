import { pool } from '../../config/db';
export async function createAccountEmail(email, password_hash) {
    const { rows } = await pool.query(`INSERT INTO accounts (email, password_hash, auth_provider)
     VALUES (LOWER($1), $2, 'EMAIL') RETURNING *`, [email, password_hash]);
    return rows[0];
}
export async function findAccountByEmail(email) {
    const { rows } = await pool.query(`SELECT * FROM accounts WHERE email = LOWER($1)`, [email]);
    return rows[0] ?? null;
}
export async function findAccountById(account_id) {
    const { rows } = await pool.query(`SELECT * FROM accounts WHERE account_id = $1`, [account_id]);
    return rows[0] ?? null;
}
export async function updateLastLogin(account_id) {
    await pool.query(`UPDATE accounts SET last_login = NOW(), updated_at = NOW() WHERE account_id = $1`, [account_id]);
}
export async function softDeleteAccount(account_id) {
    await pool.query(`UPDATE accounts SET account_status = 'DELETED', updated_at = NOW() WHERE account_id = $1`, [account_id]);
}
export async function markOtpVerified(account_id) {
    await pool.query(`UPDATE accounts SET is_otp_verified = TRUE, updated_at = NOW() WHERE account_id = $1`, [account_id]);
}
export async function updatePasswordHash(account_id, password_hash) {
    await pool.query(`UPDATE accounts SET password_hash = $2, updated_at = NOW() WHERE account_id = $1`, [account_id, password_hash]);
}
export async function updateEmail(account_id, email) {
    await pool.query(`UPDATE accounts SET email = LOWER($2), is_otp_verified = FALSE, updated_at = NOW() WHERE account_id = $1`, [account_id, email]);
}
export async function findAccountByOauth(oauth_id) {
    const { rows } = await pool.query(`SELECT * FROM accounts WHERE oauth_id = $1`, [oauth_id]);
    return rows[0] ?? null;
}
export async function createAccountOAuth(email, provider, oauth_id) {
    const { rows } = await pool.query(`INSERT INTO accounts (email, auth_provider, oauth_id, is_otp_verified)
     VALUES (LOWER($1), $2, $3, TRUE)
     ON CONFLICT (oauth_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`, [email, provider, oauth_id]);
    return rows[0];
}
export async function linkOauthToAccount(account_id, provider, oauth_id) {
    await pool.query(`UPDATE accounts SET auth_provider = $2, oauth_id = $3, updated_at = NOW() WHERE account_id = $1`, [account_id, provider, oauth_id]);
}
export async function touchUpdatedAt(account_id) {
    await pool.query(`UPDATE accounts SET updated_at = NOW() WHERE account_id = $1`, [account_id]);
}
