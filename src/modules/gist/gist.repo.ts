import { pool } from "../../config/db";
import { ADMIN_POLL_JOIN_SQL } from "./poll.repo";

// Every profile type a gist's author might be, keyed by avitag — LEFT
// JOINed so a still-current avitag always resolves to exactly one of
// these tables, same "COALESCE across all 5" pattern already used by
// listPendingGistsWithDetails/idiot/gists.repo.ts's admin queries, just
// applied to the consumer-facing endpoints below for the first time.
// `accounts` is joined off account_id, preferring the gist's own
// g.account_id (present on every gist since migration 0028) and falling
// back to whichever profile table matched, for the small number of
// pre-migration gists where g.account_id might still be null.
const AUTHOR_JOIN = `
  LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
  LEFT JOIN kreator_profiles kp ON kp.avitag = g.avitag
  LEFT JOIN kompany_profiles kmp ON kmp.avitag = g.avitag
  LEFT JOIN school_profiles scp ON scp.avitag = g.avitag
  LEFT JOIN idiot_profiles idp ON idp.avitag = g.avitag
  LEFT JOIN accounts acc ON acc.account_id = COALESCE(g.account_id, sp.account_id, kp.account_id, kmp.account_id, scp.account_id, idp.account_id)
`;

// first_name/image_url stay the SAME column names (not renamed/added) —
// every consumer-facing frontend read site (GistCard.tsx, the OG image
// route, GistPreviewMarquee) already falls back through
// `first_name || name || avitag`, so COALESCING a non-student's
// display_name into this same `first_name` column fixes what was a
// silent "shows the avitag instead of a name" degradation for every
// non-student poster, with zero frontend changes needed.
const AUTHOR_COLUMNS = `
  COALESCE(sp.first_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS first_name,
  COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url
`;

// The AND-gate (see student.controller.ts's get()): a profile is only
// live if BOTH its own profile_status AND its owning account's
// account_status are ACTIVE. IS NULL is a deliberate escape hatch, not a
// loophole — it only fires when neither side actually resolved a row (an
// avitag with no matching profile table at all, or an account_id with no
// matching accounts row), a data-integrity edge case that should stay
// visible rather than silently vanish from every feed. Uses a literal
// 'ACTIVE', not a bind parameter, specifically so appending
// `AND ${AUTHOR_LIVE_GATE}` to any WHERE clause below never renumbers an
// existing $N placeholder — several of these queries (listRecent above
// all) have hand-built, order-sensitive parameter lists.
const AUTHOR_LIVE_GATE = `(
  (COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) IS NULL
    OR COALESCE(sp.profile_status, kp.profile_status, kmp.profile_status, scp.profile_status, idp.profile_status) = 'ACTIVE')
  AND (acc.account_status IS NULL OR acc.account_status = 'ACTIVE')
)`;

// Every gist-returning query below attaches poll data the same way it
// already attaches media/my_reaction/my_report — a LATERAL join, NULL
// (not an error, not a missing key) when the gist has no poll at all.
// `viewerParam` is whichever positional parameter THAT query already binds
// viewerAvitag to (it differs per query — see each call site's own `mr`/
// `mrp` lateral joins a few lines above wherever this gets used, which
// already reference the exact same parameter for the exact same reason).
// A function, not another static template string like AUTHOR_JOIN, purely
// because this is the one fragment here that needs a parameter number
// supplied by its caller rather than being identical everywhere.
function pollJoin(viewerParam: string): string {
  return `
     LEFT JOIN LATERAL (
       SELECT json_build_object(
         'poll_id', gp.poll_id,
         'options', COALESCE((
           SELECT json_agg(json_build_object(
             'option_id', po.option_id,
             'option_text', po.option_text,
             'votes_count', (SELECT COUNT(*)::int FROM poll_votes pv WHERE pv.option_id = po.option_id)
           ) ORDER BY po.order_index ASC)
           FROM poll_options po WHERE po.poll_id = gp.poll_id
         ), '[]'::json),
         'my_vote_option_id', (
           SELECT pv2.option_id FROM poll_votes pv2
           WHERE pv2.poll_id = gp.poll_id AND pv2.voter_avitag = ${viewerParam}::text
           LIMIT 1
         )
       ) AS poll
       FROM gist_polls gp WHERE gp.gist_id = g.gist_id
     ) pollj ON TRUE`;
}

