import { pool } from '../../../config/db';

export type Degree = 'BACHELORS' | 'MASTERS' | 'PHD';
export type ProfileStatus = 'ACTIVE' | 'DEACTIVATED' | 'DELETED' | 'BANNED';

export interface StudentProfile {
  avitag: string;
  account_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  bio: string | null;
  hobbies: string[] | null;
  degree: Degree | null;
  image_url: string | null;
  is_verified: boolean;
  profile_status: ProfileStatus;
  created_at: string;
  updated_at: string;
  /** Only present on findByAvitag's joined query — full names alongside the
   * tags, so callers (Profile Settings) don't need a separate campus/major
   * list fetch just to display "University of Lagos" instead of "unilag". */
  campus_name?: string | null;
  major_name?: string | null;
}

export async function create(p: {
  avitag: string;
  account_id: string;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  campus_tag?: string | null;
  major_tag?: string | null;
  level?: number | null;
  bio?: string | null;
  hobbies?: string[] | null;
  degree?: Degree | null;
  image_url?: string | null;
}): Promise<StudentProfile> {
  const { rows } = await pool.query<StudentProfile>(
    `INSERT INTO student_profiles (
       avitag, account_id, first_name, last_name, display_name, campus_tag, major_tag, level,
       bio, hobbies, degree, image_url
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      p.avitag,
      p.account_id,
      p.first_name,
      p.last_name,
      p.display_name ?? null,
      p.campus_tag ?? null,
      p.major_tag ?? null,
      p.level ?? null,
      p.bio ?? null,
      p.hobbies ?? null,
      p.degree ?? null,
      p.image_url ?? null,
    ]
  );
  return rows[0];
}

export async function findByAvitag(avitag: string): Promise<StudentProfile | null> {
  const { rows } = await pool.query<StudentProfile>(
    `SELECT sp.*, c.campus_name, m.major_name
     FROM student_profiles sp
     LEFT JOIN campus c ON c.campus_tag = sp.campus_tag
     LEFT JOIN major m ON m.major_tag = sp.major_tag
     WHERE sp.avitag = $1`,
    [avitag]
  );
  return rows[0] ?? null;
}

export async function listActive(limit = 20, offset = 0): Promise<StudentProfile[]> {
  const { rows } = await pool.query<StudentProfile>(
    `SELECT * FROM student_profiles
     WHERE profile_status = 'ACTIVE'
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function update(avitag: string, account_id: string, updates: Partial<Omit<StudentProfile, 'avitag' | 'account_id' | 'created_at' | 'updated_at'>>): Promise<StudentProfile | null> {
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
  const { rows } = await pool.query<StudentProfile>(
    `UPDATE student_profiles SET ${fields.join(', ')} WHERE avitag = $${i++} AND account_id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function setVerified(avitag: string, verified: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE student_profiles SET is_verified = $1, updated_at = NOW() WHERE avitag = $2`,
    [verified, avitag]
  );
  return (rowCount || 0) > 0;
}

export async function remove(avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM student_profiles WHERE avitag = $1`, [avitag]);
  return (rowCount || 0) > 0;
}
