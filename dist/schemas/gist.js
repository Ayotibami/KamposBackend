"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportGistSchema = exports.updateGistSchema = exports.createGistSchema = void 0;
const zod_1 = require("zod");
exports.createGistSchema = zod_1.z.object({
    gist_text: zod_1.z.string().min(1),
});
exports.updateGistSchema = zod_1.z.object({
    gist_text: zod_1.z.string().min(1).optional(),
});
exports.reportGistSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(500).optional().nullable(),
});
