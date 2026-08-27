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
  /** Only ever populated for a STUDENT poster (the only profile type with
   * a level at all) — same "actually comes from the live sp join, not g's
   * own column despite the shared name" story as campus_tag/major_tag
   * above. */
  level?: number | null;
  /** Poster's own pick for the short-text hero color, one of GIST_COLOR_KEYS
   * — null when they didn't choose one, in which case the frontend falls
   * back to its existing gist_id-hash-based color. */
  color_key?: string | null;
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
  shares_count: number;
}

export async function getCounts(gist_id: string): Promise<GistCounts | null> {
  const { rows } = await pool.query<GistCounts>(
    `SELECT gist_id, reactions_count, comments_count, views_count, reports_count, shares_count FROM v_gist_counts WHERE gist_id = $1`,
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
  shares_count: number;
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
  /** Only populated by listRecent()'s ranked feed — true once this gist
   * has already been reacted to or commented on by the viewer, i.e. it's
   * past the "unseen" tier. The frontend uses this to draw a one-time
   * "you're caught up" divider at the exact point the feed crosses from
   * fresh content into reruns. */
  _feed_seen?: boolean;
  /** Only populated by listRecent()'s ranked feed — an opaque pagination
   * token encoding this row's (seen, score, created_at, gist_id) position
   * in the ranked order. The frontend never inspects it, just hands the
   * last item's token back as the next page's `cursor`, same as it always
   * handed back a plain gist_id before ranking existed. */
  _feed_cursor?: string;
  media: Array<{
    media_id: string;
    media_type: "IMAGE" | "VIDEO";
    media_url: string;
    thumbnail_url: string | null;
    width: number | null;
    height: number | null;
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
    `SELECT g.*, sp.first_name, sp.image_url, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
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
         'width', gm.width,
         'height', gm.height,
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
      `SELECT g.*, sp.first_name, sp.image_url, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
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
           'width', gm.width,
           'height', gm.height,
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
      `SELECT g.*, sp.first_name, sp.image_url, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
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
           'width', gm.width,
           'height', gm.height,
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
  color_key: string | null,
): Promise<GistRow> {
  const { rows } = await pool.query<GistRow>(
    `INSERT INTO gists (avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag, color_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag, color_key]
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
    `SELECT g.*, sp.first_name, sp.image_url, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
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
         'width', gm.width,
         'height', gm.height,
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

interface FeedCursor {
  seen: boolean;
  score: number;
  created_at: string;
  gist_id: string;
  /** The instant age/score were computed relative to for this whole
   *  scroll session — see listRecent's own comment for why this can't
   *  just be NOW() on every request. */
  as_of: string;
}

/** Decodes the opaque `_feed_cursor` a previous listRecent() call handed
 *  back. Never trust its shape blindly — a malformed/tampered cursor just
 *  falls back to "serve from the top" rather than erroring the request. */
function decodeFeedCursor(cursor: string): FeedCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (
      typeof decoded?.seen === "boolean" &&
      typeof decoded?.score === "number" &&
      typeof decoded?.created_at === "string" &&
      typeof decoded?.gist_id === "string" &&
      typeof decoded?.as_of === "string"
    ) {
      return decoded;
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * The main feed. Ranked, not purely chronological — see gist.controller.ts
 * for the fuller reasoning, the short version: every gist the viewer
 * hasn't already reacted to or commented on ("unseen") sorts ahead of
 * everything they have, and within each of those two tiers, ordering is by
 * a decayed-engagement score (reactions + comments*3 + shares*5, divided
 * down by age) rather than raw created_at — so a post that's genuinely
 * getting traction right now can outrank one that's merely newer and
 * getting nothing. `feedScope.restrictToCampus` is the Gist/Amebo split:
 * mode "home" = only the viewer's own campus's students, plus every
 * non-student poster unconditionally; mode "school" = one specific OTHER
 * campus's students, plus — same as "home" — every non-student poster
 * unconditionally (a KREATOR/KOMPANY/SCHOOL/IDIOT post always shows
 * regardless of which campus filter is active; campus filtering only ever
 * applies to students, who are the only profile type that has a campus at
 * all); mode "none" = no campus filtering at all (Amebo, and the
 * graceful-degrade case for a guest or a non-student viewer who has no
 * "own campus" to filter Gist by in the first place).
 *
 * Because ordering isn't by a single column anymore, pagination can't be a
 * plain "give me everything before this timestamp" cursor — it's keyset
 * pagination on the full (seen, score, created_at, gist_id) tuple that
 * actually determines row order. See _feed_cursor on GistWithCounts for
 * how that's handed back to the client as one opaque token.
 *
 * One more thing keyset-on-a-live-score needs that keyset-on-created_at
 * never did: `score` isn't fixed the way a timestamp is — it decays every
 * second purely from the passage of time, with zero new engagement
 * needed. Recomputing it fresh against NOW() on every single page request
 * means the SAME gist's score is measurably lower by the time page 2 is
 * fetched than it was when page 1's cursor captured it a few seconds
 * earlier — which let that gist's now-lower score slip back under the
 * cursor's threshold and reappear as a duplicate (caught by hand while
 * building this: page 2 opened with the exact same gist page 1 ended on).
 * The fix is to freeze "now" for the whole scroll session: the first
 * request (no cursor) picks `as_of = NOW()` and every row's cursor for
 * that response carries it forward; every later request in the same
 * session reuses that same frozen instant for its own score/age math
 * instead of calling NOW() again, so a row's score can't drift against
 * itself between two pages of one scroll. It also means a gist created
 * *after* you started scrolling won't silently shuffle into a page you
 * haven't reached yet — new content during an active session surfaces
 * through the separate "new gists" pill instead, which is exactly the
 * seam that already exists for that.
 */
export async function listRecent(
  limit = 20,
  cursor?: string,
  viewerAvitag?: string,
  filters?: { major_tag?: string | null },
  feedScope?: { mode: "home" | "school" | "none"; campusTag: string | null }
): Promise<GistWithCounts[]> {
  const major = filters?.major_tag ?? null;
  const scopeMode = feedScope?.mode ?? "none";
  const campusTag = feedScope?.campusTag ?? null;
  const decoded = cursor ? decodeFeedCursor(cursor) : null;
  const asOf = decoded?.as_of ?? new Date().toISOString();

  // $1 (viewer) and $2 (limit) are fixed positions — every fragment below
  // that needs its own parameter appends to this array and reads back its
  // own index, so conditionally-included fragments (campus, cursor) can
  // never throw the numbering off regardless of which combination is
  // actually present on a given call.
  const params: unknown[] = [viewerAvitag ?? null, limit];

  let campusClause = "";
  if ((scopeMode === "home" || scopeMode === "school") && campusTag) {
    params.push(campusTag);
    campusClause = `AND (sp.campus_tag = $${params.length}::text OR sp.campus_tag IS NULL)`;
  }

  params.push(major);
  const majorIdx = params.length;

  params.push(asOf);
  const asOfIdx = params.length;

  let cursorClause = "";
  if (decoded) {
    params.push(decoded.seen, decoded.score, decoded.created_at, decoded.gist_id);
    const s = params.length - 3;
    cursorClause = `AND (feed.seen, feed.score, g.created_at, g.gist_id) < ($${s}::boolean, $${s + 1}::float8, $${s + 2}::timestamptz, $${s + 3}::uuid)`;
  }

  const { rows } = await pool.query<GistWithCounts & { _feed_score: number }>(
    `SELECT g.*, sp.first_name, sp.image_url, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type,
            feed.seen AS _feed_seen, feed.score AS _feed_score
     FROM gists g
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
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
     LEFT JOIN LATERAL (
       SELECT
         (CASE WHEN $1::text IS NULL THEN false ELSE (
           EXISTS (SELECT 1 FROM reactions r2 WHERE r2.entity_type = 'GIST' AND r2.entity_id = g.gist_id AND r2.avitag = $1::text)
           OR EXISTS (SELECT 1 FROM comments cm2 WHERE cm2.gist_id = g.gist_id AND cm2.avitag = $1::text)
         ) END) AS seen,
         (COALESCE(c.reactions_count, 0)::float8 * 1 + COALESCE(c.comments_count, 0)::float8 * 3 + COALESCE(c.shares_count, 0)::float8 * 5)
           / POWER(EXTRACT(EPOCH FROM ($${asOfIdx}::timestamptz - g.created_at)) / 3600.0 + 2, 1.5) AS score
     ) feed ON TRUE
     WHERE (g.gist_status = 'APPROVED' OR ($1::text IS NOT NULL AND g.avitag = $1::text))
       AND g.created_at <= $${asOfIdx}::timestamptz
       ${campusClause}
       AND ($${majorIdx}::text IS NULL OR sp.major_tag = $${majorIdx}::text)
       ${cursorClause}
     ORDER BY feed.seen ASC, feed.score DESC, g.created_at DESC, g.gist_id DESC
     LIMIT $2`,
    params
  );

  return rows.map((r) => {
    // _feed_score only exists to build the cursor below — it's never
    // meant to leak to the client as its own field, unlike _feed_seen
    // (which the frontend reads directly, for the "you're caught up"
    // divider) and _feed_cursor (opaque, just handed back verbatim).
    const { _feed_score, ...rest } = r;
    return {
      ...rest,
      _feed_cursor: Buffer.from(
        JSON.stringify({ seen: r._feed_seen, score: _feed_score, created_at: r.created_at, gist_id: r.gist_id, as_of: asOf })
      ).toString("base64"),
    };
  });
}

/**
 * A profile page's gist list — deliberately more permissive than the main
 * feed's listRecent()/trending() (APPROVED-only for everyone but the
 * poster): here, anyone gets SUBMITTED (not yet reviewed) and APPROVED, and
 * only REJECTED is hidden from a viewer who isn't the poster. The poster
 * themselves still sees all three regardless, same as everywhere else.
 */
export async function listByUser(
  avitag: string,
  limit = 20,
  cursor?: string,
  viewerAvitag?: string
): Promise<GistWithCounts[]> {
  if (cursor) {
    const { rows } = await pool.query<GistWithCounts>(
      `SELECT g.*, sp.first_name, sp.image_url, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
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
           'width', gm.width,
           'height', gm.height,
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
         AND (g.gist_status != 'REJECTED' OR ($4::text IS NOT NULL AND g.avitag = $4::text))
       ORDER BY g.created_at DESC LIMIT $3`,
      [avitag, cursor, limit, viewerAvitag ?? null]
    );
    return rows;
  }
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, sp.first_name, sp.image_url, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
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
         'width', gm.width,
         'height', gm.height,
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
     WHERE g.avitag = $1 AND (g.gist_status != 'REJECTED' OR ($3::text IS NOT NULL AND g.avitag = $3::text))
     ORDER BY g.created_at DESC LIMIT $2`,
    [avitag, limit, viewerAvitag ?? null]
  );
  return rows;
}

/**
 * The true total behind listByUser's cursor pagination — same visibility
 * rule as that function (REJECTED hidden from everyone except the poster
 * themselves), so this always matches what a viewer could actually reach by
 * scrolling all the way through, never over- or under-counting relative to
 * what listByUser would ever actually return.
 */
export async function countByUser(avitag: string, viewerAvitag?: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM gists g
     WHERE g.avitag = $1 AND (g.gist_status != 'REJECTED' OR ($2::text IS NOT NULL AND g.avitag = $2::text))`,
    [avitag, viewerAvitag ?? null]
  );
  return Number(rows[0]?.count ?? 0);
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
    `SELECT g.*, sp.first_name, sp.image_url, sp.campus_tag, sp.major_tag, sp.level,counts.reactions_count, counts.comments_count, counts.views_count, counts.reports_count, counts.shares_count,
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
         'width', gm.width,
         'height', gm.height,
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
       AND ($2::text IS NULL OR sp.campus_tag = $2::text)
       AND ($3::text IS NULL OR sp.major_tag = $3::text)
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
    `SELECT g.*, sp.first_name, sp.image_url, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
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
         'width', gm.width,
         'height', gm.height,
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
       AND ($4::text IS NULL OR sp.campus_tag = $4::text)
       AND ($5::text IS NULL OR sp.major_tag = $5::text)
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

/** Logs one share event — every call is a real, separate share (no dedup,
 * unlike reports); `platform` is a free-form label from the client
 * ("whatsapp"/"x"/"facebook"/"copy_link"/"native") purely for analytics,
 * not enforced against a fixed list here. */
export async function incrementShare(
  gist_id: string,
  avitag: string | null,
  platform: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO gist_shares (gist_id, avitag, platform) VALUES ($1, $2, $3)`,
    [gist_id, avitag, platform]
  );
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

export interface TrendingSchool {
  campus_tag: string;
  score: number;
}

/**
 * Powers the school-filter pills beside Gist/Amebo — "which schools are
 * popular right now", by the same decayed-engagement formula as the ranked
 * feed's own score (reactions×1 + comments×3 + shares×5, decayed by age),
 * summed across each campus's gists in the last 72h. Deliberately no
 * minimum-activity floor — a school can rank purely off one viral gist, by
 * design (see the conversation that settled this: pure virality, not a
 * volume-weighted average). Only student posts have a campus at all, so
 * this INNER JOINs student_profiles rather than LEFT JOINing like every
 * other query in this file.
 *
 * Called through the short-TTL cache in gist.service.ts, not per-request —
 * this scans every gist from the last 72h on every call.
 */
export async function getTrendingSchools(limit: number): Promise<TrendingSchool[]> {
  const { rows } = await pool.query<{ campus_tag: string; score: string }>(
    `SELECT sp.campus_tag, SUM(
       (COALESCE(c.reactions_count, 0)::float8 * 1 + COALESCE(c.comments_count, 0)::float8 * 3 + COALESCE(c.shares_count, 0)::float8 * 5)
       / POWER(EXTRACT(EPOCH FROM (NOW() - g.created_at)) / 3600.0 + 2, 1.5)
     ) AS score
     FROM gists g
     JOIN student_profiles sp ON sp.avitag = g.avitag
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     WHERE g.gist_status = 'APPROVED'
       AND g.created_at >= NOW() - INTERVAL '72 hours'
       AND sp.campus_tag IS NOT NULL
     GROUP BY sp.campus_tag
     ORDER BY score DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({ campus_tag: r.campus_tag, score: Number(r.score) }));
}
