import { pool } from '../../config/db';
import type { GistRow, GistWithCounts } from '../gist/gist.repo';

/**
 * Row shape for the admin "browse every gist" screen (GET /idiot/gists).
 * Unlike gist.repo.ts's listByUser/findWithCounts (student_profiles-only
 * join, which leaves a KREATOR/KOMPANY/SCHOOL/IDIOT poster showing a null
 * name), this COALESCEs across all 5 profile tables — same pattern as
 * users.repo.ts's searchUsers() and gist.repo.ts's own
 * listPendingGistsWithDetails(). campus_tag/major_tag here are gists' own
 * denormalized columns (g.*, from migration 0028) rather than a live join
 * onto student_profiles — this endpoint is deliberately simpler than the
 * consumer-facing feed queries, which re-derive campus_tag/major_tag/level
 * live off student_profiles because they can't tolerate staleness; an admin
 * browse screen has no such requirement, and the campus_tag filter is
 * explicitly meant to match what's actually stored on the gist row.
 */
export interface AdminGistRow extends GistRow {
  display_name: string | null;
  image_url: string | null;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
  shares_count: number;
  media: GistWithCounts['media'];
  /** Per-type reaction breakdown (e.g. { LIKE: 3, FIRE: 1 }) — same
   * jsonb_object_agg pattern as gist.repo.ts's findWithCounts/listByUser
   * (`rbt` join), added so the admin browse screen can show the same real
   * reaction breakdown the consumer app does, not just a flat total. */
  reactions_by_type: Record<string, number>;
}

export interface AdminGistFilters {
  status?: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | null;
  search?: string | null;
  campus_tag?: string | null;
  /** Scopes to one poster's own gists — used by the profile-view page's
   * gists section. Matches g.avitag exactly (not ILIKE, unlike the free-text
   * `search` param's own avitag matching above). */
  avitag?: string | null;
  limit?: number;
  cursor?: string;
}

// The shared SELECT/JOIN body both branches below use verbatim — kept as one
// template literal purely to avoid the two branches drifting out of sync
// with each other over time; the two branches themselves stay fully
// separate query strings (rather than one query with a conditionally-built
// cursor clause) to mirror gist.repo.ts's listByUser(), which this endpoint
// was told to copy the pagination shape of exactly.
const ADMIN_GIST_SELECT = `
  SELECT g.*,
         COALESCE(sp.display_name, sp.first_name || ' ' || sp.last_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS display_name,
         COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url,
         COALESCE(c.reactions_count, 0)::int AS reactions_count,
         COALESCE(c.comments_count, 0)::int AS comments_count,
         COALESCE(c.views_count, 0)::int AS views_count,
         COALESCE(c.reports_count, 0)::int AS reports_count,
         COALESCE(c.shares_count, 0)::int AS shares_count,
         COALESCE(m.media, '[]'::json) AS media,
         rbt.by_type AS reactions_by_type
  FROM gists g
  LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
  LEFT JOIN kreator_profiles kp ON kp.avitag = g.avitag
  LEFT JOIN kompany_profiles kmp ON kmp.avitag = g.avitag
  LEFT JOIN school_profiles scp ON scp.avitag = g.avitag
  LEFT JOIN idiot_profiles idp ON idp.avitag = g.avitag
  LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
      'media_id', gm.media_id,
      'media_type', gm.media_type,
      'media_url', gm.media_url,
      'thumbnail_url', gm.thumbnail_url,
      'width', gm.width,
      'height', gm.height,
      'order_index', gm.order_index,
      'uploaded_at', gm.uploaded_at,
      'edited_at', gm.edited_at
    ) ORDER BY gm.order_index ASC) AS media
    FROM gist_media gm WHERE gm.gist_id = g.gist_id
  ) m ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
    FROM (
      SELECT type, COUNT(*)::int AS cnt FROM reactions
      WHERE entity_type = 'GIST' AND entity_id = g.gist_id
      GROUP BY type
    ) rt
  ) rbt ON TRUE
`;

// The search/status/campus/avitag predicates common to both branches — $1
// status, $2 search (already wrapped in %...% by the caller), $3 campus, $4
// avitag. Deliberately no REJECTED exception the way listByUser()'s
// `AND (g.gist_status != 'REJECTED' OR ...)` has — this whole endpoint
// exists to show every status unfiltered by default, REJECTED included.
const ADMIN_GIST_WHERE = `
  WHERE ($1::text IS NULL OR g.gist_status::text = $1::text)
    AND ($3::text IS NULL OR g.campus_tag = $3::text)
    AND ($4::text IS NULL OR g.avitag = $4::text)
    AND ($2::text IS NULL OR g.gist_text ILIKE $2 OR g.avitag ILIKE $2
         OR COALESCE(sp.display_name, sp.first_name || ' ' || sp.last_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) ILIKE $2)
`;

export async function listAllGistsForAdmin(filters: AdminGistFilters): Promise<AdminGistRow[]> {
  const status = filters.status ?? null;
  const search = filters.search ? `%${filters.search}%` : null;
  const campus = filters.campus_tag ?? null;
  const avitag = filters.avitag ?? null;
  const limit = filters.limit ?? 20;

  if (filters.cursor) {
    const { rows } = await pool.query<AdminGistRow>(
      `${ADMIN_GIST_SELECT}
       ${ADMIN_GIST_WHERE}
         AND g.created_at < (SELECT created_at FROM gists WHERE gist_id = $5)
       ORDER BY g.created_at DESC
       LIMIT $6`,
      [status, search, campus, avitag, filters.cursor, limit]
    );
    return rows;
  }

  const { rows } = await pool.query<AdminGistRow>(
    `${ADMIN_GIST_SELECT}
     ${ADMIN_GIST_WHERE}
     ORDER BY g.created_at DESC
     LIMIT $5`,
    [status, search, campus, avitag, limit]
  );
  return rows;
}
