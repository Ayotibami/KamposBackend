import { pool } from '../../../config/db';

export type ProfileStatus = 'ACTIVE' | 'DEACTIVATED' | 'DELETED' | 'BANNED';

export interface KompanyProfile {
  avitag: string;
  account_id: string;
  display_name: string;
  email: string;
  phone_number: string;
  image_url: string;
  website: string;
  social_links: any | null;
  description: string | null;
  is_verified: boolean;
  profile_status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export async function create(p: {
  avitag: string;
  account_id: string;
  display_name: string;
  email: string;
  phone_number: string;
  image_url: string;
  website: string;
  social_links?: any | null;
  description?: string | null;
}): Promise<KompanyProfile> {
  const { rows } = await pool.query<KompanyProfile>(
    `INSERT INTO kompany_profiles (
       avitag, account_id, display_name, email, phone_number, image_url, website, social_links, description
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      p.avitag,
      p.account_id,
      p.display_name,
      p.email,
      p.phone_number,
      p.image_url,
      p.website,
      p.social_links ?? null,
      p.description ?? null,
    ]
  );
  return rows[0];
}

export async function findByAvitag(avitag: string): Promise<KompanyProfile | null> {
  const { rows } = await pool.query<KompanyProfile>(`SELECT * FROM kompany_profiles WHERE avitag = $1`, [avitag]);
  return rows[0] ?? null;
}

export async function listVerifiedActive(limit = 20, offset = 0): Promise<KompanyProfile[]> {
  const { rows } = await pool.query<KompanyProfile>(
    `SELECT * FROM kompany_profiles WHERE is_verified = TRUE AND profile_status = 'ACTIVE'
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function listActive(limit = 20, offset = 0): Promise<KompanyProfile[]> {
  const { rows } = await pool.query<KompanyProfile>(
    `SELECT * FROM kompany_profiles WHERE profile_status = 'ACTIVE'
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function update(
  avitag: string,
  account_id: string,
  updates: Partial<Omit<KompanyProfile, 'avitag' | 'account_id' | 'created_at' | 'updated_at'>>
): Promise<KompanyProfile | null> {
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
  const { rows } = await pool.query<KompanyProfile>(
    `UPDATE kompany_profiles SET ${fields.join(', ')} WHERE avitag = $${i++} AND account_id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function setVerified(avitag: string, verified: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE kompany_profiles SET is_verified = $1, updated_at = NOW() WHERE avitag = $2`,
    [verified, avitag]
  );
  return (rowCount || 0) > 0;
}

export async function remove(avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM kompany_profiles WHERE avitag = $1`, [avitag]);
  return (rowCount || 0) > 0;
}
