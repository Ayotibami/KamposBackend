import * as gistRepo from '../gist/gist.repo';
import * as profileRepo from '../profile/profile.repo';
import { safeAudit } from '../audit/audit.util';
import { WSGateway } from '../../ws/gateway';
import * as reportRepo from '../gist/report.repo';

export const ModerationService = {
  // Gists
  listPendingGists: (limit = 20, offset = 0) => gistRepo.listPendingGists(limit, offset),

  approveGist: async (gist_id: string, idiot_avitag: string) => {
    const updated = await gistRepo.approveGist(gist_id);
    if (!updated) return null;
    await safeAudit({ action: 'GIST_APPROVE', target_type: 'GIST', target_id: gist_id, idiot_avitag });
    // Broadcast to global feed
    WSGateway.broadcast('feed.global', { type: 'GIST_APPROVED', gist: updated });
    return updated;
  },

  rejectGist: async (gist_id: string, idiot_avitag: string, reason?: string | null) => {
    const updated = await gistRepo.rejectGist(gist_id);
    if (!updated) return null;
    await safeAudit({ action: 'GIST_REJECT', target_type: 'GIST', target_id: gist_id, idiot_avitag, reason: reason ?? null });
    try { WSGateway.broadcast('feed.global', { type: 'GIST_REJECTED', gist_id }); } catch {}
    return updated;
  },

  // Profiles
  listPendingProfiles: (limit = 20, offset = 0) => profileRepo.listPendingProfiles(limit, offset),

  verifyProfile: async (avitag: string, idiot_avitag: string) => {
    const updated = await profileRepo.verifyProfile(avitag);
    if (!updated) return null;
    await safeAudit({ action: 'PROFILE_VERIFY', target_type: 'PROFILE', target_id: avitag, idiot_avitag });
    return updated;
  },

  rejectProfile: async (avitag: string, idiot_avitag: string, reason?: string | null) => {
    await safeAudit({ action: 'PROFILE_REJECT', target_type: 'PROFILE', target_id: avitag, idiot_avitag, reason: reason ?? null });
    return { avitag };
  },

  // Reports
  listPendingReports: (limit = 20, offset = 0) => reportRepo.listPending(limit, offset),

  acceptReport: async (report_id: string, idiot_avitag: string) => {
    const { report } = await reportRepo.acceptReportAndRejectGist(report_id, idiot_avitag);
    await safeAudit({ action: 'REPORT_ACCEPT', target_type: 'GIST', target_id: report.gist_id, idiot_avitag });
    try { WSGateway.broadcast('feed.global', { type: 'GIST_REJECTED', gist_id: report.gist_id }); } catch {}
    return report;
  },

  rejectReport: async (report_id: string, idiot_avitag: string) => {
    const row = await reportRepo.rejectReport(report_id, idiot_avitag);
    if (!row) return null;
    await safeAudit({ action: 'REPORT_REJECT', target_type: 'GIST', target_id: row.gist_id, idiot_avitag });
    return row;
  },
};
