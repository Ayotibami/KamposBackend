import { pool } from '../../../config/db';

export type ProfileStatus = 'ACTIVE' | 'DEACTIVATED' | 'DELETED' | 'BANNED';

export interface SchoolProfile {
  avitag: string;
  account_id: string;
  display_name: string;
  description: string | null;
  campus_tag: string | null;
  image_url: string | null;
  website: string | null;
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
  campus_tag?: string | null;
  image_url?: string | null;
  website?: string | null;
}): Promise<SchoolProfile> {
  const { rows } = await pool.query<SchoolProfile>(
    `INSERT INTO school_profiles (
       avitag, account_id, display_name, description, campus_tag, image_url, website
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      p.avitag,
      p.account_id,
      p.display_name,
      p.description ?? null,
      p.campus_tag ?? null,
      p.image_url ?? null,
      p.website ?? null,
    ]
  );
  return rows[0];
}

export async function findByAvitag(avitag: string): Promise<SchoolProfile | null> {
  const { rows } = await pool.query<SchoolProfile>(`SELECT * FROM school_profiles WHERE avitag = $1`, [avitag]);
  return rows[0] ?? null;
}

export async function listVerifiedActive(limit = 20, offset = 0): Promise<SchoolProfile[]> {
  const { rows } = await pool.query<SchoolProfile>(
    `SELECT * FROM school_profiles WHERE is_verified = TRUE AND profile_status = 'ACTIVE'
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function update(
  avitag: string,
  account_id: string,
  updates: Partial<Omit<SchoolProfile, 'avitag' | 'account_id' | 'created_at' | 'updated_at'>>
): Promise<SchoolProfile | null> {
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
  const { rows } = await pool.query<SchoolProfile>(
    `UPDATE school_profiles SET ${fields.join(', ')} WHERE avitag = $${i++} AND account_id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function setVerified(avitag: string, verified: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE school_profiles SET is_verified = $1, updated_at = NOW() WHERE avitag = $2`,
    [verified, avitag]
  );
  return (rowCount || 0) > 0;
}

export async function remove(avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM school_profiles WHERE avitag = $1`, [avitag]);
  return (rowCount || 0) > 0;
}
