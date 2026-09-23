import { pool } from '../../config/db';

/**
 * Row shape for the admin "browse every Spot" screen (GET /idiot/spots) —
 * same reasoning as idiot/gists.repo.ts's AdminGistRow: COALESCEs across all
 * 5 profile tables (a KREATOR/KOMPANY/SCHOOL/IDIOT poster would otherwise
 * show a null name), which the consumer-facing spot.repo.ts queries don't
 * need to since Spot itself has none of those poster types in practice yet.
 */
export interface AdminSpotRow {
  spot_id: string;
  avitag: string;
  account_id: string;
  profile_id: string;
  profile_type: string;
  caption: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  public_id: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'REJECTED' | 'REMOVED';
  is_reported: boolean;
  created_at: string;
  edited_at: string | null;
  edit_count: number;
  display_name: string | null;
  image_url: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
  shares_count: number;
}

export interface AdminSpotFilters {
  status?: 'DRAFT' | 'ACTIVE' | 'REJECTED' | 'REMOVED' | null;
  search?: string | null;
  /** Scopes to one poster's own Spots — used by the profile-view page's
   * Spots section. Matches s.avitag exactly (not ILIKE, unlike the
   * free-text `search` param's own avitag matching below). */
  avitag?: string | null;
  limit?: number;
  cursor?: string;
}

const ADMIN_SPOT_SELECT = `
  SELECT s.*,
         COALESCE(sp.display_name, sp.first_name || ' ' || sp.last_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS display_name,
         COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url,
         sp.campus_tag, sp.major_tag, sp.level,
         COALESCE(c.reactions_count, 0)::int AS reactions_count,
         COALESCE(c.comments_count, 0)::int AS comments_count,
         COALESCE(c.views_count, 0)::int AS views_count,
         COALESCE(c.reports_count, 0)::int AS reports_count,
         COALESCE(c.shares_count, 0)::int AS shares_count
  FROM spots s
  LEFT JOIN student_profiles sp ON sp.avitag = s.avitag
  LEFT JOIN kreator_profiles kp ON kp.avitag = s.avitag
  LEFT JOIN kompany_profiles kmp ON kmp.avitag = s.avitag
  LEFT JOIN school_profiles scp ON scp.avitag = s.avitag
  LEFT JOIN idiot_profiles idp ON idp.avitag = s.avitag
  LEFT JOIN v_spot_counts c ON c.spot_id = s.spot_id
`;

// $1 status, $2 search, $3 avitag. Unlike consumer queries, no REJECTED/
// REMOVED exception — this endpoint exists to show every status. DRAFT is
// the one exception: with no explicit status filter, DRAFT rows (an
// abandoned/incomplete upload — media_url still null) are excluded by
// default, since they aren't real posts and would just be noise in a
// "browse every Spot" list; passing `?status=DRAFT` explicitly still shows
// them, for the rare case an admin actually wants to see stuck uploads.
const ADMIN_SPOT_WHERE = `
  WHERE ($1::text IS NULL OR s.status::text = $1::text)
    AND ($1::text IS NOT NULL OR s.status != 'DRAFT')
    AND ($3::text IS NULL OR s.avitag = $3::text)
    AND ($2::text IS NULL OR s.caption ILIKE $2 OR s.avitag ILIKE $2
         OR COALESCE(sp.display_name, sp.first_name || ' ' || sp.last_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) ILIKE $2)
`;

export async function listAllSpotsForAdmin(filters: AdminSpotFilters): Promise<AdminSpotRow[]> {
  const status = filters.status ?? null;
  const search = filters.search ? `%${filters.search}%` : null;
  const avitag = filters.avitag ?? null;
  const limit = filters.limit ?? 20;

  if (filters.cursor) {
    const { rows } = await pool.query<AdminSpotRow>(
      `${ADMIN_SPOT_SELECT}
       ${ADMIN_SPOT_WHERE}
         AND s.created_at < (SELECT created_at FROM spots WHERE spot_id = $4)
       ORDER BY s.created_at DESC
       LIMIT $5`,
      [status, search, avitag, filters.cursor, limit]
    );
    return rows;
  }

  const { rows } = await pool.query<AdminSpotRow>(
    `${ADMIN_SPOT_SELECT}
     ${ADMIN_SPOT_WHERE}
     ORDER BY s.created_at DESC
     LIMIT $4`,
    [status, search, avitag, limit]
  );
  return rows;
}

/** The true total behind listAllSpotsForAdmin's cursor pagination — same
 * "count only on the first page" trick the consumer-facing countByUser
 * uses. Applies the same filters (minus cursor, which is irrelevant to a
 * total) so the count always matches whatever the current filtered view
 * shows. */
export async function countAllSpotsForAdmin(filters: Omit<AdminSpotFilters, 'limit' | 'cursor'>): Promise<number> {
  const status = filters.status ?? null;
  const search = filters.search ? `%${filters.search}%` : null;
  const avitag = filters.avitag ?? null;
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM spots s
     LEFT JOIN student_profiles sp ON sp.avitag = s.avitag
     LEFT JOIN kreator_profiles kp ON kp.avitag = s.avitag
     LEFT JOIN kompany_profiles kmp ON kmp.avitag = s.avitag
     LEFT JOIN school_profiles scp ON scp.avitag = s.avitag
     LEFT JOIN idiot_profiles idp ON idp.avitag = s.avitag
     ${ADMIN_SPOT_WHERE}`,
    [status, search, avitag]
  );
  return Number(rows[0]?.count ?? 0);
}
