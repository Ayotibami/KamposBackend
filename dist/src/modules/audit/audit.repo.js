import { pool } from '../../config/db';
export async function logAudit(params) {
    await pool.query(`INSERT INTO audit_logs (action, target_type, target_id, idiot_avitag, reason)
     VALUES ($1, $2, $3, $4, $5)`, [params.action, params.target_type, params.target_id, params.idiot_avitag, params.reason ?? null]);
}
