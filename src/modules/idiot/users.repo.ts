import { pool } from '../../config/db';

/**
 * One ACCOUNT row from the admin Accounts search/browse screen — one row
 * per person, not per profile. Originally this endpoint returned one row
 * per matching PROFILE (an account with two profiles showed up twice, with
 * no way to tell they were the same person without opening each one) —
 * changed to account-centric after the product owner reviewed it live and
 * asked for "one row per person" instead, with full profile detail moved to
 * the account detail page (see profile/utils.ts's listByAccountFull) rather
 * than repeated on every list row.
 */
export interface AccountSearchRow {
  account_id: string;
  email: string;
  account_status: string;
  role: string;
  created_at: string;
  last_login: string | null;
  is_otp_verified: boolean;
  /** How many profiles (across all 5 types) this account has — shown as a
   * quick hint on the list row so an admin knows what to expect before
   * opening the account detail page. */
  profile_count: number;
}

export interface UserSearchFilters {
  search?: string | null;
  role?: 'user' | 'idiot' | 'king' | null;
  account_status?: 'ACTIVE' | 'DEACTIVATED' | 'DELETED' | 'SUSPENDED' | null;
  /** true = only accounts with zero profiles across all 5 types ("no
   * profile yet" — e.g. an admin-created account nobody's finished
   * onboarding). Anything else (false/omitted) applies no restriction —
   * there's no reason to filter FOR "has a profile", that's just the
   * default. */
  no_profile?: boolean | null;
  limit?: number;
  offset?: number;
}

/**
 * Admin-facing search/browse across every ACCOUNT on the platform.
 *
 * Filters were originally profile-shaped (campus/major/profile_type) from
 * when this screen was profile-centric — removed once the product owner
 * pointed out, after using the account-centric redesign live, that
 * filtering by campus/major/type made no sense on a screen that no longer
 * shows any of that per row (that's now the Profiles section's job, one tab
 * per type, where the filters actually match what's displayed). What's left
 * here is genuinely account-level and maps directly onto what the row shows:
 * `role`/`account_status` match their own badges, `search` still matches
 * avitag/display_name under the hood (a real "I know their handle, find
 * their account" lookup) even though those fields aren't shown on the row
 * itself, and `no_profile` is a new operational filter with no row-level
 * display need at all.
 *
 * `account_status` is a real Postgres ENUM (confirmed against
 * migrations/0001_init.sql — `CREATE TYPE account_status AS ENUM (...)`),
 * so it's cast on both sides here (`a.account_status::text = $3::text`) per
 * this build's own earlier lesson about comparing an enum column directly
 * against a `$n::text` parameter with no valid operator. `role` is plain
 * TEXT (added via migration 0035, not an enum), so no cast is strictly
 * required there, but it's written the same defensive way for consistency.
 *
 * `no_profile` filters on an AGGREGATE (COUNT(p.avitag) after the GROUP BY),
 * so it has to live in a HAVING clause, not WHERE — a WHERE clause runs
 * before grouping happens and has no COUNT to test yet.
 */
export async function searchUsers(filters: UserSearchFilters): Promise<AccountSearchRow[]> {
  const term = filters.search ? `%${filters.search}%` : null;
  const role = filters.role ?? null;
  const accountStatus = filters.account_status ?? null;
  const noProfile = filters.no_profile ?? null;
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;

  const { rows } = await pool.query<AccountSearchRow>(
    `WITH profiles AS (
       SELECT account_id, avitag, COALESCE(display_name, first_name || ' ' || last_name) AS display_name
       FROM student_profiles
       UNION ALL
       SELECT account_id, avitag, display_name FROM kreator_profiles
       UNION ALL
       SELECT account_id, avitag, display_name FROM kompany_profiles
       UNION ALL
       SELECT account_id, avitag, display_name FROM school_profiles
       UNION ALL
       SELECT account_id, avitag, display_name FROM idiot_profiles
     )
     SELECT a.account_id, a.email, a.account_status, a.role, a.created_at, a.last_login, a.is_otp_verified,
            COUNT(p.avitag)::int AS profile_count
     FROM accounts a
     LEFT JOIN profiles p ON p.account_id = a.account_id
     WHERE
       ($1::text IS NULL OR a.email ILIKE $1 OR EXISTS (
         SELECT 1 FROM profiles p2 WHERE p2.account_id = a.account_id
           AND (p2.avitag ILIKE $1 OR p2.display_name ILIKE $1)
       ))
       AND ($2::text IS NULL OR a.role = $2::text)
       AND ($3::text IS NULL OR a.account_status::text = $3::text)
     GROUP BY a.account_id
     HAVING ($4::boolean IS NOT TRUE OR COUNT(p.avitag) = 0)
     ORDER BY a.created_at DESC
     LIMIT $5 OFFSET $6`,
    [term, role, accountStatus, noProfile, limit, offset]
  );
  return rows;
}
