import { pool } from "../../config/db";

export interface GistRow {
  gist_id: string;
  avitag: string;
  account_id: string;
  profile_id: string;
  profile_type: string;
  gist_text: string;
  campus_tag?: string | null;
  major_tag?: string | null;
  created_at: string;
  edited_at: string | null;
  edit_count: number;
  is_reported: boolean;
  gist_status?: "SUBMITTED" | "APPROVED" | "REJECTED";
}

export interface GistCounts {
  gist_id: string;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
}

export async function getCounts(gist_id: string): Promise<GistCounts | null> {
  const { rows } = await pool.query<GistCounts>(
    `SELECT gist_id, reactions_count, comments_count, views_count, reports_count FROM v_gist_counts WHERE gist_id = $1`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function getReactionBreakdownForGist(
  gist_id: string
): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ type: string; count: string }>(
    `SELECT type, COUNT(*)::int AS count FROM reactions WHERE entity_type = 'GIST' AND entity_id = $1 GROUP BY type`,
    [gist_id]
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.type] = Number(r.count);
  return map;
}

export async function getCountsFull(gist_id: string): Promise<{
  counts: GistCounts | null;
  reactions_by_type: Record<string, number>;
}> {
  const [counts, reactions_by_type] = await Promise.all([
    getCounts(gist_id),
    getReactionBreakdownForGist(gist_id),
  ]);
  return { counts, reactions_by_type };
}

 
export interface GistWithCounts extends GistRow {
  first_name: string | null;
  image_url: string | null;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
  /** The viewer's own reaction on this gist, if any — null when there's no
   * viewer (unauthenticated) or they haven't reacted. Lets the client show
   * the right reaction as already-selected without a separate per-gist
   * fetch. */
  my_reaction: string | null;
  /** Whether the viewer has already reported this gist — false for a
   * guest or a viewer who hasn't. Persisted server-side (a real DB check,
   * not session-local UI state), so it survives reloads/new sessions. */
  my_report: boolean;
  /** Per-emoji reaction counts, e.g. { FIRE: 3, LOVE: 1 } — drives the
   * per-emoji numbers in the reaction picker without a separate
   * /gists/:id/counts round trip for every gist in a list. */
  reactions_by_type: Record<string, number>;
  media: Array<{
    media_id: string;
    media_type: "IMAGE" | "VIDEO";
    media_url: string;
    thumbnail_url: string | null;
    order_index: number;
    uploaded_at: string;
    edited_at: string | null;
  }>;
}