// Yarn back (quote-repost): every gist-returning query below also attaches
// the FULL quoted gist (when g.quoted_gist_id is set) as a nested JSON
// object — its own author identity (same "COALESCE across all 5 profile
// tables" pattern AUTHOR_JOIN/AUTHOR_COLUMNS already use for the outer
// gist, just re-aliased with a `q` prefix so it can't collide with the
// outer query's own sp/kp/kmp/scp/idp joins), its own media, and its own
// poll. Everything except the poll's `my_vote_option_id` is correlated
// purely off g.quoted_gist_id, no bind parameter needed — the poll is why
// this is a function (viewerParam) and not a plain constant like
// AUTHOR_JOIN: `my_vote_option_id` needs to know WHO's asking, same
// reason the outer gist's own pollJoin() above takes one. Pass whichever
// `$N` placeholder that query already binds viewerAvitag to (its own
// pollJoin call already reveals the right one); pass null for an
// admin/moderation query that has no per-viewer concept at all (no
// `my_vote_option_id` in that case — same reasoning ADMIN_POLL_JOIN_SQL's
// own doc gives for the outer gist there).
//
// Redaction (is_anonymous) is deliberately NOT done here in SQL — it
// happens once, in JS, via redactIfAnonymous's own recursive handling of
// `quoted_gist` below, the same single enforcement point every other
// identity field in this file already goes through. This fragment's job
// is only to fetch the real row; hiding it is that function's job alone.
export function QUOTED_GIST_JOIN(viewerParam: string | null): string {
  return `
  LEFT JOIN gists qg ON qg.gist_id = g.quoted_gist_id
  LEFT JOIN student_profiles qsp ON qsp.avitag = qg.avitag
  LEFT JOIN kreator_profiles qkp ON qkp.avitag = qg.avitag
  LEFT JOIN kompany_profiles qkmp ON qkmp.avitag = qg.avitag
  LEFT JOIN school_profiles qscp ON qscp.avitag = qg.avitag
  LEFT JOIN idiot_profiles qidp ON qidp.avitag = qg.avitag
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
      'media_id', qgm.media_id,
      'media_type', qgm.media_type,
      'media_url', qgm.media_url,
      'thumbnail_url', qgm.thumbnail_url,
      'width', qgm.width,
      'height', qgm.height,
      'order_index', qgm.order_index,
      'uploaded_at', qgm.uploaded_at,
      'edited_at', qgm.edited_at
    ) ORDER BY qgm.order_index ASC) AS media
    FROM gist_media qgm WHERE qgm.gist_id = qg.gist_id
  ) qgm_agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT json_build_object(
      'poll_id', qgp.poll_id,
      'options', COALESCE((
        SELECT json_agg(json_build_object(
          'option_id', qpo.option_id,
          'option_text', qpo.option_text,
          'votes_count', (SELECT COUNT(*)::int FROM poll_votes qpv WHERE qpv.option_id = qpo.option_id)
        ) ORDER BY qpo.order_index ASC)
        FROM poll_options qpo WHERE qpo.poll_id = qgp.poll_id
      ), '[]'::json)${
        viewerParam
          ? `,
      'my_vote_option_id', (
        SELECT qpv2.option_id FROM poll_votes qpv2
        WHERE qpv2.poll_id = qgp.poll_id AND qpv2.voter_avitag = ${viewerParam}::text
        LIMIT 1
      )`
          : ""
      }
    ) AS poll
    FROM gist_polls qgp WHERE qgp.gist_id = qg.gist_id
  ) qpollj ON TRUE
`;
}

