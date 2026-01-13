"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const idiot_1 = require("../../middleware/idiot");
const moderation_controller_1 = require("./moderation.controller");
const router = (0, express_1.Router)();
// List pending
router.get('/gists', auth_1.isAuth, idiot_1.isIdiot, moderation_controller_1.ModerationController.listPendingGists);
router.get('/profiles', auth_1.isAuth, idiot_1.isIdiot, moderation_controller_1.ModerationController.listPendingProfiles);
// Approve/Reject gists
router.post('/gists/:id/approve', auth_1.isAuth, idiot_1.isIdiot, moderation_controller_1.ModerationController.approveGist);
router.post('/gists/:id/reject', auth_1.isAuth, idiot_1.isIdiot, moderation_controller_1.ModerationController.rejectGist);
// Verify/Reject profiles
router.post('/profiles/:avitag/verify', auth_1.isAuth, idiot_1.isIdiot, moderation_controller_1.ModerationController.verifyProfile);
router.post('/profiles/:avitag/reject', auth_1.isAuth, idiot_1.isIdiot, moderation_controller_1.ModerationController.rejectProfile);
// Reports moderation
router.get('/reports', auth_1.isAuth, idiot_1.isIdiot, moderation_controller_1.ModerationController.listPendingReports);
router.post('/reports/:report_id/accept', auth_1.isAuth, idiot_1.isIdiot, moderation_controller_1.ModerationController.acceptReport);
router.post('/reports/:report_id/reject', auth_1.isAuth, idiot_1.isIdiot, moderation_controller_1.ModerationController.rejectReport);
exports.default = router;
