"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCommentSchema = exports.createCommentSchema = void 0;
const zod_1 = require("zod");
exports.createCommentSchema = zod_1.z.object({
    gist_id: zod_1.z.string().uuid(),
    text: zod_1.z.string().min(1).max(500),
});
exports.updateCommentSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(500),
});
