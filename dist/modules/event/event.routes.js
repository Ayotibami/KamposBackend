"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const event_controller_1 = require("./event.controller");
const router = (0, express_1.Router)();
// Create with optional thumbnail (form-data supported)
router.post('/', auth_1.isAuth, event_controller_1.EventController.create);
// List & get
router.get('/', auth_1.fakeAuth, event_controller_1.EventController.list);
router.get('/:event_id', auth_1.fakeAuth, event_controller_1.EventController.get);
// Update & delete
router.put('/:event_id', auth_1.isAuth, event_controller_1.EventController.update);
router.delete('/:event_id', auth_1.isAuth, event_controller_1.EventController.remove);
// Views
router.post('/:event_id/view', auth_1.fakeAuth, event_controller_1.EventController.view);
exports.default = router;
