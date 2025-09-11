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
  listRecent: (limit?: number, cursor?: string) =>
    gistRepo.listRecent(limit, cursor),
  listByUser: (avitag: string, limit?: number, cursor?: string) =>
    gistRepo.listByUser(avitag, limit, cursor),
  trending: (limit?: number) => gistRepo.trending(limit),
  search: (term: string, limit?: number, offset?: number) =>
    gistRepo.search(term, limit, offset),
  report: (gist_id: string, reporter_avitag: string, reason: string | null) =>
    gistRepo.report(gist_id, reporter_avitag, reason),
  incrementView: (gist_id: string, avitag: string | null) =>
    gistRepo.incrementView(gist_id, avitag),
};
