import { pool } from '../../config/db';
import type { ProfileType, BasicProfile } from './utils';
import { findByAvitag } from './utils';

export interface PendingProfileRow extends BasicProfile {}

// List profiles pending verification across all sub-profile tables
export async function listPendingProfiles(limit = 20, offset = 0): Promise<PendingProfileRow[]> {
  const { rows } = await pool.query<PendingProfileRow>(
    `(
      SELECT avitag, account_id, is_verified, 'STUDENT'::text AS profile_type
      FROM student_profiles WHERE is_verified = FALSE
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'KREATOR'::text AS profile_type
      FROM kreator_profiles WHERE is_verified = FALSE
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'KOMPANY'::text AS profile_type
      FROM kompany_profiles WHERE is_verified = FALSE
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'SCHOOL'::text AS profile_type
      FROM school_profiles WHERE is_verified = FALSE
    )
    ORDER BY avitag ASC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

// Verify a profile by avitag regardless of its subtype table
export async function verifyProfile(avitag: string): Promise<BasicProfile | null> {
  // Try to set is_verified = TRUE in each table; return the unified row
  const queries = [
    `UPDATE student_profiles SET is_verified = TRUE WHERE avitag = $1`,
    `UPDATE kreator_profiles SET is_verified = TRUE WHERE avitag = $1`,
    `UPDATE kompany_profiles SET is_verified = TRUE WHERE avitag = $1`,
    `UPDATE school_profiles SET is_verified = TRUE WHERE avitag = $1`,
  ];
  for (const q of queries) {
    const { rowCount } = await pool.query(q, [avitag]);
    if ((rowCount || 0) > 0) {
      // Found and updated; return normalized profile
      const prof = await findByAvitag(avitag);
      return prof;
    }
  }
  return null;
}