// NULL (not an error, not a missing key) when g.quoted_gist_id is null OR
// points at a gist that's since been deleted (ON DELETE SET NULL means
// the latter never actually happens post-migration-0043, but qg.gist_id
// IS NOT NULL is the correct guard either way — it's checking whether the
// LEFT JOIN to `gists qg` above actually matched anything, not assuming
// it always does). Selected as its own column (not folded into a LATERAL
// like QUOTED_GIST_JOIN's media/poll) since json_build_object here only
// needs values already sitting in scope from that join, no extra
// correlated subquery of its own required.
export const QUOTED_GIST_COLUMN = `
  CASE WHEN qg.gist_id IS NOT NULL THEN json_build_object(
    'gist_id', qg.gist_id,
    'avitag', qg.avitag,
    'account_id', qg.account_id,
    'profile_id', qg.profile_id,
    'profile_type', qg.profile_type,
    'gist_text', qg.gist_text,
    'color_key', qg.color_key,
    'is_anonymous', qg.is_anonymous,
    'campus_tag', qsp.campus_tag,
    'major_tag', qsp.major_tag,
    'level', qsp.level,
    'first_name', COALESCE(qsp.first_name, qkp.display_name, qkmp.display_name, qscp.display_name, qidp.display_name),
    'image_url', COALESCE(qsp.image_url, qkp.image_url, qkmp.image_url, qscp.image_url, qidp.image_url),
    'media', COALESCE(qgm_agg.media, '[]'::json),
    'poll', qpollj.poll
  ) ELSE NULL END AS quoted_gist
`;

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
  /** Pseudonymous, not truly anonymous — the real avitag/account_id/profile
   * always stay on the row (this column alone never hides anything from
   * the database itself, only from OTHER viewers' API responses). See
   * redactIfAnonymous's own doc for where that's actually enforced. */
  is_anonymous: boolean;
  /** Yarn back — the gist this one is quoting, if any. Create-only, same
   * as is_anonymous/color_key: no update path ever sets it. ON DELETE SET
   * NULL (see migration 0043) — a deleted original just leaves this null
   * rather than taking the repost down with it. */
  quoted_gist_id?: string | null;
}

export interface GistCounts {
  gist_id: string;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
  shares_count: number;
  reposts_count: number;
}

