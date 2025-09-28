import { pool } from '../../../config/db';

export type ProfileStatus = 'ACTIVE' | 'DEACTIVATED' | 'DELETED' | 'BANNED';

export interface IdiotProfile {
  avitag: string;
  account_id: string;
  display_name: string;
  description: string | null;
  image_url: string | null;
  is_verified: boolean;
  profile_status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export async function create(p: {
  avitag: string;
  account_id: string;
  display_name: string;
  description?: string | null;
  image_url?: string | null;
}): Promise<IdiotProfile> {
  const { rows } = await pool.query<IdiotProfile>(
    `INSERT INTO idiot_profiles (
       avitag, account_id, display_name, description, image_url
     ) VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      p.avitag,
      p.account_id,
      p.display_name,
      p.description ?? null,
      p.image_url ?? null,
    ]
  );
  return rows[0];
}

export async function findByAvitag(avitag: string): Promise<IdiotProfile | null> {
  const { rows } = await pool.query<IdiotProfile>(`SELECT * FROM idiot_profiles WHERE avitag = $1`, [avitag]);
  return rows[0] ?? null;
}

export async function listActive(limit = 20, offset = 0): Promise<IdiotProfile[]> {
  const { rows } = await pool.query<IdiotProfile>(
    `SELECT * FROM idiot_profiles WHERE profile_status = 'ACTIVE'
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function update(
  avitag: string,
  account_id: string,
  updates: Partial<Omit<IdiotProfile, 'avitag' | 'account_id' | 'created_at' | 'updated_at'>>
): Promise<IdiotProfile | null> {
  const fields: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      fields.push(`${k} = $${i++}`);
      vals.push(v);
    }
  }
  if (!fields.length) return findByAvitag(avitag);
  fields.push('updated_at = NOW()');
  vals.push(avitag, account_id);
  const { rows } = await pool.query<IdiotProfile>(
    `UPDATE idiot_profiles SET ${fields.join(', ')} WHERE avitag = $${i++} AND account_id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function setVerified(avitag: string, verified: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE idiot_profiles SET is_verified = $1, updated_at = NOW() WHERE avitag = $2`,
    [verified, avitag]
  );
  return (rowCount || 0) > 0;
}

export async function remove(avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM idiot_profiles WHERE avitag = $1`, [avitag]);
  return (rowCount || 0) > 0;
}

export async function hasUnverifiedForAccount(account_id: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM idiot_profiles WHERE account_id = $1 AND is_verified = FALSE) AS exists`,
    [account_id]
  );
  return !!rows[0]?.exists;
}
