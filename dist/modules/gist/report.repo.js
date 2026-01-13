"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPending = listPending;
exports.getById = getById;
exports.listByGist = listByGist;
exports.rejectReport = rejectReport;
exports.acceptReportAndRejectGist = acceptReportAndRejectGist;
const db_1 = require("../../config/db");
async function listPending(limit = 20, offset = 0) {
    const { rows } = await db_1.pool.query(`SELECT * FROM gist_reports WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT $1 OFFSET $2`, [limit, offset]);
    return rows;
}
async function getById(report_id) {
    const { rows } = await db_1.pool.query(`SELECT * FROM gist_reports WHERE report_id = $1`, [report_id]);
    return rows[0] ?? null;
}
async function listByGist(gist_id) {
    const { rows } = await db_1.pool.query(`SELECT * FROM gist_reports WHERE gist_id = $1 ORDER BY created_at DESC`, [gist_id]);
    return rows;
}
async function rejectReport(report_id, idiot_avitag) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`UPDATE gist_reports SET status = 'REJECTED', reviewed_by = $2, reviewed_at = NOW() WHERE report_id = $1 AND status = 'PENDING' RETURNING *`, [report_id, idiot_avitag]);
        const row = rows[0] ?? null;
        if (row) {
            // If no more pending reports for the gist, clear is_reported
            await client.query(`UPDATE gists SET is_reported = EXISTS (SELECT 1 FROM gist_reports WHERE gist_id = $1 AND status = 'PENDING') WHERE gist_id = $1`, [row.gist_id]);
        }
        await client.query('COMMIT');
        return row;
    }
    catch (e) {
        try {
            await client.query('ROLLBACK');
        }
        catch { }
        throw e;
    }
    finally {
        client.release();
    }
}
async function acceptReportAndRejectGist(report_id, idiot_avitag) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`UPDATE gist_reports SET status = 'ACCEPTED', reviewed_by = $2, reviewed_at = NOW() WHERE report_id = $1 AND status = 'PENDING' RETURNING *`, [report_id, idiot_avitag]);
        const report = rows[0];
        if (!report)
            throw Object.assign(new Error('Report not found or already reviewed'), { statusCode: 404 });
        // Reject the gist
        await client.query(`UPDATE gists SET gist_status = 'REJECTED', edited_at = NOW() WHERE gist_id = $1`, [report.gist_id]);
        // Mark all remaining pending reports for the gist as ACCEPTED as well, since action is taken
        await client.query(`UPDATE gist_reports SET status = 'ACCEPTED', reviewed_by = $2, reviewed_at = NOW() WHERE gist_id = $1 AND status = 'PENDING'`, [report.gist_id, idiot_avitag]);
        // Clear is_reported (no more pending)
        await client.query(`UPDATE gists SET is_reported = EXISTS (SELECT 1 FROM gist_reports WHERE gist_id = $1 AND status = 'PENDING') WHERE gist_id = $1`, [report.gist_id]);
        await client.query('COMMIT');
        return { report };
    }
    catch (e) {
        try {
            await client.query('ROLLBACK');
        }
        catch { }
        throw e;
    }
    finally {
        client.release();
    }
}