export async function getCounts(gist_id: string): Promise<GistCounts | null> {
  const { rows } = await pool.query<GistCounts>(
    `SELECT gist_id, reactions_count, comments_count, views_count, reports_count, shares_count, reposts_count FROM v_gist_counts WHERE gist_id = $1`,
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


/** The quoted gist nested on a Yarn back — a compact stand-in for the
 * original, not a second full GistWithCounts (no counts/my_reaction of
 * its own; the frontend's QuotedGistPreview only ever needs identity +
 * content + media + poll). Null when the outer gist isn't a repost, or
 * was but the original has since been deleted (quoted_gist_id survives
 * that — see migration 0044 — precisely so this is distinguishable from
 * "never was a repost" at all). */
export interface QuotedGistPreviewRow {
  gist_id: string;
  avitag: string;
  account_id: string;
  profile_id: string;
  profile_type: string;
  gist_text: string;
  color_key: string | null;
  is_anonymous: boolean;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  first_name: string | null;
  image_url: string | null;
  media: GistWithCounts["media"];
  /** Votable — QUOTED_GIST_JOIN's poll join carries `my_vote_option_id`
   * for a real viewerParam (every consumer-facing call site passes one);
   * the key is absent entirely (not just null) for an admin/moderation
   * query (QUOTED_GIST_JOIN(null)), same "an admin isn't voting"
   * reasoning ADMIN_POLL_JOIN_SQL's own doc already gives for the outer
   * gist — hence optional here rather than `string | null` outright,
   * this one type covers both call shapes. */
  poll: {
    poll_id: string;
    options: Array<{ option_id: string; option_text: string; votes_count: number }>;
    my_vote_option_id?: string | null;
  } | null;
}

export interface GistWithCounts extends GistRow {
  first_name: string | null;
  image_url: string | null;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  reports_count: number;
  shares_count: number;
  reposts_count: number;
  quoted_gist: QuotedGistPreviewRow | null;
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
  /** Null for every gist without a poll — the vast majority. When present:
   * `options` always has 2-4 entries (order_index ASC, same as media),
   * each with a live `votes_count`; `my_vote_option_id` is null for a
   * guest or a viewer who hasn't voted yet. Mutually exclusive with
   * `media` at creation time (see schemas/gist.ts) — a gist never has
   * both. */
  poll: {
    poll_id: string;
    options: Array<{ option_id: string; option_text: string; votes_count: number }>;
    my_vote_option_id: string | null;
  } | null;
}

// Every field here is genuinely identifying and reaches the frontend today
// (avitag/first_name/image_url render the header; major_tag/level render
// the tag row) — campus_tag is deliberately NOT in this list, see this
// function's own doc below on why. account_id/profile_id/profile_type
// never reach the frontend at all, but are blanked too as defense in
// depth: no reason a raw internal ID should sit in a public API response
// for a post that's meant to hide who posted it.
type RedactableGistFields = Pick<
  GistRow,
  "avitag" | "account_id" | "profile_id" | "profile_type" | "is_anonymous"
> & {
  first_name?: string | null;
  image_url?: string | null;
  major_tag?: string | null;
  level?: number | null;
  /** The nested quoted gist on a Yarn back has the exact same shape of
   * identity to hide, redacted independently against the same
   * viewerAvitag — see redactIfAnonymous's own doc on why this recurses
   * into it rather than leaving it alone. */
  quoted_gist?: RedactableGistFields | null;
};

// A placeholder, not an empty string — an empty avitag would make
// `href="/${avitag}"` on the frontend resolve to "/", which at least
// doesn't 404 into someone else's page, but "anonymous" reads as
// deliberate rather than a blank-string bug if anything downstream ever
// logs or renders it raw. No real account can hold this avitag (the
// signup flow validates avitags against a stricter pattern than a plain
// dictionary word), so an `isOwn`-style `gist.avitag === viewer` check
// can never accidentally match a real viewer against it.
const ANONYMOUS_AVITAG_PLACEHOLDER = "anonymous";

/**
 * The actual enforcement point for "anonymous" meaning something real:
 * every consumer-facing query below calls this on its way out, so the true
 * avitag/name/photo/major/level NEVER leave this process in an API
 * response to anyone but the poster themselves — not "hidden by the
 * frontend," genuinely redacted before the JSON is even built. This is
 * pseudonymous, not truly anonymous: the row in the `gists` table itself
 * is untouched (real avitag/account_id, same as any other gist), so the
 * poster's own request (avitag === viewerAvitag, the bypass below) and
 * Village People's admin queries (idiot/gists.repo.ts, which never calls
 * this at all) both still see exactly who posted it.
 *
 * campus_tag is deliberately left alone — a whole campus isn't identifying
 * the way a name/photo/department/level is, and it's genuinely useful
 * context for reading the post (especially on the cross-campus Amebo tab).
 * gist_text/media/poll/reactions/comments are never touched here either —
 * anonymity hides who posted, not what they posted.
 *
 * Recurses into `quoted_gist` first, before checking the outer row's own
 * is_anonymous — a Yarn back and the gist it quotes are two independent
 * posts with two independent identities, so each gets checked against
 * viewerAvitag on its own terms. Quoting someone else's anonymous gist
 * must not leak who they are just because their post is now nested one
 * level down instead of top-level; conversely, MY OWN identity on the
 * outer gist is unaffected by whatever the quoted poster chose.
 */
function redactIfAnonymous<T extends RedactableGistFields>(row: T, viewerAvitag?: string | null): T {
  const withRedactedQuote: T = row.quoted_gist
    ? { ...row, quoted_gist: redactIfAnonymous(row.quoted_gist, viewerAvitag) }
    : row;
  if (!withRedactedQuote.is_anonymous || withRedactedQuote.avitag === viewerAvitag) return withRedactedQuote;
  return {
    ...withRedactedQuote,
    avitag: ANONYMOUS_AVITAG_PLACEHOLDER,
    account_id: "",
    profile_id: "",
    profile_type: "",
    first_name: null,
    image_url: null,
    major_tag: null,
    level: null,
  };
}

export async function findWithCountsAnyStatus(
  gist_id: string,
  viewerAvitag?: string
): Promise<GistWithCounts | null> {
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count, c.reposts_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type, pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN}
     FROM gists g
     ${AUTHOR_JOIN}
     ${QUOTED_GIST_JOIN("$2")}
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
     ) rbt ON TRUE${pollJoin("$2")}
     WHERE g.gist_id = $1 AND ${AUTHOR_LIVE_GATE}`,
    [gist_id, viewerAvitag ?? null]
  );
  return rows[0] ? redactIfAnonymous(rows[0], viewerAvitag) : null;
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
      `SELECT g.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count, c.reposts_count,
              COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type, pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN}
       FROM gists g
       ${AUTHOR_JOIN}
     ${QUOTED_GIST_JOIN("$3")}
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
       ) rbt ON TRUE${pollJoin("$3")}
       WHERE g.gist_status = 'APPROVED' AND g.created_at < $1 AND ${AUTHOR_LIVE_GATE}
       ORDER BY g.created_at DESC
       LIMIT $2`,
      [target.created_at, before, viewerAvitag ?? null]
    ),
    pool.query<GistWithCounts>(
      `SELECT g.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count, c.reposts_count,
              COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type, pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN}
       FROM gists g
       ${AUTHOR_JOIN}
     ${QUOTED_GIST_JOIN("$3")}
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
       ) rbt ON TRUE${pollJoin("$3")}
       WHERE g.gist_status = 'APPROVED' AND g.created_at > $1 AND ${AUTHOR_LIVE_GATE}
       ORDER BY g.created_at ASC
       LIMIT $2`,
      [target.created_at, after, viewerAvitag ?? null]
    ),
  ]);

  return {
    target,
    before: beforeRes.rows.map((r) => redactIfAnonymous(r, viewerAvitag)),
    after: afterRes.rows.map((r) => redactIfAnonymous(r, viewerAvitag)),
  };
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
  is_anonymous = false,
  quoted_gist_id: string | null = null,
): Promise<GistRow> {
  const { rows } = await pool.query<GistRow>(
    `INSERT INTO gists (avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag, color_key, is_anonymous, quoted_gist_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag, color_key, is_anonymous, quoted_gist_id]
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
    `SELECT g.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count, c.reposts_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type, pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN}
     FROM gists g
     ${AUTHOR_JOIN}
     ${QUOTED_GIST_JOIN("$2")}
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
     ) rbt ON TRUE${pollJoin("$2")}
     WHERE g.gist_id = $1 AND g.gist_status = 'APPROVED' AND ${AUTHOR_LIVE_GATE}`,
    [gist_id, viewerAvitag ?? null]
  );
  return rows[0] ? redactIfAnonymous(rows[0], viewerAvitag) : null;
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
    // sp.avitag IS NULL (not sp.campus_tag IS NULL) is what actually means
    // "no student_profiles row at all" — a genuine non-student poster
    // (KREATOR/KOMPANY/SCHOOL/IDIOT), the case this OR is meant to exempt
    // from campus filtering entirely (see this function's own docstring).
    // sp.campus_tag IS NULL is a DIFFERENT thing: a real student whose
    // profile row exists but has no campus_tag value set on it — that's
    // still a student, and their posts still need to be filtered by
    // campus like anyone else's. Checking the wrong column let any
    // student with an incomplete profile leak into EVERY campus's Gist
    // tab, regardless of the viewer's own campus — not a viewer-side
    // lookup failure, a structural hole in this exact filter.
    //
    // UPPER() on both sides rather than a plain `=`: campus_tag is stored
    // uppercase (e.g. 'FUL'), but callers reach this from two different
    // paths with two different casing habits — the viewer's own token
    // value (already uppercase, matches DB) and a client-supplied
    // ?school= query param (lowercased by the controller before it gets
    // here). A case-sensitive compare made the second path silently match
    // nothing for any campus whose tag isn't literally lowercase already —
    // confirmed live for FUL. Normalizing both sides makes the match work
    // regardless of which path supplied the tag or how it was cased.
    campusClause = `AND (UPPER(sp.campus_tag) = UPPER($${params.length}::text) OR sp.avitag IS NULL)`;
  }

  params.push(major);
  const majorIdx = params.length;

  params.push(asOf);
  const asOfIdx = params.length;

  let cursorClause = "";
  if (decoded) {
    params.push(decoded.seen, decoded.score, decoded.created_at, decoded.gist_id);
    const s = params.length - 3;
    // A plain tuple `<` comparison only works when every column sorts the
    // same direction — this feed's ORDER BY mixes ASC (seen) with DESC
    // (score, created_at, gist_id), so it's spelled out tier-by-tier to
    // match ORDER BY exactly instead of relying on row-wise comparison.
    cursorClause = `AND (
      feed.seen > $${s}::boolean
      OR (feed.seen = $${s}::boolean AND feed.score < $${s + 1}::float8)
      OR (feed.seen = $${s}::boolean AND feed.score = $${s + 1}::float8 AND g.created_at < $${s + 2}::timestamptz)
      OR (feed.seen = $${s}::boolean AND feed.score = $${s + 1}::float8 AND g.created_at = $${s + 2}::timestamptz AND g.gist_id < $${s + 3}::uuid)
    )`;
  }

  const { rows } = await pool.query<GistWithCounts & { _feed_score: number }>(
    `SELECT g.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count, c.reposts_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type, pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN},
            feed.seen AS _feed_seen, feed.score AS _feed_score
     FROM gists g
     ${AUTHOR_JOIN}
     ${QUOTED_GIST_JOIN("$1")}
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
     ) rbt ON TRUE${pollJoin("$1")}
     LEFT JOIN LATERAL (
       SELECT
         (CASE WHEN $1::text IS NULL THEN false ELSE (
           EXISTS (SELECT 1 FROM reactions r2 WHERE r2.entity_type = 'GIST' AND r2.entity_id = g.gist_id AND r2.avitag = $1::text)
           OR EXISTS (SELECT 1 FROM comments cm2 WHERE cm2.gist_id = g.gist_id AND cm2.avitag = $1::text)
         ) END) AS seen,
         -- Rounded to 9 decimal places (::numeric forces exact decimal
         -- rounding, then cast back to float8) — not for display, purely so
         -- this survives round-tripping intact. score comes back to the
         -- client as part of the opaque cursor and gets rebound as a query
         -- parameter on the very next request; confirmed live that a raw,
         -- unrounded float8 can lose a handful of ULPs somewhere in that
         -- JSON-encode -> query-parameter-bind round trip (~1e-18 off,
         -- nowhere near "real" drift — the same row, same inputs, same
         -- instant), which is nonetheless enough to flip feed.score =
         -- cursor.score to false. That single flipped comparison let the
         -- cursor's own boundary row fall through to the "score < cursor"
         -- branch below and get admitted into the NEXT page too — the
         -- previous page's last row silently reappearing as the next
         -- page's first, confirmed live for real gists on prod. 9 decimals
         -- is far finer than this ranking needs and far coarser than the
         -- observed drift, so the rounded value now round-trips exactly.
         ROUND(
           ((COALESCE(c.reactions_count, 0)::float8 * 1 + COALESCE(c.comments_count, 0)::float8 * 3 + COALESCE(c.shares_count, 0)::float8 * 5)
             / POWER(EXTRACT(EPOCH FROM ($${asOfIdx}::timestamptz - g.created_at)) / 3600.0 + 2, 1.5))::numeric,
           9
         )::float8 AS score
     ) feed ON TRUE
     WHERE (g.gist_status = 'APPROVED' OR ($1::text IS NOT NULL AND g.avitag = $1::text))
       AND g.created_at <= $${asOfIdx}::timestamptz
       ${campusClause}
       AND ($${majorIdx}::text IS NULL OR sp.major_tag = $${majorIdx}::text)
       AND ${AUTHOR_LIVE_GATE}
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
      ...redactIfAnonymous(rest, viewerAvitag),
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
      `SELECT g.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count, c.reposts_count,
              COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type, pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN}
       FROM gists g
     ${AUTHOR_JOIN}
     ${QUOTED_GIST_JOIN("$4")}
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
       ) rbt ON TRUE${pollJoin("$4")}
       WHERE g.avitag = $1 AND g.created_at < (SELECT created_at FROM gists WHERE gist_id = $2)
         AND (g.gist_status != 'REJECTED' OR ($4::text IS NOT NULL AND g.avitag = $4::text))
         AND (NOT g.is_anonymous OR ($4::text IS NOT NULL AND g.avitag = $4::text))
         AND ${AUTHOR_LIVE_GATE}
       ORDER BY g.created_at DESC LIMIT $3`,
      [avitag, cursor, limit, viewerAvitag ?? null]
    );
    return rows.map((r) => redactIfAnonymous(r, viewerAvitag));
  }
  const { rows } = await pool.query<GistWithCounts>(
    `SELECT g.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count, c.reposts_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type, pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN}
     FROM gists g
     ${AUTHOR_JOIN}
     ${QUOTED_GIST_JOIN("$3")}
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
     ) rbt ON TRUE${pollJoin("$3")}
     WHERE g.avitag = $1 AND (g.gist_status != 'REJECTED' OR ($3::text IS NOT NULL AND g.avitag = $3::text))
       AND (NOT g.is_anonymous OR ($3::text IS NOT NULL AND g.avitag = $3::text))
       AND ${AUTHOR_LIVE_GATE}
     ORDER BY g.created_at DESC LIMIT $2`,
    [avitag, limit, viewerAvitag ?? null]
  );
  return rows.map((r) => redactIfAnonymous(r, viewerAvitag));
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
     WHERE g.avitag = $1 AND (g.gist_status != 'REJECTED' OR ($2::text IS NOT NULL AND g.avitag = $2::text))
       AND (NOT g.is_anonymous OR ($2::text IS NOT NULL AND g.avitag = $2::text))`,
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
    `SELECT g.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,counts.reactions_count, counts.comments_count, counts.views_count, counts.reports_count, counts.shares_count, counts.reposts_count,
            t.score, t.reactions_3d, t.comments_3d,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type, pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN}
     FROM v_gist_trending_3d t
     JOIN gists g ON g.gist_id = t.gist_id
     ${AUTHOR_JOIN}
     ${QUOTED_GIST_JOIN("$1")}
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
     ) rbt ON TRUE${pollJoin("$1")}
     WHERE (g.gist_status = 'APPROVED' OR ($1::text IS NOT NULL AND g.avitag = $1::text))
       AND ($2::text IS NULL OR UPPER(sp.campus_tag) = UPPER($2::text))
       AND ($3::text IS NULL OR sp.major_tag = $3::text)
       AND ${AUTHOR_LIVE_GATE}
     ORDER BY t.score DESC
     LIMIT $4`,
    [viewerAvitag ?? null, campus, major, limit]
  );
  return rows.map((r) => redactIfAnonymous(r, viewerAvitag));
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
    `SELECT g.*, ${AUTHOR_COLUMNS}, sp.campus_tag, sp.major_tag, sp.level,c.reactions_count, c.comments_count, c.views_count, c.reports_count, c.shares_count, c.reposts_count,
            COALESCE(m.media, '[]'::json) AS media, mr.type AS my_reaction, mrp.reported AS my_report, rbt.by_type AS reactions_by_type, pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN}
     FROM gists g
     ${AUTHOR_JOIN}
     ${QUOTED_GIST_JOIN("$6")}
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
     ) rbt ON TRUE${pollJoin("$6")}
     WHERE (g.gist_status = 'APPROVED' OR ($6::text IS NOT NULL AND g.avitag = $6::text))
       AND ($4::text IS NULL OR UPPER(sp.campus_tag) = UPPER($4::text))
       AND ($5::text IS NULL OR sp.major_tag = $5::text)
       AND g.gist_text ILIKE $1
       AND ${AUTHOR_LIVE_GATE}
     ORDER BY g.created_at DESC
     LIMIT $2 OFFSET $3`,
    [q, limit, offset, campus, major, viewerAvitag ?? null]
  );
  return rows.map((r) => redactIfAnonymous(r, viewerAvitag));
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

