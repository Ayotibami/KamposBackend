import { pool } from "../../config/db";

export interface SpotReportRow {
  report_id: string;
  spot_id: string;
  reporter_avitag: string;
  reason: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function listPending(limit = 20, offset = 0): Promise<SpotReportRow[]> {
  const { rows } = await pool.query<SpotReportRow>(
    `SELECT * FROM spot_reports WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

/**
 * Admin moderation queue for pending Spot reports — same base as
 * listPending() but joins in the *reported spot's* own details, mirroring
 * gist/report.repo.ts's listPendingWithDetails() exactly (down to the
 * all-5-profile-tables COALESCE for poster identity). A moderator reviewing
 * a report needs to see the actual clip (media_url/thumbnail_url/caption)
 * and its current status without a second round trip per row.
 */
export interface PendingSpotReportWithDetails extends SpotReportRow {
  spot_avitag: string;
  spot_caption: string | null;
  spot_media_url: string | null;
  spot_thumbnail_url: string | null;
  spot_duration_seconds: number | null;
  spot_status: "DRAFT" | "ACTIVE" | "REJECTED" | "REMOVED";
  display_name: string | null;
  image_url: string | null;
}

export async function listPendingWithDetails(limit = 20, offset = 0): Promise<PendingSpotReportWithDetails[]> {
  const { rows } = await pool.query<PendingSpotReportWithDetails>(
    `SELECT r.*,
            s.avitag AS spot_avitag, s.caption AS spot_caption, s.media_url AS spot_media_url,
            s.thumbnail_url AS spot_thumbnail_url, s.duration_seconds AS spot_duration_seconds,
            s.status AS spot_status,
            COALESCE(sp.display_name, sp.first_name || ' ' || sp.last_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS display_name,
            COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url
     FROM spot_reports r
     JOIN spots s ON s.spot_id = r.spot_id
     LEFT JOIN student_profiles sp ON sp.avitag = s.avitag
     LEFT JOIN kreator_profiles kp ON kp.avitag = s.avitag
     LEFT JOIN kompany_profiles kmp ON kmp.avitag = s.avitag
     LEFT JOIN school_profiles scp ON scp.avitag = s.avitag
     LEFT JOIN idiot_profiles idp ON idp.avitag = s.avitag
     WHERE r.status = 'PENDING'
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function getById(report_id: string): Promise<SpotReportRow | null> {
  const { rows } = await pool.query<SpotReportRow>(`SELECT * FROM spot_reports WHERE report_id = $1`, [report_id]);
  return rows[0] ?? null;
}

export async function listBySpot(spot_id: string): Promise<SpotReportRow[]> {
  const { rows } = await pool.query<SpotReportRow>(
    `SELECT * FROM spot_reports WHERE spot_id = $1 ORDER BY created_at DESC`,
    [spot_id]
  );
  return rows;
}

export async function rejectReport(report_id: string, idiot_avitag: string): Promise<SpotReportRow | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<SpotReportRow>(
      `UPDATE spot_reports SET status = 'REJECTED', reviewed_by = $2, reviewed_at = NOW() WHERE report_id = $1 AND status = 'PENDING' RETURNING *`,
      [report_id, idiot_avitag]
    );
    const row = rows[0] ?? null;
    if (row) {
      // If no more pending reports for the spot, clear is_reported.
      await client.query(
        `UPDATE spots SET is_reported = EXISTS (SELECT 1 FROM spot_reports WHERE spot_id = $1 AND status = 'PENDING') WHERE spot_id = $1`,
        [row.spot_id]
      );
    }
    await client.query("COMMIT");
    return row;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

export async function acceptReportAndRejectSpot(report_id: string, idiot_avitag: string): Promise<{ report: SpotReportRow }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<SpotReportRow>(
      `UPDATE spot_reports SET status = 'ACCEPTED', reviewed_by = $2, reviewed_at = NOW() WHERE report_id = $1 AND status = 'PENDING' RETURNING *`,
      [report_id, idiot_avitag]
    );
    const report = rows[0];
    if (!report) throw Object.assign(new Error("Report not found or already reviewed"), { statusCode: 404 });

    // Reject the spot — only takes effect if it's still ACTIVE (mirrors
    // rejectAsAdmin's own guard in spot.controller.ts's remove, so accepting
    // a report against an already-removed spot doesn't resurrect/overwrite
    // whatever status it's already settled into).
    await client.query(`UPDATE spots SET status = 'REJECTED' WHERE spot_id = $1 AND status = 'ACTIVE'`, [report.spot_id]);

    // Mark all remaining pending reports for the spot as ACCEPTED as well,
    // since action is taken.
    await client.query(
      `UPDATE spot_reports SET status = 'ACCEPTED', reviewed_by = $2, reviewed_at = NOW() WHERE spot_id = $1 AND status = 'PENDING'`,
      [report.spot_id, idiot_avitag]
    );

    // Clear is_reported (no more pending).
    await client.query(
      `UPDATE spots SET is_reported = EXISTS (SELECT 1 FROM spot_reports WHERE spot_id = $1 AND status = 'PENDING') WHERE spot_id = $1`,
      [report.spot_id]
    );

    await client.query("COMMIT");
    return { report };
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
