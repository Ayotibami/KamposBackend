import { pool } from "../../config/db";

// Same "COALESCE across all 5 profile tables" pattern as gist.repo.ts's
// AUTHOR_JOIN/AUTHOR_COLUMNS/AUTHOR_LIVE_GATE — copied rather than shared,
// since the alias (`s` for spots vs `g` for gists) is baked into each
// fragment as a plain string, not parameterized.
const AUTHOR_JOIN = `
  LEFT JOIN student_profiles sp ON sp.avitag = s.avitag
  LEFT JOIN kreator_profiles kp ON kp.avitag = s.avitag
  LEFT JOIN kompany_profiles kmp ON kmp.avitag = s.avitag
  LEFT JOIN school_profiles scp ON scp.avitag = s.avitag
  LEFT JOIN idiot_profiles idp ON idp.avitag = s.avitag
  LEFT JOIN accounts acc ON acc.account_id = COALESCE(s.account_id, sp.account_id, kp.account_id, kmp.account_id, scp.account_id, idp.account_id)
`;

const AUTHOR_COLUMNS = `
  COALESCE(sp.first_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS first_name,
  COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url
`;

// Literal 'ACTIVE', not a bind parameter — appending this never renumbers
// an existing $N placeholder, same reasoning gist.repo.ts's own
// AUTHOR_LIVE_GATE gives.
const AUTHOR_LIVE_GATE = `(
  (COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) IS NULL
    OR COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) = 'ACTIVE')
  AND (acc.account_status IS NULL OR acc.account_status = 'ACTIVE')
)`;

export type SpotStatus = "DRAFT" | "ACTIVE" | "REJECTED" | "REMOVED";

export interface SpotRow {
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
  status: SpotStatus;
  is_reported: boolean;
  created_at: string;
  edited_at: string | null;
  edit_count: number;
}

export interface SpotCounts {
  spot_id: string;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
  shares_count: number;
}

export interface SpotWithCounts extends SpotRow {
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  first_name: string | null;
  image_url: string | null;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
  shares_count: number;
  /** The viewer's own like on this spot, if any — 'LIKE' or null. Spot only
   * ever sends 'LIKE' (see spot.constants.ts's own doc), but this reads
   * whatever's actually stored, same as gist's my_reaction. */
  my_reaction: string | null;
  /** Persisted, not session-local — survives reload/new session. Drives
   * the "already flagged, can't flag again" state on the flag button. */
  my_report: boolean;
  /** Opaque pagination token from listRecent() — the frontend never
   * inspects it, just hands the last item's token back as the next page's
   * `cursor`. */
  _feed_cursor?: string;
}

export async function createDraft(
  avitag: string,
  account_id: string,
  profile_id: string,
  profile_type: string
): Promise<SpotRow> {
  const { rows } = await pool.query<SpotRow>(
    `INSERT INTO spots (avitag, account_id, profile_id, profile_type) VALUES ($1,$2,$3,$4) RETURNING *`,
    [avitag, account_id, profile_id, profile_type]
  );
  return rows[0];
}

export async function findById(spot_id: string): Promise<SpotRow | null> {
  const { rows } = await pool.query<SpotRow>(`SELECT * FROM spots WHERE spot_id = $1`, [spot_id]);
  return rows[0] ?? null;
}

/** The real publish moment — created_at is reset to NOW() here, not left at
 * whatever it was when the draft row was first created (see migration
 * 0045's own comment on `spots.created_at` for why: an upload started, then
 * resumed 20 minutes later, shouldn't backdate into the feed). Only ever
 * succeeds once, guarded by `status = 'DRAFT'` — a second finalize call
 * against an already-ACTIVE spot (a retried request, a race) is a no-op,
 * returning null rather than silently re-publishing/overwriting it. */
