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
exports.ModerationService = void 0;
const gistRepo = __importStar(require("../gist/gist.repo"));
const profileRepo = __importStar(require("../profile/profile.repo"));
const audit_util_1 = require("../audit/audit.util");
const gateway_1 = require("../../ws/gateway");
const reportRepo = __importStar(require("../gist/report.repo"));
exports.ModerationService = {
    // Gists
    listPendingGists: (limit = 20, offset = 0) => gistRepo.listPendingGists(limit, offset),
    approveGist: async (gist_id, idiot_avitag) => {
        const updated = await gistRepo.approveGist(gist_id);
        if (!updated)
            return null;
        await (0, audit_util_1.safeAudit)({ action: 'GIST_APPROVE', target_type: 'GIST', target_id: gist_id, idiot_avitag });
        // Broadcast to global feed
        gateway_1.WSGateway.broadcast('feed.global', { type: 'GIST_APPROVED', gist: updated });
        return updated;
    },
    rejectGist: async (gist_id, idiot_avitag, reason) => {
        const updated = await gistRepo.rejectGist(gist_id);
        if (!updated)
            return null;
        await (0, audit_util_1.safeAudit)({ action: 'GIST_REJECT', target_type: 'GIST', target_id: gist_id, idiot_avitag, reason: reason ?? null });
        try {
            gateway_1.WSGateway.broadcast('feed.global', { type: 'GIST_REJECTED', gist_id });
        }
        catch { }
        return updated;
    },
    // Profiles
    listPendingProfiles: (limit = 20, offset = 0) => profileRepo.listPendingProfiles(limit, offset),
    verifyProfile: async (avitag, idiot_avitag) => {
        const updated = await profileRepo.verifyProfile(avitag);
        if (!updated)
            return null;
        await (0, audit_util_1.safeAudit)({ action: 'PROFILE_VERIFY', target_type: 'PROFILE', target_id: avitag, idiot_avitag });
        return updated;
    },
    rejectProfile: async (avitag, idiot_avitag, reason) => {
        await (0, audit_util_1.safeAudit)({ action: 'PROFILE_REJECT', target_type: 'PROFILE', target_id: avitag, idiot_avitag, reason: reason ?? null });
        return { avitag };
    },
    // Reports
    listPendingReports: (limit = 20, offset = 0) => reportRepo.listPending(limit, offset),
    acceptReport: async (report_id, idiot_avitag) => {
        const { report } = await reportRepo.acceptReportAndRejectGist(report_id, idiot_avitag);
        await (0, audit_util_1.safeAudit)({ action: 'REPORT_ACCEPT', target_type: 'GIST', target_id: report.gist_id, idiot_avitag });
        try {
            gateway_1.WSGateway.broadcast('feed.global', { type: 'GIST_REJECTED', gist_id: report.gist_id });
        }
        catch { }
        return report;
    },
    rejectReport: async (report_id, idiot_avitag) => {
        const row = await reportRepo.rejectReport(report_id, idiot_avitag);
        if (!row)
            return null;
        await (0, audit_util_1.safeAudit)({ action: 'REPORT_REJECT', target_type: 'GIST', target_id: row.gist_id, idiot_avitag });
        return row;
    },
};
