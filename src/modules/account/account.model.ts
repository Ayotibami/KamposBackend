import pool from "../../config/connectDB";
import type { IAccount } from "./account.interface";

const mapRow = (r: any): IAccount => ({
  accountId: r.account_id,
  email: r.email,
  passwordHash: r.password_hash,
  authProvider: r.auth_provider,
  isOtpVerified: r.is_otp_verified,
  accountStatus: r.account_status,
  oauthId: r.oauth_id,
  lastLogin: r.last_login,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const createAccount = async (a: Partial<IAccount>): Promise<IAccount> => {
  const { rows } = await pool.query(
    `INSERT INTO accounts
     (email, password_hash, auth_provider, is_otp_verified, account_status, oauth_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [a.email, a.passwordHash ?? null, a.authProvider ?? "Email", a.isOtpVerified ?? false, a.accountStatus ?? "Active", a.oauthId ?? null]
  );
  return mapRow(rows[0]);
};

export const findAccountByEmail = async (email: string): Promise<IAccount | null> => {
  const { rows } = await pool.query(`SELECT * FROM accounts WHERE email = $1`, [email]);
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findAccountById = async (id: string): Promise<IAccount | null> => {
  const { rows } = await pool.query(`SELECT * FROM accounts WHERE account_id = $1`, [id]);
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const updateAccountById = async (id: string, updates: Partial<IAccount>): Promise<IAccount | null> => {
  const set: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  const mapKey = (k: string) => {
    switch (k) {
      case "passwordHash": return "password_hash";
      case "authProvider": return "auth_provider";
      case "isOtpVerified": return "is_otp_verified";
      case "accountStatus": return "account_status";
      case "oauthId": return "oauth_id";
      case "lastLogin": return "last_login";
      default: return k;
    }
  };
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    set.push(`${mapKey(k)} = $${idx++}`);
    vals.push(v);
  }
  if (set.length === 0) return findAccountById(id);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE accounts SET ${set.join(", ")}, updated_at = now() WHERE account_id = $${idx} RETURNING *`,
    vals
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};