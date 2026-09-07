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
  /** Only from findByAvitag's joined query — see students/repo.ts's
   * identical field for the full reasoning. */
  owner_account_status?: 'ACTIVE' | 'DEACTIVATED' | 'SUSPENDED' | 'DELETED';
  /** See students/repo.ts's identical field — guards ban/delete/edit
   * against touching a king's profile through the admin path. */
  owner_role?: 'user' | 'idiot' | 'king';
  profile_status_reason?: string | null;
  profile_status_changed_at?: string | null;
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
  const { rows } = await pool.query<SchoolProfile>(
    `SELECT scp.*, acc.account_status AS owner_account_status, acc.role AS owner_role
     FROM school_profiles scp
     LEFT JOIN accounts acc ON acc.account_id = scp.account_id
     WHERE scp.avitag = $1`,
    [avitag],
  );
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

export async function listActive(limit = 20, offset = 0): Promise<SchoolProfile[]> {
  const { rows } = await pool.query<SchoolProfile>(
    `SELECT * FROM school_profiles WHERE profile_status = 'ACTIVE'
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

/** Soft delete — see students/repo.ts's softDelete for the full reasoning. */
export async function softDelete(avitag: string, reason: string | null = null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE school_profiles
     SET profile_status = 'DELETED', profile_status_reason = $1, profile_status_changed_at = NOW(), updated_at = NOW()
     WHERE avitag = $2`,
    [reason, avitag],
  );
  return (rowCount || 0) > 0;
}

/** Admin ban/unban — see students/repo.ts's setBanned for the full
 * reasoning. */
export async function setBanned(avitag: string, banned: boolean, reason: string | null = null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE school_profiles
     SET profile_status = $1, profile_status_reason = $2, profile_status_changed_at = NOW(), updated_at = NOW()
     WHERE avitag = $3`,
    [banned ? 'BANNED' : 'ACTIVE', banned ? reason : null, avitag],
  );
  return (rowCount || 0) > 0;
}

/** Self deactivate/reactivate — see students/repo.ts's setDeactivated for
 * the full reasoning. */
export async function setDeactivated(avitag: string, deactivated: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE school_profiles
     SET profile_status = $1, profile_status_reason = NULL, profile_status_changed_at = NOW(), updated_at = NOW()
     WHERE avitag = $2`,
    [deactivated ? 'DEACTIVATED' : 'ACTIVE', avitag],
  );
  return (rowCount || 0) > 0;
}

/**
 * Row shape for the admin "Schools" profile-browse screen
 * (GET /idiot/profiles/schools) — every school_profiles column plus the
 * owning account's email, joined via account_id.
 */
export interface AdminSchoolRow extends SchoolProfile {
  email: string;
}

export interface AdminSchoolSearchFilters {
  search?: string | null;
  profile_status?: ProfileStatus | null;
  is_verified?: boolean | null;
  campus_tag?: string | null;
  limit?: number;
  cursor?: string;
}

// Shared SELECT/WHERE for both cursor branches below, same approach as
// students/repo.ts's ADMIN_STUDENT_SELECT/WHERE. profile_status is a real
// Postgres ENUM, so it's cast on both sides: scp.profile_status::text
// compared against $1::text, never bare `= $1`. major_tag/level don't
// apply to this table.
const ADMIN_SCHOOL_SELECT = `
  SELECT scp.*, a.email
  FROM school_profiles scp
  JOIN accounts a ON a.account_id = scp.account_id
`;

const ADMIN_SCHOOL_WHERE = `
  WHERE ($1::text IS NULL OR scp.profile_status::text = $1::text)
    AND ($2::boolean IS NULL OR scp.is_verified = $2::boolean)
    AND ($3::text IS NULL OR scp.campus_tag = $3::text)
    AND ($4::text IS NULL OR scp.avitag ILIKE $4 OR scp.display_name ILIKE $4)
`;

/**
 * Admin search/browse across all school profiles, any status. Cursor
 * pagination = last-seen row's avitag, resolved to that row's created_at.
 */
export async function adminSearch(filters: AdminSchoolSearchFilters): Promise<AdminSchoolRow[]> {
  const profileStatus = filters.profile_status ?? null;
  const isVerified = filters.is_verified ?? null;
  const campusTag = filters.campus_tag ?? null;
  const search = filters.search ? `%${filters.search}%` : null;
  const limit = filters.limit ?? 20;

  if (filters.cursor) {
    const { rows } = await pool.query<AdminSchoolRow>(
      `${ADMIN_SCHOOL_SELECT}
       ${ADMIN_SCHOOL_WHERE}
         AND scp.created_at < (SELECT created_at FROM school_profiles WHERE avitag = $5)
       ORDER BY scp.created_at DESC
       LIMIT $6`,
      [profileStatus, isVerified, campusTag, search, filters.cursor, limit]
    );
    return rows;
  }

  const { rows } = await pool.query<AdminSchoolRow>(
    `${ADMIN_SCHOOL_SELECT}
     ${ADMIN_SCHOOL_WHERE}
     ORDER BY scp.created_at DESC
     LIMIT $5`,
    [profileStatus, isVerified, campusTag, search, limit]
  );
  return rows;
}
