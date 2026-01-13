import * as gistRepo from "./gist.repo";
import { getCampusMajor } from "../profile/utils";
export const GistService = {
    create: async (avitag, account_id, profile_id, profile_type, gist_text) => {
        const { campus_tag, major_tag } = await getCampusMajor(avitag);
        return gistRepo.create(avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag);
    },
    updateText: (gist_id, avitag, gist_text) => gistRepo.updateText(gist_id, avitag, gist_text),
    deleteByOwner: (gist_id, avitag) => gistRepo.remove(gist_id, avitag),
    deleteAsIdiot: (gist_id) => gistRepo.removeAsIdiot(gist_id),
    findById: (gist_id) => gistRepo.findById(gist_id),
    findWithCounts: (gist_id) => gistRepo.findWithCounts(gist_id),
    findWithCountsAnyStatus: (gist_id) => gistRepo.findWithCountsAnyStatus(gist_id),
    listRecent: (limit, cursor, viewerAvitag, filters) => gistRepo.listRecent(limit, cursor, viewerAvitag, filters),
    listByUser: (avitag, limit, cursor, viewerAvitag) => gistRepo.listByUser(avitag, limit, cursor, viewerAvitag),
    trending: (limit, viewerAvitag, filters) => gistRepo.trending(limit, viewerAvitag, filters),
    search: (term, limit, offset, viewerAvitag, filters) => gistRepo.search(term, limit, offset, viewerAvitag, filters),
    getCounts: (gist_id) => gistRepo.getCounts(gist_id),
    getCountsFull: (gist_id) => gistRepo.getCountsFull(gist_id),
    getReactionBreakdownForGist: (gist_id) => gistRepo.getReactionBreakdownForGist(gist_id),
    report: (gist_id, reporter_avitag, reason) => gistRepo.report(gist_id, reporter_avitag, reason),
    incrementView: (gist_id, avitag) => gistRepo.incrementView(gist_id, avitag),
};