export async function finalize(
  spot_id: string,
  avitag: string,
  params: {
    media_url: string;
    thumbnail_url: string | null;
    public_id: string | null;
    duration_seconds: number | null;
    width: number | null;
    height: number | null;
    caption: string | null;
  }
): Promise<SpotRow | null> {
  const { rows } = await pool.query<SpotRow>(
    `UPDATE spots
     SET media_url = $1, thumbnail_url = $2, public_id = $3, duration_seconds = $4,
         width = $5, height = $6, caption = $7, status = 'ACTIVE', created_at = NOW()
     WHERE spot_id = $8 AND avitag = $9 AND status = 'DRAFT'
     RETURNING *`,
    [
      params.media_url,
      params.thumbnail_url,
      params.public_id,
      params.duration_seconds,
      params.width,
      params.height,
      params.caption,
      spot_id,
      avitag,
    ]
  );
  return rows[0] ?? null;
}

function withEngagementFields(viewerParam: string) {
  return `
     LEFT JOIN LATERAL (
       SELECT type FROM reactions
       WHERE entity_type = 'SPOT' AND entity_id = s.spot_id AND avitag = ${viewerParam}::text
       LIMIT 1
     ) mr ON TRUE
     LEFT JOIN LATERAL (
       SELECT EXISTS (
         SELECT 1 FROM spot_reports
         WHERE spot_id = s.spot_id AND reporter_avitag = ${viewerParam}::text
       ) AS reported
     ) mrp ON TRUE`;
}

export async function findWithCounts(spot_id: string, viewerAvitag?: string): Promise<SpotWithCounts | null> {
  const { rows } = await pool.query<SpotWithCounts>(
    `SELECT s.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,
            c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
            mr.type AS my_reaction, mrp.reported AS my_report
     FROM spots s
     ${AUTHOR_JOIN}
     LEFT JOIN v_spot_counts c ON c.spot_id = s.spot_id
     ${withEngagementFields("$2")}
     WHERE s.spot_id = $1 AND s.status = 'ACTIVE' AND ${AUTHOR_LIVE_GATE}`,
    [spot_id, viewerAvitag ?? null]
  );
  return rows[0] ?? null;
}

/** Bypasses the ACTIVE-only + live-gate filters findWithCounts enforces —
 * used only by the owner/admin path (see spot.controller.ts's `get`), same
 * "any status, ownership checked by the caller" shape as gist.repo.ts's
 * findWithCountsAnyStatus. */
export async function findWithCountsAnyStatus(spot_id: string, viewerAvitag?: string): Promise<SpotWithCounts | null> {
  const { rows } = await pool.query<SpotWithCounts>(
    `SELECT s.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,
            c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
            mr.type AS my_reaction, mrp.reported AS my_report
     FROM spots s
     ${AUTHOR_JOIN}
     LEFT JOIN v_spot_counts c ON c.spot_id = s.spot_id
     ${withEngagementFields("$2")}
     WHERE s.spot_id = $1`,
    [spot_id, viewerAvitag ?? null]
  );
  return rows[0] ?? null;
}

interface FeedCursor {
  score: number;
  created_at: string;
  spot_id: string;
  /** The instant score/age were computed relative to for this whole scroll
   * session — same reasoning gist.repo.ts's listRecent gives: recomputing
   * against a fresh NOW() on every page would let a spot's score/age drift
   * mid-scroll and duplicate or skip rows across pages. */
  as_of: string;
}

function decodeFeedCursor(cursor: string): FeedCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (
      typeof decoded?.score !== "number" ||
      typeof decoded?.created_at !== "string" ||
      typeof decoded?.spot_id !== "string" ||
      typeof decoded?.as_of !== "string"
    ) {
      return null;
    }
    return decoded as FeedCursor;
  } catch {
    return null;
  }
}

/**
 * The global Spot feed — unconditionally unscoped (no campus/major filter
 * at all, unlike Gist's listRecent), recency-dominant with a light
 * engagement boost inside a freshness window, same decay shape as
 * v_gist_trending_3d: (reactions + 3*comments + 5*shares) / (age_hours+2)^1.5.
 * Keyset-paginated on (score, created_at, spot_id) — no "seen/unseen" tier
 * the way Gist's feed has, that concept was never part of Spot's spec.
 */
