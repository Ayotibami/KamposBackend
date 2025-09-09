import { pool } from '../../config/db';

export interface Profile {
  avitag: string;
  account_id: string;
  profile_type: 'STUDENT' | 'KREATOR' | 'KOMPANY' | 'SCHOOL' | 'IDIOT';
  is_verified: boolean;
  display_name: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
}

export async function findProfile(avitag: string): Promise<Profile | null> {
  const { rows } = await pool.query<Profile>(`SELECT * FROM profiles WHERE avitag = $1`, [avitag]);
  return rows[0] ?? null;
}

export async function listPendingProfiles(limit = 20, offset = 0): Promise<Profile[]> {
  const { rows } = await pool.query<Profile>(
    `SELECT * FROM profiles WHERE is_verified = FALSE ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function verifyProfile(avitag: string): Promise<Profile | null> {
  const { rows } = await pool.query<Profile>(
    `UPDATE profiles SET is_verified = TRUE, updated_at = NOW() WHERE avitag = $1 RETURNING *`,
    [avitag]
  );
  return rows[0] ?? null;
}

export async function createProfile(params: {
  avitag: string;
  account_id: string;
  profile_type: 'STUDENT' | 'KREATOR' | 'KOMPANY' | 'SCHOOL' | 'IDIOT';
  display_name?: string | null;
  campus_tag?: string | null;
  major_tag?: string | null;
  level?: number | null;
}): Promise<Profile> {
  const { rows } = await pool.query<Profile>(
    `INSERT INTO profiles (avitag, account_id, profile_type, display_name, campus_tag, major_tag, level)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      params.avitag,
      params.account_id,
      params.profile_type,
      params.display_name ?? null,
      params.campus_tag ?? null,
      params.major_tag ?? null,
      params.level ?? null,
    ]
  );
  return rows[0];
}

export async function listProfilesByAccount(account_id: string): Promise<Profile[]> {
  const { rows } = await pool.query<Profile>(
    `SELECT * FROM profiles WHERE account_id = $1 ORDER BY created_at DESC`,
    [account_id]
  );
  return rows;
}

export async function updateProfile(
  avitag: string,
  account_id: string,
  updates: {
    display_name?: string | null;
    campus_tag?: string | null;
    major_tag?: string | null;
    level?: number | null;
  }
): Promise<Profile | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (updates.display_name !== undefined) {
    fields.push(`display_name = $${idx++}`);
    values.push(updates.display_name);
  }
  if (updates.campus_tag !== undefined) {
    fields.push(`campus_tag = $${idx++}`);
    values.push(updates.campus_tag);
  }
  if (updates.major_tag !== undefined) {
    fields.push(`major_tag = $${idx++}`);
    values.push(updates.major_tag);
  }
  if (updates.level !== undefined) {
    fields.push(`level = $${idx++}`);
    values.push(updates.level);
  }
  if (fields.length === 0) return findProfile(avitag);
  fields.push(`updated_at = NOW()`);
  values.push(avitag);
  values.push(account_id);
  const { rows } = await pool.query<Profile>(
    `UPDATE profiles SET ${fields.join(', ')} WHERE avitag = $${idx++} AND account_id = $${idx} RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

export async function deleteProfile(avitag: string, account_id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM profiles WHERE avitag = $1 AND account_id = $2`,
    [avitag, account_id]
  );
  return (result.rowCount || 0) > 0;
}
