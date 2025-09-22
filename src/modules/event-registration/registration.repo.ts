import { pool } from '../../config/db';

export interface EventRegistrationRow {
  id: number;
  event_id: string;
  student_avi_tag: string;
  registered_at: string;
}

export async function register(event_id: string, student_avi_tag: string): Promise<EventRegistrationRow> {
  const { rows } = await pool.query<EventRegistrationRow>(
    `INSERT INTO event_registrations (event_id, student_avi_tag) VALUES ($1,$2) RETURNING *`,
    [event_id, student_avi_tag]
  );
  return rows[0];
}

export async function listByEvent(event_id: string): Promise<EventRegistrationRow[]> {
  const { rows } = await pool.query<EventRegistrationRow>(
    `SELECT * FROM event_registrations WHERE event_id = $1 ORDER BY registered_at DESC`,
    [event_id]
  );
  return rows;
}

export async function listByStudent(avi_tag: string): Promise<EventRegistrationRow[]> {
  const { rows } = await pool.query<EventRegistrationRow>(
    `SELECT * FROM event_registrations WHERE student_avi_tag = $1 ORDER BY registered_at DESC`,
    [avi_tag]
  );
  return rows;
}

export async function unregister(id: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM event_registrations WHERE id = $1`, [id]);
  return (rowCount || 0) > 0;
}