export async function findWithCountsAnyStatus(
  gist_id: string,
  viewerAvitag?: string
): Promise<GistWithCounts | null> {
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, sp.first_name, sp.image_url, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
     FROM gists g
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     LEFT JOIN LATERAL (
       SELECT type FROM reactions
       WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $2::text
       LIMIT 1
     ) mr ON TRUE
     LEFT JOIN LATERAL (
       SELECT EXISTS (
         SELECT 1 FROM gist_reports
         WHERE gist_id = g.gist_id AND reporter_avitag = $2::text
       ) AS reported
     ) mrp ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
       FROM (
         SELECT type, COUNT(*)::int AS cnt FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id
         GROUP BY type
       ) rt
     ) rbt ON TRUE
     WHERE g.gist_id = $1`,
    [gist_id, viewerAvitag ?? null]
  );
  return rows[0] ?? null;
}

/**
 * The shared-link experience: one target gist (any status — this is the
 * specific thing someone deliberately shared, so it's visible regardless;
 * the frontend renders a "removed" state itself for a REJECTED one rather
 * than the backend hiding it outright) plus chronological neighbors on
 * each side. Siblings stay APPROVED-only, same as every other list this
 * app shows — the exception is only for the one gist someone actually
 * shared, not a backdoor into browsing unapproved content generally.
 */
export async function getContext(
  gist_id: string,
  before: number,
  after: number,
  viewerAvitag?: string
): Promise<{ target: GistWithCounts; before: GistWithCounts[]; after: GistWithCounts[] } | null> {
  const target = await findWithCountsAnyStatus(gist_id, viewerAvitag);
  if (!target) return null;

  const [beforeRes, afterRes] = await Promise.all([
    pool.query<GistWithCounts>(
      `SELECT g.*, sp.first_name, sp.image_url, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
              COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
       FROM gists g
       LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
       LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'media_id', gm.media_id,
           'media_type', gm.media_type,
           'media_url', gm.media_url,
           'thumbnail_url', gm.thumbnail_url,
           'order_index', gm.order_index,
           'uploaded_at', gm.uploaded_at,
           'edited_at', gm.edited_at
         ) ORDER BY gm.order_index ASC) AS media
         FROM gist_media gm WHERE gm.gist_id = g.gist_id
       ) m ON TRUE
       LEFT JOIN LATERAL (
         SELECT type FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $3::text
         LIMIT 1
       ) mr ON TRUE
       LEFT JOIN LATERAL (
         SELECT EXISTS (
           SELECT 1 FROM gist_reports
           WHERE gist_id = g.gist_id AND reporter_avitag = $3::text
         ) AS reported
       ) mrp ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
         FROM (
           SELECT type, COUNT(*)::int AS cnt FROM reactions
           WHERE entity_type = 'GIST' AND entity_id = g.gist_id
           GROUP BY type
         ) rt
       ) rbt ON TRUE
       WHERE g.gist_status = 'APPROVED' AND g.created_at < $1
       ORDER BY g.created_at DESC
       LIMIT $2`,
      [target.created_at, before, viewerAvitag ?? null]
    ),
    pool.query<GistWithCounts>(
      `SELECT g.*, sp.first_name, sp.image_url, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
              COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
       FROM gists g
       LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
       LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'media_id', gm.media_id,
           'media_type', gm.media_type,
           'media_url', gm.media_url,
           'thumbnail_url', gm.thumbnail_url,
           'order_index', gm.order_index,
           'uploaded_at', gm.uploaded_at,
           'edited_at', gm.edited_at
         ) ORDER BY gm.order_index ASC) AS media
         FROM gist_media gm WHERE gm.gist_id = g.gist_id
       ) m ON TRUE
       LEFT JOIN LATERAL (
         SELECT type FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $3::text
         LIMIT 1
       ) mr ON TRUE
       LEFT JOIN LATERAL (
         SELECT EXISTS (
           SELECT 1 FROM gist_reports
           WHERE gist_id = g.gist_id AND reporter_avitag = $3::text
         ) AS reported
       ) mrp ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
         FROM (
           SELECT type, COUNT(*)::int AS cnt FROM reactions
           WHERE entity_type = 'GIST' AND entity_id = g.gist_id
           GROUP BY type
         ) rt
       ) rbt ON TRUE
       WHERE g.gist_status = 'APPROVED' AND g.created_at > $1
       ORDER BY g.created_at ASC
       LIMIT $2`,
      [target.created_at, after, viewerAvitag ?? null]
    ),
  ]);

  return { target, before: beforeRes.rows, after: afterRes.rows };
}

export async function create(
  avitag: string,
  account_id: string,
  profile_id: string,
  profile_type: string,
  gist_text: string,
  campus_tag: string | null,
  major_tag: string | null,
): Promise<GistRow> {
  const { rows } = await pool.query<GistRow>(
    `INSERT INTO gists (avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag]
  );
  return rows[0];
}

export async function updateText(
  gist_id: string,
  avitag: string,
  gist_text: string
): Promise<GistRow | null> {
  const { rows } = await pool.query<GistRow>(
    `UPDATE gists SET gist_text = $1, edited_at = NOW(), edit_count = edit_count + 1
     WHERE gist_id = $2 AND avitag = $3 RETURNING *`,
    [gist_text, gist_id, avitag]
  );
  return rows[0] ?? null;
}

export async function remove(
  gist_id: string,
  avitag: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM gists WHERE gist_id = $1 AND avitag = $2`,
    [gist_id, avitag]
  );
  return (rowCount || 0) > 0;
}

export async function removeAsIdiot(gist_id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM gists WHERE gist_id = $1`,
    [gist_id]
  );
  return (rowCount || 0) > 0;
}

