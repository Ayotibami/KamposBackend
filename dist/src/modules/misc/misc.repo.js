import { pool } from '../../config/db';
export async function getAllCampuses() {
    const { rows } = await pool.query('SELECT campus_tag, campus_name FROM campus ORDER BY campus_name ASC');
    return rows;
}
export async function getAllMajors() {
    const { rows } = await pool.query('SELECT major_tag, major_name FROM major ORDER BY major_name ASC');
    return rows;
}
