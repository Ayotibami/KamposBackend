import pool from "../../config/connectDB";
import type { IEvent } from "./event.interface";

const mapRow = (r: any): IEvent => ({
  eventId: r.event_id,
  title: r.title,
  hostAviTags: r.host_avi_tags,
  location: r.location,
  description: r.description,
  eventDate: r.event_date,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const createEvent = async (event: Partial<IEvent>): Promise<IEvent> => {
  const { rows } = await pool.query(
    `INSERT INTO events (title, host_avi_tags, location, description, event_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      event.title,
      event.hostAviTags,
      event.location,
      event.description,
      event.eventDate,
    ]
  );
  return mapRow(rows[0]);
};

export const findEventById = async (
  eventId: string
): Promise<IEvent | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM events WHERE event_id = $1`,
    [eventId]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findEventsByCampus = async (
  campusTag: string
): Promise<IEvent[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM events WHERE location = $1 ORDER BY event_date DESC`,
    [campusTag]
  );
  return rows.map(mapRow);
};

export const updateEventById = async (
  eventId: string,
  updates: Partial<IEvent>
): Promise<IEvent | null> => {
  const set: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  if (updates.title) {
    set.push(`title = $${idx++}`);
    vals.push(updates.title);
  }
  if (updates.hostAviTags) {
    set.push(`host_avi_tags = $${idx++}`);
    vals.push(updates.hostAviTags);
  }
  if (updates.location) {
    set.push(`location = $${idx++}`);
    vals.push(updates.location);
  }
  if (updates.description) {
    set.push(`description = $${idx++}`);
    vals.push(updates.description);
  }
  if (updates.eventDate) {
    set.push(`event_date = $${idx++}`);
    vals.push(updates.eventDate);
  }
  if (set.length === 0) return findEventById(eventId);
  vals.push(eventId);
  const { rows } = await pool.query(
    `UPDATE events SET ${set.join(
      ", "
    )}, updated_at = NOW() WHERE event_id = $${idx} RETURNING *`,
    vals
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const deleteEventById = async (eventId: string): Promise<void> => {
  await pool.query(`DELETE FROM events WHERE event_id = $1`, [eventId]);
};