export async function findById(gist_id: string): Promise<GistRow | null> {
  const { rows } = await pool.query<GistRow>(
    `SELECT * FROM gists WHERE gist_id = $1`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function findWithCounts(
  gist_id: string,
  viewerAvitag?: string
): Promise<GistWithCounts | null> {
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, sp.first_name, sp.image_url, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
     FROM gists g
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     LEFT JOIN LATERAL (
       SELECT type FROM reactions
       WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $2::text
       LIMIT 1
     ) mr ON TRUE
     LEFT JOIN LATERAL (
       SELECT EXISTS (
         SELECT 1 FROM gist_reports
         WHERE gist_id = g.gist_id AND reporter_avitag = $2::text
       ) AS reported
     ) mrp ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
       FROM (
         SELECT type, COUNT(*)::int AS cnt FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id
         GROUP BY type
       ) rt
     ) rbt ON TRUE
     WHERE g.gist_id = $1 AND g.gist_status = 'APPROVED'`,
    [gist_id, viewerAvitag ?? null]
  );
  return rows[0] ?? null;
}

export async function listRecent(
  limit = 20,
  cursor?: string,
  viewerAvitag?: string,
  filters?: { campus_tag?: string | null; major_tag?: string | null }
): Promise<GistWithCounts[]> {
  const campus = filters?.campus_tag ?? null;
  const major = filters?.major_tag ?? null;
  if (cursor) {
    const { rows } = await pool.query<GistWithCounts>(
      `SELECT g.*, sp.first_name, sp.image_url, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
              COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
       FROM gists g
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
       LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'media_id', gm.media_id,
           'media_type', gm.media_type,
           'media_url', gm.media_url,
           'thumbnail_url', gm.thumbnail_url,
           'order_index', gm.order_index,
           'uploaded_at', gm.uploaded_at,
           'edited_at', gm.edited_at
         ) ORDER BY gm.order_index ASC) AS media
         FROM gist_media gm WHERE gm.gist_id = g.gist_id
       ) m ON TRUE
       LEFT JOIN LATERAL (
         SELECT type FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $3::text
         LIMIT 1
       ) mr ON TRUE
       LEFT JOIN LATERAL (
         SELECT EXISTS (
           SELECT 1 FROM gist_reports
           WHERE gist_id = g.gist_id AND reporter_avitag = $3::text
         ) AS reported
       ) mrp ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
         FROM (
           SELECT type, COUNT(*)::int AS cnt FROM reactions
           WHERE entity_type = 'GIST' AND entity_id = g.gist_id
           GROUP BY type
         ) rt
       ) rbt ON TRUE
       WHERE g.created_at < (SELECT created_at FROM gists WHERE gist_id = $1)
        AND (g.gist_status = 'APPROVED' OR ($3::text IS NOT NULL AND g.avitag = $3::text))
        AND ($4::text IS NULL OR g.campus_tag = $4::text)
        AND ($5::text IS NULL OR g.major_tag = $5::text)
       ORDER BY g.created_at DESC
       LIMIT $2`,
      [cursor, limit, viewerAvitag ?? null, campus, major]
    );
    return rows;
  }
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, sp.first_name, sp.image_url, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
     FROM gists g
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     LEFT JOIN LATERAL (
       SELECT type FROM reactions
       WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $1::text
       LIMIT 1
     ) mr ON TRUE
     LEFT JOIN LATERAL (
       SELECT EXISTS (
         SELECT 1 FROM gist_reports
         WHERE gist_id = g.gist_id AND reporter_avitag = $1::text
       ) AS reported
     ) mrp ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
       FROM (
         SELECT type, COUNT(*)::int AS cnt FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id
         GROUP BY type
       ) rt
     ) rbt ON TRUE
     WHERE (g.gist_status = 'APPROVED' OR ($1::text IS NOT NULL AND g.avitag = $1::text))
       AND ($2::text IS NULL OR g.campus_tag = $2::text)
       AND ($3::text IS NULL OR g.major_tag = $3::text)
     ORDER BY g.created_at DESC LIMIT $4`,
    [viewerAvitag ?? null, campus, major, limit]
  );
  return rows;
}

