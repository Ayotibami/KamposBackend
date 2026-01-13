"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const gist_media_1 = require("../../schemas/gist_media");
const media_controller_1 = require("./media.controller");
const router = (0, express_1.Router)();
// List media for a gist (public)
router.get('/:gist_id/media', auth_1.fakeAuth, media_controller_1.GistMediaController.list);
// Upload new media to a gist (auth + file upload)
router.post('/:gist_id/media', auth_1.isAuth, media_controller_1.GistMediaController.upload);
// Update an existing media row (auth)
router.patch('/media/:media_id', auth_1.isAuth, (0, validate_1.validateBody)(gist_media_1.updateGistMediaSchema), media_controller_1.GistMediaController.update);
// Delete a media item (auth)
router.delete('/media/:media_id', auth_1.isAuth, media_controller_1.GistMediaController.remove);
exports.default = router;
