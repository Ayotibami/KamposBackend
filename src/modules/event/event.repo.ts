import { pool } from '../../config/db';

export interface EventRow {
  event_id: string;
  title: string;
  host_avi_tags: string[];
  location: string;
  description: string;
  event_date: string; // ISO
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function create(ev: {
  title: string;
  host_avi_tags: string[];
  location: string;
  description: string;
  event_date: Date;
  thumbnail_url?: string | null;
}): Promise<EventRow> {
  const { rows } = await pool.query<EventRow>(
    `INSERT INTO events (title, host_avi_tags, location, description, event_date, thumbnail_url)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [ev.title, ev.host_avi_tags, ev.location, ev.description, ev.event_date, ev.thumbnail_url ?? null]
  );
  return rows[0];
}

export async function update(event_id: string, patch: Partial<Omit<EventRow,'event_id'|'created_at'|'updated_at'>>): Promise<EventRow | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = $${idx++}`);
    values.push(v);
  }
  if (!fields.length) return findById(event_id);
  values.push(event_id);
  const { rows } = await pool.query<EventRow>(
    `UPDATE events SET ${fields.join(', ')}, updated_at = NOW() WHERE event_id = $${idx} RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

export async function remove(event_id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM events WHERE event_id = $1`, [event_id]);
  return (rowCount || 0) > 0;
}

export async function list(limit = 20, before?: string): Promise<EventRow[]> {
  if (before) {
    const { rows } = await pool.query<EventRow>(
      `SELECT * FROM events WHERE event_date < (SELECT event_date FROM events WHERE event_id = $1)
       ORDER BY event_date DESC LIMIT $2`,
      [before, limit]
    );
    return rows;
  }
  const { rows } = await pool.query<EventRow>(
    `SELECT * FROM events ORDER BY event_date DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function findById(event_id: string): Promise<EventRow | null> {
  const { rows } = await pool.query<EventRow>(`SELECT * FROM events WHERE event_id = $1`, [event_id]);
  return rows[0] ?? null;
}

export async function incrementView(event_id: string, avitag: string | null): Promise<void> {
  await pool.query(`INSERT INTO event_views (event_id, avitag) VALUES ($1,$2)`, [event_id, avitag]);
}
