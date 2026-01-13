"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const comment_1 = require("../../schemas/comment");
const comment_controller_1 = require("./comment.controller");
const router = (0, express_1.Router)();
// Create
router.post('/', auth_1.isAuth, (0, validate_1.validateBody)(comment_1.createCommentSchema), comment_controller_1.CommentController.create);
// Read
router.get('/gist/:gist_id', auth_1.fakeAuth, comment_controller_1.CommentController.listByGist);
router.get('/user/:avitag', auth_1.fakeAuth, comment_controller_1.CommentController.listByUser);
router.get('/:comment_id', auth_1.fakeAuth, comment_controller_1.CommentController.get);
// Update
router.put('/:comment_id', auth_1.isAuth, (0, validate_1.validateBody)(comment_1.updateCommentSchema), comment_controller_1.CommentController.update);
// Delete
router.delete('/:comment_id', auth_1.isAuth, comment_controller_1.CommentController.remove);
exports.default = router;
