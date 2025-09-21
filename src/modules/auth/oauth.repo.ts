import { pool } from '../../config/db';

export type OAuthProvider = 'GOOGLE' | 'FACEBOOK' | 'APPLE';

export interface OAuthSessionRow {
  session_id: string;
  account_id: string;
  auth_provider: OAuthProvider;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createOrUpdateSession(params: {
  account_id: string;
  auth_provider: OAuthProvider;
  encrypted_refresh_token?: string | null;
  token_expires_at?: Date | string | null;
}): Promise<OAuthSessionRow> {
  const { rows } = await pool.query<OAuthSessionRow>(
    `INSERT INTO oauth_sessions (account_id, auth_provider, encrypted_refresh_token, token_expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id, auth_provider)
     DO UPDATE SET encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
                   token_expires_at = EXCLUDED.token_expires_at,
                   updated_at = NOW()
     RETURNING *`,
    [
      params.account_id,
      params.auth_provider,
      params.encrypted_refresh_token ?? null,
      params.token_expires_at ?? null,
    ]
  );
  return rows[0];
}

export async function getSessionsByAccount(account_id: string): Promise<OAuthSessionRow[]> {
  const { rows } = await pool.query<OAuthSessionRow>(
    `SELECT * FROM oauth_sessions WHERE account_id = $1 ORDER BY updated_at DESC`,
    [account_id]
  );
  return rows;
}
