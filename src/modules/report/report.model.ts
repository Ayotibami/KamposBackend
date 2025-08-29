import pool from "../../config/connectDB";
import type { IReport } from "./report.interface";

const mapRow = (r: any): IReport => ({
  reportId: r.report_id,
  reportedBy: r.reported_by,
  gistId: r.gist_id,
  reason: r.reason,
  status: r.status,
  actionTaken: r.action_taken,
  reviewedBy: r.reviewed_by,
  reviewedAt: r.reviewed_at,
  createdAt: r.created_at,
});

export const createReport = async (
  report: Partial<IReport>
): Promise<IReport> => {
  const { rows } = await pool.query(
    `INSERT INTO reports (reported_by, gist_id, reason, status)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [
      report.reportedBy,
      report.gistId,
      report.reason,
      report.status ?? "PENDING",
    ]
  );
  return mapRow(rows[0]);
};

export const findReportById = async (
  reportId: string
): Promise<IReport | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM reports WHERE report_id = $1`,
    [reportId]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findReportsByGistId = async (
  gistId: string
): Promise<IReport[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM reports WHERE gist_id = $1`,
    [gistId]
  );
  return rows.map(mapRow);
};

export const updateReportById = async (
  reportId: string,
  updates: Partial<IReport>
): Promise<IReport | null> => {
  const set: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  if (updates.status) {
    set.push(`status = $${idx++}`);
    vals.push(updates.status);
  }
  if (updates.actionTaken !== undefined) {
    set.push(`action_taken = $${idx++}`);
    vals.push(updates.actionTaken);
  }
  if (updates.reviewedBy) {
    set.push(`reviewed_by = $${idx++}`);
    vals.push(updates.reviewedBy);
  }
  if (set.length === 0) return findReportById(reportId);
  vals.push(reportId);
  const { rows } = await pool.query(
    `UPDATE reports SET ${set.join(
      ", "
    )}, reviewed_at = NOW() WHERE report_id = $${idx} RETURNING *`,
    vals
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findAllReports = async (): Promise<IReport[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM reports ORDER BY created_at DESC`
  );
  return rows.map(mapRow);
};

export const findReportsByUser = async (aviTag: string): Promise<IReport[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM reports WHERE reported_by = $1 ORDER BY created_at DESC`,
    [aviTag]
  );
  return rows.map(mapRow);
};

export const deleteReportById = async (reportId: string): Promise<void> => {
  await pool.query(`DELETE FROM reports WHERE report_id = $1`, [reportId]);
};

