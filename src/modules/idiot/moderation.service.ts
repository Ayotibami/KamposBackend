import * as gistRepo from '../gist/gist.repo';
import * as profileRepo from '../profile/profile.repo';
import { logAudit } from '../audit/audit.repo';
import { WSGateway } from '../../ws/gateway';

export const ModerationService = {
  // Gists
  listPendingGists: (limit = 20, offset = 0) => gistRepo.listPendingGists(limit, offset),

  approveGist: async (gist_id: string, idiot_avitag: string) => {
    const updated = await gistRepo.approveGist(gist_id);
    if (!updated) return null;
    await logAudit({ action: 'GIST_APPROVE', target_type: 'GIST', target_id: gist_id, idiot_avitag });
    // Broadcast to global feed
    WSGateway.broadcast('feed.global', { type: 'GIST_APPROVED', gist: updated });
    return updated;
  },

  rejectGist: async (gist_id: string, idiot_avitag: string, reason?: string | null) => {
    const updated = await gistRepo.rejectGist(gist_id);
    if (!updated) return null;
    await logAudit({ action: 'GIST_REJECT', target_type: 'GIST', target_id: gist_id, idiot_avitag, reason: reason ?? null });
    return updated;
  },

  // Profiles
  listPendingProfiles: (limit = 20, offset = 0) => profileRepo.listPendingProfiles(limit, offset),

  verifyProfile: async (avitag: string, idiot_avitag: string) => {
    const updated = await profileRepo.verifyProfile(avitag);
    if (!updated) return null;
    await logAudit({ action: 'PROFILE_VERIFY', target_type: 'PROFILE', target_id: avitag, idiot_avitag });
    return updated;
  },

  rejectProfile: async (avitag: string, idiot_avitag: string, reason?: string | null) => {
    await logAudit({ action: 'PROFILE_REJECT', target_type: 'PROFILE', target_id: avitag, idiot_avitag, reason: reason ?? null });
    return { avitag };
  },
};
