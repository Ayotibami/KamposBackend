import { pool } from '../../config/db';

export interface OTPCode {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  created_at: string;
}

export async function createOTP(email: string, code: string, ttlSeconds = 600): Promise<OTPCode> {
  const { rows } = await pool.query<OTPCode>(
    `INSERT INTO otp_codes (email, code, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)
     RETURNING *`,
    [email.toLowerCase(), code, String(ttlSeconds)]
  );
  return rows[0];
}

export async function findValidOTP(email: string, code: string): Promise<OTPCode | null> {
  const { rows } = await pool.query<OTPCode>(
    `SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
    [email.toLowerCase(), code]
  );
  return rows[0] ?? null;
}

export async function deleteOTP(id: string): Promise<void> {
  await pool.query(`DELETE FROM otp_codes WHERE id = $1`, [id]);
}
