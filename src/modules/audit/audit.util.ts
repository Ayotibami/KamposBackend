import { logAudit, type AuditAction } from './audit.repo';

export async function safeAudit(params: {
  action: AuditAction;
  target_type: 'PROFILE' | 'GIST' | 'ACCOUNT' | 'COMMENT' | 'CAMPUS' | 'MAJOR' | 'BROADCAST';
  target_id: string;
  idiot_avitag: string;
  reason?: string | null;
}): Promise<void> {
  try {
    await logAudit(params);
  } catch {
    // swallow audit errors to avoid breaking the moderation action
  }
}
