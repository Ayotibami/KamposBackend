import * as gistRepo from "./gist.repo";
import { getCampusMajor } from "../profile/utils";

export const GistService = {
  create: async (avitag: string, account_id: string, profile_id: string, profile_type: string, gist_text: string) => {
    const { campus_tag, major_tag } = await getCampusMajor(avitag);
    return gistRepo.create(avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag);
  },
  updateText: (gist_id: string, avitag: string, gist_text: string) =>
    gistRepo.updateText(gist_id, avitag, gist_text),
  deleteByOwner: (gist_id: string, avitag: string) =>
    gistRepo.remove(gist_id, avitag),
  deleteAsIdiot: (gist_id: string) => gistRepo.removeAsIdiot(gist_id),
  findById: (gist_id: string) => gistRepo.findById(gist_id),
  findWithCounts: (gist_id: string, viewerAvitag?: string) => gistRepo.findWithCounts(gist_id, viewerAvitag),
  findWithCountsAnyStatus: (gist_id: string, viewerAvitag?: string) => gistRepo.findWithCountsAnyStatus(gist_id, viewerAvitag),
  listRecent: (limit?: number, cursor?: string, viewerAvitag?: string, filters?: { campus_tag?: string | null; major_tag?: string | null }) =>
    gistRepo.listRecent(limit, cursor, viewerAvitag, filters),
  listByUser: (avitag: string, limit?: number, cursor?: string, viewerAvitag?: string) =>
    gistRepo.listByUser(avitag, limit, cursor, viewerAvitag),
  trending: (limit?: number, viewerAvitag?: string, filters?: { campus_tag?: string | null; major_tag?: string | null }) =>
    gistRepo.trending(limit, viewerAvitag, filters),
  search: (term: string, limit?: number, offset?: number, viewerAvitag?: string, filters?: { campus_tag?: string | null; major_tag?: string | null }) =>
    gistRepo.search(term, limit, offset, viewerAvitag, filters),
  getCounts: (gist_id: string) => gistRepo.getCounts(gist_id),
  getCountsFull: (gist_id: string) => gistRepo.getCountsFull(gist_id),
  getReactionBreakdownForGist: (gist_id: string) => gistRepo.getReactionBreakdownForGist(gist_id),
  report: (gist_id: string, reporter_avitag: string, reason: string | null) =>
    gistRepo.report(gist_id, reporter_avitag, reason),
  incrementView: (gist_id: string, avitag: string | null) =>
    gistRepo.incrementView(gist_id, avitag),
};
