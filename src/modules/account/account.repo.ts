import { pool } from '../../config/db';

export interface Account {
  account_id: string;
  email: string;
  password_hash: string | null;
  auth_provider: 'EMAIL' | 'GOOGLE' | 'FACEBOOK' | 'APPLE';
  is_otp_verified: boolean;
  account_status: 'ACTIVE' | 'DELETED' | 'SUSPENDED';
  oauth_id: string | null;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export async function createAccountEmail(email: string, password_hash: string): Promise<Account> {
  const { rows } = await pool.query<Account>(
    `INSERT INTO accounts (email, password_hash, auth_provider)
     VALUES (LOWER($1), $2, 'EMAIL') RETURNING *`,
    [email, password_hash]
  );
  return rows[0];
}

export async function findAccountByEmail(email: string): Promise<Account | null> {
  const { rows } = await pool.query<Account>(
    `SELECT * FROM accounts WHERE email = LOWER($1)`,
    [email]
  );
  return rows[0] ?? null;
}

export async function findAccountById(account_id: string): Promise<Account | null> {
  const { rows } = await pool.query<Account>(
    `SELECT * FROM accounts WHERE account_id = $1`,
    [account_id]
  );
  return rows[0] ?? null;
}

export async function updateLastLogin(account_id: string): Promise<void> {
  await pool.query(`UPDATE accounts SET last_login = NOW(), updated_at = NOW() WHERE account_id = $1`, [account_id]);
}

export async function softDeleteAccount(account_id: string): Promise<void> {
  await pool.query(`UPDATE accounts SET account_status = 'DELETED', updated_at = NOW() WHERE account_id = $1`, [account_id]);
}

export async function markOtpVerified(account_id: string): Promise<void> {
  await pool.query(`UPDATE accounts SET is_otp_verified = TRUE, updated_at = NOW() WHERE account_id = $1`, [account_id]);
}

export async function updatePasswordHash(account_id: string, password_hash: string): Promise<void> {
  await pool.query(`UPDATE accounts SET password_hash = $2, updated_at = NOW() WHERE account_id = $1`, [account_id, password_hash]);
}

export async function updateEmail(account_id: string, email: string): Promise<void> {
  await pool.query(`UPDATE accounts SET email = LOWER($2), is_otp_verified = FALSE, updated_at = NOW() WHERE account_id = $1`, [account_id, email]);
}

export async function findAccountByOauth(oauth_id: string): Promise<Account | null> {
  const { rows } = await pool.query<Account>(
    `SELECT * FROM accounts WHERE oauth_id = $1`,
    [oauth_id]
  );
  return rows[0] ?? null;
}

export async function createAccountOAuth(email: string | null, provider: 'GOOGLE' | 'FACEBOOK' | 'APPLE', oauth_id: string): Promise<Account> {
  const { rows } = await pool.query<Account>(
    `INSERT INTO accounts (email, auth_provider, oauth_id, is_otp_verified)
     VALUES (LOWER($1), $2, $3, TRUE)
     ON CONFLICT (oauth_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [email, provider, oauth_id]
  );
  return rows[0];
}

export async function linkOauthToAccount(account_id: string, provider: 'GOOGLE'|'FACEBOOK'|'APPLE', oauth_id: string): Promise<void> {
  await pool.query(`UPDATE accounts SET auth_provider = $2, oauth_id = $3, updated_at = NOW() WHERE account_id = $1`, [account_id, provider, oauth_id]);
}

export async function touchUpdatedAt(account_id: string): Promise<void> {
  await pool.query(`UPDATE accounts SET updated_at = NOW() WHERE account_id = $1`, [account_id]);
}
