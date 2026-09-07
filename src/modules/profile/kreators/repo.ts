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
  /** Only from findByAvitag's joined query — see students/repo.ts's
   * identical field for the full reasoning (the AND-gate between a
   * profile's own status and its owning account's). */
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
  const { rows } = await pool.query<KreatorProfile>(
    `SELECT kp.*, acc.account_status AS owner_account_status, acc.role AS owner_role
     FROM kreator_profiles kp
     LEFT JOIN accounts acc ON acc.account_id = kp.account_id
     WHERE kp.avitag = $1`,
    [avitag],
  );
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

export async function listActive(limit = 20, offset = 0): Promise<KreatorProfile[]> {
  const { rows } = await pool.query<KreatorProfile>(
    `SELECT * FROM kreator_profiles WHERE profile_status = 'ACTIVE'
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

/** Soft delete — see students/repo.ts's softDelete for the full reasoning
 * (this used to be a hard DELETE). */
export async function softDelete(avitag: string, reason: string | null = null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE kreator_profiles
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
    `UPDATE kreator_profiles
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
    `UPDATE kreator_profiles
     SET profile_status = $1, profile_status_reason = NULL, profile_status_changed_at = NOW(), updated_at = NOW()
     WHERE avitag = $2`,
    [deactivated ? 'DEACTIVATED' : 'ACTIVE', avitag],
  );
  return (rowCount || 0) > 0;
}

/**
 * Row shape for the admin "Kreators" profile-browse screen
 * (GET /idiot/profiles/kreators) — every kreator_profiles column plus the
 * owning account's email, joined via account_id.
 */
export interface AdminKreatorRow extends KreatorProfile {
  email: string;
}

export interface AdminKreatorSearchFilters {
  search?: string | null;
  profile_status?: ProfileStatus | null;
  is_verified?: boolean | null;
  /** Filters against this table's own `campustag` column (no underscore —
   * unlike every other profile table). */
  campus_tag?: string | null;
  limit?: number;
  cursor?: string;
}

// Shared SELECT/WHERE for both cursor branches below, same approach as
// students/repo.ts's ADMIN_STUDENT_SELECT/WHERE. profile_status is a real
// Postgres ENUM, so it's cast on both sides: kp.profile_status::text
// compared against $1::text, never bare `= $1`.
const ADMIN_KREATOR_SELECT = `
  SELECT kp.*, a.email
  FROM kreator_profiles kp
  JOIN accounts a ON a.account_id = kp.account_id
`;

const ADMIN_KREATOR_WHERE = `
  WHERE ($1::text IS NULL OR kp.profile_status::text = $1::text)
    AND ($2::boolean IS NULL OR kp.is_verified = $2::boolean)
    AND ($3::text IS NULL OR kp.campustag = $3::text)
    AND ($4::text IS NULL OR kp.avitag ILIKE $4 OR kp.display_name ILIKE $4)
`;

/**
 * Admin search/browse across all kreator profiles, any status. Cursor
 * pagination uses this table's own `joined_at` column (its equivalent of
 * created_at, per the real migration) — cursor = last-seen row's avitag,
 * resolved to that row's joined_at.
 */
export async function adminSearch(filters: AdminKreatorSearchFilters): Promise<AdminKreatorRow[]> {
  const profileStatus = filters.profile_status ?? null;
  const isVerified = filters.is_verified ?? null;
  const campusTag = filters.campus_tag ?? null;
  const search = filters.search ? `%${filters.search}%` : null;
  const limit = filters.limit ?? 20;

  if (filters.cursor) {
    const { rows } = await pool.query<AdminKreatorRow>(
      `${ADMIN_KREATOR_SELECT}
       ${ADMIN_KREATOR_WHERE}
         AND kp.joined_at < (SELECT joined_at FROM kreator_profiles WHERE avitag = $5)
       ORDER BY kp.joined_at DESC
       LIMIT $6`,
      [profileStatus, isVerified, campusTag, search, filters.cursor, limit]
    );
    return rows;
  }

  const { rows } = await pool.query<AdminKreatorRow>(
    `${ADMIN_KREATOR_SELECT}
     ${ADMIN_KREATOR_WHERE}
     ORDER BY kp.joined_at DESC
     LIMIT $5`,
    [profileStatus, isVerified, campusTag, search, limit]
  );
  return rows;
}
