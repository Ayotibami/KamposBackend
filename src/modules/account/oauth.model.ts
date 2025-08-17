import pool from "../../config/connectDB";
import crypto from "crypto";

export interface IOAuthSession {
  sessionId?: string;
  accountId: string;
  authProvider: string;
  refreshTokenHash?: string | null;
  tokenExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const createSession = async (session: {
  accountId: string;
  authProvider: string;
  refreshTokenPlain: string | null;
  tokenExpiresAt?: Date | null;
}) => {
  const refreshTokenHash = session.refreshTokenPlain ? hashToken(session.refreshTokenPlain) : null;
  const { rows } = await pool.query(
    `INSERT INTO oauth_sessions (account_id, auth_provider, encrypted_refresh_token, token_expires_at)
     VALUES ($1,$2,$3,$4)
     RETURNING session_id, account_id, auth_provider, encrypted_refresh_token, token_expires_at, created_at, updated_at`,
    [session.accountId, session.authProvider, refreshTokenHash, session.tokenExpiresAt]
  );
  return rows[0];
};

export const findSessionById = async (sessionId: string) => {
  const { rows } = await pool.query(`SELECT * FROM oauth_sessions WHERE session_id = $1 LIMIT 1`, [sessionId]);
  return rows[0] ?? null;
};

export const findSessionByRefreshToken = async (refreshTokenPlain: string) => {
  const hash = hashToken(refreshTokenPlain);
  const { rows } = await pool.query(
    `SELECT * FROM oauth_sessions WHERE encrypted_refresh_token = $1 LIMIT 1`,
    [hash]
  );
  return rows[0] ?? null;
};

export const findSessionsByAccountId = async (accountId: string) => {
  const { rows } = await pool.query(`SELECT * FROM oauth_sessions WHERE account_id = $1`, [accountId]);
  return rows;
};

export const deleteSessionById = async (sessionId: string) => {
  await pool.query(`DELETE FROM oauth_sessions WHERE session_id = $1`, [sessionId]);
};

export const deleteSessionsByAccountId = async (accountId: string) => {
  await pool.query(`DELETE FROM oauth_sessions WHERE account_id = $1`, [accountId]);
};

/**
 * Replace the stored refresh token hash for the given session (used during rotation).
 * newRefreshPlain should be the new plain token (will be hashed before storing).
 */
export const updateSessionHash = async (sessionId: string, newRefreshPlain: string): Promise<void> => {
  const newHash = hashToken(newRefreshPlain);
  await pool.query(
    `UPDATE oauth_sessions SET encrypted_refresh_token = $1, updated_at = now() WHERE session_id = $2`,
    [newHash, sessionId]
  );
};