/**
 * Admin moderation queue for pending gists — same base as listPendingGists()
 * (nothing else calls that one, so this stays a separate function rather
 * than replacing it in place) but enriched so an admin panel can render a
 * full review card in one round trip: the poster's display name/photo
 * (unlike findWithCounts()'s student_profiles-only join, this COALESCEs
 * across all 5 profile tables — a moderation queue needs to identify a
 * KREATOR/KOMPANY/SCHOOL/IDIOT poster too, not just students), the gist's
 * media (same LATERAL gist_media JSON-array pattern as findWithCounts()),
 * and its report count (almost always 0 for a freshly-SUBMITTED gist, but
 * included anyway to keep this row shape consistent with the reports
 * queue below).
 */
export interface PendingGistWithDetails extends GistRow {
  display_name: string | null;
  image_url: string | null;
  reports_count: number;
  media: GistWithCounts["media"];
  /** See GistWithCounts's own `poll` doc — same shape, minus
   * `my_vote_option_id` (an admin reviewing a pending gist isn't voting on
   * it — see ADMIN_POLL_JOIN_SQL's own doc). */
  poll: { poll_id: string; options: Array<{ option_id: string; option_text: string; votes_count: number }> } | null;
  /** The quoted gist on a Yarn back — same QUOTED_GIST_JOIN/COLUMN every
   * consumer-facing query above already uses. Not redacted (no
   * redactIfAnonymous call anywhere in this function) — a moderator
   * reviewing a pending repost needs the real identity behind the quoted
   * gist too, same reasoning report.repo.ts's own listPendingWithDetails
   * already documents for the top-level poster. */
  quoted_gist: QuotedGistPreviewRow | null;
}

