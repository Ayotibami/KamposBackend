import { logAudit } from './audit.repo';

export async function safeAudit(params: {
  action: 'PROFILE_VERIFY' | 'PROFILE_REJECT' | 'GIST_APPROVE' | 'GIST_REJECT' | 'REPORT_ACCEPT' | 'REPORT_REJECT';
  target_type: 'PROFILE' | 'GIST';
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
