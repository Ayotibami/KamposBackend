"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAccountEmail = createAccountEmail;
exports.findAccountByEmail = findAccountByEmail;
exports.findAccountById = findAccountById;
exports.updateLastLogin = updateLastLogin;
exports.softDeleteAccount = softDeleteAccount;
exports.markOtpVerified = markOtpVerified;
exports.updatePasswordHash = updatePasswordHash;
exports.updateEmail = updateEmail;
exports.findAccountByOauth = findAccountByOauth;
exports.createAccountOAuth = createAccountOAuth;
exports.linkOauthToAccount = linkOauthToAccount;
exports.touchUpdatedAt = touchUpdatedAt;
const db_1 = require("../../config/db");
async function createAccountEmail(email, password_hash) {
    const { rows } = await db_1.pool.query(`INSERT INTO accounts (email, password_hash, auth_provider)
     VALUES (LOWER($1), $2, 'EMAIL') RETURNING *`, [email, password_hash]);
    return rows[0];
}
async function findAccountByEmail(email) {
    const { rows } = await db_1.pool.query(`SELECT * FROM accounts WHERE email = LOWER($1)`, [email]);
    return rows[0] ?? null;
}
async function findAccountById(account_id) {
    const { rows } = await db_1.pool.query(`SELECT * FROM accounts WHERE account_id = $1`, [account_id]);
    return rows[0] ?? null;
}
async function updateLastLogin(account_id) {
    await db_1.pool.query(`UPDATE accounts SET last_login = NOW(), updated_at = NOW() WHERE account_id = $1`, [account_id]);
}
async function softDeleteAccount(account_id) {
    await db_1.pool.query(`UPDATE accounts SET account_status = 'DELETED', updated_at = NOW() WHERE account_id = $1`, [account_id]);
}
async function markOtpVerified(account_id) {
    await db_1.pool.query(`UPDATE accounts SET is_otp_verified = TRUE, updated_at = NOW() WHERE account_id = $1`, [account_id]);
}
async function updatePasswordHash(account_id, password_hash) {
    await db_1.pool.query(`UPDATE accounts SET password_hash = $2, updated_at = NOW() WHERE account_id = $1`, [account_id, password_hash]);
}
async function updateEmail(account_id, email) {
    await db_1.pool.query(`UPDATE accounts SET email = LOWER($2), is_otp_verified = FALSE, updated_at = NOW() WHERE account_id = $1`, [account_id, email]);
}
async function findAccountByOauth(oauth_id) {
    const { rows } = await db_1.pool.query(`SELECT * FROM accounts WHERE oauth_id = $1`, [oauth_id]);
    return rows[0] ?? null;
}
async function createAccountOAuth(email, provider, oauth_id) {
    const { rows } = await db_1.pool.query(`INSERT INTO accounts (email, auth_provider, oauth_id, is_otp_verified)
     VALUES (LOWER($1), $2, $3, TRUE)
     ON CONFLICT (oauth_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`, [email, provider, oauth_id]);
    return rows[0];
}
async function linkOauthToAccount(account_id, provider, oauth_id) {
    await db_1.pool.query(`UPDATE accounts SET auth_provider = $2, oauth_id = $3, updated_at = NOW() WHERE account_id = $1`, [account_id, provider, oauth_id]);
}
async function touchUpdatedAt(account_id) {
    await db_1.pool.query(`UPDATE accounts SET updated_at = NOW() WHERE account_id = $1`, [account_id]);
}
