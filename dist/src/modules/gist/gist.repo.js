import { pool } from "../../config/db";
export async function getCounts(gist_id) {
    const { rows } = await pool.query(`SELECT gist_id, reactions_count, comments_count, views_count, reports_count FROM v_gist_counts WHERE gist_id = $1`, [gist_id]);
    return rows[0] ?? null;
}
export async function getReactionBreakdownForGist(gist_id) {
    const { rows } = await pool.query(`SELECT type, COUNT(*)::int AS count FROM reactions WHERE entity_type = 'GIST' AND entity_id = $1 GROUP BY type`, [gist_id]);
    const map = {};
    for (const r of rows)
        map[r.type] = Number(r.count);
    return map;
}
export async function getCountsFull(gist_id) {
    const [counts, reactions_by_type] = await Promise.all([
        getCounts(gist_id),
        getReactionBreakdownForGist(gist_id),
    ]);
    return { counts, reactions_by_type };
}
export async function findWithCountsAnyStatus(gist_id) {
    const { rows } = await pool.query(`SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
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
     WHERE g.gist_id = $1`, [gist_id]);
    return rows[0] ?? null;
}
export async function create(avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag) {
    const { rows } = await pool.query(`INSERT INTO gists (avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag]);
    return rows[0];
}
export async function updateText(gist_id, avitag, gist_text) {
    const { rows } = await pool.query(`UPDATE gists SET gist_text = $1, edited_at = NOW(), edit_count = edit_count + 1
     WHERE gist_id = $2 AND avitag = $3 RETURNING *`, [gist_text, gist_id, avitag]);
    return rows[0] ?? null;
}
export async function remove(gist_id, avitag) {
    const { rowCount } = await pool.query(`DELETE FROM gists WHERE gist_id = $1 AND avitag = $2`, [gist_id, avitag]);
    return (rowCount || 0) > 0;
}
export async function removeAsIdiot(gist_id) {
    const { rowCount } = await pool.query(`DELETE FROM gists WHERE gist_id = $1`, [gist_id]);
    return (rowCount || 0) > 0;
}
export async function findById(gist_id) {
    const { rows } = await pool.query(`SELECT * FROM gists WHERE gist_id = $1`, [gist_id]);
    return rows[0] ?? null;
}
export async function findWithCounts(gist_id) {
    const { rows } = await pool.query(`SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
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
     WHERE g.gist_id = $1 AND g.gist_status = 'APPROVED'`, [gist_id]);
    return rows[0] ?? null;
}
export async function listRecent(limit = 20, cursor, viewerAvitag, filters) {
    const campus = filters?.campus_tag ?? null;
    const major = filters?.major_tag ?? null;
    if (cursor) {
        const { rows } = await pool.query(`SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
              COALESCE(m.media, '[]'::json) AS media
       FROM gists g
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
       WHERE g.created_at < (SELECT created_at FROM gists WHERE gist_id = $1)
        AND (g.gist_status = 'APPROVED' OR ($3::text IS NOT NULL AND g.avitag = $3::text))
        AND ($4::text IS NULL OR g.campus_tag = $4::text)
        AND ($5::text IS NULL OR g.major_tag = $5::text)
       ORDER BY g.created_at DESC
       LIMIT $2`, [cursor, limit, viewerAvitag ?? null, campus, major]);
        return rows;
    }
    const { rows } = await pool.query(`SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
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
     WHERE (g.gist_status = 'APPROVED' OR ($1::text IS NOT NULL AND g.avitag = $1::text))
       AND ($2::text IS NULL OR g.campus_tag = $2::text)
       AND ($3::text IS NULL OR g.major_tag = $3::text)
     ORDER BY g.created_at DESC LIMIT $4`, [viewerAvitag ?? null, campus, major, limit]);
    return rows;
}
export async function listByUser(avitag, limit = 20, cursor, viewerAvitag) {
    if (cursor) {
        const { rows } = await pool.query(`SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
              COALESCE(m.media, '[]'::json) AS media
       FROM gists g
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
       WHERE g.avitag = $1 AND g.created_at < (SELECT created_at FROM gists WHERE gist_id = $2)
         AND (g.gist_status = 'APPROVED' OR ($4::text IS NOT NULL AND g.avitag = $4::text))
       ORDER BY g.created_at DESC LIMIT $3`, [avitag, cursor, limit, viewerAvitag ?? null]);
        return rows;
    }
    const { rows } = await pool.query(`SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
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
     WHERE g.avitag = $1 AND (g.gist_status = 'APPROVED' OR ($3::text IS NOT NULL AND g.avitag = $3::text))
     ORDER BY g.created_at DESC LIMIT $2`, [avitag, limit, viewerAvitag ?? null]);
    return rows;
}
export async function trending(limit = 20, viewerAvitag, filters) {
    const campus = filters?.campus_tag ?? null;
    const major = filters?.major_tag ?? null;
    const { rows } = await pool.query(`SELECT g.*, counts.reactions_count, counts.comments_count, counts.views_count, counts.reports_count,
            t.score, t.reactions_3d, t.comments_3d,
            COALESCE(m.media, '[]'::json) AS media
     FROM v_gist_trending_3d t
     JOIN gists g ON g.gist_id = t.gist_id
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
     WHERE (g.gist_status = 'APPROVED' OR ($1::text IS NOT NULL AND g.avitag = $1::text))
       AND ($2::text IS NULL OR g.campus_tag = $2::text)
       AND ($3::text IS NULL OR g.major_tag = $3::text)
     ORDER BY t.score DESC
     LIMIT $4`, [viewerAvitag ?? null, campus, major, limit]);
    return rows;
}
export async function search(term, limit = 20, offset = 0, viewerAvitag, filters) {
    const q = `%${term}%`;
    const campus = filters?.campus_tag ?? null;
    const major = filters?.major_tag ?? null;
    const { rows } = await pool.query(`SELECT g.*, c.reactions_count, c.comments_count, c.views_count, c.reports_count,
            COALESCE(m.media, '[]'::json) AS media
     FROM gists g
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
     WHERE (g.gist_status = 'APPROVED' OR ($6::text IS NOT NULL AND g.avitag = $6::text))
       AND ($4::text IS NULL OR g.campus_tag = $4::text)
       AND ($5::text IS NULL OR g.major_tag = $5::text)
       AND g.gist_text ILIKE $1
     ORDER BY g.created_at DESC
     LIMIT $2 OFFSET $3`, [q, limit, offset, campus, major, viewerAvitag ?? null]);
    return rows;
}
export async function report(gist_id, reporter_avitag, reason) {
    await pool.query(`INSERT INTO gist_reports (gist_id, reporter_avitag, reason) VALUES ($1, $2, $3)`, [gist_id, reporter_avitag, reason]);
    await pool.query(`UPDATE gists SET is_reported = TRUE WHERE gist_id = $1`, [
        gist_id,
    ]);
}
export async function incrementView(gist_id, avitag) {
    await pool.query(`INSERT INTO gist_views (gist_id, avitag) VALUES ($1, $2)`, [
        gist_id,
        avitag,
    ]);
}
// Moderation helpers (used by idiot routes)
export async function approveGist(gist_id) {
    const { rows } = await pool.query(`UPDATE gists SET gist_status = 'APPROVED', edited_at = NOW() WHERE gist_id = $1 RETURNING *`, [gist_id]);
    return rows[0] ?? null;
}
export async function rejectGist(gist_id) {
    const { rows } = await pool.query(`UPDATE gists SET gist_status = 'REJECTED', edited_at = NOW() WHERE gist_id = $1 RETURNING *`, [gist_id]);
    return rows[0] ?? null;
}
export async function listPendingGists(limit = 20, offset = 0) {
    const { rows } = await pool.query(`SELECT * FROM gists WHERE gist_status = 'SUBMITTED' ORDER BY created_at ASC LIMIT $1 OFFSET $2`, [limit, offset]);
    return rows;
}
