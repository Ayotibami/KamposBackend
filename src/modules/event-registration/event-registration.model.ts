import pool from "../../config/connectDB";
import type { IEventRegistration } from "./event-registration.interface";

const mapRow = (r: any): IEventRegistration => ({
  id: r.id,
  eventId: r.event_id,
  studentAviTag: r.student_avi_tag,
  registeredAt: r.registered_at,
});

export const createEventRegistration = async (
  registration: Partial<IEventRegistration>
): Promise<IEventRegistration> => {
  const { rows } = await pool.query(
    `INSERT INTO event_registrations (event_id, student_avi_tag) VALUES ($1, $2) RETURNING *`,
    [registration.eventId, registration.studentAviTag]
  );
  return mapRow(rows[0]);
};

export const findRegistrationsByEventId = async (
  eventId: string
): Promise<IEventRegistration[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM event_registrations WHERE event_id = $1`,
    [eventId]
  );
  return rows.map(mapRow);
};

export const findRegistrationsByStudent = async (
  studentAviTag: string
): Promise<IEventRegistration[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM event_registrations WHERE student_avi_tag = $1`,
    [studentAviTag]
  );
  return rows.map(mapRow);
};

export const deleteRegistrationById = async (id: number): Promise<void> => {
  await pool.query(`DELETE FROM event_registrations WHERE id = $1`, [id]);
};
