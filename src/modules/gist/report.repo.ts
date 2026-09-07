import { pool } from '../../config/db';

export interface GistReportRow {
  report_id: string;
  gist_id: string;
  reporter_avitag: string;
  reason: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function listPending(limit = 20, offset = 0): Promise<GistReportRow[]> {
  const { rows } = await pool.query<GistReportRow>(
    `SELECT * FROM gist_reports WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

/**
 * Admin moderation queue for pending reports — same base as listPending()
 * but joins in the *reported gist's* own details, since an admin reviewing
 * a report needs to see what's actually being reported (its text, current
 * status, poster identity, media) without a second round trip per row.
 * Poster display name/photo uses the same all-5-profile-tables COALESCE
 * join as gist.repo.ts's listPendingGistsWithDetails() — a moderation view
 * needs to identify a poster of any profile type, not just students.
 */
export interface PendingReportWithDetails extends GistReportRow {
  gist_avitag: string;
  gist_text: string;
  gist_status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  display_name: string | null;
  image_url: string | null;
  media: Array<{
    media_id: string;
    media_type: 'IMAGE' | 'VIDEO';
    media_url: string;
    thumbnail_url: string | null;
    width: number | null;
    height: number | null;
    order_index: number;
    uploaded_at: string;
    edited_at: string | null;
  }>;
}

export async function listPendingWithDetails(limit = 20, offset = 0): Promise<PendingReportWithDetails[]> {
  const { rows } = await pool.query<PendingReportWithDetails>(
    `SELECT r.*,
            g.avitag AS gist_avitag, g.gist_text, g.gist_status,
            COALESCE(sp.display_name, sp.first_name || ' ' || sp.last_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS display_name,
            COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url,
            COALESCE(m.media, '[]'::json) AS media
     FROM gist_reports r
     JOIN gists g ON g.gist_id = r.gist_id
     LEFT JOIN student_profiles sp ON sp.avitag = g.avitag
     LEFT JOIN kreator_profiles kp ON kp.avitag = g.avitag
     LEFT JOIN kompany_profiles kmp ON kmp.avitag = g.avitag
     LEFT JOIN school_profiles scp ON scp.avitag = g.avitag
     LEFT JOIN idiot_profiles idp ON idp.avitag = g.avitag
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
     WHERE r.status = 'PENDING'
     -- Newest first — see gist.repo.ts's listPendingGistsWithDetails for
     -- why (this queue gets the same live push events).
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function getById(report_id: string): Promise<GistReportRow | null> {
  const { rows } = await pool.query<GistReportRow>(`SELECT * FROM gist_reports WHERE report_id = $1`, [report_id]);
  return rows[0] ?? null;
}

export async function listByGist(gist_id: string): Promise<GistReportRow[]> {
  const { rows } = await pool.query<GistReportRow>(
    `SELECT * FROM gist_reports WHERE gist_id = $1 ORDER BY created_at DESC`,
    [gist_id]
  );
  return rows;
}

export async function rejectReport(report_id: string, idiot_avitag: string): Promise<GistReportRow | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<GistReportRow>(
      `UPDATE gist_reports SET status = 'REJECTED', reviewed_by = $2, reviewed_at = NOW() WHERE report_id = $1 AND status = 'PENDING' RETURNING *`,
      [report_id, idiot_avitag]
    );
    const row = rows[0] ?? null;
    if (row) {
      // If no more pending reports for the gist, clear is_reported
      await client.query(
        `UPDATE gists SET is_reported = EXISTS (SELECT 1 FROM gist_reports WHERE gist_id = $1 AND status = 'PENDING') WHERE gist_id = $1`,
        [row.gist_id]
      );
    }
    await client.query('COMMIT');
    return row;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

export async function acceptReportAndRejectGist(report_id: string, idiot_avitag: string): Promise<{ report: GistReportRow; }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<GistReportRow>(
      `UPDATE gist_reports SET status = 'ACCEPTED', reviewed_by = $2, reviewed_at = NOW() WHERE report_id = $1 AND status = 'PENDING' RETURNING *`,
      [report_id, idiot_avitag]
    );
    const report = rows[0];
    if (!report) throw Object.assign(new Error('Report not found or already reviewed'), { statusCode: 404 });

    // Reject the gist
    await client.query(`UPDATE gists SET gist_status = 'REJECTED', edited_at = NOW() WHERE gist_id = $1`, [report.gist_id]);

    // Mark all remaining pending reports for the gist as ACCEPTED as well, since action is taken
    await client.query(
      `UPDATE gist_reports SET status = 'ACCEPTED', reviewed_by = $2, reviewed_at = NOW() WHERE gist_id = $1 AND status = 'PENDING'`,
      [report.gist_id, idiot_avitag]
    );

    // Clear is_reported (no more pending)
    await client.query(
      `UPDATE gists SET is_reported = EXISTS (SELECT 1 FROM gist_reports WHERE gist_id = $1 AND status = 'PENDING') WHERE gist_id = $1`,
      [report.gist_id]
    );

    await client.query('COMMIT');
    return { report };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