export async function listRecent(limit = 20, cursor?: string, viewerAvitag?: string): Promise<SpotWithCounts[]> {
  const decoded = cursor ? decodeFeedCursor(cursor) : null;
  const asOf = decoded?.as_of ?? new Date().toISOString();

  const params: unknown[] = [viewerAvitag ?? null, limit, asOf];
  const asOfIdx = 3;

  let cursorClause = "";
  if (decoded) {
    params.push(decoded.score, decoded.created_at, decoded.spot_id);
    const s = params.length - 2;
    cursorClause = `AND (
      feed.score < $${s}::float8
      OR (feed.score = $${s}::float8 AND s.created_at < $${s + 1}::timestamptz)
      OR (feed.score = $${s}::float8 AND s.created_at = $${s + 1}::timestamptz AND s.spot_id < $${s + 2}::uuid)
    )`;
  }

  const { rows } = await pool.query<SpotWithCounts & { _feed_score: number }>(
    `SELECT s.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,
            c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
            mr.type AS my_reaction, mrp.reported AS my_report,
            feed.score AS _feed_score
     FROM spots s
     ${AUTHOR_JOIN}
     LEFT JOIN v_spot_counts c ON c.spot_id = s.spot_id
     ${withEngagementFields("$1")}
     LEFT JOIN LATERAL (
       -- Rounded to 9 decimal places — see gist.repo.ts's listRecent for
       -- why: an unrounded float8 can lose a handful of ULPs round-tripping
       -- through the JSON-encoded cursor and back, enough to flip
       -- feed.score = cursor.score to false and let the previous page's
       -- last row reappear as the next page's first.
       SELECT ROUND(
         ((COALESCE(c.reactions_count, 0)::float8 * 1 + COALESCE(c.comments_count, 0)::float8 * 3 + COALESCE(c.shares_count, 0)::float8 * 5)
           / POWER(EXTRACT(EPOCH FROM ($${asOfIdx}::timestamptz - s.created_at)) / 3600.0 + 2, 1.5))::numeric,
         9
       )::float8 AS score
     ) feed ON TRUE
     WHERE s.status = 'ACTIVE'
       AND s.created_at <= $${asOfIdx}::timestamptz
       AND ${AUTHOR_LIVE_GATE}
       ${cursorClause}
     ORDER BY feed.score DESC, s.created_at DESC, s.spot_id DESC
     LIMIT $2`,
    params
  );

  return rows.map((r) => {
    const { _feed_score, ...rest } = r;
    return {
      ...rest,
      _feed_cursor: Buffer.from(
        JSON.stringify({ score: _feed_score, created_at: r.created_at, spot_id: r.spot_id, as_of: asOf })
      ).toString("base64"),
    };
  });
}

/** A profile page's Spot list — own profile sees ACTIVE + REJECTED +
 * REMOVED (their own posting history, moderation status included);
 * everyone else sees ACTIVE only. DRAFT never shows to anyone, own profile
 * included — it isn't a real post yet. Plain-id cursor (not the encoded
 * feed cursor), same style gist.repo.ts's own listByUser uses. */
export async function listByUser(
  avitag: string,
  limit = 20,
  cursor?: string,
  viewerAvitag?: string
): Promise<SpotWithCounts[]> {
  const statusClause = viewerAvitag === avitag ? `s.status IN ('ACTIVE','REJECTED','REMOVED')` : `s.status = 'ACTIVE'`;
  if (cursor) {
    const { rows } = await pool.query<SpotWithCounts>(
      `SELECT s.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,
              c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
              mr.type AS my_reaction, mrp.reported AS my_report
       FROM spots s
       ${AUTHOR_JOIN}
       LEFT JOIN v_spot_counts c ON c.spot_id = s.spot_id
       ${withEngagementFields("$4")}
       WHERE s.avitag = $1 AND ${statusClause}
         AND s.created_at < (SELECT created_at FROM spots WHERE spot_id = $2)
       ORDER BY s.created_at DESC LIMIT $3`,
      [avitag, cursor, limit, viewerAvitag ?? null]
    );
    return rows;
  }
  const { rows } = await pool.query<SpotWithCounts>(
    `SELECT s.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,
            c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count,
            mr.type AS my_reaction, mrp.reported AS my_report
     FROM spots s
     ${AUTHOR_JOIN}
     LEFT JOIN v_spot_counts c ON c.spot_id = s.spot_id
     ${withEngagementFields("$3")}
     WHERE s.avitag = $1 AND ${statusClause}
     ORDER BY s.created_at DESC LIMIT $2`,
    [avitag, limit, viewerAvitag ?? null]
  );
  return rows;
}

