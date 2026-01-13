"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GistService = void 0;
const gistRepo = __importStar(require("./gist.repo"));
const utils_1 = require("../profile/utils");
exports.GistService = {
    create: async (avitag, account_id, profile_id, profile_type, gist_text) => {
        const { campus_tag, major_tag } = await (0, utils_1.getCampusMajor)(avitag);
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
