import * as gistRepo from "./gist.repo";

export const GistService = {
  create: (avitag: string, gist_text: string) =>
    gistRepo.create(avitag, gist_text),
  updateText: (gist_id: string, avitag: string, gist_text: string) =>
    gistRepo.updateText(gist_id, avitag, gist_text),
  deleteByOwner: (gist_id: string, avitag: string) =>
    gistRepo.remove(gist_id, avitag),
  deleteAsIdiot: (gist_id: string) => gistRepo.removeAsIdiot(gist_id),
  findById: (gist_id: string) => gistRepo.findById(gist_id),
  findWithCounts: (gist_id: string) => gistRepo.findWithCounts(gist_id),
  findWithCountsAnyStatus: (gist_id: string) => gistRepo.findWithCountsAnyStatus(gist_id),
  listRecent: (limit?: number, cursor?: string, viewerAvitag?: string) =>
    gistRepo.listRecent(limit, cursor, viewerAvitag),
  listByUser: (avitag: string, limit?: number, cursor?: string, viewerAvitag?: string) =>
    gistRepo.listByUser(avitag, limit, cursor, viewerAvitag),
  trending: (limit?: number, viewerAvitag?: string) => gistRepo.trending(limit, viewerAvitag),
  search: (term: string, limit?: number, offset?: number, viewerAvitag?: string) =>
    gistRepo.search(term, limit, offset, viewerAvitag),
  getCounts: (gist_id: string) => gistRepo.getCounts(gist_id),
  report: (gist_id: string, reporter_avitag: string, reason: string | null) =>
    gistRepo.report(gist_id, reporter_avitag, reason),
  incrementView: (gist_id: string, avitag: string | null) =>
    gistRepo.incrementView(gist_id, avitag),
};
