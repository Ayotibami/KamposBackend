import pool from "../../config/connectDB";
import type { IView } from "./view.interface";

const mapRow = (r: any): IView => ({
  viewId: r.view_id,
  gistId: r.gist_id,
  avitag: r.avitag,
  viewedAt: r.viewed_at,
});

export const createView = async (view: Partial<IView>): Promise<IView> => {
  const { rows } = await pool.query(
    `INSERT INTO views (gist_id, avitag) VALUES ($1, $2) RETURNING *`,
    [view.gistId, view.avitag]
  );
  return mapRow(rows[0]);
};

export const findViewsByGistId = async (gistId: string): Promise<IView[]> => {
  const { rows } = await pool.query(`SELECT * FROM views WHERE gist_id = $1`, [
    gistId,
  ]);
  return rows.map(mapRow);
};

export const countViewsByGistId = async (gistId: string): Promise<number> => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM views WHERE gist_id = $1`,
    [gistId]
  );
  return parseInt(rows[0].count);
};