export async function listByUser(
  avitag: string,
  limit = 20,
  cursor?: string,
  viewerAvitag?: string
): Promise<GistWithCounts[]> {
  if (cursor) {
    const { rows } = await pool.query<GistWithCounts>(
      `SELECT g.*, sp.first_name, sp.image_url, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
              COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
       FROM gists g
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
       LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'media_id', gm.media_id,
           'media_type', gm.media_type,
           'media_url', gm.media_url,
           'thumbnail_url', gm.thumbnail_url,
           'order_index', gm.order_index,
           'uploaded_at', gm.uploaded_at,
           'edited_at', gm.edited_at
         ) ORDER BY gm.order_index ASC) AS media
         FROM gist_media gm WHERE gm.gist_id = g.gist_id
       ) m ON TRUE
       LEFT JOIN LATERAL (
         SELECT type FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $4::text
         LIMIT 1
       ) mr ON TRUE
       LEFT JOIN LATERAL (
         SELECT EXISTS (
           SELECT 1 FROM gist_reports
           WHERE gist_id = g.gist_id AND reporter_avitag = $4::text
         ) AS reported
       ) mrp ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
         FROM (
           SELECT type, COUNT(*)::int AS cnt FROM reactions
           WHERE entity_type = 'GIST' AND entity_id = g.gist_id
           GROUP BY type
         ) rt
       ) rbt ON TRUE
       WHERE g.avitag = $1 AND g.created_at < (SELECT created_at FROM gists WHERE gist_id = $2)
         AND (g.gist_status = 'APPROVED' OR ($4::text IS NOT NULL AND g.avitag = $4::text))
       ORDER BY g.created_at DESC LIMIT $3`,
      [avitag, cursor, limit, viewerAvitag ?? null]
    );
    return rows;
  }
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, sp.first_name, sp.image_url, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
     FROM gists g
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     LEFT JOIN LATERAL (
       SELECT type FROM reactions
       WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $3::text
       LIMIT 1
     ) mr ON TRUE
     LEFT JOIN LATERAL (
       SELECT EXISTS (
         SELECT 1 FROM gist_reports
         WHERE gist_id = g.gist_id AND reporter_avitag = $3::text
       ) AS reported
     ) mrp ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
       FROM (
         SELECT type, COUNT(*)::int AS cnt FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id
         GROUP BY type
       ) rt
     ) rbt ON TRUE
     WHERE g.avitag = $1 AND (g.gist_status = 'APPROVED' OR ($3::text IS NOT NULL AND g.avitag = $3::text))
     ORDER BY g.created_at DESC LIMIT $2`,
    [avitag, limit, viewerAvitag ?? null]
  );
  return rows;
}

export async function trending(limit = 20, viewerAvitag?: string, filters?: { campus_tag?: string | null; major_tag?: string | null }): Promise<
  Array<
    GistWithCounts & {
      score: number;
      reactions_3d: number;
      comments_3d: number;
    }
  >
> {
  const campus = filters?.campus_tag ?? null;
  const major = filters?.major_tag ?? null;
  const { rows } = await pool.query<any>(
    `SELECT g.*, sp.first_name, sp.image_url, counts.reactions_count, counts.comments_count, counts.views_count, counts.reports_count,
            t.score, t.reactions_3d, t.comments_3d,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
     FROM v_gist_trending_3d t
     JOIN gists g ON g.gist_id = t.gist_id
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
     LEFT JOIN v_gist_counts counts ON counts.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     LEFT JOIN LATERAL (
       SELECT type FROM reactions
       WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $1::text
       LIMIT 1
     ) mr ON TRUE
     LEFT JOIN LATERAL (
       SELECT EXISTS (
         SELECT 1 FROM gist_reports
         WHERE gist_id = g.gist_id AND reporter_avitag = $1::text
       ) AS reported
     ) mrp ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
       FROM (
         SELECT type, COUNT(*)::int AS cnt FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id
         GROUP BY type
       ) rt
     ) rbt ON TRUE
     WHERE (g.gist_status = 'APPROVED' OR ($1::text IS NOT NULL AND g.avitag = $1::text))
       AND ($2::text IS NULL OR g.campus_tag = $2::text)
       AND ($3::text IS NULL OR g.major_tag = $3::text)
     ORDER BY t.score DESC
     LIMIT $4`,
    [viewerAvitag ?? null, campus, major, limit]
  );
  return rows;
}

export async function search(
  term: string,
  limit = 20,
  offset = 0,
  viewerAvitag?: string,
  filters?: { campus_tag?: string | null; major_tag?: string | null }
): Promise<GistWithCounts[]> {
  const q = `%${term}%`;
  const campus = filters?.campus_tag ?? null;
  const major = filters?.major_tag ?? null;
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, sp.first_name, sp.image_url, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type
     FROM gists g
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'media_id', gm.media_id,
         'media_type', gm.media_type,
         'media_url', gm.media_url,
         'thumbnail_url', gm.thumbnail_url,
         'order_index', gm.order_index,
         'uploaded_at', gm.uploaded_at,
         'edited_at', gm.edited_at
       ) ORDER BY gm.order_index ASC) AS media
       FROM gist_media gm WHERE gm.gist_id = g.gist_id
     ) m ON TRUE
     LEFT JOIN LATERAL (
       SELECT type FROM reactions
       WHERE entity_type = 'GIST' AND entity_id = g.gist_id AND avitag = $6::text
       LIMIT 1
     ) mr ON TRUE
     LEFT JOIN LATERAL (
       SELECT EXISTS (
         SELECT 1 FROM gist_reports
         WHERE gist_id = g.gist_id AND reporter_avitag = $6::text
       ) AS reported
     ) mrp ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(jsonb_object_agg(rt.type, rt.cnt), '{}'::jsonb) AS by_type
       FROM (
         SELECT type, COUNT(*)::int AS cnt FROM reactions
         WHERE entity_type = 'GIST' AND entity_id = g.gist_id
         GROUP BY type
       ) rt
     ) rbt ON TRUE
     WHERE (g.gist_status = 'APPROVED' OR ($6::text IS NOT NULL AND g.avitag = $6::text))
       AND ($4::text IS NULL OR g.campus_tag = $4::text)
       AND ($5::text IS NULL OR g.major_tag = $5::text)
       AND g.gist_text ILIKE $1
     ORDER BY g.created_at DESC
     LIMIT $2 OFFSET $3`,
    [q, limit, offset, campus, major, viewerAvitag ?? null]
  );
  return rows;
}

