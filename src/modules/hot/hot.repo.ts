import { pool } from "../../config/db";
import { VISIBLE_WINDOW, SWEEP_AFTER } from "./hot.constants";

// Same "COALESCE across all 5 profile tables" pattern gist.repo.ts's
// AUTHOR_JOIN/AUTHOR_COLUMNS/AUTHOR_LIVE_GATE and spot.repo.ts's own copy
// use — copied rather than shared, since the alias (`hp` here) is baked
// into each fragment as a plain string, not parameterized. A Hot post can
// come from any profile type, not just students, which is also why this
// joins `student_profiles` a SECOND time on its own below for
// campus_tag/major_tag/level — those three only ever exist on a student
// profile, and stay NULL (by design, not a bug) for every other profile
// type, which is exactly what lets the feed ranking's tier CASE in
// listFeed() fall a non-student's post straight through to tier 6
// ("everyone else") with no special-casing needed.
const AUTHOR_JOIN = `
  LEFT JOIN student_profiles sp ON sp.avitag = hp.avitag
  LEFT JOIN kreator_profiles kp ON kp.avitag = hp.avitag
  LEFT JOIN kompany_profiles kmp ON kmp.avitag = hp.avitag
  LEFT JOIN school_profiles scp ON scp.avitag = hp.avitag
  LEFT JOIN idiot_profiles idp ON idp.avitag = hp.avitag
  LEFT JOIN accounts acc ON acc.account_id = COALESCE(sp.account_id, kp.account_id, kmp.account_id, scp.account_id, idp.account_id)
`;

const AUTHOR_COLUMNS = `
  COALESCE(sp.first_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS first_name,
  COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url,
  sp.campus_tag, sp.major_tag, sp.level, sp.bio
`;

// Literal 'ACTIVE', not a bind parameter — same reasoning gist.repo.ts's
// own AUTHOR_LIVE_GATE gives: appending this never renumbers an existing
// $N placeholder.
const AUTHOR_LIVE_GATE = `(
  (COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) IS NULL
    OR COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) = 'ACTIVE')
  AND (acc.account_status IS NULL OR acc.account_status = 'ACTIVE')
)`;

export type HotMediaKind = "TEXT" | "PHOTO" | "VIDEO";

export interface HotPostRow {
  hot_post_id: string;
  avitag: string;
  media_kind: HotMediaKind;
  text: string | null;
  media_url: string | null;
  public_id: string | null;
  thumbnail_url: string | null;
  color_key: string | null;
  duration_ms: number | null;
  is_reported: boolean;
  created_at: string;
}

export interface HotPostWithAuthor extends HotPostRow {
  first_name: string | null;
  image_url: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  /** Student profiles only, same as campus_tag/major_tag/level above — NULL
   * for a KREATOR/KOMPANY/SCHOOL/IDIOT poster, by design not a bug. */
  bio: string | null;
  seen: boolean;
}

export interface HotFeedRow extends HotPostWithAuthor {
  tier: number;
}

