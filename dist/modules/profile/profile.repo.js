"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPendingProfiles = listPendingProfiles;
exports.verifyProfile = verifyProfile;
const db_1 = require("../../config/db");
const utils_1 = require("./utils");
// List profiles pending verification across all sub-profile tables
async function listPendingProfiles(limit = 20, offset = 0) {
    const { rows } = await db_1.pool.query(`(
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
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'IDIOT'::text AS profile_type
      FROM idiot_profiles WHERE is_verified = FALSE
    )
    ORDER BY avitag ASC
    LIMIT $1 OFFSET $2`, [limit, offset]);
    return rows;
}
// Verify a profile by avitag regardless of its subtype table
async function verifyProfile(avitag) {
    // Try to set is_verified = TRUE in each table; return the unified row
    const queries = [
        `UPDATE student_profiles SET is_verified = TRUE WHERE avitag = $1`,
        `UPDATE kreator_profiles SET is_verified = TRUE WHERE avitag = $1`,
        `UPDATE kompany_profiles SET is_verified = TRUE WHERE avitag = $1`,
        `UPDATE school_profiles SET is_verified = TRUE WHERE avitag = $1`,
        `UPDATE idiot_profiles SET is_verified = TRUE WHERE avitag = $1`,
    ];
    for (const q of queries) {
        const { rowCount } = await db_1.pool.query(q, [avitag]);
        if ((rowCount || 0) > 0) {
            // Found and updated; return normalized profile
            const prof = await (0, utils_1.findByAvitag)(avitag);
            return prof;
        }
    }
    return null;
}
