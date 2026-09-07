import { pool } from '../../config/db';

export type ProfileType = 'STUDENT' | 'KREATOR' | 'KOMPANY' | 'SCHOOL' | 'IDIOT' | 'king';

export interface BasicProfile {
  avitag: string;
  account_id: string;
  is_verified: boolean;
  profile_type: ProfileType;
}

export async function getCampusMajor(avitag: string): Promise<{ campus_tag: string | null; major_tag: string | null }> {
  // Currently only student_profiles define campus_tag/major_tag
  const { rows } = await pool.query<{ campus_tag: string | null; major_tag: string | null }>(
    `SELECT campus_tag, major_tag FROM student_profiles WHERE avitag = $1 LIMIT 1`,
    [avitag]
  );
  const r = rows[0];
  return { campus_tag: r?.campus_tag ?? null, major_tag: r?.major_tag ?? null };
}

export async function findByAvitag(avitag: string): Promise<BasicProfile | null> {
  // Check each subtype table for existence and return a normalized shape
  const checks: Array<{ sql: string; type: ProfileType }> = [
    { sql: 'SELECT avitag, account_id, is_verified FROM student_profiles WHERE avitag = $1 LIMIT 1', type: 'STUDENT' },
    { sql: 'SELECT avitag, account_id, is_verified FROM kreator_profiles WHERE avitag = $1 LIMIT 1', type: 'KREATOR' },
    { sql: 'SELECT avitag, account_id, is_verified FROM kompany_profiles WHERE avitag = $1 LIMIT 1', type: 'KOMPANY' },
    { sql: 'SELECT avitag, account_id, is_verified FROM school_profiles WHERE avitag = $1 LIMIT 1', type: 'SCHOOL' },
    { sql: 'SELECT avitag, account_id, is_verified FROM idiot_profiles WHERE avitag = $1 LIMIT 1', type: 'IDIOT' },
  ];
  for (const c of checks) {
    const { rows } = await pool.query<{ avitag: string; account_id: string; is_verified: boolean }>(c.sql, [avitag]);
    if (rows[0]) {
      return { avitag: rows[0].avitag, account_id: rows[0].account_id, is_verified: rows[0].is_verified, profile_type: c.type };
    }
  }
  return null;
}

export interface AccountProfileRow extends BasicProfile {
  display_name?: string | null;
  image_url?: string | null;
  created_at?: string;
}

// ACTIVE-only — this is the one query behind GET /account/profile, which
// authStore's resolveAuthState() uses to decide the "needs-profile" vs
// "active" gate state purely off `profiles.length`. A deactivated/banned/
// deleted profile still being counted here would leave someone who just
// deactivated their only profile resolving to "active" anyway, sent to
// /feed with a now-dead avitag baked into their session. The admin panel's
// own account-detail view needs to see every status regardless — that's
// listByAccountFull below, a deliberately separate, unfiltered query.
export async function listByAccount(account_id: string): Promise<AccountProfileRow[]> {
  const { rows } = await pool.query<AccountProfileRow>(
    `(
      SELECT avitag, account_id, is_verified, 'STUDENT'::TEXT AS profile_type,
             COALESCE(display_name, first_name || ' ' || last_name) AS display_name, image_url, created_at
      FROM student_profiles WHERE account_id = $1 AND profile_status = 'ACTIVE'
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'KREATOR'::TEXT AS profile_type, display_name, image_url, joined_at AS created_at
      FROM kreator_profiles WHERE account_id = $1 AND profile_status = 'ACTIVE'
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'KOMPANY'::TEXT AS profile_type, display_name, image_url, created_at
      FROM kompany_profiles WHERE account_id = $1 AND profile_status = 'ACTIVE'
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'SCHOOL'::TEXT AS profile_type, display_name, image_url, created_at
      FROM school_profiles WHERE account_id = $1 AND profile_status = 'ACTIVE'
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'IDIOT'::TEXT AS profile_type, display_name, image_url, created_at
      FROM idiot_profiles WHERE account_id = $1 AND profile_status = 'ACTIVE'
    )
    ORDER BY created_at DESC`,
    [account_id]
  );
  return rows;
}

