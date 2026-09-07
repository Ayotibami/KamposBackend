import { pool } from '../../config/db';

export interface Account {
  account_id: string;
  email: string;
  password_hash: string | null;
  auth_provider: 'EMAIL' | 'GOOGLE' | 'FACEBOOK' | 'APPLE';
  is_otp_verified: boolean;
  account_status: 'ACTIVE' | 'DEACTIVATED' | 'SUSPENDED' | 'DELETED';
  /** Set on suspend/ban-style admin actions (and left null for self-service
   * deactivate/delete, which don't need a "why" the way an admin action
   * does) — quoted back to the account owner in the login-blocked message. */
  account_status_reason: string | null;
  account_status_changed_at: string | null;
  oauth_id: string | null;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  role: 'user' | 'idiot' | 'king';
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

/**
 * Single setter for every non-ACTIVE account_status (DEACTIVATED,
 * SUSPENDED, DELETED) — self-service and admin-triggered actions alike all
 * go through this, since they're mechanically identical writes (just the
 * target status and whether a reason is present differ). Reactivating
 * (back to ACTIVE) is deliberately a SEPARATE function below, not a valid
 * `status` here — that transition also needs to clear the reason, and
 * self-reactivate has its own extra precondition (must currently be
 * DEACTIVATED) that doesn't belong in this generic setter.
 */
export async function setAccountStatus(
  account_id: string,
  status: 'DEACTIVATED' | 'SUSPENDED' | 'DELETED',
  reason: string | null = null,
): Promise<void> {
  await pool.query(
    `UPDATE accounts
     SET account_status = $2, account_status_reason = $3, account_status_changed_at = NOW(), updated_at = NOW()
     WHERE account_id = $1`,
    [account_id, status, reason],
  );
}

/** Admin unsuspending an account — the one ACTIVE-bound transition besides
 * self-reactivate, kept separate from it since this one has no credential
 * check of its own (the caller is already an authenticated admin). */
export async function unsuspendAccount(account_id: string): Promise<void> {
  await pool.query(
    `UPDATE accounts
     SET account_status = 'ACTIVE', account_status_reason = NULL, account_status_changed_at = NOW(), updated_at = NOW()
     WHERE account_id = $1`,
    [account_id],
  );
}

/** The self-service "turn my account back on" transition — see
 * AuthService.reactivate, which is the only caller (it already verified
 * the account is currently DEACTIVATED before calling this). */
export async function reactivateAccount(account_id: string): Promise<void> {
  await pool.query(
    `UPDATE accounts
     SET account_status = 'ACTIVE', account_status_reason = NULL, account_status_changed_at = NOW(), updated_at = NOW()
     WHERE account_id = $1`,
    [account_id],
  );
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

export async function updateAccountRole(account_id: string, role: 'user' | 'idiot' | 'king'): Promise<void> {
  await pool.query(`UPDATE accounts SET role = $1, updated_at = NOW() WHERE account_id = $2`, [role, account_id]);
}

export async function listAdminAccounts(): Promise<PublicAccount[]> {
  const { rows } = await pool.query<Account>(
    `SELECT * FROM accounts WHERE role IN ('idiot','king') ORDER BY created_at ASC`
  );
  return rows.map(toPublicAccount);
}

export type PublicAccount = Omit<Account, 'password_hash'>;

/** Strips password_hash before an Account ever leaves the server in a
 * response — internal auth logic (login/changePassword) needs the hash and
 * reads it straight from the repo functions above, but nothing sent back
 * to a client should ever include it, hashed or not. */
export function toPublicAccount(account: Account): PublicAccount {
  const { password_hash: _password_hash, ...rest } = account;
  return rest;
}