export async function create(params: {
  avitag: string;
  media_kind: HotMediaKind;
  text: string | null;
  media_url: string | null;
  public_id: string | null;
  thumbnail_url: string | null;
  color_key: string | null;
  duration_ms: number | null;
  hot_post_id?: string; // pre-minted by /upload-signature for PHOTO/VIDEO, so the Cloudinary folder and the eventual row share one id — see hot.controller.ts
}): Promise<HotPostRow> {
  const { rows } = await pool.query<HotPostRow>(
    `INSERT INTO hot_posts (hot_post_id, avitag, media_kind, text, media_url, public_id, thumbnail_url, color_key, duration_ms)
     VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      params.hot_post_id ?? null,
      params.avitag,
      params.media_kind,
      params.text,
      params.media_url,
      params.public_id,
      params.thumbnail_url,
      params.color_key,
      params.duration_ms,
    ]
  );
  return rows[0];
}

export async function findById(hot_post_id: string): Promise<HotPostRow | null> {
  const { rows } = await pool.query<HotPostRow>(`SELECT * FROM hot_posts WHERE hot_post_id = $1`, [hot_post_id]);
  return rows[0] ?? null;
}

/** Self-delete only — there's no admin/idiot moderation path for Hot posts
 * (no report flow exists for them, see this feature's own planning notes),
 * so unlike gist.repo.ts/spot.repo.ts's remove() this has no separate
 * admin branch at all, just the one ownership-checked hard delete. Returns
 * enough to clean up Cloudinary (null public_id for a TEXT post, which the
 * caller already skips). */
export async function remove(
  hot_post_id: string,
  avitag: string
): Promise<{ public_id: string | null; media_kind: HotMediaKind } | null> {
  const { rows } = await pool.query<{ public_id: string | null; media_kind: HotMediaKind }>(
    `DELETE FROM hot_posts WHERE hot_post_id = $1 AND avitag = $2 RETURNING public_id, media_kind`,
    [hot_post_id, avitag]
  );
  return rows[0] ?? null;
}

/** Your own still-visible posts, oldest first (soonest to expire first) —
 * matches EDeyHotRail.tsx's own `[...myPosts].sort((a,b) => a.expiresAt -
 * b.expiresAt)`, just computed server-side now instead of client-side mock
 * state. `seen` is checked against the SAME avitag as the posts themselves
 * on purpose — you asked for your own stack to behave exactly like anyone
 * else's (ring segments grey out, resume position works the same way) once
 * you've actually watched a post back. */
export async function listMine(avitag: string): Promise<HotPostWithAuthor[]> {
  const { rows } = await pool.query<HotPostWithAuthor>(
    `SELECT hp.*, ${AUTHOR_COLUMNS},
            EXISTS (SELECT 1 FROM hot_post_seen hs WHERE hs.hot_post_id = hp.hot_post_id AND hs.avitag = $1) AS seen
     FROM hot_posts hp
     ${AUTHOR_JOIN}
     WHERE hp.avitag = $1 AND hp.created_at > NOW() - INTERVAL '${VISIBLE_WINDOW}'
     ORDER BY hp.created_at ASC`,
    [avitag]
  );
  return rows;
}

/** Everyone else's visible posts, flat (one row per post, not yet grouped
 * by author — hot.service.ts does that grouping in JS after this comes
 * back, simplest way to get "sort authors by their best tier, then their
 * posts within" without a gnarly window-function query). `tier` is the
 * 6-bucket ranking: 1 = same campus+major+level, 2 = same campus+major
 * (any level), 3 = same campus+level (any major), 4 = rest of your own
 * campus, 5 = a trending campus (trendingCampusTags, from
 * GistService.trendingSchools — reused as-is, not recomputed here), 6 =
 * everyone else, the final catch-all. A non-student poster's campus_tag is
 * always NULL, so every campus comparison below is false for them and they
 * fall straight through to tier 6 with no special-casing needed — same
 * reasoning as this file's own AUTHOR_JOIN doc comment. */
export async function listFeed(
  viewerAvitag: string,
  viewerCampusTag: string | null,
  viewerMajorTag: string | null,
  trendingCampusTags: string[]
): Promise<HotFeedRow[]> {
  const { rows } = await pool.query<HotFeedRow>(
    `WITH viewer AS (
       -- The viewer's own level, looked up once here rather than passed in
       -- as a param — it's not on the JWT (only campus_tag/major_tag are,
       -- see JwtClaims' own doc comment for why), and this CTE means the
       -- lookup runs once total, not once per row the way three separate
       -- inline subqueries in the CASE below would have.
       SELECT level FROM student_profiles WHERE avitag = $1
     )
     SELECT hp.*, ${AUTHOR_COLUMNS},
            EXISTS (SELECT 1 FROM hot_post_seen hs WHERE hs.hot_post_id = hp.hot_post_id AND hs.avitag = $1) AS seen,
            CASE
              WHEN sp.campus_tag = $2::text AND sp.major_tag = $3::text AND sp.level = viewer.level THEN 1
              WHEN sp.campus_tag = $2::text AND sp.major_tag = $3::text THEN 2
              WHEN sp.campus_tag = $2::text AND sp.level = viewer.level THEN 3
              WHEN sp.campus_tag = $2::text THEN 4
              WHEN sp.campus_tag = ANY($4::text[]) THEN 5
              ELSE 6
            END AS tier
     FROM hot_posts hp
     ${AUTHOR_JOIN}
     -- LEFT JOIN, not CROSS JOIN — the viewer CTE returns zero rows for a
     -- non-student viewer (no student_profiles row at all, e.g. a KREATOR/
     -- KOMPANY/SCHOOL account), and a CROSS JOIN against an empty set would
     -- silently wipe out the entire feed instead of just leaving
     -- viewer.level NULL (which correctly fails every tier 1-3 comparison
     -- and falls that viewer through to ranking everyone by campus/
     -- trending/catch-all only — tiers 1-4 just never match for them,
     -- nothing breaks).
     LEFT JOIN viewer ON TRUE
     WHERE hp.created_at > NOW() - INTERVAL '${VISIBLE_WINDOW}'
       AND hp.avitag <> $1
       AND ${AUTHOR_LIVE_GATE}
     ORDER BY tier ASC, hp.created_at ASC`,
    [viewerAvitag, viewerCampusTag, viewerMajorTag, trendingCampusTags]
  );
  return rows;
}

/** Batched — one call marks many posts seen at once (fired when you close
 * the viewer or flip between people, not per-post), rather than one round
 * trip per post. `unnest` turns the array param into one row per id so a
 * single INSERT can carry them all; ON CONFLICT DO NOTHING makes re-marking
 * an already-seen post a harmless no-op. */
export async function markSeenBatch(avitag: string, hotPostIds: string[]): Promise<void> {
  if (hotPostIds.length === 0) return;
  await pool.query(
    `INSERT INTO hot_post_seen (hot_post_id, avitag)
     SELECT id, $1 FROM unnest($2::uuid[]) AS id
     ON CONFLICT (hot_post_id, avitag) DO NOTHING`,
    [avitag, hotPostIds]
  );
}

/** hot.sweep.ts's own read — rows past the visibility window PLUS the
 * grace buffer (SWEEP_AFTER, not VISIBLE_WINDOW — see hot.constants.ts's
 * own doc for why they're different numbers), batched so one sweep tick
 * never tries to clean up an unbounded number of rows at once. */
export async function findExpiredForSweep(limit: number): Promise<HotPostRow[]> {
  const { rows } = await pool.query<HotPostRow>(
    `SELECT * FROM hot_posts WHERE created_at <= NOW() - INTERVAL '${SWEEP_AFTER}' ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function deleteByIds(hotPostIds: string[]): Promise<void> {
  if (hotPostIds.length === 0) return;
  await pool.query(`DELETE FROM hot_posts WHERE hot_post_id = ANY($1::uuid[])`, [hotPostIds]);
}
