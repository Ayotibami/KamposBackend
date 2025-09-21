import { pool } from '../../config/db';

export async function logAudit(params: {
  action: 'PROFILE_VERIFY' | 'PROFILE_REJECT' | 'GIST_APPROVE' | 'GIST_REJECT' | 'REPORT_ACCEPT' | 'REPORT_REJECT';
  target_type: 'PROFILE' | 'GIST';
  target_id: string; // avitag or gist_id
  idiot_avitag: string;
  reason?: string | null;
}) {
  await pool.query(
    `INSERT INTO audit_logs (action, target_type, target_id, idiot_avitag, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.action, params.target_type, params.target_id, params.idiot_avitag, params.reason ?? null]
  );
}
