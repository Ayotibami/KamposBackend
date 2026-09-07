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
  const { rows } = await pool.query<KompanyProfile>(
    `SELECT kmp.*, acc.account_status AS owner_account_status, acc.role AS owner_role
     FROM kompany_profiles kmp
     LEFT JOIN accounts acc ON acc.account_id = kmp.account_id
     WHERE kmp.avitag = $1`,
    [avitag],
  );
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

/** Soft delete — see students/repo.ts's softDelete for the full reasoning. */
export async function softDelete(avitag: string, reason: string | null = null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE kompany_profiles
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
    `UPDATE kompany_profiles
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
    `UPDATE kompany_profiles
     SET profile_status = $1, profile_status_reason = NULL, profile_status_changed_at = NOW(), updated_at = NOW()
     WHERE avitag = $2`,
    [deactivated ? 'DEACTIVATED' : 'ACTIVE', avitag],
  );
  return (rowCount || 0) > 0;
}

/**
 * Row shape for the admin "Kompanies" profile-browse screen
 * (GET /idiot/profiles/kompanies) — every kompany_profiles column plus the
 * owning account's email, joined via account_id. Note kompany_profiles
 * already carries its own `email` (the profile's contact email) — this
 * adds the ACCOUNT's login email under the `email` alias from `a`, so the
 * table's own `email` column still comes through under its own name from
 * `kmp.*` while the account's is exposed separately as `account_email`
 * to avoid silently shadowing it.
 */
export interface AdminKompanyRow extends KompanyProfile {
  account_email: string;
}

export interface AdminKompanySearchFilters {
  search?: string | null;
  profile_status?: ProfileStatus | null;
  is_verified?: boolean | null;
  limit?: number;
  cursor?: string;
}

// Shared SELECT/WHERE for both cursor branches below, same approach as
// students/repo.ts's ADMIN_STUDENT_SELECT/WHERE. profile_status is a real
// Postgres ENUM, so it's cast on both sides: kmp.profile_status::text
// compared against $1::text, never bare `= $1`. Neither campus_tag,
// major_tag, nor level apply to this table.
const ADMIN_KOMPANY_SELECT = `
  SELECT kmp.*, a.email AS account_email
  FROM kompany_profiles kmp
  JOIN accounts a ON a.account_id = kmp.account_id
`;

const ADMIN_KOMPANY_WHERE = `
  WHERE ($1::text IS NULL OR kmp.profile_status::text = $1::text)
    AND ($2::boolean IS NULL OR kmp.is_verified = $2::boolean)
    AND ($3::text IS NULL OR kmp.avitag ILIKE $3 OR kmp.display_name ILIKE $3)
`;

/**
 * Admin search/browse across all kompany profiles, any status. Cursor
 * pagination = last-seen row's avitag, resolved to that row's created_at.
 */
export async function adminSearch(filters: AdminKompanySearchFilters): Promise<AdminKompanyRow[]> {
  const profileStatus = filters.profile_status ?? null;
  const isVerified = filters.is_verified ?? null;
  const search = filters.search ? `%${filters.search}%` : null;
  const limit = filters.limit ?? 20;

  if (filters.cursor) {
    const { rows } = await pool.query<AdminKompanyRow>(
      `${ADMIN_KOMPANY_SELECT}
       ${ADMIN_KOMPANY_WHERE}
         AND kmp.created_at < (SELECT created_at FROM kompany_profiles WHERE avitag = $4)
       ORDER BY kmp.created_at DESC
       LIMIT $5`,
      [profileStatus, isVerified, search, filters.cursor, limit]
    );
    return rows;
  }

  const { rows } = await pool.query<AdminKompanyRow>(
    `${ADMIN_KOMPANY_SELECT}
     ${ADMIN_KOMPANY_WHERE}
     ORDER BY kmp.created_at DESC
     LIMIT $4`,
    [profileStatus, isVerified, search, limit]
  );
  return rows;
}