/** The true total behind listByUser's cursor pagination — same reasoning as
 * gist.repo.ts's own countByUser: the frontend needs a real "N Spots" count,
 * not just "however many pages happen to be loaded so far". Same visibility
 * rule as listByUser (own profile counts ACTIVE+REJECTED+REMOVED, everyone
 * else counts ACTIVE only). */
export async function countByUser(avitag: string, viewerAvitag?: string): Promise<number> {
  const statusClause = viewerAvitag === avitag ? `status IN ('ACTIVE','REJECTED','REMOVED')` : `status = 'ACTIVE'`;
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM spots WHERE avitag = $1 AND ${statusClause}`,
    [avitag]
  );
  return Number(rows[0]?.count ?? 0);
}

/** Self-delete — a soft status change to REMOVED, not a hard DELETE (unlike
 * gist.repo.ts's own remove()). Keeping the row distinguishes "the poster
 * pulled this themselves" from REJECTED ("an admin took it down") in the
 * moderation/audit trail, per the status lifecycle we agreed on. */
export async function remove(spot_id: string, avitag: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE spots SET status = 'REMOVED' WHERE spot_id = $1 AND avitag = $2 AND status = 'ACTIVE'`,
    [spot_id, avitag]
  );
  return (rowCount || 0) > 0;
}

export async function rejectAsAdmin(spot_id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`UPDATE spots SET status = 'REJECTED' WHERE spot_id = $1 AND status = 'ACTIVE'`, [
    spot_id,
  ]);
  return (rowCount || 0) > 0;
}

/** ON CONFLICT DO NOTHING against the (spot_id, reporter_avitag) unique
 * constraint (migration 0045) — the actual enforcement of "one report per
 * person," not just the my_report-gated UI. Returns whether this was a
 * genuinely new report (false for a silent duplicate no-op). */
export async function report(spot_id: string, reporter_avitag: string, reason: string | null): Promise<boolean> {
  const { rows } = await pool.query(
    `INSERT INTO spot_reports (spot_id, reporter_avitag, reason) VALUES ($1,$2,$3)
     ON CONFLICT (spot_id, reporter_avitag) DO NOTHING RETURNING report_id`,
    [spot_id, reporter_avitag, reason]
  );
  const isNew = rows.length > 0;
  if (isNew) {
    await pool.query(`UPDATE spots SET is_reported = TRUE WHERE spot_id = $1`, [spot_id]);
  }
  return isNew;
}

/** Raw row per playback, no dedup — explicit decision, mirrors gist_views. */
export async function incrementView(spot_id: string, avitag: string | null): Promise<void> {
  await pool.query(`INSERT INTO spot_views (spot_id, avitag) VALUES ($1, $2)`, [spot_id, avitag]);
}

export async function incrementShare(spot_id: string, avitag: string | null, platform: string | null): Promise<void> {
  await pool.query(`INSERT INTO spot_shares (spot_id, avitag, platform) VALUES ($1, $2, $3)`, [spot_id, avitag, platform]);
}

export async function getCounts(spot_id: string): Promise<SpotCounts | null> {
  const { rows } = await pool.query<SpotCounts>(
    `SELECT spot_id, reactions_count, comments_count, views_count, reports_count, shares_count FROM v_spot_counts WHERE spot_id = $1`,
    [spot_id]
  );
  return rows[0] ?? null;
}
