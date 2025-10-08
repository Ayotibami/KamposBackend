import { pool } from '../../config/db';

export interface CampusRow {
  campus_tag: string;
  campus_name: string;
}

export async function getAllCampuses(): Promise<CampusRow[]> {
  const { rows } = await pool.query<CampusRow>(
    'SELECT campus_tag, campus_name FROM campus ORDER BY campus_name ASC'
  );
  return rows;
}

export interface MajorRow {
  major_tag: string;
  major_name: string;
}

export async function getAllMajors(): Promise<MajorRow[]> {
  const { rows } = await pool.query<MajorRow>(
    'SELECT major_tag, major_name FROM major ORDER BY major_name ASC'
  );
  return rows;
}
