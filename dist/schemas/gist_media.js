"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reorderGistMediaSchema = exports.updateGistMediaSchema = void 0;
const zod_1 = require("zod");
exports.updateGistMediaSchema = zod_1.z.object({
    order_index: zod_1.z.number().int().min(0).optional(),
    thumbnail_url: zod_1.z.string().url().nullable().optional(),
    media_url: zod_1.z.string().url().optional(),
});
exports.reorderGistMediaSchema = zod_1.z.object({
    media_ids: zod_1.z.array(zod_1.z.string().uuid()).min(1),
});
