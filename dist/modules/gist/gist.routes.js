"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const otp_1 = require("../../middleware/otp");
const gist_controller_1 = require("./gist.controller");
const validate_1 = require("../../middleware/validate");
const gist_1 = require("../../schemas/gist");
const gist_media_1 = require("../../schemas/gist_media");
const media_controller_1 = require("./media.controller");
const router = (0, express_1.Router)();
// Create
router.post('/', auth_1.isAuth, otp_1.requireOtpVerified, (0, validate_1.validateBody)(gist_1.createGistSchema), gist_controller_1.GistController.create);
// List & discovery
router.get('/', auth_1.fakeAuth, gist_controller_1.GistController.list);
router.get('/trending', auth_1.fakeAuth, gist_controller_1.GistController.trending);
router.get('/search', auth_1.fakeAuth, gist_controller_1.GistController.search);
router.get('/user/:avitag', auth_1.fakeAuth, gist_controller_1.GistController.byUser);
router.get('/approved', auth_1.fakeAuth, gist_controller_1.GistController.list);
// Single
router.get('/:gist_id/counts', gist_controller_1.GistController.counts);
router.get('/:gist_id', auth_1.fakeAuth, gist_controller_1.GistController.get);
router.patch('/:gist_id', auth_1.isAuth, otp_1.requireOtpVerified, (0, validate_1.validateBody)(gist_1.updateGistSchema), gist_controller_1.GistController.update);
router.delete('/:gist_id', auth_1.isAuth, gist_controller_1.GistController.remove);
// Engagement
router.post('/:gist_id/report', auth_1.isAuth, otp_1.requireOtpVerified, gist_controller_1.GistController.report);
router.post('/:gist_id/view', gist_controller_1.GistController.view);
// Media reorder
router.patch('/:gist_id/media/reorder', auth_1.isAuth, (0, validate_1.validateBody)(gist_media_1.reorderGistMediaSchema), media_controller_1.GistMediaController.reorder);
exports.default = router;
