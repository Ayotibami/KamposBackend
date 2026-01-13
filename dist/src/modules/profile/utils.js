import { pool } from '../../config/db';
export async function getCampusMajor(avitag) {
    // Currently only student_profiles define campus_tag/major_tag
    const { rows } = await pool.query(`SELECT campus_tag, major_tag FROM student_profiles WHERE avitag = $1 LIMIT 1`, [avitag]);
    const r = rows[0];
    return { campus_tag: r?.campus_tag ?? null, major_tag: r?.major_tag ?? null };
}
export async function findByAvitag(avitag) {
    // Check each subtype table for existence and return a normalized shape
    const checks = [
        { sql: 'SELECT avitag, account_id, is_verified FROM student_profiles WHERE avitag = $1 LIMIT 1', type: 'STUDENT' },
        { sql: 'SELECT avitag, account_id, is_verified FROM kreator_profiles WHERE avitag = $1 LIMIT 1', type: 'KREATOR' },
        { sql: 'SELECT avitag, account_id, is_verified FROM kompany_profiles WHERE avitag = $1 LIMIT 1', type: 'KOMPANY' },
        { sql: 'SELECT avitag, account_id, is_verified FROM school_profiles WHERE avitag = $1 LIMIT 1', type: 'SCHOOL' },
        { sql: 'SELECT avitag, account_id, is_verified FROM idiot_profiles WHERE avitag = $1 LIMIT 1', type: 'IDIOT' },
    ];
    for (const c of checks) {
        const { rows } = await pool.query(c.sql, [avitag]);
        if (rows[0]) {
            return { avitag: rows[0].avitag, account_id: rows[0].account_id, is_verified: rows[0].is_verified, profile_type: c.type };
        }
    }
    return null;
}
export async function listByAccount(account_id) {
    const { rows } = await pool.query(`(
      SELECT avitag, account_id, is_verified, 'STUDENT'::TEXT AS profile_type, display_name, image_url, created_at
      FROM student_profiles WHERE account_id = $1
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'KREATOR'::TEXT AS profile_type, display_name, image_url, joined_at AS created_at
      FROM kreator_profiles WHERE account_id = $1
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'KOMPANY'::TEXT AS profile_type, display_name, image_url, created_at
      FROM kompany_profiles WHERE account_id = $1
    ) UNION ALL (
      SELECT avitag, account_id, is_verified, 'SCHOOL'::TEXT AS profile_type, display_name, image_url, created_at
      FROM school_profiles WHERE account_id = $1
    )
    ORDER BY created_at DESC`, [account_id]);
    return rows;
}
