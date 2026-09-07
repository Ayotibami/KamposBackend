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
  /** Only from findByAvitag's joined query — see students/repo.ts's
   * identical field for the full reasoning. */
  owner_account_status?: 'ACTIVE' | 'DEACTIVATED' | 'SUSPENDED' | 'DELETED';
  /** See students/repo.ts's identical field — guards ban/delete/edit
   * against touching a king's profile through the admin path. Matters
   * MOST here of all 5 types: a king's "idiot" profile is their own admin
   * identity, exactly what a plain admin trying to harm a king would go
   * after first. */
  owner_role?: 'user' | 'idiot' | 'king';
  profile_status_reason?: string | null;
  profile_status_changed_at?: string | null;
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
  const { rows } = await pool.query<IdiotProfile>(
    `SELECT idp.*, acc.account_status AS owner_account_status, acc.role AS owner_role
     FROM idiot_profiles idp
     LEFT JOIN accounts acc ON acc.account_id = idp.account_id
     WHERE idp.avitag = $1`,
    [avitag],
  );
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

/** Soft delete — see students/repo.ts's softDelete for the full reasoning. */
export async function softDelete(avitag: string, reason: string | null = null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE idiot_profiles
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
    `UPDATE idiot_profiles
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
    `UPDATE idiot_profiles
     SET profile_status = $1, profile_status_reason = NULL, profile_status_changed_at = NOW(), updated_at = NOW()
     WHERE avitag = $2`,
    [deactivated ? 'DEACTIVATED' : 'ACTIVE', avitag],
  );
  return (rowCount || 0) > 0;
}

export async function hasUnverifiedForAccount(account_id: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM idiot_profiles WHERE account_id = $1 AND is_verified = FALSE) AS exists`,
    [account_id]
  );
  return !!rows[0]?.exists;
}

/**
 * Row shape for the admin "Idiots" (admin) profile-browse screen
 * (GET /idiot/profiles/idiots) — every idiot_profiles column plus the
 * owning account's email, joined via account_id.
 */
export interface AdminIdiotRow extends IdiotProfile {
  email: string;
}

export interface AdminIdiotSearchFilters {
  search?: string | null;
  profile_status?: ProfileStatus | null;
  is_verified?: boolean | null;
  limit?: number;
  cursor?: string;
}

// Shared SELECT/WHERE for both cursor branches below, same approach as
// students/repo.ts's ADMIN_STUDENT_SELECT/WHERE. profile_status is a real
// Postgres ENUM, so it's cast on both sides: idp.profile_status::text
// compared against $1::text, never bare `= $1`. campus_tag/major_tag/level
// don't apply to this table.
const ADMIN_IDIOT_SELECT = `
  SELECT idp.*, a.email
  FROM idiot_profiles idp
  JOIN accounts a ON a.account_id = idp.account_id
`;

const ADMIN_IDIOT_WHERE = `
  WHERE ($1::text IS NULL OR idp.profile_status::text = $1::text)
    AND ($2::boolean IS NULL OR idp.is_verified = $2::boolean)
    AND ($3::text IS NULL OR idp.avitag ILIKE $3 OR idp.display_name ILIKE $3)
`;

/**
 * Admin search/browse across all admin (idiot) profiles, any status.
 * Cursor pagination = last-seen row's avitag, resolved to that row's
 * created_at.
 */
export async function adminSearch(filters: AdminIdiotSearchFilters): Promise<AdminIdiotRow[]> {
  const profileStatus = filters.profile_status ?? null;
  const isVerified = filters.is_verified ?? null;
  const search = filters.search ? `%${filters.search}%` : null;
  const limit = filters.limit ?? 20;

  if (filters.cursor) {
    const { rows } = await pool.query<AdminIdiotRow>(
      `${ADMIN_IDIOT_SELECT}
       ${ADMIN_IDIOT_WHERE}
         AND idp.created_at < (SELECT created_at FROM idiot_profiles WHERE avitag = $4)
       ORDER BY idp.created_at DESC
       LIMIT $5`,
      [profileStatus, isVerified, search, filters.cursor, limit]
    );
    return rows;
  }

  const { rows } = await pool.query<AdminIdiotRow>(
    `${ADMIN_IDIOT_SELECT}
     ${ADMIN_IDIOT_WHERE}
     ORDER BY idp.created_at DESC
     LIMIT $4`,
    [profileStatus, isVerified, search, limit]
  );
  return rows;
}
