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

// --- Admin write side (idiot/reference.controller.ts) ---
//
// campus_tag/major_tag are the PRIMARY KEY on these two tables, and are
// stored as free-text copies (not enforced by any foreign key) on several
// OTHER tables too — confirmed live against the database's actual
// information_schema, not just the migration files, since those two
// disagreed: kreator_profiles.campustag, gists.campus_tag/major_tag, and
// events.campus_tag/major_tag carry no FK at all, only
// student_profiles.campus_tag/major_tag and school_profiles.campus_tag do.
// That inconsistency is exactly why the tag itself is NOT editable here —
// renaming a campus's tag would cascade correctly through the two
// FK-protected tables but silently leave the other three holding a now-
// orphaned value with no error and no way to notice. The tag is set once
// at creation (same permanence model as avitag) and locked forever after;
// only campus_name/major_name (safe — nothing keys off the display name)
// can ever change post-creation.

export async function createCampus(campus_tag: string, campus_name: string): Promise<CampusRow> {
  const { rows } = await pool.query<CampusRow>(
    `INSERT INTO campus (campus_tag, campus_name) VALUES ($1, $2) RETURNING campus_tag, campus_name`,
    [campus_tag, campus_name],
  );
  return rows[0];
}

export async function updateCampusName(campus_tag: string, campus_name: string): Promise<CampusRow | null> {
  const { rows } = await pool.query<CampusRow>(
    `UPDATE campus SET campus_name = $2 WHERE campus_tag = $1 RETURNING campus_tag, campus_name`,
    [campus_tag, campus_name],
  );
  return rows[0] ?? null;
}

export interface CampusUsage {
  student_profiles: number;
  school_profiles: number;
  kreator_profiles: number;
  gists: number;
  events: number;
  total: number;
}

/** Every place a campus_tag value is stored, FK-protected or not (see this
 * file's own doc comment above) — checked before a delete is ever allowed,
 * since three of these five would otherwise let the row vanish out from
 * under them with zero warning. */
export async function getCampusUsage(campus_tag: string): Promise<CampusUsage> {
  const { rows } = await pool.query<Omit<CampusUsage, 'total'>>(
    `SELECT
       (SELECT COUNT(*)::int FROM student_profiles WHERE campus_tag = $1) AS student_profiles,
       (SELECT COUNT(*)::int FROM school_profiles WHERE campus_tag = $1) AS school_profiles,
       (SELECT COUNT(*)::int FROM kreator_profiles WHERE campustag = $1) AS kreator_profiles,
       (SELECT COUNT(*)::int FROM gists WHERE campus_tag = $1) AS gists,
       (SELECT COUNT(*)::int FROM events WHERE campus_tag = $1) AS events`,
    [campus_tag],
  );
  const r = rows[0];
  return { ...r, total: r.student_profiles + r.school_profiles + r.kreator_profiles + r.gists + r.events };
}

/** Returns the deleted row's own name (or null if the tag didn't exist) —
 * not just a boolean — so the caller can fold it into the audit trail's
 * `reason` before it's gone for good. Once deleted, audit.repo.ts's own
 * LEFT JOIN back to this table returns null forever; the reason captured
 * here at delete time is the only place that name survives afterward. */
export async function deleteCampus(campus_tag: string): Promise<string | null> {
  const { rows } = await pool.query<{ campus_name: string }>(
    `DELETE FROM campus WHERE campus_tag = $1 RETURNING campus_name`,
    [campus_tag],
  );
  return rows[0]?.campus_name ?? null;
}

export async function createMajor(major_tag: string, major_name: string): Promise<MajorRow> {
  const { rows } = await pool.query<MajorRow>(
    `INSERT INTO major (major_tag, major_name) VALUES ($1, $2) RETURNING major_tag, major_name`,
    [major_tag, major_name],
  );
  return rows[0];
}

export async function updateMajorName(major_tag: string, major_name: string): Promise<MajorRow | null> {
  const { rows } = await pool.query<MajorRow>(
    `UPDATE major SET major_name = $2 WHERE major_tag = $1 RETURNING major_tag, major_name`,
    [major_tag, major_name],
  );
  return rows[0] ?? null;
}

export interface MajorUsage {
  student_profiles: number;
  gists: number;
  events: number;
  total: number;
}

/** major_tag has no non-student profile use (only student_profiles has a
 * major at all) — just student_profiles, gists, events. */
export async function getMajorUsage(major_tag: string): Promise<MajorUsage> {
  const { rows } = await pool.query<Omit<MajorUsage, 'total'>>(
    `SELECT
       (SELECT COUNT(*)::int FROM student_profiles WHERE major_tag = $1) AS student_profiles,
       (SELECT COUNT(*)::int FROM gists WHERE major_tag = $1) AS gists,
       (SELECT COUNT(*)::int FROM events WHERE major_tag = $1) AS events`,
    [major_tag],
  );
  const r = rows[0];
  return { ...r, total: r.student_profiles + r.gists + r.events };
}

/** Same reasoning as deleteCampus above — returns the deleted name so the
 * caller can capture it in the audit trail before it's gone. */
export async function deleteMajor(major_tag: string): Promise<string | null> {
  const { rows } = await pool.query<{ major_name: string }>(
    `DELETE FROM major WHERE major_tag = $1 RETURNING major_name`,
    [major_tag],
  );
  return rows[0]?.major_name ?? null;
}