export async function listPendingGistsWithDetails(
  limit = 20,
  offset = 0
): Promise<PendingGistWithDetails[]> {
  const { rows } = await pool.query<PendingGistWithDetails>(
    `SELECT g.*,
            COALESCE(sp.display_name, sp.first_name || ' ' || sp.last_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS display_name,
            COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url,
            COALESCE(rc.reports_count, 0)::int AS reports_count,
            COALESCE(m.media, '[]'::json) AS media,
            pollj.poll AS poll,
            ${QUOTED_GIST_COLUMN}
     FROM gists g
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
     LEFT JOIN kreator_profiles kp ON kp.avitag = g.avitag
     LEFT JOIN kompany_profiles kmp ON kmp.avitag = g.avitag
     LEFT JOIN school_profiles scp ON scp.avitag = g.avitag
     LEFT JOIN idiot_profiles idp ON idp.avitag = g.avitag
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS reports_count FROM gist_reports WHERE gist_id = g.gist_id
     ) rc ON TRUE
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
     ${ADMIN_POLL_JOIN_SQL}
     ${QUOTED_GIST_JOIN(null)}
     WHERE g.gist_status = 'SUBMITTED'
     -- Newest first — this queue now gets live push events (see
     -- ws/socketio.ts's admin room), and a freshly-arrived item has to be
     -- the very first thing an admin sees, not something they scroll down
     -- to find. Older, still-unhandled items don't get lost — they're
     -- still here, just reached via "Load more" instead of being at top.
     ORDER BY g.created_at DESC
     LIMIT $1 OFFSET $2`,
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
     LEFT JOIN accounts acc ON acc.account_id = sp.account_id
     LEFT JOIN v_gist_counts c ON c.gist_id = g.gist_id
     WHERE g.gist_status = 'APPROVED'
       AND g.created_at >= NOW() - INTERVAL '72 hours'
       AND sp.campus_tag IS NOT NULL
       AND sp.profile_status = 'ACTIVE'
       AND (acc.account_status IS NULL OR acc.account_status = 'ACTIVE')
     GROUP BY sp.campus_tag
     ORDER BY score DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({ campus_tag: r.campus_tag, score: Number(r.score) }));
}
