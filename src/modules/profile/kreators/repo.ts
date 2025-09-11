import { pool } from '../../../config/db';

export type ProfileStatus = 'ACTIVE' | 'DEACTIVATED' | 'DELETED' | 'BANNED';

export interface KreatorProfile {
  avitag: string;
  account_id: string;
  display_name: string;
  campustag: string | null;
  description: string | null;
  image_url: string | null;
  engagement_score: number | null;
  earnings_balance: string; // numeric
  monetization_enabled: boolean;
  top_gist_id: string | null;
  is_verified: boolean;
  profile_status: ProfileStatus;
  joined_at: string;
  updated_at: string;
}

export async function create(p: {
  avitag: string;
  account_id: string;
  display_name: string;
  campustag?: string | null;
  description?: string | null;
  image_url?: string | null;
}): Promise<KreatorProfile> {
  const { rows } = await pool.query<KreatorProfile>(
    `INSERT INTO kreator_profiles (
       avitag, account_id, display_name, campustag, description, image_url
     ) VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      p.avitag,
      p.account_id,
      p.display_name,
      p.campustag ?? null,
      p.description ?? null,
      p.image_url ?? null,
    ]
  );
  return rows[0];
}

export async function findByAvitag(avitag: string): Promise<KreatorProfile | null> {
  const { rows } = await pool.query<KreatorProfile>(`SELECT * FROM kreator_profiles WHERE avitag = $1`, [avitag]);
  return rows[0] ?? null;
}

export async function listVerifiedActive(limit = 20, offset = 0): Promise<KreatorProfile[]> {
  const { rows } = await pool.query<KreatorProfile>(
    `SELECT * FROM kreator_profiles WHERE is_verified = TRUE AND profile_status = 'ACTIVE'
     ORDER BY joined_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function update(
  avitag: string,
  account_id: string,
  updates: Partial<Omit<KreatorProfile, 'avitag' | 'account_id' | 'joined_at' | 'updated_at'>>
): Promise<KreatorProfile | null> {
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
  const { rows } = await pool.query<KreatorProfile>(
    `UPDATE kreator_profiles SET ${fields.join(', ')} WHERE avitag = $${i++} AND account_id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function setVerified(avitag: string, verified: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE kreator_profiles SET is_verified = $1, updated_at = NOW() WHERE avitag = $2`,
    [verified, avitag]
  );
  return (rowCount || 0) > 0;
}

export async function remove(avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM kreator_profiles WHERE avitag = $1`, [avitag]);
  return (rowCount || 0) > 0;
}
