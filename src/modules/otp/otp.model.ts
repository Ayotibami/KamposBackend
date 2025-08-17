import pool from "../../config/connectDB";

export interface IOTP {
  id?: number;
  email: string;
  otp: string;
  createdAt?: string;
}

export const createOTP = async (email: string, otp: string) => {
  const { rows } = await pool.query(
    `INSERT INTO otps (email, otp) VALUES ($1, $2) RETURNING id, email, otp, created_at AS "createdAt"`,
    [email, otp]
  );
  return rows[0] as IOTP;
};

export const findOTPByEmail = async (email: string) => {
  const { rows } = await pool.query(
    `SELECT id, email, otp, created_at AS "createdAt" FROM otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  return rows[0] as IOTP | undefined;
};

export const deleteOTPById = async (id: number) => {
  await pool.query(`DELETE FROM otps WHERE id = $1`, [id]);
};
