"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEventCommentSchema = exports.createEventCommentSchema = void 0;
const zod_1 = require("zod");
exports.createEventCommentSchema = zod_1.z.object({
    event_id: zod_1.z.string().uuid(),
    text: zod_1.z.string().min(1).max(500),
});
exports.updateEventCommentSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(500),
});