/** Returns false (and inserts nothing) when this reporter already has a
 * report on this gist — ON CONFLICT DO NOTHING on the unique
 * (gist_id, reporter_avitag) constraint, not a separate SELECT-then-INSERT,
 * so a duplicate double-click can't race its way past the check. */
export async function report(
  gist_id: string,
  reporter_avitag: string,
  reason: string | null
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO gist_reports (gist_id, reporter_avitag, reason) VALUES ($1, $2, $3)
     ON CONFLICT (gist_id, reporter_avitag) DO NOTHING`,
    [gist_id, reporter_avitag, reason]
  );
  if (!rowCount) return false;
  await pool.query(`UPDATE gists SET is_reported = TRUE WHERE gist_id = $1`, [
    gist_id,
  ]);
  return true;
}

export async function incrementView(
  gist_id: string,
  avitag: string | null
): Promise<void> {
  await pool.query(`INSERT INTO gist_views (gist_id, avitag) VALUES ($1, $2)`, [
    gist_id,
    avitag,
  ]);
}

// Moderation helpers (used by idiot routes)
export async function approveGist(gist_id: string): Promise<GistRow | null> {
  const { rows } = await pool.query<GistRow>(
    `UPDATE gists SET gist_status = 'APPROVED', edited_at = NOW() WHERE gist_id = $1 RETURNING *`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function rejectGist(gist_id: string): Promise<GistRow | null> {
  const { rows } = await pool.query<GistRow>(
    `UPDATE gists SET gist_status = 'REJECTED', edited_at = NOW() WHERE gist_id = $1 RETURNING *`,
    [gist_id]
  );
  return rows[0] ?? null;
}

export async function listPendingGists(
  limit = 20,
  offset = 0
): Promise<GistRow[]> {
  const { rows } = await pool.query<GistRow>(
    `SELECT * FROM gists WHERE gist_status = 'SUBMITTED' ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}
