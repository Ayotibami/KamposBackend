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
  /** Also only from findByAvitag's joined query — the OWNING ACCOUNT's own
   * status, alongside this profile's own profile_status. A profile is only
   * actually live if BOTH are ACTIVE (see student.controller.ts's get()) —
   * an account-level suspend/deactivate/delete shouldn't require rewriting
   * every profile row it owns, so this stays a live join, not a copy. */
  owner_account_status?: 'ACTIVE' | 'DEACTIVATED' | 'SUSPENDED' | 'DELETED';
  /** Also only from findByAvitag's joined query — the owning account's
   * role, so a ban/delete/edit coming through the ADMIN path can refuse to
   * touch a king's profile the same way updateStatus already refuses to
   * touch a king's ACCOUNT. Deliberately not selected on the list/search
   * queries below — those are read-only browsing, no mutation to guard. */
  owner_role?: 'user' | 'idiot' | 'king';
  profile_status_reason?: string | null;
  profile_status_changed_at?: string | null;
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
    `SELECT sp.*, c.campus_name, m.major_name, acc.account_status AS owner_account_status, acc.role AS owner_role
     FROM student_profiles sp
     LEFT JOIN campus c ON c.campus_tag = sp.campus_tag
     LEFT JOIN major m ON m.major_tag = sp.major_tag
     LEFT JOIN accounts acc ON acc.account_id = sp.account_id
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

/**
 * Soft delete — flips profile_status to DELETED rather than removing the
 * row. Replaces what used to be a hard `DELETE FROM student_profiles`:
 * that destroyed the row (and freed the avitag for reuse) with no way for
 * anyone, owner or admin, to undo it. DELETED is meant to be terminal too,
 * but soft — the row/content stays, and the avitag stays permanently
 * reserved (still occupying its own primary key) so nobody can later sign
 * up under a deleted persona's old handle and inherit stale mentions/links.
 */
export async function softDelete(avitag: string, reason: string | null = null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE student_profiles
     SET profile_status = 'DELETED', profile_status_reason = $1, profile_status_changed_at = NOW(), updated_at = NOW()
     WHERE avitag = $2`,
    [reason, avitag],
  );
  return (rowCount || 0) > 0;
}

/** Admin ban/unban — mechanically identical to setDeactivated below, just
 * admin-controlled instead of self-controlled (see the profile-status
 * design doc trail: BANNED and DEACTIVATED have the same visible effect,
 * differing only in who can flip them). `reason` is cleared on unban. */
export async function setBanned(avitag: string, banned: boolean, reason: string | null = null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE student_profiles
     SET profile_status = $1, profile_status_reason = $2, profile_status_changed_at = NOW(), updated_at = NOW()
     WHERE avitag = $3`,
    [banned ? 'BANNED' : 'ACTIVE', banned ? reason : null, avitag],
  );
  return (rowCount || 0) > 0;
}

/** Self deactivate/reactivate — owner-only (enforced in the controller,
 * not here). No reason: this is the person's own choice about their own
 * profile, not something that needs explaining to themselves. */
export async function setDeactivated(avitag: string, deactivated: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE student_profiles
     SET profile_status = $1, profile_status_reason = NULL, profile_status_changed_at = NOW(), updated_at = NOW()
     WHERE avitag = $2`,
    [deactivated ? 'DEACTIVATED' : 'ACTIVE', avitag],
  );
  return (rowCount || 0) > 0;
}

/**
 * Row shape for the admin "Students" profile-browse screen
 * (GET /idiot/profiles/students) — every student_profiles column plus the
 * owning account's email, joined via account_id per the task spec (an
 * admin looking at a profile needs a way to get to the account behind it).
 */
export interface AdminStudentRow extends StudentProfile {
  email: string;
}

export interface AdminStudentSearchFilters {
  search?: string | null;
  profile_status?: ProfileStatus | null;
  is_verified?: boolean | null;
  campus_tag?: string | null;
  major_tag?: string | null;
  level?: number | null;
  limit?: number;
  cursor?: string;
}

// Shared SELECT/WHERE body for both cursor branches below — kept as one
// template literal so the two branches (with/without cursor) can't drift
// out of sync, same approach as idiot/gists.repo.ts's ADMIN_GIST_SELECT.
// profile_status is a real Postgres ENUM (profile_status), so per this
// build's earlier lesson it's cast on both sides: sp.profile_status::text
// compared against $1::text, never bare `= $1`.
const ADMIN_STUDENT_SELECT = `
  SELECT sp.*, a.email
  FROM student_profiles sp
  JOIN accounts a ON a.account_id = sp.account_id
`;

const ADMIN_STUDENT_WHERE = `
  WHERE ($1::text IS NULL OR sp.profile_status::text = $1::text)
    AND ($2::boolean IS NULL OR sp.is_verified = $2::boolean)
    AND ($3::text IS NULL OR sp.campus_tag = $3::text)
    AND ($4::text IS NULL OR sp.major_tag = $4::text)
    AND ($5::int IS NULL OR sp.level = $5::int)
    AND ($6::text IS NULL OR sp.avitag ILIKE $6
         OR COALESCE(sp.display_name, sp.first_name || ' ' || sp.last_name) ILIKE $6)
`;

/**
 * Admin search/browse across all student profiles, any status — the
 * "Profiles" section counterpart to the per-account /idiot/users browse.
 * Cursor-based pagination (cursor = last-seen row's own avitag, resolved
 * to that row's created_at) rather than offset, same reasoning as
 * gist.repo.ts's listByUser(): an admin can delete/verify a profile right
 * from this list mid-page.
 */
export async function adminSearch(filters: AdminStudentSearchFilters): Promise<AdminStudentRow[]> {
  const profileStatus = filters.profile_status ?? null;
  const isVerified = filters.is_verified ?? null;
  const campusTag = filters.campus_tag ?? null;
  const majorTag = filters.major_tag ?? null;
  const level = filters.level ?? null;
  const search = filters.search ? `%${filters.search}%` : null;
  const limit = filters.limit ?? 20;

  if (filters.cursor) {
    const { rows } = await pool.query<AdminStudentRow>(
      `${ADMIN_STUDENT_SELECT}
       ${ADMIN_STUDENT_WHERE}
         AND sp.created_at < (SELECT created_at FROM student_profiles WHERE avitag = $7)
       ORDER BY sp.created_at DESC
       LIMIT $8`,
      [profileStatus, isVerified, campusTag, majorTag, level, search, filters.cursor, limit]
    );
    return rows;
  }

  const { rows } = await pool.query<AdminStudentRow>(
    `${ADMIN_STUDENT_SELECT}
     ${ADMIN_STUDENT_WHERE}
     ORDER BY sp.created_at DESC
     LIMIT $7`,
    [profileStatus, isVerified, campusTag, majorTag, level, search, limit]
  );
  return rows;
}
