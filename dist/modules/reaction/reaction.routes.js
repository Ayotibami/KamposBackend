"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const reaction_1 = require("../../schemas/reaction");
const reaction_controller_1 = require("./reaction.controller");
const router = (0, express_1.Router)();
// Upsert
router.post('/', auth_1.isAuth, (0, validate_1.validateBody)(reaction_1.upsertReactionSchema), reaction_controller_1.ReactionController.upsert);
// Read
router.get('/entity/:entity_type/:entity_id', auth_1.fakeAuth, reaction_controller_1.ReactionController.listByEntity);
router.get('/user/:avitag', auth_1.fakeAuth, reaction_controller_1.ReactionController.listByUser);
// Delete
router.delete('/:reaction_id', auth_1.isAuth, reaction_controller_1.ReactionController.remove);
router.delete('/entity/:entity_type/:entity_id', auth_1.isAuth, reaction_controller_1.ReactionController.removeByEntity);
exports.default = router;