/**
 * Every field defined on any of the 5 profile types — a superset, most of
 * it null for any given row depending on `profile_type`. Kept separate from
 * AccountProfileRow/listByAccount (used by the consumer app's own
 * /account/profile response) rather than widening that shared shape: this
 * is purely for the admin account-detail screen, and there's no reason to
 * bloat a widely-hit consumer endpoint's response with fields like
 * earnings_balance/social_links just because the admin panel wants to
 * display them.
 */
export interface AccountProfileFullRow extends AccountProfileRow {
  first_name: string | null;
  last_name: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  bio: string | null;
  hobbies: string[] | null;
  degree: string | null;
  description: string | null;
  website: string | null;
  phone_number: string | null;
  contact_email: string | null;
  social_links: Record<string, unknown> | null;
  engagement_score: number | null;
  earnings_balance: string | null;
  monetization_enabled: boolean | null;
  top_gist_id: string | null;
}

/**
 * Admin-only, full-detail version of listByAccount() — every column any of
 * the 5 profile types actually has (level/campus/major/bio/hobbies for
 * students, description/website/phone/social links for the business-y
 * types, etc.), padded with typed NULLs per branch so the UNION ALL lines
 * up. Every enum/JSONB column is cast explicitly (::text, ::jsonb) rather
 * than left to infer, same lesson learned from gists.repo.ts's earlier
 * gist_status enum-vs-text bug — this was tested directly against the live
 * database before shipping, not just type-checked.
 *
 * profile_type is emitted LOWERCASE ('student', not 'STUDENT') — unlike
 * listByAccount's own uppercase literals just above, which the
 * consumer-facing /account/profile response has always used. This
 * function's own output feeds the admin Users detail page, which indexes
 * profileEditFields.ts's PROFILE_EDIT_FIELDS/PROFILE_TYPE_PATH maps — both
 * keyed lowercase, matching this app's actual `ProfileType` union
 * (src/types/index.ts: "student"|"kreator"|...). Emitting uppercase here
 * would silently return zero fields from every such lookup, the exact same
 * bug that's been quietly breaking the admin "Edit profile" form since it
 * shipped (it reads profile_type from this same account-detail response).
 */
export async function listByAccountFull(account_id: string): Promise<AccountProfileFullRow[]> {
  const { rows } = await pool.query<AccountProfileFullRow>(
    `(
      SELECT avitag, account_id, is_verified, 'student'::text AS profile_type,
             COALESCE(display_name, first_name || ' ' || last_name) AS display_name,
             image_url, created_at,
             first_name, last_name, campus_tag, major_tag, level, bio, hobbies, degree::text AS degree,
             NULL::text AS description, NULL::text AS website, NULL::text AS phone_number,
             NULL::text AS contact_email, NULL::jsonb AS social_links,
             NULL::double precision AS engagement_score, NULL::numeric AS earnings_balance,
             NULL::boolean AS monetization_enabled, NULL::uuid AS top_gist_id
      FROM student_profiles WHERE account_id = $1
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'kreator'::text, display_name, image_url, joined_at,
             NULL, NULL, campustag, NULL, NULL, NULL, NULL, NULL,
             description, NULL, NULL, NULL, NULL,
             engagement_score, earnings_balance, monetization_enabled, top_gist_id
      FROM kreator_profiles WHERE account_id = $1
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'kompany'::text, display_name, image_url, created_at,
             NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
             description, website, phone_number, email, social_links,
             NULL, NULL, NULL, NULL
      FROM kompany_profiles WHERE account_id = $1
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'school'::text, display_name, image_url, created_at,
             NULL, NULL, campus_tag, NULL, NULL, NULL, NULL, NULL,
             description, website, NULL, NULL, NULL,
             NULL, NULL, NULL, NULL
      FROM school_profiles WHERE account_id = $1
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'idiot'::text, display_name, image_url, created_at,
             NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
             description, NULL, NULL, NULL, NULL,
             NULL, NULL, NULL, NULL
      FROM idiot_profiles WHERE account_id = $1
    )
    ORDER BY created_at DESC`,
    [account_id]
  );
  return rows;
}
