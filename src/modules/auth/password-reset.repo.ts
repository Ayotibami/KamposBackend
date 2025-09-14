import { pool } from '../../config/db';

export interface PasswordResetToken {
  token: string;
  account_id: string;
  expires_at: string;
  created_at: string;
}

export async function createResetToken(account_id: string, ttlSeconds = 3600): Promise<PasswordResetToken> {
  const { rows } = await pool.query<PasswordResetToken>(
    `INSERT INTO password_reset_tokens (account_id, expires_at)
     VALUES ($1, NOW() + ($2 || ' seconds')::interval)
     RETURNING *`,
    [account_id, String(ttlSeconds)]
  );
  return rows[0];
}

export async function findValidToken(token: string): Promise<PasswordResetToken | null> {
  const { rows } = await pool.query<PasswordResetToken>(
    `SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );
  return rows[0] ?? null;
}

export async function consumeToken(token: string): Promise<void> {
  await pool.query(`DELETE FROM password_reset_tokens WHERE token = $1`, [token]);
}
