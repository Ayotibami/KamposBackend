"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationController = void 0;
const moderation_service_1 = require("./moderation.service");
exports.ModerationController = {
    listPendingGists: async (req, res) => {
        const limit = Number(req.query.limit ?? 20);
        const offset = Number(req.query.offset ?? 0);
        const data = await moderation_service_1.ModerationService.listPendingGists(limit, offset);
        res.json({ success: true, data });
    },
    listPendingProfiles: async (req, res) => {
        const limit = Number(req.query.limit ?? 20);
        const offset = Number(req.query.offset ?? 0);
        const data = await moderation_service_1.ModerationService.listPendingProfiles(limit, offset);
        res.json({ success: true, data });
    },
    approveGist: async (req, res) => {
        if (!req.user?.avitag) {
            return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
        }
        const id = req.params.id;
        const updated = await moderation_service_1.ModerationService.approveGist(id, req.user.avitag);
        if (!updated)
            return res.status(404).json({ success: false, message: 'Gist not found' });
        res.json({ success: true, data: updated });
    },
    rejectGist: async (req, res) => {
        if (!req.user?.avitag) {
            return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
        }
        const id = req.params.id;
        const { reason } = req.body || {};
        const updated = await moderation_service_1.ModerationService.rejectGist(id, req.user.avitag, reason ?? null);
        if (!updated)
            return res.status(404).json({ success: false, message: 'Gist not found' });
        res.json({ success: true, data: updated });
    },
    verifyProfile: async (req, res) => {
        if (!req.user?.avitag) {
            return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
        }
        const avitag = req.params.avitag;
        const updated = await moderation_service_1.ModerationService.verifyProfile(avitag, req.user.avitag);
        if (!updated)
            return res.status(404).json({ success: false, message: 'Profile not found' });
        res.json({ success: true, data: updated });
    },
    rejectProfile: async (req, res) => {
        if (!req.user?.avitag) {
            return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
        }
        const avitag = req.params.avitag;
        const { reason } = req.body || {};
        const result = await moderation_service_1.ModerationService.rejectProfile(avitag, req.user.avitag, reason ?? null);
        res.json({ success: true, data: result });
    },
    listPendingReports: async (req, res) => {
        const limit = Number(req.query.limit ?? 20);
        const offset = Number(req.query.offset ?? 0);
        const data = await moderation_service_1.ModerationService.listPendingReports(limit, offset);
        res.json({ success: true, data });
    },
    acceptReport: async (req, res) => {
        if (!req.user?.avitag) {
            return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
        }
        const { report_id } = req.params;
        try {
            const report = await moderation_service_1.ModerationService.acceptReport(report_id, req.user.avitag);
            return res.json({ success: true, data: report });
        }
        catch (err) {
            const status = err.statusCode || 400;
            return res.status(status).json({ success: false, message: err.message || 'Unable to accept report' });
        }
    },
    rejectReport: async (req, res) => {
        if (!req.user?.avitag) {
            return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
        }
        const { report_id } = req.params;
        const row = await moderation_service_1.ModerationService.rejectReport(report_id, req.user.avitag);
        if (!row)
            return res.status(404).json({ success: false, message: 'Report not found or already reviewed' });
        return res.json({ success: true, data: row });
    },
};
